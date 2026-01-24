/**
 * Mystery Shop Service Layer
 * 神秘商店业务逻辑层
 * 
 * 核心概念：
 * - 神秘商店是 Family-level 配置，全家共享同一个商店
 * - 每次刷新生成一个 rotation，所有成员看到相同的商品
 * - 刷新费用由具体成员支付，但商店内容对全家开放
 * 
 * 功能：
 * - 刷新神秘商店（生成 3-5 个折扣 offers）
 * - 获取当前商店商品（Family-level）
 * - 购买商品（Member-level，走订单体系）
 */
const marketplaceRepo = require('../repos/marketplaceRepo');
const walletRepo = require('../repos/walletRepo');

/**
 * 折扣配置
 */
const DISCOUNT_CONFIG = {
  // 折扣率范围
  minDiscount: 0.5,  // 最低5折
  maxDiscount: 0.9,  // 最高9折
  
  // 生成数量范围
  minOffers: 3,
  maxOffers: 5,
  
  // 限购配置
  defaultLimitPerMember: 1,
  
  // 有效期（小时）
  validHours: 24,
  
  // 刷新成本
  refreshCost: 10,
  freeRefreshCount: 1,
};

/**
 * 从数组中随机抽取指定数量的元素（不重复）
 */
const randomPick = (array, count) => {
  if (array.length <= count) return [...array];
  
  const result = [];
  const used = new Set();
  
  while (result.length < count && result.length < array.length) {
    const index = Math.floor(Math.random() * array.length);
    if (!used.has(index)) {
      used.add(index);
      result.push(array[index]);
    }
  }
  
  return result;
};

/**
 * 生成随机折扣率
 */
const randomDiscount = () => {
  const { minDiscount, maxDiscount } = DISCOUNT_CONFIG;
  // 生成 0.5 - 0.9 之间的折扣率，精确到小数点后一位
  const discount = minDiscount + Math.random() * (maxDiscount - minDiscount);
  return Math.round(discount * 10) / 10;
};

// ========== Rotation 管理（Family-level）==========

/**
 * 获取当前活跃的 rotation
 */
