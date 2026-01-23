/**
 * Lottery Controller - v2 API
 * 抽奖系统接口控制层
 */
const lotteryService = require('../services/lotteryService');
const walletService = require('../services/walletService');

/**
 * POST /api/v2/draw/spin
 * 执行抽奖
 */
exports.spin = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { pool_id: poolId, member_id: memberId, idempotency_key: idempotencyKey } = req.body;

    // 参数校验
    if (!poolId) {
      return res.status(400).json({ code: 400, msg: '缺少必填参数: pool_id' });
    }
    if (!memberId) {
      return res.status(400).json({ code: 400, msg: '缺少必填参数: member_id' });
    }

    // 演示模式检查
    if (req.session.user.username === 'visitor') {
      return res.status(403).json({ code: 403, msg: '演示模式：游客账号仅供查看，禁止修改数据' });
    }

    // 校验成员归属
    const member = await walletService.getMemberById(parseInt(memberId));
    if (!member || member.parent_id !== userId) {
      return res.status(403).json({ code: 403, msg: '无权操作该成员' });
    }

    // 生成幂等键
    const finalIdempotencyKey = idempotencyKey || `spin_${poolId}_${memberId}_${Date.now()}`;

    const result = await lotteryService.spin(
      parseInt(poolId),
      parseInt(memberId),
      finalIdempotencyKey
    );

    res.json({
      code: 200,
      data: result,
      msg: result.msg,
    });
  } catch (err) {
    console.error('spin 错误:', err);

    if (err.message.includes('不存在') || err.message.includes('已关闭') ||
        err.message.includes('未配置') || err.message.includes('为空') ||
        err.message.includes('不足') || err.message.includes('上限')) {
      return res.status(400).json({ code: 400, msg: err.message });
    }

    res.status(500).json({ code: 500, msg: '抽奖失败', error: err.message });
  }
};

/**
 * GET /api/v2/draw/pools
 * 获取所有抽奖池
 */
exports.getPools = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { member_id: memberId } = req.query;

    if (!memberId) {
      return res.status(400).json({ code: 400, msg: '缺少必填参数: member_id' });
    }

    const pools = await lotteryService.getPoolsForMember(userId, parseInt(memberId));

    res.json({
      code: 200,
      data: { pools, total: pools.length },
    });
  } catch (err) {
    console.error('getPools 错误:', err);
    res.status(500).json({ code: 500, msg: '获取抽奖池失败', error: err.message });
  }
};

/**
 * GET /api/v2/draw/pools/:id
 * 获取抽奖池详情
 */
exports.getPoolDetail = async (req, res) => {
  try {
    const poolId = parseInt(req.params.id);

    if (!poolId) {
      return res.status(400).json({ code: 400, msg: '无效的抽奖池ID' });
    }

    const detail = await lotteryService.getPoolDetail(poolId);

    res.json({
      code: 200,
      data: detail,
    });
  } catch (err) {
    console.error('getPoolDetail 错误:', err);

    if (err.message.includes('不存在')) {
      return res.status(404).json({ code: 404, msg: err.message });
    }

    res.status(500).json({ code: 500, msg: '获取抽奖池详情失败', error: err.message });
  }
};

/**
 * GET /api/v2/draw/history
 * 获取抽奖历史
 */
exports.getHistory = async (req, res) => {
  try {
    const { member_id: memberId, limit = 50 } = req.query;

    if (!memberId) {
      return res.status(400).json({ code: 400, msg: '缺少必填参数: member_id' });
    }

    const history = await lotteryService.getDrawHistory(parseInt(memberId), parseInt(limit));

    res.json({
      code: 200,
      data: { history, total: history.length },
    });
  } catch (err) {
    console.error('getHistory 错误:', err);
    res.status(500).json({ code: 500, msg: '获取抽奖历史失败', error: err.message });
  }
};

/**
 * GET /api/v2/draw/tickets
 * 获取成员的抽奖券统计
 */
exports.getTickets = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { member_id: memberId } = req.query;

    if (!memberId) {
      return res.status(400).json({ code: 400, msg: '缺少必填参数: member_id' });
    }

    const tickets = await lotteryService.getMemberTicketStats(parseInt(memberId), userId);

    res.json({
      code: 200,
      data: { tickets, total: tickets.length },
    });
  } catch (err) {
    console.error('getTickets 错误:', err);
    res.status(500).json({ code: 500, msg: '获取抽奖券失败', error: err.message });
  }
};
