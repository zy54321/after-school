/**
 * Marketplace Service Layer
 * 负责商城业务逻辑处理
 */
const dayjs = require('dayjs');
const marketplaceRepo = require('../repos/marketplaceRepo');
const walletRepo = require('../repos/walletRepo');

/**
 * 计算限制周期开始时间
 * @param {string} limitType - 限制类型：daily/weekly/monthly
 */
const getLimitStartTime = (limitType) => {
  let startTime = dayjs();
  if (limitType === 'daily') {
    startTime = startTime.startOf('day');
  } else if (limitType === 'weekly') {
    startTime = startTime.startOf('week').add(1, 'day'); // 周一开始
  } else if (limitType === 'monthly') {
    startTime = startTime.startOf('month');
  }
  return startTime.toDate();
};

/**
 * 创建订单并履约（事务内完成）
 * 
 * 流程：
 * 1. 检查幂等键 - 如果已存在相同订单则直接返回
 * 2. 校验余额
 * 3. 检查购买限制
 * 4. 写入订单
 * 5. 写入积分流水（扣分）
 * 6. 写入库存
 * 7. 提交事务
 * 
 * @param {object} params - 订单参数
 * @param {number} params.memberId - 成员ID
 * @param {number} params.offerId - Offer ID（可选，优先使用）
 * @param {number} params.skuId - SKU ID（如果没有 offerId）
 * @param {number} params.quantity - 购买数量
 * @param {string} params.idempotencyKey - 幂等键
 * @returns {object} 订单结果
 */