async function getActiveRotation(parentId, client) {
  const result = await client.query(
    `SELECT * FROM mystery_shop_rotation 
     WHERE parent_id = $1 AND status = 'active' AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [parentId]
  );
  return result.rows[0];
}

/**
 * 创建新的 rotation
 */
async function createRotation(parentId, options, client) {
  const { expiresAt, offerCount, refreshType, payerMemberId, config } = options;
  
  const result = await client.query(
    `INSERT INTO mystery_shop_rotation 
     (parent_id, expires_at, offer_count, refresh_type, payer_member_id, config, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'active')
     RETURNING *`,
    [parentId, expiresAt, offerCount, refreshType, payerMemberId, JSON.stringify(config || {})]
  );
  return result.rows[0];
}

/**
 * 将旧的 rotation 标记为已替换
 */
async function replaceOldRotations(parentId, client) {
  await client.query(
    `UPDATE mystery_shop_rotation 
     SET status = 'replaced', updated_at = NOW()
     WHERE parent_id = $1 AND status = 'active'`,
    [parentId]
  );
}

/**
 * 刷新神秘商店（Family-level）
 * 
 * 核心规则：
 * - 刷新是家庭级的，每次只生成一个 rotation
 * - 所有家庭成员看到相同的商品
 * - 付费刷新时，member_id 是付款人，但商品对全家开放
 * 
 * 流程：
 * 1. 检查刷新配置
 * 2. 如需付费，扣除付款成员积分
 * 3. 使当前 rotation 失效
 * 4. 创建新 rotation
 * 5. 生成折扣 offers
 * 
 * @param {number} parentId - 用户ID（家庭标识）
 * @param {number} payerMemberId - 付款成员ID（可选，仅付费刷新时使用）
 * @param {boolean} isFree - 是否免费刷新
 * @returns {object} 刷新结果
 */
exports.refresh = async (parentId, payerMemberId = null, isFree = true) => {
  const pool = marketplaceRepo.getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // ========== 1. 检查刷新配置 ==========
    let config = await getOrCreateConfig(parentId, client);
    
    // 检查今日刷新次数
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 如果是新的一天，重置刷新次数
    if (!config.last_refresh_at || new Date(config.last_refresh_at) < today) {
      config.refresh_count = 0;
    }
    
    // 确定刷新类型
    let refreshType = 'free';
    
    // 检查是否需要付费
    if (config.refresh_count >= config.free_refresh_count) {
      refreshType = 'paid';
      
      if (!payerMemberId) {
        throw new Error('免费刷新次数已用完，需要指定付款成员');
      }
      
      if (!isFree) {
        // 需要付费刷新
        const balance = await walletRepo.getBalance(payerMemberId, client);
        if (balance < config.refresh_cost) {
          throw new Error(`积分不足，刷新需要 ${config.refresh_cost} 积分`);
        }
        
        // 扣除刷新费用
        await walletRepo.createPointsLog({
          memberId: payerMemberId,
          parentId,
          description: '神秘商店刷新',
          pointsChange: -config.refresh_cost,
          reasonCode: 'mystery_shop_refresh',
          idempotencyKey: `mystery_refresh_${parentId}_${Date.now()}`,
        }, client);
      }
    }
    
    // ========== 2. 使当前 rotation 失效 ==========
    await replaceOldRotations(parentId, client);
    
    // ========== 3. 使当前神秘商店 offers 失效 ==========
    const deactivated = await marketplaceRepo.deactivateOffersByType(parentId, 'mystery_shop', client);
    
    // ========== 4. 获取可用的 SKU 池 ==========
    const skuPool = await marketplaceRepo.getActiveSkus(parentId, client);
    if (skuPool.length === 0) {
      throw new Error('没有可用的商品，请先创建 SKU');
    }
    
    // ========== 5. 随机选择 SKU ==========
    const { minOffers, maxOffers } = DISCOUNT_CONFIG;
    const offerCount = Math.floor(Math.random() * (maxOffers - minOffers + 1)) + minOffers;
    const selectedSkus = randomPick(skuPool, offerCount);
    
    // ========== 6. 创建新 rotation ==========
    const validFrom = new Date();
    const validUntil = new Date(Date.now() + DISCOUNT_CONFIG.validHours * 3600000);
    
    const rotation = await createRotation(parentId, {
      expiresAt: validUntil,
      offerCount: selectedSkus.length,
      refreshType,
      payerMemberId: refreshType === 'paid' ? payerMemberId : null,
      config: {
        discountConfig: DISCOUNT_CONFIG,
        skuCount: skuPool.length,
      },
    }, client);
    
    // ========== 7. 生成折扣 offers ==========
    const createdOffers = [];
    
    for (const sku of selectedSkus) {
      const discountRate = randomDiscount();
      const baseCost = sku.default_cost || sku.base_cost || 10;
      const discountedCost = Math.max(1, Math.floor(baseCost * discountRate));
      
      const offer = await marketplaceRepo.createOffer({
        parentId,  // 供给侧配置必须包含 parent_id
        skuId: sku.id,
        cost: discountedCost,
        quantity: 1,
        validFrom,
        validUntil,
        isActive: true,
        offerType: 'mystery_shop',
        discountRate,
        limitPerMember: DISCOUNT_CONFIG.defaultLimitPerMember,
        metadata: {
          rotationId: rotation.id,  // 关联 rotation
          originalCost: baseCost,
          savings: baseCost - discountedCost,
        },
      }, client);
      
      createdOffers.push({
        ...offer,
        sku_name: sku.name,
        sku_icon: sku.icon,
        sku_description: sku.description,
        original_cost: baseCost,
        savings: baseCost - discountedCost,
        rotation_id: rotation.id,
      });
    }
    
    // ========== 8. 更新配置 ==========
    await updateConfig(parentId, {
      lastRefreshAt: new Date(),
      refreshCount: (config.refresh_count || 0) + 1,
    }, client);
    
    await client.query('COMMIT');
    
    return {
      success: true,
      msg: `神秘商店已刷新，发现 ${createdOffers.length} 件特惠商品！`,
      offers: createdOffers,
      rotation: {
        id: rotation.id,
        expiresAt: rotation.expires_at,
        refreshType,
        payerMemberId: refreshType === 'paid' ? payerMemberId : null,
      },
      validUntil,
      deactivatedCount: deactivated.length,
    };
    
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * 获取当前神秘商店商品（Family-level）
 * 
 * 说明：不需要 memberId，返回家庭共享的商店内容
 * 
 * @param {number} parentId - 用户ID（家庭标识）
 * @returns {array} 商店商品列表
 */
exports.getShopOffers = async (parentId) => {
  const pool = marketplaceRepo.getPool();
  
  // 获取当前活跃 rotation
  const rotation = await getActiveRotation(parentId, pool);
  
  // 获取商品
  const offers = await marketplaceRepo.getOffersByType(parentId, 'mystery_shop');
  
  // 添加额外信息
  return offers.map(offer => ({
    ...offer,
    original_cost: offer.metadata?.originalCost || offer.sku_base_cost,
    savings: offer.metadata?.savings || (offer.sku_base_cost - offer.cost),
    discount_percent: offer.discount_rate ? Math.round((1 - offer.discount_rate) * 100) : null,
    rotation_id: offer.metadata?.rotationId || rotation?.id,
  }));
};

/**
 * 获取当前 Rotation 信息（Family-level）
 * 
 * @param {number} parentId - 用户ID
 * @returns {object|null} 当前轮次信息
 */
exports.getCurrentRotation = async (parentId) => {
  const pool = marketplaceRepo.getPool();
  return await getActiveRotation(parentId, pool);
};

/**
 * 获取商店配置
 */
exports.getShopConfig = async (parentId) => {
  const pool = marketplaceRepo.getPool();
  return await getOrCreateConfig(parentId, pool);
};

/**
 * 获取商店概览（Family-level）
 * 
 * 包含：当前轮次、商品列表、配置信息
 * 
 * @param {number} parentId - 用户ID
 * @returns {object} 商店概览
 */
exports.getShopOverview = async (parentId) => {
  const pool = marketplaceRepo.getPool();
  
  const [rotation, offers, config] = await Promise.all([
    getActiveRotation(parentId, pool),
    this.getShopOffers(parentId),
    getOrCreateConfig(parentId, pool),
  ]);
  
  return {
    parentId,
    rotation: rotation ? {
      id: rotation.id,
      expiresAt: rotation.expires_at,
      generatedAt: rotation.generated_at,
      offerCount: rotation.offer_count,
      refreshType: rotation.refresh_type,
      status: rotation.status,
    } : null,
    offers,
    config: {
      refreshCost: config.refresh_cost,
      freeRefreshCount: config.free_refresh_count,
      todayRefreshCount: config.refresh_count || 0,
      lastRefreshAt: config.last_refresh_at,
      canFreeRefresh: (config.refresh_count || 0) < config.free_refresh_count,
    },
  };
};

/**
 * 检查是否可以购买（限购检查）
 * 
 * 说明：限购是按成员计算的，同一家庭不同成员可以分别购买
 * 
 * @param {number} offerId - Offer ID
 * @param {number} memberId - 成员ID
 */
exports.canPurchase = async (offerId, memberId) => {
  const pool = marketplaceRepo.getPool();
  
  // 获取 offer 信息
  const offer = await marketplaceRepo.getActiveOfferById(offerId, pool);
  if (!offer) {
    return { canPurchase: false, reason: 'Offer 不存在或已过期' };
  }
  
  if (offer.offer_type !== 'mystery_shop') {
    return { canPurchase: true }; // 非神秘商店商品不受限购限制
  }
  
  // 检查限购
  if (offer.limit_per_member) {
    const purchaseCount = await marketplaceRepo.getOfferPurchaseCount(offerId, memberId, pool);
    if (purchaseCount >= offer.limit_per_member) {
      return { 
        canPurchase: false, 
        reason: `限购 ${offer.limit_per_member} 件，已购买 ${purchaseCount} 件` 
      };
    }
  }
  
  return { canPurchase: true };
};

// ========== 内部辅助函数 ==========

/**
 * 获取或创建商店配置
 */
async function getOrCreateConfig(parentId, client) {
  let result = await client.query(
    'SELECT * FROM mystery_shop_config WHERE parent_id = $1',
    [parentId]
  );
  
  if (result.rows.length === 0) {
    // 创建默认配置
    result = await client.query(
      `INSERT INTO mystery_shop_config (parent_id, refresh_cost, free_refresh_count)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [parentId, DISCOUNT_CONFIG.refreshCost, DISCOUNT_CONFIG.freeRefreshCount]
    );
  }
  
  return result.rows[0];
}

/**
 * 更新商店配置
 */
async function updateConfig(parentId, updates, client) {
  const { lastRefreshAt, refreshCount } = updates;
  
  await client.query(
    `UPDATE mystery_shop_config 
     SET last_refresh_at = COALESCE($2, last_refresh_at),
         refresh_count = COALESCE($3, refresh_count)
     WHERE parent_id = $1`,
    [parentId, lastRefreshAt, refreshCount]
  );
}
