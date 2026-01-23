/**
 * Mystery Shop Service Layer
 * 神秘商店业务逻辑层
 * 
 * 功能：
 * - 刷新神秘商店（生成 3-5 个折扣 offers）
 * - 获取当前商店商品
 * - 购买商品（走订单体系）
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

/**
 * 刷新神秘商店
 * 
 * 流程：
 * 1. 使当前所有神秘商店 offers 失效
 * 2. 随机选择 3-5 个 SKU
 * 3. 为每个 SKU 生成折扣 offer
 * 4. 设置限时/限购
 * 
 * @param {number} parentId - 用户ID
 * @param {number} memberId - 操作成员ID（可选，用于扣除刷新费用）
 * @param {boolean} isFree - 是否免费刷新
 * @returns {object} 刷新结果
 */
exports.refresh = async (parentId, memberId = null, isFree = true) => {
  const pool = marketplaceRepo.getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // ========== 1. 检查刷新配置 ==========
    let config = await getOrCreateConfig(parentId, client);
    
    // 检查今日刷新次数（如果需要付费刷新）
    if (!isFree && memberId) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // 如果是新的一天，重置刷新次数
      if (!config.last_refresh_at || new Date(config.last_refresh_at) < today) {
        config.refresh_count = 0;
      }
      
      // 检查是否需要付费
      if (config.refresh_count >= config.free_refresh_count) {
        // 需要付费刷新
        const balance = await walletRepo.getBalance(memberId, client);
        if (balance < config.refresh_cost) {
          throw new Error(`积分不足，刷新需要 ${config.refresh_cost} 积分`);
        }
        
        // 扣除刷新费用
        await walletRepo.createPointsLog({
          memberId,
          parentId,
          description: '神秘商店刷新',
          pointsChange: -config.refresh_cost,
          reasonCode: 'mystery_shop',
          idempotencyKey: `mystery_refresh_${parentId}_${Date.now()}`,
        }, client);
      }
    }
    
    // ========== 2. 使当前神秘商店 offers 失效 ==========
    const deactivated = await marketplaceRepo.deactivateOffersByType(parentId, 'mystery_shop', client);
    
    // ========== 3. 获取可用的 SKU 池 ==========
    const skuPool = await marketplaceRepo.getActiveSkus(parentId, client);
    if (skuPool.length === 0) {
      throw new Error('没有可用的商品，请先创建 SKU');
    }
    
    // ========== 4. 随机选择 SKU ==========
    const { minOffers, maxOffers } = DISCOUNT_CONFIG;
    const offerCount = Math.floor(Math.random() * (maxOffers - minOffers + 1)) + minOffers;
    const selectedSkus = randomPick(skuPool, offerCount);
    
    // ========== 5. 生成折扣 offers ==========
    const validFrom = new Date();
    const validUntil = new Date(Date.now() + DISCOUNT_CONFIG.validHours * 3600000);
    
    const createdOffers = [];
    
    for (const sku of selectedSkus) {
      const discountRate = randomDiscount();
      const baseCost = sku.default_cost || sku.base_cost || 10;
      const discountedCost = Math.max(1, Math.floor(baseCost * discountRate));
      
      const offer = await marketplaceRepo.createOffer({
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
      });
    }
    
    // ========== 6. 更新配置 ==========
    await updateConfig(parentId, {
      lastRefreshAt: new Date(),
      refreshCount: (config.refresh_count || 0) + 1,
    }, client);
    
    await client.query('COMMIT');
    
    return {
      success: true,
      msg: `神秘商店已刷新，发现 ${createdOffers.length} 件特惠商品！`,
      offers: createdOffers,
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
 * 获取当前神秘商店商品
 */
exports.getShopOffers = async (parentId) => {
  const offers = await marketplaceRepo.getOffersByType(parentId, 'mystery_shop');
  
  // 添加额外信息
  return offers.map(offer => ({
    ...offer,
    original_cost: offer.metadata?.originalCost || offer.sku_base_cost,
    savings: offer.metadata?.savings || (offer.sku_base_cost - offer.cost),
    discount_percent: offer.discount_rate ? Math.round((1 - offer.discount_rate) * 100) : null,
  }));
};

/**
 * 获取商店配置
 */
exports.getShopConfig = async (parentId) => {
  const pool = marketplaceRepo.getPool();
  return await getOrCreateConfig(parentId, pool);
};

/**
 * 检查是否可以购买（限购检查）
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
