/**
 * Reminder Repository Layer
 * 提醒系统数据访问层
 */
const pool = require('../../../shared/config/db');

/**
 * 获取数据库连接池（用于事务）
 */
exports.getPool = () => pool;

// ========== Reminder Policy 提醒策略 ==========

/**
 * 创建提醒策略
 */
exports.createPolicy = async ({
  parentId,
  name,
  description,
  policyType,
  config,
  targetType,
  targetFilter,
  channels,
  status,
  priority,
}, client = pool) => {
  const result = await client.query(
    `INSERT INTO reminder_policy 
     (parent_id, name, description, policy_type, config, target_type, target_filter, channels, status, priority)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      parentId, name, description || null, policyType || 'custom',
      JSON.stringify(config || {}), targetType || null,
      JSON.stringify(targetFilter || {}), channels || ['app'],
      status || 'active', priority || 0
    ]
  );
  return result.rows[0];
};

/**
 * 获取策略详情
 */
exports.getPolicyById = async (policyId, client = pool) => {
  const result = await client.query(
    `SELECT * FROM reminder_policy WHERE id = $1`,
    [policyId]
  );
  return result.rows[0];
};

/**
 * 获取用户的策略列表
 */
exports.getPoliciesByParentId = async (parentId, status = null, client = pool) => {
  let query = `SELECT * FROM reminder_policy WHERE parent_id = $1`;
  const params = [parentId];
  
  if (status) {
    query += ` AND status = $2`;
    params.push(status);
  }
  
  query += ` ORDER BY priority DESC, created_at DESC`;
  
  const result = await client.query(query, params);
  return result.rows;
};

/**
 * 更新策略状态
 */
exports.updatePolicyStatus = async (policyId, status, client = pool) => {
  const result = await client.query(
    `UPDATE reminder_policy SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
    [status, policyId]
  );
  return result.rows[0];
};

/**
 * 更新策略触发统计
 */
exports.updatePolicyTriggerStats = async (policyId, client = pool) => {
  const result = await client.query(
    `UPDATE reminder_policy 
     SET trigger_count = trigger_count + 1, last_triggered_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
     WHERE id = $1 RETURNING *`,
    [policyId]
  );
  return result.rows[0];
};

// ========== Reminder Event 提醒事件 ==========

/**
 * 创建提醒事件
 */
