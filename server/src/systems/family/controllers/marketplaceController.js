/**
 * Marketplace Controller - v2 API
 * 商城接口控制层
 */
const marketplaceService = require('../services/marketplaceService');
const marketplaceRepo = require('../repos/marketplaceRepo');
const walletService = require('../services/walletService');

/**
 * GET /api/v2/skus
 * 获取可用的 SKU 列表（Family-level，不需要 member_id）
 * 
 * Query params:
 * - type: string (可选，筛选 SKU 类型: reward/auction/ticket)
 */
exports.getSkus = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { type } = req.query;
    
    let skus = await marketplaceService.getActiveSkus(userId);
    
    // 按类型筛选
    if (type) {
      skus = skus.filter(s => s.type === type);
    }
    
    res.json({
      code: 200,
      data: {
        skus,
        total: skus.length,
      },
    });
  } catch (err) {
    console.error('getSkus 错误:', err);
    res.status(500).json({ 
      code: 500, 
      msg: '获取商品列表失败',
      error: err.message,
    });
  }
};

/**
 * GET /api/v2/catalog
 * 获取市场目录（Family-level，不需要 member_id）
 * 
 * Query params:
 * - type: string (可选，筛选 SKU 类型: reward/auction/ticket)
 * - include_offers: boolean (可选，是否包含 Offer，默认 true)
 */
exports.getCatalog = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { type, include_offers: includeOffers = 'true' } = req.query;
    
    const catalog = await marketplaceService.getMarketCatalog(userId, {
      type,
      includeOffers: includeOffers !== 'false',
    });
    
    res.json({
      code: 200,
      data: catalog,
    });
  } catch (err) {
    console.error('getCatalog 错误:', err);
    res.status(500).json({ 
      code: 500, 
      msg: '获取市场目录失败',
      error: err.message,
    });
  }
};

/**
 * GET /api/v2/offers
 * 获取可用的 Offer 列表
 * 
 * Query params:
 * - offer_type: 'reward' | 'auction' (可选)
 * - sku_id: number (可选)
 */
exports.getOffers = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { offer_type: offerType, sku_id: skuId } = req.query;
    
    const offers = await marketplaceRepo.getActiveOffers(userId, {
      offerType,
      skuId: skuId ? parseInt(skuId) : undefined,
    });
    
    res.json({
      code: 200,
      data: {
        offers,
        total: offers.length,
      },
    });
  } catch (err) {
    console.error('getOffers 错误:', err);
    res.status(500).json({ 
      code: 500, 
      msg: '获取报价列表失败',
      error: err.message,
    });
  }
};

/**
 * POST /api/v2/orders
 * 创建订单并履约
 * 
 * Body:
 * - offer_id: number (必填)
 * - buyer_member_id: number (必填)
 * - idempotency_key: string (必填)
 * - quantity: number (可选，默认 1)
 * - extra: object (可选，扩展字段)
 */
exports.createOrder = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { 
      offer_id: offerId, 
      buyer_member_id: buyerMemberId, 
      idempotency_key: idempotencyKey,
      quantity = 1,
      extra,
    } = req.body;
    
    // ========== 参数校验 ==========
    if (!offerId) {
      return res.status(400).json({ 
        code: 400, 
        msg: '缺少必填参数: offer_id',
      });
    }
    
    if (!buyerMemberId) {
      return res.status(400).json({ 
        code: 400, 
        msg: '缺少必填参数: buyer_member_id',
      });
    }
    
    if (!idempotencyKey) {
      return res.status(400).json({ 
        code: 400, 
        msg: '缺少必填参数: idempotency_key',
      });
    }
    
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length > 100) {
      return res.status(400).json({ 
        code: 400, 
        msg: 'idempotency_key 必须是字符串且不超过100字符',
      });
    }
    
    if (quantity < 1 || quantity > 100) {
      return res.status(400).json({ 
        code: 400, 
        msg: 'quantity 必须在 1-100 之间',
      });
    }
    
    // ========== 校验成员归属 ==========
    const member = await walletService.getMemberById(buyerMemberId);
    if (!member) {
      return res.status(404).json({ 
        code: 404, 
        msg: '成员不存在',
      });
    }
    
    if (member.parent_id !== userId) {
      return res.status(403).json({ 
        code: 403, 
        msg: '无权操作该成员',
      });
    }
    
    // ========== 演示模式检查 ==========
    const user = req.session.user;
    if (user.username === 'visitor') {
      return res.status(403).json({ 
        code: 403, 
        msg: '演示模式：游客账号仅供查看，禁止修改数据',
      });
    }
    
    // ========== 调用服务层 ==========
    const result = await marketplaceService.createOrderAndFulfill({
      memberId: buyerMemberId,
      offerId: parseInt(offerId),
      quantity: parseInt(quantity),
      idempotencyKey,
    });
    
    // ========== 返回结果 ==========
    res.json({
      code: 200,
      data: {
        order: result.order,
        idempotent: result.idempotent,
      },
      msg: result.msg,
    });
    
  } catch (err) {
    console.error('createOrder 错误:', err);
    
    // 余额不足 - 返回明确错误
    if (err.message.includes('积分不足')) {
      return res.status(400).json({ 
        code: 400, 
        msg: err.message,
        error_code: 'INSUFFICIENT_BALANCE',
      });
    }
    
    // 购买限制
    if (err.message.includes('购买上限')) {
      return res.status(400).json({ 
        code: 400, 
        msg: err.message,
        error_code: 'LIMIT_EXCEEDED',
      });
    }
    
    // Offer 不存在
    if (err.message.includes('Offer 不存在') || err.message.includes('已失效')) {
      return res.status(404).json({ 
        code: 404, 
        msg: err.message,
        error_code: 'OFFER_NOT_FOUND',
      });
    }
    
    // 目标成员限制
    if (err.message.includes('不对此成员开放')) {
      return res.status(403).json({ 
        code: 403, 
        msg: err.message,
        error_code: 'MEMBER_NOT_ALLOWED',
      });
    }
    
    // 其他错误
    res.status(500).json({ 
      code: 500, 
      msg: '下单失败',
      error: err.message,
    });
  }
};

