/**
 * Auction Controller - v2 API
 * 拍卖接口控制层
 */
const auctionService = require('../services/auctionService');
const walletService = require('../services/walletService');

/**
 * POST /api/v2/auction/sessions
 * 创建拍卖场次
 */
exports.createSession = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { title, scheduled_at: scheduledAt, config } = req.body;

    // 参数校验
    if (!title) {
      return res.status(400).json({ code: 400, msg: '缺少必填参数: title' });
    }

    // 演示模式检查
    if (req.session.user.username === 'visitor') {
      return res.status(403).json({ code: 403, msg: '演示模式：游客账号仅供查看，禁止修改数据' });
    }

    const session = await auctionService.createSession({
      parentId: userId,
      title,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      config: config || {},
    });

    res.json({
      code: 200,
      data: { session },
      msg: '拍卖场次创建成功',
    });
  } catch (err) {
    console.error('createSession 错误:', err);
    res.status(500).json({ code: 500, msg: '创建场次失败', error: err.message });
  }
};

/**
 * GET /api/v2/auction/sessions
 * 获取拍卖场次列表（Family-level，不需要 member_id）
 * 
 * Query params:
 * - status: string (可选，筛选状态: draft/scheduled/active/ended)
 */
exports.getSessions = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { status } = req.query;

    const sessions = await auctionService.getSessionsByParentId(userId, status);

    res.json({
      code: 200,
      data: { sessions, total: sessions.length },
    });
  } catch (err) {
    console.error('getSessions 错误:', err);
    res.status(500).json({ code: 500, msg: '获取场次列表失败', error: err.message });
  }
};

/**
 * GET /api/v2/auction/overview
 * 获取拍卖概览（Family-level，不需要 member_id）
 */
exports.getOverview = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { status } = req.query;

    const overview = await auctionService.getAuctionOverview(userId, { status });

    res.json({
      code: 200,
      data: overview,
    });
  } catch (err) {
    console.error('getOverview 错误:', err);
    res.status(500).json({ code: 500, msg: '获取拍卖概览失败', error: err.message });
  }
};

/**
 * GET /api/v2/auction/sessions/:id
 * 获取场次详情（含拍卖品列表）
 */
exports.getSessionDetail = async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);

    if (!sessionId) {
      return res.status(400).json({ code: 400, msg: '无效的场次ID' });
    }

    const data = await auctionService.getSessionWithLots(sessionId);

    res.json({
      code: 200,
      data,
    });
  } catch (err) {
    console.error('getSessionDetail 错误:', err);

    if (err.message.includes('不存在')) {
      return res.status(404).json({ code: 404, msg: err.message });
    }

    res.status(500).json({ code: 500, msg: '获取场次详情失败', error: err.message });
  }
};

/**
 * POST /api/v2/auction/sessions/:id/lots/preview-generate
 * 预览生成拍品（不落库）
 */
exports.previewGenerateLots = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const sessionId = parseInt(req.params.id);
    
    if (!sessionId) {
      return res.status(400).json({ code: 400, msg: '无效的场次ID' });
    }
    
    const {
      count,
      seed,
      unique = false,
      rarity_weights,
      filters,
      locked_sku_ids,
      counts, // 直接指定各稀有度数量
    } = req.body;
    
    const result = await auctionService.previewGenerateLots(sessionId, {
      count,
      seed,
      unique,
      rarity_weights,
      filters,
      locked_sku_ids,
      counts,
    });
    
    res.json({ code: 200, data: result, msg: '预览生成成功' });
  } catch (err) {
    console.error('previewGenerateLots 错误:', err);
    res.status(500).json({ code: 500, msg: err.message || '预览生成失败' });
  }
};

/**
 * POST /api/v2/auction/sessions/:id/lots/commit-generate
 * 确认生成拍品（落库）
 */
