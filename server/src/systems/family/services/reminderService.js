/**
 * Reminder Service Layer
 * 提醒系统业务逻辑层
 */
const reminderRepo = require('../repos/reminderRepo');

// ========== 提醒策略管理 ==========

/**
 * 创建提醒策略
 */
exports.createPolicy = async (policyData) => {
  const policy = await reminderRepo.createPolicy(policyData);
  return { success: true, policy };
};

/**
 * 获取策略详情
 */
exports.getPolicyById = async (policyId) => {
  const policy = await reminderRepo.getPolicyById(policyId);
  if (!policy) {
    throw new Error('策略不存在');
  }
  return policy;
};

/**
 * 获取用户的策略列表
 */
exports.getPoliciesByParentId = async (parentId, status = null) => {
  return await reminderRepo.getPoliciesByParentId(parentId, status);
};

/**
 * 更新策略状态
 */
exports.updatePolicyStatus = async (policyId, status) => {
  const policy = await reminderRepo.updatePolicyStatus(policyId, status);
  if (!policy) {
    throw new Error('策略不存在');
  }
  return { success: true, policy };
};

// ========== 提醒事件管理 ==========

/**
 * 创建提醒事件
 */
exports.createEvent = async (eventData) => {
  const event = await reminderRepo.createEvent(eventData);
  return { success: true, event };
};

/**
 * 获取事件详情
 */
exports.getEventById = async (eventId) => {
  const event = await reminderRepo.getEventById(eventId);
  if (!event) {
    throw new Error('事件不存在');
  }
  return event;
};

/**
 * 获取用户的提醒事件列表
 */
exports.getEventsByParentId = async (parentId, filters = {}) => {
  return await reminderRepo.getEventsByParentId(parentId, filters);
};

/**
 * 获取成员的待办提醒
 */
exports.getPendingEventsByMemberId = async (memberId, limit = 10) => {
  return await reminderRepo.getPendingEventsByMemberId(memberId, limit);
};

/**
 * 获取逾期提醒（家长面板用）
 */
exports.getOverdueEvents = async (parentId, limit = 20) => {
  return await reminderRepo.getOverdueEvents(parentId, limit);
};

/**
 * 标记事件为已读
 */
exports.markEventAsRead = async (eventId) => {
  const event = await reminderRepo.markEventAsRead(eventId);
  if (!event) {
    throw new Error('事件不存在');
  }
  return { success: true, event };
};

/**
 * 取消事件
 */
exports.cancelEvent = async (eventId) => {
  const event = await reminderRepo.cancelEvent(eventId);
  if (!event) {
    throw new Error('事件不存在');
  }
  return { success: true, event };
};

/**
 * 获取提醒统计
 */
exports.getReminderStats = async (parentId) => {
  return await reminderRepo.getReminderStats(parentId);
};

// ========== 扫描器 (Scheduler) ==========

/**
 * 扫描并发送待发送的提醒事件
 * 核心扫描逻辑：fire_at <= now 且 status = pending -> sent
 * 
 * @param {number} limit - 每次扫描的最大数量
 * @returns {Object} 扫描结果
 */