/**
 * GET /api/v2/orders
 * 获取成员的订单列表
 * 
 * Query params:
 * - member_id: number (必填)
 * - limit: number (可选，默认 50)
 */
exports.getOrders = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { member_id: memberId, limit = 50 } = req.query;
    
    if (!memberId) {
      return res.status(400).json({ 
        code: 400, 
        msg: '缺少必填参数: member_id',
      });
    }
    
    // 校验成员归属
    const member = await walletService.getMemberById(parseInt(memberId));
    if (!member || member.parent_id !== userId) {
      return res.status(403).json({ 
        code: 403, 
        msg: '无权查看该成员的订单',
      });
    }
    
    const orders = await marketplaceService.getOrdersByMemberId(
      parseInt(memberId), 
      parseInt(limit)
    );
    
    res.json({
      code: 200,
      data: {
        orders,
        total: orders.length,
      },
    });
  } catch (err) {
    console.error('getOrders 错误:', err);
    res.status(500).json({ 
      code: 500, 
      msg: '获取订单列表失败',
      error: err.message,
    });
  }
};

/**
 * GET /api/v2/inventory
 * 获取成员的库存列表
 * 
 * Query params:
 * - member_id: number (必填)
 * - status: 'unused' | 'used' | 'all' (可选)
 */
exports.getInventory = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { member_id: memberId, status } = req.query;
    
    if (!memberId) {
      return res.status(400).json({ 
        code: 400, 
        msg: '缺少必填参数: member_id',
      });
    }
    
    // 校验成员归属
    const member = await walletService.getMemberById(parseInt(memberId));
    if (!member || member.parent_id !== userId) {
      return res.status(403).json({ 
        code: 403, 
        msg: '无权查看该成员的库存',
      });
    }
    
    const inventory = await marketplaceService.getInventoryByMemberId(
      parseInt(memberId),
      status
    );
    
    res.json({
      code: 200,
      data: {
        inventory,
        total: inventory.length,
      },
    });
  } catch (err) {
    console.error('getInventory 错误:', err);
    res.status(500).json({ 
      code: 500, 
      msg: '获取库存列表失败',
      error: err.message,
    });
  }
};

/**
 * GET /api/v2/wallet
 * 获取成员钱包信息
 * 
 * Query params:
 * - member_id: number (必填)
 */
exports.getWallet = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { member_id: memberId } = req.query;
    
    if (!memberId) {
      return res.status(400).json({ 
        code: 400, 
        msg: '缺少必填参数: member_id',
      });
    }
    
    // 校验成员归属
    const member = await walletService.getMemberById(parseInt(memberId));
    if (!member || member.parent_id !== userId) {
      return res.status(403).json({ 
        code: 403, 
        msg: '无权查看该成员的钱包',
      });
    }
    
    const wallet = await walletService.getWalletOverview(parseInt(memberId));
    
    res.json({
      code: 200,
      data: wallet,
    });
  } catch (err) {
    console.error('getWallet 错误:', err);
    res.status(500).json({ 
      code: 500, 
      msg: '获取钱包信息失败',
      error: err.message,
    });
  }
};

/**
 * GET /api/v2/wallet/logs
 * 获取成员积分流水
 * 
 * Query params:
 * - member_id: number (必填)
 * - limit: number (可选，默认 50)
 * - offset: number (可选，默认 0)
 * - reason_code: string (可选)
 */