exports.commitGenerateLots = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const sessionId = parseInt(req.params.id);
    
    if (!sessionId) {
      return res.status(400).json({ code: 400, msg: '无效的场次ID' });
    }
    
    const { seed, preview_lots, replace = false } = req.body;
    
    if (!seed || !Array.isArray(preview_lots) || preview_lots.length === 0) {
      return res.status(400).json({ code: 400, msg: '缺少必填参数: seed, preview_lots' });
    }
    
    const result = await auctionService.commitGenerateLots(sessionId, userId, {
      seed,
      preview_lots,
      replace,
    });
    
    res.json({ code: 200, data: result, msg: result.msg || '拍品已生成' });
  } catch (err) {
    console.error('commitGenerateLots 错误:', err);
    res.status(500).json({ code: 500, msg: err.message || '确认生成失败' });
  }
};

/**
 * POST /api/v2/auction/sessions/:id/generate-lots
 * 生成拍卖品（旧接口，保留兼容）
 */
exports.generateLots = async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);
    const { r = 0, sr = 0, ssr = 0, ur = 0 } = req.body;

    if (!sessionId) {
      return res.status(400).json({ code: 400, msg: '无效的场次ID' });
    }

    // 演示模式检查
    if (req.session.user.username === 'visitor') {
      return res.status(403).json({ code: 403, msg: '演示模式：游客账号仅供查看，禁止修改数据' });
    }

    const totalCount = r + sr + ssr + ur;
    if (totalCount === 0) {
      return res.status(400).json({ code: 400, msg: '请至少指定一个稀有度的数量' });
    }

    const result = await auctionService.generateLots(sessionId, {
      r: parseInt(r),
      sr: parseInt(sr),
      ssr: parseInt(ssr),
      ur: parseInt(ur),
    });

    if (!result.success) {
      return res.status(400).json({ code: 400, msg: result.msg, existingCount: result.existingCount });
    }

    res.json({
      code: 200,
      data: result,
      msg: result.msg,
    });
  } catch (err) {
    console.error('generateLots 错误:', err);
    res.status(500).json({ code: 500, msg: '生成拍卖品失败', error: err.message });
  }
};

/**
 * POST /api/v2/auction/sessions/:id/pool
 * 设置拍卖品池子
 */
exports.setSessionPool = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const sessionId = parseInt(req.params.id);
    const { sku_ids: skuIds } = req.body;

    if (!sessionId) {
      return res.status(400).json({ code: 400, msg: '无效的场次ID' });
    }

    if (!Array.isArray(skuIds) || skuIds.length === 0) {
      return res.status(400).json({ code: 400, msg: '请选择拍卖品池子' });
    }

    const session = await auctionService.setSessionPool(sessionId, userId, skuIds);
    res.json({ code: 200, data: { session }, msg: '拍卖品池子已设置' });
  } catch (err) {
    console.error('setSessionPool 错误:', err);
    if (err.message.includes('无权限')) {
      return res.status(403).json({ code: 403, msg: err.message });
    }
    res.status(500).json({ code: 500, msg: '设置拍卖品池子失败', error: err.message });
  }
};

/**
 * POST /api/v2/auction/sessions/:id/start
 * 开始拍卖
 */
exports.startSession = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const sessionId = parseInt(req.params.id);

    if (!sessionId) {
      return res.status(400).json({ code: 400, msg: '无效的场次ID' });
    }

    const result = await auctionService.startSession(sessionId, userId);
    res.json({ code: 200, data: result, msg: '拍卖已开始' });
  } catch (err) {
    console.error('startSession 错误:', err);
    if (err.message.includes('无权限') || err.message.includes('暂无拍品')) {
      return res.status(400).json({ code: 400, msg: err.message });
    }
    res.status(500).json({ code: 500, msg: '开始拍卖失败', error: err.message });
  }
};

/**
 * POST /api/v2/auction/sessions/:id/next
 * 进入下一拍品
 */
exports.advanceSessionLot = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const sessionId = parseInt(req.params.id);

    if (!sessionId) {
      return res.status(400).json({ code: 400, msg: '无效的场次ID' });
    }

    const result = await auctionService.advanceSessionLot(sessionId, userId);
    res.json({ code: 200, data: result, msg: '已进入下一拍品' });
  } catch (err) {
    console.error('advanceSessionLot 错误:', err);
    if (err.message.includes('无权限')) {
      return res.status(403).json({ code: 403, msg: err.message });
    }
    res.status(500).json({ code: 500, msg: '切换拍品失败', error: err.message });
  }
};

