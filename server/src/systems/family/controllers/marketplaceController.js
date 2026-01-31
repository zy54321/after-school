/**
 * Marketplace Controller - v2 API
 * 商城接口控制层
 */
const marketplaceService = require('../services/marketplaceService');
const marketplaceRepo = require('../repos/marketplaceRepo');
const walletService = require('../services/walletService');
const familyRepo = require('../repos/familyRepo');
const walletRepo = require('../repos/walletRepo');
const lotteryRepo = require('../repos/lotteryRepo');

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
 * GET /api/v2/admin/skus
 * 获取家庭自定义 SKU 列表（管理后台）
 */
exports.getAdminSkus = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const skus = await marketplaceRepo.getSkusByParentId(userId);

    res.json({
      code: 200,
      data: {
        skus,
        total: skus.length,
      },
    });
  } catch (err) {
    console.error('getAdminSkus 错误:', err);
    res.status(500).json({ code: 500, msg: '获取 SKU 失败', error: err.message });
  }
};

/**
 * POST /api/v2/skus
 * 创建 SKU（家庭配置）
 */
exports.createSku = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const {
      name,
      description,
      icon,
      type,
      base_cost: baseCost,
      limit_type: limitType,
      limit_max: limitMax,
      target_members: targetMembers,
      is_active: isActive,
      source_type: sourceType,
      source_id: sourceId,
      source_meta: sourceMeta,
      ticket_type_id: ticketTypeId,
      weight_score: weightScore
    } = req.body;

    if (!name) {
      return res.status(400).json({ code: 400, msg: 'SKU 名称不能为空' });
    }

    // 禁止创建 service 类型
    if (type === 'service') {
      return res.status(400).json({ code: 400, msg: 'service 类型已废弃，请使用 permission 类型' });
    }

    // 校验 permission 类型必须包含 duration_minutes 或 uses
    if (type === 'permission') {
      const { duration_minutes: durationMinutes, uses } = req.body;
      if ((!durationMinutes || durationMinutes <= 0) && (!uses || uses <= 0)) {
        return res.status(400).json({ 
          code: 400, 
          msg: 'permission 类型商品必须包含 duration_minutes 或 uses 至少一个' 
        });
      }
    }

    // 校验 weight_score
    if (weightScore !== undefined && (weightScore < 0 || weightScore > 100)) {
      return res.status(400).json({ code: 400, msg: 'weight_score 必须在 0~100 范围内' });
    }

    const sku = await marketplaceRepo.createSku({
      parentId: userId,
      name,
      description,
      icon,
      type,
      baseCost,
      limitType,
      limitMax,
      targetMembers,
      isActive,
      sourceType,
      sourceId,
      sourceMeta,
      weightScore: weightScore !== undefined ? weightScore : 0,
      fulfillmentMode,
      verification,
      durationMinutes,
      uses
    });

    if (ticketTypeId) {
      const ticketType = await lotteryRepo.getTicketTypeById(parseInt(ticketTypeId));
      if (!ticketType || ticketType.parent_id !== userId) {
        return res.status(400).json({ code: 400, msg: '抽奖券类型不存在或无权限' });
      }
      await lotteryRepo.updateTicketTypeSkuId(ticketType.id, sku.id);
    }

    res.json({ code: 200, data: { sku }, msg: 'SKU 创建成功' });
  } catch (err) {
    console.error('createSku 错误:', err);
    res.status(500).json({ code: 500, msg: '创建 SKU 失败', error: err.message });
  }
};

/**
 * PUT /api/v2/skus/:id
 * 更新 SKU（家庭配置）
 */
