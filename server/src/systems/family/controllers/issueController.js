/**
 * Issue Controller - v2 API
 * Issue Tracker 接口控制层
 */
const issueService = require('../services/issueService');
const walletService = require('../services/walletService');

/**
 * POST /api/v2/issues
 * 创建问题
 */
exports.createIssue = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const {
      owner_member_id: ownerMemberId,
      title,
      description,
      icon,
      tags,
      severity,
      attention_threshold: attentionThreshold,
    } = req.body;

    // 参数校验
    if (!ownerMemberId) {
      return res.status(400).json({ code: 400, msg: '缺少必填参数: owner_member_id' });
    }
    if (!title) {
      return res.status(400).json({ code: 400, msg: '缺少必填参数: title' });
    }

    // 演示模式检查
    if (req.session.user.username === 'visitor') {
      return res.status(403).json({ code: 403, msg: '演示模式：游客账号仅供查看，禁止修改数据' });
    }

    // 校验成员归属
    const member = await walletService.getMemberById(parseInt(ownerMemberId));
    if (!member || member.parent_id !== userId) {
      return res.status(403).json({ code: 403, msg: '无权操作该成员' });
    }

    const issue = await issueService.createIssue({
      parentId: userId,
      ownerMemberId: parseInt(ownerMemberId),
      title,
      description,
      icon,
      tags: tags || [],
      severity: severity || 'medium',
      attentionThreshold: attentionThreshold || 5,
    });

    res.json({
      code: 200,
      data: { issue },
      msg: '问题创建成功',
    });
  } catch (err) {
    console.error('createIssue 错误:', err);
    res.status(500).json({ code: 500, msg: '创建问题失败', error: err.message });
  }
};

/**
 * GET /api/v2/issues
 * 获取问题列表
 */
exports.getIssues = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { member_id: memberId, status } = req.query;

    let issues;
    if (memberId) {
      issues = await issueService.getMemberIssues(parseInt(memberId), status || null);
    } else {
      issues = await issueService.getAllIssues(userId, status || null);
    }

    res.json({
      code: 200,
      data: { issues, total: issues.length },
    });
  } catch (err) {
    console.error('getIssues 错误:', err);
    res.status(500).json({ code: 500, msg: '获取问题列表失败', error: err.message });
  }
};

/**
 * GET /api/v2/issues/top
 * 获取 Top Issues（按关注度排序）
 */
exports.getTopIssues = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { limit = 10 } = req.query;

    const issues = await issueService.getTopIssues(userId, parseInt(limit));

    res.json({
      code: 200,
      data: { issues, total: issues.length },
    });
  } catch (err) {
    console.error('getTopIssues 错误:', err);
    res.status(500).json({ code: 500, msg: '获取 Top Issues 失败', error: err.message });
  }
};

/**
 * GET /api/v2/issues/:id
 * 获取问题详情
 */
exports.getIssueDetail = async (req, res) => {
  try {
    const issueId = parseInt(req.params.id);

    if (!issueId) {
      return res.status(400).json({ code: 400, msg: '无效的问题ID' });
    }

    const detail = await issueService.getIssueDetail(issueId);

    res.json({
      code: 200,
      data: detail,
    });
  } catch (err) {
    console.error('getIssueDetail 错误:', err);

    if (err.message.includes('不存在')) {
      return res.status(404).json({ code: 404, msg: err.message });
    }

    res.status(500).json({ code: 500, msg: '获取问题详情失败', error: err.message });
  }
};

/**
 * POST /api/v2/issues/:id/occurrence
 * 记录问题发生
 */
exports.recordOccurrence = async (req, res) => {
  try {
    const issueId = parseInt(req.params.id);
    const {
      note,
      context,
      reporter_member_id: reporterMemberId,
      occurred_at: occurredAt,
    } = req.body;

    if (!issueId) {
      return res.status(400).json({ code: 400, msg: '无效的问题ID' });
    }

    // 演示模式检查
    if (req.session.user.username === 'visitor') {
      return res.status(403).json({ code: 403, msg: '演示模式：游客账号仅供查看，禁止修改数据' });
    }

    const result = await issueService.recordOccurrence(issueId, {
      note,
      context,
      reporterMemberId: reporterMemberId ? parseInt(reporterMemberId) : null,
      occurredAt: occurredAt ? new Date(occurredAt) : null,
    });

    res.json({
      code: 200,
      data: result,
      msg: result.msg,
    });
  } catch (err) {
    console.error('recordOccurrence 错误:', err);

    if (err.message.includes('不存在')) {
      return res.status(400).json({ code: 400, msg: err.message });
    }

    res.status(500).json({ code: 500, msg: '记录问题发生失败', error: err.message });
  }
};

/**
 * POST /api/v2/issues/:id/decay
 * 衰减问题关注度
 */