exports.scanAndSendReminders = async (limit = 100) => {
  const pool = reminderRepo.getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. 获取待发送的提醒事件
    const pendingEvents = await reminderRepo.getPendingEvents(limit, client);
    
    if (pendingEvents.length === 0) {
      await client.query('COMMIT');
      return { 
        success: true, 
        scanned: 0, 
        sent: 0, 
        failed: 0, 
        events: [] 
      };
    }
    
    const results = {
      sent: [],
      failed: [],
    };
    
    // 2. 逐个处理提醒事件
    for (const event of pendingEvents) {
      try {
        // 模拟发送逻辑（实际应用中这里会调用推送服务、邮件服务等）
        const sendResult = await sendReminder(event);
        
        if (sendResult.success) {
          // 更新状态为已发送
          await reminderRepo.updateEventStatus(event.id, 'sent', null, client);
          
          // 更新关联策略的触发统计
          if (event.policy_id) {
            await reminderRepo.updatePolicyTriggerStats(event.policy_id, client);
          }
          
          results.sent.push({
            id: event.id,
            title: event.title,
            channel: event.channel,
            member_name: event.member_name,
          });
        } else {
          // 发送失败，记录错误
          await reminderRepo.updateEventStatus(event.id, 'failed', sendResult.error, client);
          results.failed.push({
            id: event.id,
            title: event.title,
            error: sendResult.error,
          });
        }
      } catch (err) {
        // 单个事件处理失败，记录错误并继续
        await reminderRepo.updateEventStatus(event.id, 'failed', err.message, client);
        results.failed.push({
          id: event.id,
          title: event.title,
          error: err.message,
        });
      }
    }
    
    await client.query('COMMIT');
    
    return {
      success: true,
      scanned: pendingEvents.length,
      sent: results.sent.length,
      failed: results.failed.length,
      events: results,
    };
    
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * 模拟发送提醒
 * 实际应用中这里会根据 channel 调用不同的推送服务
 * 
 * @param {Object} event - 提醒事件
 * @returns {Object} 发送结果
 */
async function sendReminder(event) {
  // 根据渠道类型进行不同的发送逻辑
  switch (event.channel) {
    case 'app':
      // 应用内通知 - 通常是存储到通知表或通过 WebSocket 推送
      console.log(`📱 [APP] 发送通知给 ${event.member_name || '家长'}: ${event.title}`);
      return { success: true };
      
    case 'push':
      // 推送通知 - 通常调用 FCM/APNs 等推送服务
      console.log(`🔔 [PUSH] 推送通知给 ${event.member_name || '家长'}: ${event.title}`);
      return { success: true };
      
    case 'email':
      // 邮件通知 - 调用邮件服务
      console.log(`📧 [EMAIL] 发送邮件给 ${event.parent_username}: ${event.title}`);
      return { success: true };
      
    case 'sms':
      // 短信通知 - 调用短信服务
      console.log(`💬 [SMS] 发送短信: ${event.title}`);
      return { success: true };
      
    case 'wechat':
      // 微信通知 - 调用微信消息推送
      console.log(`💚 [WECHAT] 发送微信消息: ${event.title}`);
      return { success: true };
      
    default:
      console.log(`❓ [UNKNOWN] 未知渠道 ${event.channel}: ${event.title}`);
      return { success: false, error: `不支持的渠道: ${event.channel}` };
  }
}

// ========== 基于策略自动创建提醒 ==========

/**
 * 根据任务到期策略创建提醒
 * 
 * @param {Object} task - 悬赏任务
 * @param {number} parentId - 用户ID
 */
exports.createTaskDueReminders = async (task, parentId) => {
  const policies = await reminderRepo.getPoliciesByParentId(parentId, 'active');
  const taskDuePolicies = policies.filter(p => p.policy_type === 'task_due');
  
  const events = [];
  
  for (const policy of taskDuePolicies) {
    const hoursBefore = policy.config.hours_before || [24];
    
    for (const hours of hoursBefore) {
      const fireAt = new Date(new Date(task.due_at).getTime() - hours * 60 * 60 * 1000);
      
      // 只创建未来的提醒
      if (fireAt > new Date()) {
        const event = await reminderRepo.createEvent({
          parentId,
          memberId: task.publisher_member_id,
          targetType: 'task',
          targetId: task.id,
          title: `任务即将到期`,
          message: `任务"${task.title}"将在${hours}小时后到期，请尽快完成！`,
          data: { task_id: task.id, hours_before: hours },
          fireAt,
          channel: policy.channels?.[0] || 'app',
          policyId: policy.id,
        });
        events.push(event);
      }
    }
  }
  
  return events;
};

/**
 * 根据问题发生策略创建警报
 * 
 * @param {Object} issue - 问题
 * @param {number} occurrenceCount - 发生次数
 */
exports.createIssueOccurrenceAlert = async (issue, occurrenceCount) => {
  const policies = await reminderRepo.getPoliciesByParentId(issue.parent_id, 'active');
  const issuePolicies = policies.filter(p => p.policy_type === 'issue_occurrence');
  
  const events = [];
  
  for (const policy of issuePolicies) {
    const threshold = policy.config.threshold || 3;
    const periodDays = policy.config.period_days || 7;
    
    // 检查是否达到阈值
    if (occurrenceCount >= threshold) {
      const event = await reminderRepo.createEvent({
        parentId: issue.parent_id,
        memberId: issue.owner_member_id,
        targetType: 'issue',
        targetId: issue.id,
        title: `问题行为频繁警报`,
        message: `"${issue.title}"问题在${periodDays}天内已发生${occurrenceCount}次，需要关注！`,
        data: { issue_id: issue.id, occurrence_count: occurrenceCount },
        fireAt: new Date(),
        channel: policy.channels?.[0] || 'app',
        policyId: policy.id,
      });
      events.push(event);
    }
  }
  
  return events;
};

/**
 * 创建自定义提醒
 */
exports.createCustomReminder = async ({
  parentId,
  memberId,
  title,
  message,
  fireAt,
  channel = 'app',
}) => {
  const event = await reminderRepo.createEvent({
    parentId,
    memberId,
    targetType: 'custom',
    targetId: null,
    title,
    message,
    fireAt: new Date(fireAt),
    channel,
    status: 'pending',
  });
  
  return { success: true, event };
};