exports.updateSku = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const skuId = parseInt(req.params.id);
    const {
      name,
      description,
      icon,
      type,
      base_cost: baseCost,
      limit_type: limitType,
      limit_max: limitMax,
      target_members: targetMembers,
      is_active: isActive,
      source_type: sourceType,
      source_id: sourceId,
      source_meta: sourceMeta,
      ticket_type_id: ticketTypeId,
      weight_score: weightScore
    } = req.body;

    const sku = await marketplaceRepo.getSkuByIdRaw(skuId);
    if (!sku || sku.parent_id !== userId) {
      return res.status(404).json({ code: 404, msg: 'SKU 不存在或无权限' });
    }

    // 禁止更新为 service 类型
    if (type === 'service') {
      return res.status(400).json({ code: 400, msg: 'service 类型已废弃，请使用 permission 类型' });
    }

    // 校验 permission 类型必须包含 duration_minutes 或 uses
    const finalType = type || sku.type;
    if (finalType === 'permission') {
      const { duration_minutes: durationMinutes, uses } = req.body;
      const currentDuration = durationMinutes !== undefined ? durationMinutes : sku.duration_minutes;
      const currentUses = uses !== undefined ? uses : sku.uses;
      if ((!currentDuration || currentDuration <= 0) && (!currentUses || currentUses <= 0)) {
        return res.status(400).json({ 
          code: 400, 
          msg: 'permission 类型商品必须包含 duration_minutes 或 uses 至少一个' 
        });
      }
    }

    // 校验 weight_score
    if (weightScore !== undefined && (weightScore < 0 || weightScore > 100)) {
      return res.status(400).json({ code: 400, msg: 'weight_score 必须在 0~100 范围内' });
    }

    const updated = await marketplaceRepo.updateSku({
      skuId,
      name: name !== undefined ? name : sku.name,
      description: description !== undefined ? description : sku.description,
      icon: icon !== undefined ? icon : sku.icon,
      type: type !== undefined ? type : sku.type,
      baseCost: baseCost !== undefined ? baseCost : sku.base_cost,
      limitType: limitType !== undefined ? limitType : sku.limit_type,
      limitMax: limitMax !== undefined ? limitMax : sku.limit_max,
      targetMembers: targetMembers !== undefined ? targetMembers : sku.target_members,
      isActive: isActive !== undefined ? isActive : sku.is_active,
      sourceType: sourceType !== undefined ? sourceType : sku.source_type,
      sourceId: sourceId !== undefined ? sourceId : sku.source_id,
      sourceMeta: sourceMeta !== undefined ? sourceMeta : sku.source_meta,
      weightScore: weightScore !== undefined ? weightScore : sku.weight_score,
      fulfillmentMode: fulfillmentMode !== undefined ? fulfillmentMode : sku.fulfillment_mode,
      verification: verification !== undefined ? verification : sku.verification,
      durationMinutes: durationMinutes !== undefined ? durationMinutes : sku.duration_minutes,
      uses: uses !== undefined ? uses : sku.uses,
    });

    if (ticketTypeId) {
      const ticketType = await lotteryRepo.getTicketTypeById(parseInt(ticketTypeId));
      if (!ticketType || ticketType.parent_id !== userId) {
        return res.status(400).json({ code: 400, msg: '抽奖券类型不存在或无权限' });
      }
      await lotteryRepo.updateTicketTypeSkuId(ticketType.id, updated.id);
    }

    res.json({ code: 200, data: { sku: updated }, msg: 'SKU 更新成功' });
  } catch (err) {
    console.error('updateSku 错误:', err);
    res.status(500).json({ code: 500, msg: '更新 SKU 失败', error: err.message });
  }
};

/**
 * DELETE /api/v2/skus/:id
 * 停用 SKU（软删除）
 */
exports.deleteSku = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const skuId = parseInt(req.params.id);

    const sku = await marketplaceRepo.getSkuByIdRaw(skuId);
    if (!sku || sku.parent_id !== userId) {
      return res.status(404).json({ code: 404, msg: 'SKU 不存在或无权限' });
    }

    const deleted = await marketplaceRepo.deactivateSku(skuId);
    res.json({ code: 200, data: { sku: deleted }, msg: 'SKU 已停用' });
  } catch (err) {
    console.error('deleteSku 错误:', err);
    res.status(500).json({ code: 500, msg: '停用 SKU 失败', error: err.message });
  }
};

/**
 * GET /api/v2/admin/offers
 * 获取家庭 Offer 列表（管理后台）
 */
exports.getAdminOffers = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const offers = await marketplaceRepo.getOffersByParentId(userId);

    res.json({
      code: 200,
      data: {
        offers,
        total: offers.length,
      },
    });
  } catch (err) {
    console.error('getAdminOffers 错误:', err);
    res.status(500).json({ code: 500, msg: '获取 Offer 失败', error: err.message });
  }
};

/**
 * POST /api/v2/offers
 * 创建 Offer（家庭配置）
 */
exports.createOffer = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const {
      sku_id: skuId,
      cost,
      quantity,
      valid_from: validFrom,
      valid_until: validUntil,
      is_active: isActive,
    } = req.body;

    if (!skuId || !cost) {
      return res.status(400).json({ code: 400, msg: 'sku_id 和 cost 必填' });
    }

    const sku = await marketplaceRepo.getSkuByIdRaw(parseInt(skuId));
    if (!sku || (sku.parent_id !== 0 && sku.parent_id !== userId)) {
      return res.status(404).json({ code: 404, msg: 'SKU 不存在或无权限' });
    }

    const offer = await marketplaceRepo.createOffer({
      parentId: userId,
      skuId: parseInt(skuId),
      cost: parseInt(cost),
      quantity: quantity ? parseInt(quantity) : 1,
      validFrom: validFrom ? new Date(validFrom) : new Date(),
      validUntil: validUntil ? new Date(validUntil) : null,
      isActive,
    });

    res.json({ code: 200, data: { offer }, msg: 'Offer 创建成功' });
  } catch (err) {
    console.error('createOffer 错误:', err);
    res.status(500).json({ code: 500, msg: '创建 Offer 失败', error: err.message });
  }
};