exports.createOrderAndFulfill = async ({
  memberId,
  offerId,
  skuId,
  quantity = 1,
  idempotencyKey
}) => {
  const pool = marketplaceRepo.getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // ========== 1. 获取成员信息 ==========
    const member = await walletRepo.getMemberById(memberId, client);
    if (!member) {
      throw new Error('成员不存在');
    }
    const parentId = member.parent_id;
    
    // ========== 2. 幂等性检查 ==========
    if (idempotencyKey) {
      const existingOrder = await marketplaceRepo.getOrderByIdempotencyKey(
        parentId, 
        idempotencyKey, 
        client
      );
      
      if (existingOrder) {
        // 已存在相同订单，直接返回成功（不重复扣分）
        await client.query('COMMIT');
        return {
          success: true,
          order: existingOrder,
          msg: '订单已处理（幂等返回）',
          idempotent: true,
        };
      }
    }
    
    // ========== 3. 获取 Offer 和 SKU 信息 ==========
    let offer, sku;
    
    if (offerId) {
      // 优先使用 offerId
      offer = await marketplaceRepo.getActiveOfferById(offerId, client);
      if (!offer) {
        throw new Error('Offer 不存在或已失效');
      }
      sku = await marketplaceRepo.getSkuById(offer.sku_id, client);
    } else if (skuId) {
      // 使用 skuId 获取默认 Offer
      sku = await marketplaceRepo.getSkuById(skuId, client);
      if (!sku) {
        throw new Error('SKU 不存在');
      }
      offer = await marketplaceRepo.getActiveOfferBySkuId(skuId, client);
      if (!offer) {
        throw new Error('没有可用的 Offer');
      }
    } else {
      throw new Error('必须提供 offerId 或 skuId');
    }
    
    if (!sku) {
      throw new Error('SKU 不存在');
    }
    
    // ========== 4. 计算总费用 ==========
    const totalCost = offer.cost * quantity;
    
    // ========== 5. 校验余额 ==========
    const balance = await walletRepo.getBalance(memberId, client);
    if (balance < totalCost) {
      throw new Error(`积分不足，当前余额: ${balance}，需要: ${totalCost}`);
    }
    
    // ========== 6. 检查购买限制 ==========
    if (sku.limit_type && sku.limit_type !== 'unlimited') {
      const startTime = getLimitStartTime(sku.limit_type);
      const orderCount = await marketplaceRepo.getOrderCountSince(
        memberId,
        sku.id,
        startTime,
        client
      );
      
      if (orderCount + quantity > sku.limit_max) {
        const limitTypeText = {
          daily: '今日',
          weekly: '本周',
          monthly: '本月',
        };
        throw new Error(
          `已达${limitTypeText[sku.limit_type] || ''}购买上限 (${sku.limit_max}次)`
        );
      }
    }
    
    // ========== 7. 检查目标成员限制 ==========
    if (sku.target_members && sku.target_members.length > 0) {
      if (!sku.target_members.includes(memberId)) {
        throw new Error('该商品不对此成员开放');
      }
    }
    
    // ========== 8. 创建订单 ==========
    const order = await marketplaceRepo.createOrder({
      parentId,
      memberId,
      offerId: offer.id,
      skuId: sku.id,
      skuName: sku.name,
      cost: totalCost,
      quantity,
      status: 'paid',
      idempotencyKey,
    }, client);
    
    // ========== 9. 创建积分流水（扣分） ==========
    const pointsLog = await walletRepo.createPointsLog({
      memberId,
      parentId,
      orderId: order.id,
      description: `兑换：${sku.name}${quantity > 1 ? ` x${quantity}` : ''}`,
      pointsChange: -totalCost,
      reasonCode: sku.type === 'auction' ? 'auction' : 'reward',
      idempotencyKey: idempotencyKey ? `points_${idempotencyKey}` : null,
    }, client);
    
    // ========== 10. 创建库存 ==========
    // 检查是否有未使用的相同 SKU
    const existingInventory = await marketplaceRepo.findUnusedInventoryItem(
      memberId,
      sku.id,
      client
    );
    
    if (existingInventory) {
      // 合并到现有库存
      await marketplaceRepo.incrementInventoryQuantity(
        existingInventory.id,
        quantity,
        client
      );
    } else {
      // 创建新库存
      await marketplaceRepo.createInventoryItem({
        memberId,
        skuId: sku.id,
        orderId: order.id,
        quantity,
        status: 'unused',
      }, client);
    }
    
    // ========== 11. 提交事务 ==========
    await client.query('COMMIT');
    
    return {
      success: true,
      order,
      pointsLog,
      msg: `兑换成功！${sku.name} 已存入背包 🎒`,
      idempotent: false,
    };
    
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * 获取成员的订单列表
 */
exports.getOrdersByMemberId = async (memberId, limit = 50) => {
  return await marketplaceRepo.getOrdersByMemberId(memberId, limit);
};

/**
 * 获取成员的库存列表
 */
exports.getInventoryByMemberId = async (memberId, status = null) => {
  return await marketplaceRepo.getInventoryByMemberId(memberId, status);
};

/**
 * 获取可用的 SKU 列表
 */
exports.getActiveSkus = async (parentId) => {
  return await marketplaceRepo.getActiveSkus(parentId);
};

// ========== 市场配置入口（Family-level）==========
// 这些方法不需要 memberId，用于展示市场目录

/**
 * 获取市场目录（Family-level 视角）
 * 
 * 用途：展示家庭市场的所有可用商品，不涉及具体成员
 * 
 * @param {number} parentId - 用户ID
 * @param {object} options - 查询选项
 * @param {string} options.type - SKU 类型筛选 (reward/auction/ticket)
 * @param {boolean} options.includeOffers - 是否包含 Offer 详情
 * @returns {object} 市场目录
 */
exports.getMarketCatalog = async (parentId, options = {}) => {
  const { type, includeOffers = true } = options;
  
  // 获取 SKU 列表
  const skus = await marketplaceRepo.getActiveSkus(parentId);
  
  // 按类型筛选
  let filteredSkus = skus;
  if (type) {
    filteredSkus = skus.filter(s => s.type === type);
  }
  
  // 获取 Offers（如果需要）
  let offers = [];
  if (includeOffers) {
    offers = await marketplaceRepo.getActiveOffers(parentId, { offerType: type });
  }
  
  // 组装目录
  const catalog = filteredSkus.map(sku => {
    const skuOffers = offers.filter(o => o.sku_id === sku.id);
    return {
      ...sku,
      offers: skuOffers,
      lowestPrice: skuOffers.length > 0 
        ? Math.min(...skuOffers.map(o => o.cost))
        : sku.base_cost,
    };
  });
  
  return {
    parentId,
    skus: catalog,
    totalSkus: catalog.length,
    totalOffers: offers.length,
  };
};

/**
 * 获取所有有效 Offers（Family-level 视角）
 * 
 * @param {number} parentId - 用户ID
 * @param {object} options - 查询选项
 * @returns {array} Offer 列表
 */
exports.getActiveOffers = async (parentId, options = {}) => {
  return await marketplaceRepo.getActiveOffers(parentId, options);
};
