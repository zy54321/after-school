/**
 * Reminder Controller
 * 提醒系统 API 控制器
 */
const reminderService = require('../services/reminderService');

// ========== 提醒策略 ==========

/**
 * 创建提醒策略
 * POST /api/v2/reminders/policies
 */
exports.createPolicy = async (req, res) => {
  try {
    const parentId = req.session.user.id;
    const { name, description, policyType, config, targetType, targetFilter, channels, priority } = req.body;

    if (!name) {
      return res.status(400).json({ code: 400, msg: '策略名称不能为空' });
    }

    const result = await reminderService.createPolicy({
      parentId,
      name,
      description,
      policyType,
      config,
      targetType,
      targetFilter,
      channels,
      priority,
    });

    res.json({ code: 200, msg: '策略创建成功', data: result });
  } catch (err) {
    console.error('createPolicy 错误:', err);
    res.status(500).json({ code: 500, msg: '创建策略失败', error: err.message });
  }
};

/**
 * 获取策略列表
 * GET /api/v2/reminders/policies
 */
exports.getPolicies = async (req, res) => {
  try {
    const parentId = req.session.user.id;
    const { status } = req.query;

    const policies = await reminderService.getPoliciesByParentId(parentId, status);

    res.json({ code: 200, msg: '获取成功', data: policies });
  } catch (err) {
    console.error('getPolicies 错误:', err);
    res.status(500).json({ code: 500, msg: '获取策略列表失败', error: err.message });
  }
};

/**
 * 更新策略状态
 * PATCH /api/v2/reminders/policies/:id/status
 */
exports.updatePolicyStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'paused', 'archived'].includes(status)) {
      return res.status(400).json({ code: 400, msg: '无效的状态值' });
    }

    const result = await reminderService.updatePolicyStatus(id, status);

    res.json({ code: 200, msg: '状态更新成功', data: result });
  } catch (err) {
    console.error('updatePolicyStatus 错误:', err);
    res.status(500).json({ code: 500, msg: '更新策略状态失败', error: err.message });
  }
};

// ========== 提醒事件 ==========

/**
 * 获取提醒事件列表
 * GET /api/v2/reminders
 */
exports.getReminders = async (req, res) => {
  try {
    const parentId = req.session.user.id;
    const { status, memberId, targetType, limit, offset } = req.query;

    const events = await reminderService.getEventsByParentId(parentId, {
      status,
      memberId: memberId ? parseInt(memberId) : null,
      targetType,
      limit: limit ? parseInt(limit) : null,
      offset: offset ? parseInt(offset) : null,
    });

    res.json({ code: 200, msg: '获取成功', data: events });
  } catch (err) {
    console.error('getReminders 错误:', err);
    res.status(500).json({ code: 500, msg: '获取提醒列表失败', error: err.message });
  }
};

/**
 * 获取成员的待办提醒
 * GET /api/v2/reminders/pending/:memberId
 */
exports.getPendingReminders = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { limit } = req.query;

    const events = await reminderService.getPendingEventsByMemberId(
      parseInt(memberId),
      limit ? parseInt(limit) : 10
    );

    res.json({ code: 200, msg: '获取成功', data: events });
  } catch (err) {
    console.error('getPendingReminders 错误:', err);
    res.status(500).json({ code: 500, msg: '获取待办提醒失败', error: err.message });
  }
};

/**
 * 获取逾期提醒（家长面板）
 * GET /api/v2/reminders/overdue
 */
exports.getOverdueReminders = async (req, res) => {
  try {
    const parentId = req.session.user.id;
    const { limit } = req.query;

    const events = await reminderService.getOverdueEvents(parentId, limit ? parseInt(limit) : 20);

    res.json({ code: 200, msg: '获取成功', data: events });
  } catch (err) {
    console.error('getOverdueReminders 错误:', err);
    res.status(500).json({ code: 500, msg: '获取逾期提醒失败', error: err.message });
  }
};

/**
 * 创建自定义提醒
 * POST /api/v2/reminders
 */
exports.createReminder = async (req, res) => {
  try {
    const parentId = req.session.user.id;
    const { memberId, title, message, fireAt, channel } = req.body;

    if (!title || !fireAt) {
      return res.status(400).json({ code: 400, msg: '标题和触发时间不能为空' });
    }

    const result = await reminderService.createCustomReminder({
      parentId,
      memberId,
      title,
      message,
      fireAt,
      channel,
    });

    res.json({ code: 200, msg: '提醒创建成功', data: result });
  } catch (err) {
    console.error('createReminder 错误:', err);
    res.status(500).json({ code: 500, msg: '创建提醒失败', error: err.message });
  }
};

/**
 * 标记提醒为已读
 * PATCH /api/v2/reminders/:id/read
 */
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await reminderService.markEventAsRead(parseInt(id));

    res.json({ code: 200, msg: '已标记为已读', data: result });
  } catch (err) {
    console.error('markAsRead 错误:', err);
    res.status(500).json({ code: 500, msg: '标记已读失败', error: err.message });
  }
};

/**
 * 取消提醒
 * DELETE /api/v2/reminders/:id
 */
exports.cancelReminder = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await reminderService.cancelEvent(parseInt(id));

    res.json({ code: 200, msg: '提醒已取消', data: result });
  } catch (err) {
    console.error('cancelReminder 错误:', err);
    res.status(500).json({ code: 500, msg: '取消提醒失败', error: err.message });
  }
};

// ========== 扫描器 ==========

/**
 * 扫描并发送待发送的提醒
 * POST /api/v2/reminders/scan
 */
exports.scanReminders = async (req, res) => {
  try {
    const { limit } = req.body;

    console.log('🔍 开始扫描待发送提醒...');
    const result = await reminderService.scanAndSendReminders(limit || 100);

    console.log(`✅ 扫描完成: 扫描 ${result.scanned} 条, 发送 ${result.sent} 条, 失败 ${result.failed} 条`);

    res.json({ code: 200, msg: '扫描完成', data: result });
  } catch (err) {
    console.error('scanReminders 错误:', err);
    res.status(500).json({ code: 500, msg: '扫描失败', error: err.message });
  }
};

/**
 * 获取提醒统计
 * GET /api/v2/reminders/stats
 */
exports.getReminderStats = async (req, res) => {
  try {
    const parentId = req.session.user.id;

    const stats = await reminderService.getReminderStats(parentId);

    res.json({ code: 200, msg: '获取成功', data: stats });
  } catch (err) {
    console.error('getReminderStats 错误:', err);
    res.status(500).json({ code: 500, msg: '获取统计失败', error: err.message });
  }
};