/**
 * PUT /api/v2/offers/:id
 * 更新 Offer（家庭配置）
 */
exports.updateOffer = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const offerId = parseInt(req.params.id);
    const {
      cost,
      quantity,
      valid_from: validFrom,
      valid_until: validUntil,
      is_active: isActive,
    } = req.body;

    const offer = await marketplaceRepo.getOfferByIdRaw(offerId);
    if (!offer || offer.parent_id !== userId) {
      return res.status(404).json({ code: 404, msg: 'Offer 不存在或无权限' });
    }

    const updated = await marketplaceRepo.updateOffer({
      offerId,
      cost: cost !== undefined ? parseInt(cost) : offer.cost,
      quantity: quantity !== undefined ? parseInt(quantity) : offer.quantity,
      validFrom: validFrom ? new Date(validFrom) : offer.valid_from,
      validUntil: validUntil ? new Date(validUntil) : offer.valid_until,
      isActive: isActive !== undefined ? isActive : offer.is_active,
    });

    res.json({ code: 200, data: { offer: updated }, msg: 'Offer 更新成功' });
  } catch (err) {
    console.error('updateOffer 错误:', err);
    res.status(500).json({ code: 500, msg: '更新 Offer 失败', error: err.message });
  }
};

/**
 * DELETE /api/v2/offers/:id
 * 停用 Offer（软删除）
 */
exports.deleteOffer = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const offerId = parseInt(req.params.id);

    const offer = await marketplaceRepo.getOfferByIdRaw(offerId);
    if (!offer || offer.parent_id !== userId) {
      return res.status(404).json({ code: 404, msg: 'Offer 不存在或无权限' });
    }

    const deleted = await marketplaceRepo.deactivateOffer(offerId);
    res.json({ code: 200, data: { offer: deleted }, msg: 'Offer 已停用' });
  } catch (err) {
    console.error('deleteOffer 错误:', err);
    res.status(500).json({ code: 500, msg: '停用 Offer 失败', error: err.message });
  }
};

/**
 * GET /api/v2/family/members
 * 获取家庭成员列表（供 MemberSelector 使用）
 */
