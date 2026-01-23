/**
 * Marketplace Controller - v2 API
 * 商城接口控制层
 */
const marketplaceService = require('../services/marketplaceService');
const marketplaceRepo = require('../repos/marketplaceRepo');
const walletService = require('../services/walletService');

/**
 * GET /api/v2/skus
 * 获取可用的 SKU 列表
 */
exports.getSkus = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const skus = await marketplaceService.getActiveSkus(userId);
    
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
 * 刷新神秘商店
 */
exports.refreshMysteryShop = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { member_id: memberId, is_free: isFree = true } = req.body;

    // 演示模式检查
    if (req.session.user.username === 'visitor') {
      return res.status(403).json({ code: 403, msg: '演示模式：游客账号仅供查看，禁止修改数据' });
    }

    // 如果需要付费刷新，需要验证成员归属
    if (!isFree && memberId) {
      const member = await walletService.getMemberById(parseInt(memberId));
      if (!member || member.parent_id !== userId) {
        return res.status(403).json({ code: 403, msg: '无权操作该成员' });
      }
    }

    const result = await mysteryShopService.refresh(
      userId,
      memberId ? parseInt(memberId) : null,
      isFree !== false
    );

    res.json({
      code: 200,
      data: {
        offers: result.offers,
        validUntil: result.validUntil,
      },
      msg: result.msg,
    });
  } catch (err) {
    console.error('refreshMysteryShop 错误:', err);
    
    if (err.message.includes('积分不足')) {
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
 * 获取神秘商店商品
 */
exports.getMysteryShop = async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    const offers = await mysteryShopService.getShopOffers(userId);
    const config = await mysteryShopService.getShopConfig(userId);

    res.json({
      code: 200,
      data: {
        offers,
        total: offers.length,
        config: {
          lastRefreshAt: config.last_refresh_at,
          refreshCount: config.refresh_count,
          refreshCost: config.refresh_cost,
          freeRefreshCount: config.free_refresh_count,
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