exports.getWalletLogs = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { 
      member_id: memberId, 
      limit = 50, 
      offset = 0,
      reason_code: reasonCode,
    } = req.query;
    
    if (!memberId) {
      return res.status(400).json({ 
        code: 400, 
        msg: '缺少必填参数: member_id',
      });
    }
    
    // 校验成员归属
    const member = await walletService.getMemberById(parseInt(memberId));
    if (!member || member.parent_id !== userId) {
      return res.status(403).json({ 
        code: 403, 
        msg: '无权查看该成员的流水',
      });
    }
    
    const result = await walletService.listLogs(parseInt(memberId), {
      limit: parseInt(limit),
      offset: parseInt(offset),
      reasonCode,
    });
    
    res.json({
      code: 200,
      data: result,
    });
  } catch (err) {
    console.error('getWalletLogs 错误:', err);
    res.status(500).json({ 
      code: 500, 
      msg: '获取流水列表失败',
      error: err.message,
    });
  }
};

// ========== 神秘商店 ==========

const mysteryShopService = require('../services/mysteryShopService');

/**
 * POST /api/v2/mystery-shop/refresh
 * 刷新神秘商店（Family-level，全家共享）
 * 
 * Body:
 * - payer_member_id: number (可选，付费刷新时的付款成员)
 * - is_free: boolean (可选，是否免费刷新，默认 true)
 * 
 * 说明：
 * - 刷新是家庭级的，所有成员看到相同的商品
 * - 付费刷新时，payer_member_id 是付款人，商品仍对全家开放
 */
exports.refreshMysteryShop = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { 
      member_id: memberId,  // 兼容旧字段
      payer_member_id: payerMemberId,  // 新字段
      is_free: isFree = true 
    } = req.body;
    
    // 优先使用新字段
    const actualPayerId = payerMemberId || memberId;

    // 演示模式检查
    if (req.session.user.username === 'visitor') {
      return res.status(403).json({ code: 403, msg: '演示模式：游客账号仅供查看，禁止修改数据' });
    }

    // 如果需要付费刷新，需要验证成员归属
    if (!isFree && actualPayerId) {
      const member = await walletService.getMemberById(parseInt(actualPayerId));
      if (!member || member.parent_id !== userId) {
        return res.status(403).json({ code: 403, msg: '无权操作该成员' });
      }
    }

    const result = await mysteryShopService.refresh(
      userId,
      actualPayerId ? parseInt(actualPayerId) : null,
      isFree !== false
    );

    res.json({
      code: 200,
      data: {
        offers: result.offers,
        rotation: result.rotation,  // 新增：返回 rotation 信息
        validUntil: result.validUntil,
      },
      msg: result.msg,
    });
  } catch (err) {
    console.error('refreshMysteryShop 错误:', err);
    
    if (err.message.includes('积分不足') || err.message.includes('免费刷新次数')) {
      return res.status(400).json({ code: 400, msg: err.message });
    }
    
    res.status(500).json({
      code: 500,
      msg: '刷新神秘商店失败',
      error: err.message,
    });
  }
};

/**
 * GET /api/v2/mystery-shop
 * 获取神秘商店商品（Family-level，不需要 member_id）
 * 
 * 说明：
 * - 神秘商店是家庭共享的，所有成员看到相同的商品
 * - 返回当前活跃的 rotation 及其商品
 */
exports.getMysteryShop = async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    const offers = await mysteryShopService.getShopOffers(userId);
    const config = await mysteryShopService.getShopConfig(userId);
    const rotation = await mysteryShopService.getCurrentRotation(userId);

    res.json({
      code: 200,
      data: {
        offers,
        total: offers.length,
        rotation: rotation ? {
          id: rotation.id,
          expiresAt: rotation.expires_at,
          generatedAt: rotation.generated_at,
          refreshType: rotation.refresh_type,
        } : null,
        config: {
          lastRefreshAt: config.last_refresh_at,
          refreshCount: config.refresh_count,
          refreshCost: config.refresh_cost,
          freeRefreshCount: config.free_refresh_count,
          canFreeRefresh: (config.refresh_count || 0) < config.free_refresh_count,
        },
      },
    });
  } catch (err) {
    console.error('getMysteryShop 错误:', err);
    res.status(500).json({
      code: 500,
      msg: '获取神秘商店失败',
      error: err.message,
    });
  }
};

/**
 * GET /api/v2/mystery-shop/overview
 * 获取神秘商店概览（Family-level，不需要 member_id）
 * 
 * 包含完整的商店状态：rotation、offers、config
 */
exports.getMysteryShopOverview = async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    const overview = await mysteryShopService.getShopOverview(userId);

    res.json({
      code: 200,
      data: overview,
    });
  } catch (err) {
    console.error('getMysteryShopOverview 错误:', err);
    res.status(500).json({
      code: 500,
      msg: '获取神秘商店概览失败',
      error: err.message,
    });
  }
};