exports.getMembers = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const members = await familyRepo.getMembersByParentId(userId);

    const membersWithBalance = await Promise.all(
      members.map(async (member) => {
        const balance = await walletRepo.getBalance(member.id);
        return {
          ...member,
          balance,
        };
      })
    );

    res.json({
      code: 200,
      data: {
        members: membersWithBalance,
        total: membersWithBalance.length,
      },
    });
  } catch (err) {
    console.error('getMembers 错误:', err);
    res.status(500).json({
      code: 500,
      msg: '获取成员列表失败',
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

    const { limit } = req.query;
    const total = inventory.length;
    const items = limit ? inventory.slice(0, parseInt(limit)) : inventory;

    res.json({
      code: 200,
      data: {
        items,              // ✅ 给 MemberInventory 用
        inventory: items,   // ✅ 老字段也保留
        total,              // ✅ 给 FamilyDashboard 用
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
 * POST /api/v2/inventory/use
 * 使用库存道具
 *
 * Body:
 * - inventory_id: number (必填)
 * - quantity: number (可选，默认 1)
 */
exports.useInventory = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { inventory_id: inventoryId, quantity = 1 } = req.body;

    if (!inventoryId) return res.status(400).json({ code: 400, msg: '缺少必填参数: inventory_id' });
    const useQty = parseInt(quantity);
    if (!useQty || useQty <= 0) return res.status(400).json({ code: 400, msg: 'quantity 必须大于 0' });

    // 演示模式检查（保持你其它模块的风格）
    if (req.session.user.username === 'visitor') {
      return res.status(403).json({ code: 403, msg: '演示模式：游客账号仅供查看，禁止修改数据' });
    }

    const result = await marketplaceService.useInventoryItem({
      userId,
      inventoryId: parseInt(inventoryId),
      quantity: useQty,
    });

    res.json({
      code: 200,
      data: result,
      msg: '使用成功',
    });
  } catch (err) {
    console.error('useInventory 错误:', err);
    res.status(400).json({
      code: 400,
      msg: err.message || '使用失败',
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

    const [wallet, memberInfo] = await Promise.all([
      walletService.getWalletOverview(parseInt(memberId)),
      walletService.getMemberById(parseInt(memberId))
    ]);

    res.json({
      code: 200,
      data: {
        ...wallet,
        member: memberInfo, // 添加成员完整信息
      },
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

/**
 * POST /api/v2/admin/quick-publish
 * 一键发布商品
 */
exports.quickPublish = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const {
      name, icon, description,
      type,
      weight_score,
      cost, quantity,
      limit_type, limit_max,
      valid_until
    } = req.body;

    if (!name || !cost) {
      return res.status(400).json({ code: 400, msg: '商品名称和价格必填' });
    }

    // 校验 type 必须属于允许的类型（删除 service）
    const allowedTypes = ['item', 'permission', 'ticket'];
    if (type === 'service') {
      return res.status(400).json({ code: 400, msg: 'service 类型已废弃，请使用 permission 类型' });
    }
    if (type && !allowedTypes.includes(type)) {
      return res.status(400).json({ code: 400, msg: `商品类型必须是以下之一: ${allowedTypes.join(', ')}` });
    }

    // 校验 weight_score
    if (weight_score !== undefined && (weight_score < 0 || weight_score > 100)) {
      return res.status(400).json({ code: 400, msg: '权重必须在 0-100 之间' });
    }

    const result = await marketplaceService.publishProduct(userId, {
      name, icon, description,
      type: type || 'item',
      weight_score: weight_score !== undefined ? parseInt(weight_score) : 0,
      cost: parseInt(cost),
      quantity: quantity ? parseInt(quantity) : 999,
      limit_type: limit_type || 'unlimited',
      limit_max: limit_max ? parseInt(limit_max) : 0,
      valid_until
    });

    res.json({ code: 200, data: result, msg: '发布成功' });
  } catch (err) {
    console.error('quickPublish 错误:', err);
    res.status(500).json({ code: 500, msg: '发布失败', error: err.message });
  }
};

/**
 * PUT /api/v2/admin/quick-update/:offerId
 * 一键更新商品
 */
exports.quickUpdate = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const offerId = parseInt(req.params.offerId);
    const body = req.body;

    // 校验 type 必须属于允许的类型（若未传则不改类型，删除 service）
    if (body.type !== undefined) {
      if (body.type === 'service') {
        return res.status(400).json({ code: 400, msg: 'service 类型已废弃，请使用 permission 类型' });
      }
      const allowedTypes = ['item', 'permission', 'ticket'];
      if (!allowedTypes.includes(body.type)) {
        return res.status(400).json({ code: 400, msg: `商品类型必须是以下之一: ${allowedTypes.join(', ')}` });
      }
    }

    // 校验 weight_score
    if (body.weight_score !== undefined && (body.weight_score < 0 || body.weight_score > 100)) {
      return res.status(400).json({ code: 400, msg: '权重必须在 0-100 之间' });
    }

    await marketplaceService.updateProduct(userId, offerId, {
      ...body,
      cost: body.cost !== undefined ? parseInt(body.cost) : undefined,
      quantity: body.quantity !== undefined ? parseInt(body.quantity) : undefined,
      limit_max: body.limit_max !== undefined ? parseInt(body.limit_max) : undefined,
      weight_score: body.weight_score !== undefined ? parseInt(body.weight_score) : undefined,
      type: body.type // 允许更新类型
    });

    res.json({ code: 200, msg: '更新成功' });
  } catch (err) {
    console.error('quickUpdate 错误:', err);
    res.status(500).json({ code: 500, msg: '更新失败', error: err.message });
  }
};

/**
 * POST /api/v2/admin/offers/:offerId/disable_default
 * 下架系统默认商品（为家庭创建 override offer）
 */
exports.disableDefaultOffer = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const offerId = parseInt(req.params.offerId);

    // 权限校验：只能操作自己家庭的商品
    const result = await marketplaceService.disableSystemOfferForParent(userId, offerId);

    res.json({ code: 200, data: result, msg: result.msg });
  } catch (err) {
    console.error('disableDefaultOffer 错误:', err);
    res.status(500).json({ code: 500, msg: '下架失败', error: err.message });
  }
};

/**
 * POST /api/v2/admin/offers/:offerId/enable_default
 * 恢复系统默认商品（删除家庭 override offer）
 */
exports.enableDefaultOffer = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const offerId = parseInt(req.params.offerId);

    // 权限校验：只能操作自己家庭的商品
    const result = await marketplaceService.enableSystemOfferForParent(userId, offerId);

    res.json({ code: 200, data: result, msg: result.msg });
  } catch (err) {
    console.error('enableDefaultOffer 错误:', err);
    res.status(500).json({ code: 500, msg: '恢复失败', error: err.message });
  }
};