/**
 * POST /api/v2/auction/lots/:id/bids
 * 提交出价
 */
exports.submitBid = async (req, res) => {
  try {
    const lotId = parseInt(req.params.id);
    const { member_id: memberId, bid_points: bidPoints } = req.body;
    const userId = req.session.user.id;

    if (!lotId) return res.status(400).json({ code: 400, msg: '无效的拍品ID' });
    if (!memberId) return res.status(400).json({ code: 400, msg: '缺少必填参数: member_id' });
    if (!bidPoints || bidPoints <= 0) return res.status(400).json({ code: 400, msg: '出价必须大于0' });

    // 演示模式检查
    if (req.session.user.username === 'visitor') {
      return res.status(403).json({ code: 403, msg: '演示模式：游客账号仅供查看，禁止修改数据' });
    }

    // 1. 获取要操作的成员信息
    const member = await walletService.getMemberById(parseInt(memberId));

    if (!member) {
      return res.status(404).json({ code: 404, msg: `未找到ID为 ${memberId} 的成员` });
    }

    // 2. 权限校验：确保当前登录用户(家长)有权操作该成员
    // 注意：这里假设 req.session.user.id 是 parent_id
    if (member.parent_id !== userId) {
      console.warn(`[Audit] 非法操作: User ${userId} 尝试操作 Member ${memberId} (Parent: ${member.parent_id})`);
      return res.status(403).json({ code: 403, msg: '您无权使用该成员身份进行出价' });
    }

    const result = await auctionService.submitBid(
      userId, // actorUserId
      lotId,
      parseInt(memberId), // bidderId
      parseInt(bidPoints) // bidPoints
    );

    res.json({
      code: 200,
      data: { bid: result.bid },
      msg: result.msg,
    });
  } catch (err) {
    console.error('submitBid 错误:', err);

    if (err.message.includes('不能低于') || err.message.includes('积分不足') || err.message.includes('已有更高')) {
      return res.status(400).json({ code: 400, msg: err.message });
    }

    res.status(500).json({ code: 500, msg: '出价失败', error: err.message });
  }
};

/**
 * GET /api/v2/auction/lots/:id/bids
 * 获取拍品的出价列表
 */
exports.getBids = async (req, res) => {
  try {
    const lotId = parseInt(req.params.id);
    const { limit = 50 } = req.query;

    if (!lotId) {
      return res.status(400).json({ code: 400, msg: '无效的拍品ID' });
    }

    const bids = await auctionService.getBidsByLotId(lotId, parseInt(limit));

    res.json({
      code: 200,
      data: { bids, total: bids.length },
    });
  } catch (err) {
    console.error('getBids 错误:', err);
    res.status(500).json({ code: 500, msg: '获取出价列表失败', error: err.message });
  }
};

/**
 * POST /api/v2/auction/sessions/:id/settle
 * 结算拍卖场次
 */
exports.settleSession = async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);

    if (!sessionId) {
      return res.status(400).json({ code: 400, msg: '无效的场次ID' });
    }

    // 演示模式检查
    if (req.session.user.username === 'visitor') {
      return res.status(403).json({ code: 403, msg: '演示模式：游客账号仅供查看，禁止修改数据' });
    }

    const result = await auctionService.settleSession(sessionId);

    res.json({
      code: 200,
      data: result,
      msg: result.msg,
    });
  } catch (err) {
    console.error('settleSession 错误:', err);

    if (err.message.includes('不存在') || err.message.includes('不允许')) {
      return res.status(400).json({ code: 400, msg: err.message });
    }

    res.status(500).json({ code: 500, msg: '结算失败', error: err.message });
  }
};

/**
 * GET /api/v2/auction/skus
 * 获取可用于拍卖的 SKU 列表
 */