exports.decayAttentionScore = async (req, res) => {
  try {
    const issueId = req.params.id ? parseInt(req.params.id) : null;
    const { decay_amount: decayAmount = 1 } = req.body;

    // 演示模式检查
    if (req.session.user.username === 'visitor') {
      return res.status(403).json({ code: 403, msg: '演示模式：游客账号仅供查看，禁止修改数据' });
    }

    const result = await issueService.decayAttentionScore(
      issueId || null,
      parseInt(decayAmount)
    );

    res.json({
      code: 200,
      data: result,
      msg: result.msg,
    });
  } catch (err) {
    console.error('decayAttentionScore 错误:', err);

    if (err.message.includes('不存在')) {
      return res.status(400).json({ code: 400, msg: err.message });
    }

    res.status(500).json({ code: 500, msg: '衰减关注度失败', error: err.message });
  }
};

/**
 * POST /api/v2/issues/:id/intervention
 * 执行干预措施
 */
exports.executeIntervention = async (req, res) => {
  try {
    const issueId = parseInt(req.params.id);
    const { intervention_id: interventionId } = req.body;

    if (!issueId) {
      return res.status(400).json({ code: 400, msg: '无效的问题ID' });
    }
    if (!interventionId) {
      return res.status(400).json({ code: 400, msg: '缺少必填参数: intervention_id' });
    }

    // 演示模式检查
    if (req.session.user.username === 'visitor') {
      return res.status(403).json({ code: 403, msg: '演示模式：游客账号仅供查看，禁止修改数据' });
    }

    const result = await issueService.executeIntervention(
      parseInt(interventionId),
      issueId
    );

    res.json({
      code: 200,
      data: result,
      msg: result.msg,
    });
  } catch (err) {
    console.error('executeIntervention 错误:', err);

    if (err.message.includes('不存在')) {
      return res.status(400).json({ code: 400, msg: err.message });
    }

    res.status(500).json({ code: 500, msg: '执行干预措施失败', error: err.message });
  }
};

/**
 * POST /api/v2/issues/:id/interventions
 * 创建干预措施
 */
exports.createIntervention = async (req, res) => {
  try {
    const issueId = parseInt(req.params.id);
    const {
      name,
      description,
      icon,
      action_type: actionType,
      template,
      trigger_type: triggerType,
      trigger_config: triggerConfig,
      priority,
    } = req.body;

    if (!issueId) {
      return res.status(400).json({ code: 400, msg: '无效的问题ID' });
    }
    if (!name) {
      return res.status(400).json({ code: 400, msg: '缺少必填参数: name' });
    }
    if (!actionType) {
      return res.status(400).json({ code: 400, msg: '缺少必填参数: action_type' });
    }

    // 演示模式检查
    if (req.session.user.username === 'visitor') {
      return res.status(403).json({ code: 403, msg: '演示模式：游客账号仅供查看，禁止修改数据' });
    }

    const intervention = await issueService.createIntervention({
      issueId,
      name,
      description,
      icon,
      actionType,
      template: template || {},
      triggerType: triggerType || 'manual',
      triggerConfig: triggerConfig || {},
      priority: priority || 0,
    });

    res.json({
      code: 200,
      data: { intervention },
      msg: '干预措施创建成功',
    });
  } catch (err) {
    console.error('createIntervention 错误:', err);
    res.status(500).json({ code: 500, msg: '创建干预措施失败', error: err.message });
  }
};

/**
 * PATCH /api/v2/issues/:id/status
 * 更新问题状态
 */
exports.updateStatus = async (req, res) => {
  try {
    const issueId = parseInt(req.params.id);
    const { status } = req.body;

    if (!issueId) {
      return res.status(400).json({ code: 400, msg: '无效的问题ID' });
    }
    if (!status || !['active', 'resolved', 'monitoring', 'archived'].includes(status)) {
      return res.status(400).json({ code: 400, msg: '无效的状态值' });
    }

    // 演示模式检查
    if (req.session.user.username === 'visitor') {
      return res.status(403).json({ code: 403, msg: '演示模式：游客账号仅供查看，禁止修改数据' });
    }

    const issue = await issueService.updateIssueStatus(issueId, status);

    res.json({
      code: 200,
      data: { issue },
      msg: '状态更新成功',
    });
  } catch (err) {
    console.error('updateStatus 错误:', err);
    res.status(500).json({ code: 500, msg: '更新状态失败', error: err.message });
  }
};

/**
 * GET /api/v2/issues/occurrences
 * 获取最近的发生记录
 */
exports.getRecentOccurrences = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { limit = 20 } = req.query;

    const occurrences = await issueService.getRecentOccurrences(userId, parseInt(limit));

    res.json({
      code: 200,
      data: { occurrences, total: occurrences.length },
    });
  } catch (err) {
    console.error('getRecentOccurrences 错误:', err);
    res.status(500).json({ code: 500, msg: '获取发生记录失败', error: err.message });
  }
};