exports.createEvent = async ({
  parentId,
  memberId,
  targetType,
  targetId,
  title,
  message,
  data,
  fireAt,
  channel,
  status,
  policyId,
  maxRetries,
}, client = pool) => {
  const result = await client.query(
    `INSERT INTO reminder_event 
     (parent_id, member_id, target_type, target_id, title, message, data, fire_at, channel, status, policy_id, max_retries)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      parentId, memberId || null, targetType, targetId || null,
      title, message, JSON.stringify(data || {}),
      fireAt, channel || 'app', status || 'pending',
      policyId || null, maxRetries || 3
    ]
  );
  return result.rows[0];
};

/**
 * 获取事件详情
 */
exports.getEventById = async (eventId, client = pool) => {
  const result = await client.query(
    `SELECT re.*, 
            fm.name as member_name,
            rp.name as policy_name
     FROM reminder_event re
     LEFT JOIN family_members fm ON re.member_id = fm.id
     LEFT JOIN reminder_policy rp ON re.policy_id = rp.id
     WHERE re.id = $1`,
    [eventId]
  );
  return result.rows[0];
};

/**
 * 获取待发送的提醒事件（扫描器用）
 */
exports.getPendingEvents = async (limit = 100, client = pool) => {
  const result = await client.query(
    `SELECT re.*, 
            fm.name as member_name,
            u.username as parent_username,
            rp.name as policy_name,
            rp.policy_type
     FROM reminder_event re
     JOIN users u ON re.parent_id = u.id
     LEFT JOIN family_members fm ON re.member_id = fm.id
     LEFT JOIN reminder_policy rp ON re.policy_id = rp.id
     WHERE re.status = 'pending'
       AND re.fire_at <= CURRENT_TIMESTAMP
       AND re.retry_count < re.max_retries
     ORDER BY re.fire_at ASC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
};

/**
 * 获取用户的提醒事件列表
 */
exports.getEventsByParentId = async (parentId, { status, memberId, targetType, limit, offset } = {}, client = pool) => {
  let query = `
    SELECT re.*, 
           fm.name as member_name,
           rp.name as policy_name
    FROM reminder_event re
    LEFT JOIN family_members fm ON re.member_id = fm.id
    LEFT JOIN reminder_policy rp ON re.policy_id = rp.id
    WHERE re.parent_id = $1
  `;
  const params = [parentId];
  let paramIndex = 2;

  if (status) {
    query += ` AND re.status = $${paramIndex++}`;
    params.push(status);
  }
  
  if (memberId) {
    query += ` AND re.member_id = $${paramIndex++}`;
    params.push(memberId);
  }
  
  if (targetType) {
    query += ` AND re.target_type = $${paramIndex++}`;
    params.push(targetType);
  }

  query += ` ORDER BY re.fire_at DESC`;
  
  if (limit) {
    query += ` LIMIT $${paramIndex++}`;
    params.push(limit);
  }
  
  if (offset) {
    query += ` OFFSET $${paramIndex++}`;
    params.push(offset);
  }

  const result = await client.query(query, params);
  return result.rows;
};

/**
 * 获取成员的待办提醒
 */
exports.getPendingEventsByMemberId = async (memberId, limit = 10, client = pool) => {
  const result = await client.query(
    `SELECT re.*, rp.name as policy_name
     FROM reminder_event re
     LEFT JOIN reminder_policy rp ON re.policy_id = rp.id
     WHERE re.member_id = $1
       AND re.status IN ('pending', 'sent')
       AND re.fire_at <= CURRENT_TIMESTAMP + INTERVAL '24 hours'
     ORDER BY re.fire_at ASC
     LIMIT $2`,
    [memberId, limit]
  );
  return result.rows;
};

/**
 * 获取逾期提醒（家长面板用）
 */
exports.getOverdueEvents = async (parentId, limit = 20, client = pool) => {
  const result = await client.query(
    `SELECT re.*, 
            fm.name as member_name,
            rp.name as policy_name
     FROM reminder_event re
     LEFT JOIN family_members fm ON re.member_id = fm.id
     LEFT JOIN reminder_policy rp ON re.policy_id = rp.id
     WHERE re.parent_id = $1
       AND re.status = 'pending'
       AND re.fire_at < CURRENT_TIMESTAMP
     ORDER BY re.fire_at ASC
     LIMIT $2`,
    [parentId, limit]
  );
  return result.rows;
};

/**
 * 更新事件状态
 */
exports.updateEventStatus = async (eventId, status, error = null, client = pool) => {
  let query = `UPDATE reminder_event SET status = $1, updated_at = CURRENT_TIMESTAMP`;
  const params = [status, eventId];
  
  if (status === 'sent') {
    query += `, fired_at = CURRENT_TIMESTAMP`;
  }
  
  if (status === 'failed' && error) {
    query += `, last_error = $3, retry_count = retry_count + 1`;
    params.push(error);
  }
  
  query += ` WHERE id = $2 RETURNING *`;
  
  const result = await client.query(query, params);
  return result.rows[0];
};

/**
 * 批量更新事件状态
 */
exports.batchUpdateEventStatus = async (eventIds, status, client = pool) => {
  if (!eventIds || eventIds.length === 0) return [];
  
  const result = await client.query(
    `UPDATE reminder_event 
     SET status = $1, fired_at = CASE WHEN $1 = 'sent' THEN CURRENT_TIMESTAMP ELSE fired_at END, updated_at = CURRENT_TIMESTAMP
     WHERE id = ANY($2)
     RETURNING *`,
    [status, eventIds]
  );
  return result.rows;
};

/**
 * 标记事件为已读
 */
exports.markEventAsRead = async (eventId, client = pool) => {
  const result = await client.query(
    `UPDATE reminder_event SET status = 'read', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
    [eventId]
  );
  return result.rows[0];
};

/**
 * 取消事件
 */
exports.cancelEvent = async (eventId, client = pool) => {
  const result = await client.query(
    `UPDATE reminder_event SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
    [eventId]
  );
  return result.rows[0];
};

/**
 * 删除事件
 */
exports.deleteEvent = async (eventId, client = pool) => {
  const result = await client.query(
    `DELETE FROM reminder_event WHERE id = $1 RETURNING id`,
    [eventId]
  );
  return result.rowCount > 0;
};

/**
 * 获取提醒统计
 */
exports.getReminderStats = async (parentId, client = pool) => {
  const result = await client.query(
    `SELECT 
       COUNT(*) as total_events,
       COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
       COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_count,
       COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_count,
       COUNT(CASE WHEN status = 'read' THEN 1 END) as read_count,
       COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
       COUNT(CASE WHEN status = 'pending' AND fire_at < CURRENT_TIMESTAMP THEN 1 END) as overdue_count,
       COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as today_count
     FROM reminder_event
     WHERE parent_id = $1`,
    [parentId]
  );
  return result.rows[0];
};