exports.getAuctionableSkus = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const skus = await auctionService.getAuctionableSkus(userId);

    res.json({
      code: 200,
      data: { skus, total: skus.length },
    });
  } catch (err) {
    console.error('getAuctionableSkus 错误:', err);
    res.status(500).json({ code: 500, msg: '获取SKU列表失败', error: err.message });
  }
};

/**
 * GET /api/v2/auction/hall
 * 大厅聚合（拍卖台用）
 */
exports.getHall = async (req, res) => {
  try {
    const data = await auctionService.getHall(req.session.user.id);
    res.json({ code: 200, data });
  } catch (err) {
    console.error('getHall 错误:', err);
    res.status(500).json({ code: 500, msg: '获取大厅数据失败', error: err.message });
  }
};

/**
 * GET /api/v2/auction/sessions/:id/overview
 * 会场详情聚合（拍卖台用）
 */
exports.getSessionOverview = async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);
    if (!sessionId) return res.status(400).json({ code: 400, msg: '无效的场次ID' });
    const data = await auctionService.getSessionOverview(req.session.user.id, sessionId);
    res.json({ code: 200, data });
  } catch (err) {
    console.error('getSessionOverview 错误:', err);
    res.status(500).json({ code: 500, msg: '获取会场聚合失败', error: err.message });
  }
};

/**
 * POST /api/v2/auction/lots/:id/close
 * 逐 lot 成交（线下拍完一个就点成交）
 */
exports.closeLot = async (req, res) => {
  try {
    const lotId = parseInt(req.params.id);
    if (!lotId) return res.status(400).json({ code: 400, msg: '无效的拍品ID' });
    const data = await auctionService.closeLot(req.session.user.id, lotId);
    res.json({ code: 200, data, msg: '已成交/已流拍' });
  } catch (err) {
    console.error('closeLot 错误:', err);
    res.status(500).json({ code: 500, msg: '拍品成交失败', error: err.message });
  }
};

/**
 * POST /api/v2/auction/lots/:id/undo-last-bid
 * 撤销最后一次出价（仅允许撤销该 lot 最新一条 bid）
 */
exports.undoLastBid = async (req, res) => {
  try {
    const lotId = parseInt(req.params.id);
    if (!lotId) return res.status(400).json({ code: 400, msg: '无效的拍品ID' });
    const data = await auctionService.undoLastBid(req.session.user.id, lotId);
    res.json({ code: 200, data, msg: '已撤销最后一次出价' });
  } catch (err) {
    console.error('undoLastBid 错误:', err);
    res.status(500).json({ code: 500, msg: '撤销出价失败', error: err.message });
  }
};

/**
 * GET /api/v2/auction/sessions-admin
 * 获取管理员场次列表（聚合统计）
 */
exports.getSessionsAdmin = async (req, res) => {
  try {
    const sessions = await auctionService.getSessionsAdmin(req.session.user.id);
    res.json({ code: 200, data: { sessions } });
  } catch (err) {
    console.error('getSessionsAdmin 错误:', err);
    res.status(500).json({ code: 500, msg: '获取场次列表失败', error: err.message });
  }
};

/**
 * POST /api/v2/auction/sessions/:id/activate-lot
 * 激活指定拍品
 */
exports.activateLot = async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);
    const { lot_id: lotId } = req.body;
    
    if (!lotId) {
      return res.status(400).json({ code: 400, msg: '缺少必填参数: lot_id' });
    }
    
    const result = await auctionService.activateLot(req.session.user.id, sessionId, lotId);
    res.json({ code: 200, data: result, msg: '拍品已激活' });
  } catch (err) {
    console.error('activateLot 错误:', err);
    res.status(500).json({ code: 500, msg: err.message || '激活拍品失败' });
  }
};

/**
 * POST /api/v2/auction/sessions/:id/activate-next
 * 激活下一拍品
 */
exports.activateNext = async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);
    const result = await auctionService.activateNext(req.session.user.id, sessionId);
    res.json({ code: 200, data: result, msg: result.message || '已激活下一拍品' });
  } catch (err) {
    console.error('activateNext 错误:', err);
    res.status(500).json({ code: 500, msg: err.message || '激活下一拍品失败' });
  }
};
