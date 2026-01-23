/**
 * Issue Repository Layer
 * Issue Tracker 数据访问层
 */
const pool = require('../../../shared/config/db');

/**
 * 获取数据库连接池（用于事务）
 */
exports.getPool = () => pool;

// ========== Issue 问题 ==========

/**
 * 创建问题
 */
exports.createIssue = async ({
  parentId,
  ownerMemberId,
  title,
  description,
  icon,
  tags,
  severity,
  attentionThreshold,
}, client = pool) => {
  const result = await client.query(
    `INSERT INTO issue (parent_id, owner_member_id, title, description, icon, tags, severity, attention_threshold)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [parentId, ownerMemberId, title, description, icon || '⚠️', tags || [], severity || 'medium', attentionThreshold || 5]
  );
  return result.rows[0];
};

/**
 * 获取问题详情
 */
exports.getIssueById = async (issueId, client = pool) => {
  const result = await client.query(
    `SELECT i.*, fm.name as member_name
     FROM issue i
     JOIN family_members fm ON i.owner_member_id = fm.id
     WHERE i.id = $1`,
    [issueId]
  );
  return result.rows[0];
};

/**
 * 获取用户的所有问题
 */
exports.getIssuesByParentId = async (parentId, status = null, client = pool) => {
  let query = `
    SELECT i.*, fm.name as member_name
    FROM issue i
    JOIN family_members fm ON i.owner_member_id = fm.id
    WHERE i.parent_id = $1
  `;
  const params = [parentId];
  
  if (status) {
    query += ' AND i.status = $2';
    params.push(status);
  }
  
  query += ' ORDER BY i.attention_score DESC, i.last_occurred_at DESC NULLS LAST';
  
  const result = await client.query(query, params);
  return result.rows;
};

/**
 * 获取成员的问题
 */
exports.getIssuesByMemberId = async (memberId, status = null, client = pool) => {
  let query = `
    SELECT i.*, fm.name as member_name
    FROM issue i
    JOIN family_members fm ON i.owner_member_id = fm.id
    WHERE i.owner_member_id = $1
  `;
  const params = [memberId];
  
  if (status) {
    query += ' AND i.status = $2';
    params.push(status);
  }
  
  query += ' ORDER BY i.attention_score DESC, i.last_occurred_at DESC NULLS LAST';
  
  const result = await client.query(query, params);
  return result.rows;
};

/**
 * 获取 Top Issues（按关注度排序）
 */
exports.getTopIssues = async (parentId, limit = 10, client = pool) => {
  const result = await client.query(
    `SELECT i.*, fm.name as member_name,
            CASE WHEN i.attention_score >= i.attention_threshold THEN TRUE ELSE FALSE END as is_alert
     FROM issue i
     JOIN family_members fm ON i.owner_member_id = fm.id
     WHERE i.parent_id = $1 AND i.status IN ('active', 'monitoring')
     ORDER BY i.attention_score DESC, i.occurrence_count DESC
     LIMIT $2`,
    [parentId, limit]
  );
  return result.rows;
};

/**
 * 更新问题关注度
 */
exports.updateAttentionScore = async (issueId, scoreChange, client = pool) => {
  const result = await client.query(
    `UPDATE issue 
     SET attention_score = GREATEST(0, attention_score + $2),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [issueId, scoreChange]
  );
  return result.rows[0];
};

/**
 * 设置问题关注度
 */
exports.setAttentionScore = async (issueId, score, client = pool) => {
  const result = await client.query(
    `UPDATE issue 
     SET attention_score = GREATEST(0, $2),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [issueId, score]
  );
  return result.rows[0];
};

/**
 * 更新问题状态
 */
exports.updateIssueStatus = async (issueId, status, client = pool) => {
  const result = await client.query(
    `UPDATE issue SET status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
    [issueId, status]
  );
  return result.rows[0];
};

/**
 * 增加连续天数
 */
exports.incrementStreakDays = async (issueId, client = pool) => {
  const result = await client.query(
    `UPDATE issue 
     SET streak_days = streak_days + 1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [issueId]
  );
  return result.rows[0];
};

/**
 * 批量衰减关注度
 */
exports.decayAllAttentionScores = async (parentId, decayAmount = 1, client = pool) => {
  const result = await client.query(
    `UPDATE issue 
     SET attention_score = GREATEST(0, attention_score - $2),
         updated_at = CURRENT_TIMESTAMP
     WHERE parent_id = $1 
       AND status IN ('active', 'monitoring')
       AND attention_score > 0
     RETURNING *`,
    [parentId, decayAmount]
  );
  return result.rows;
};

// ========== Issue Occurrence 发生记录 ==========

/**
 * 创建发生记录
 */
exports.createOccurrence = async ({
  issueId,
  occurredAt,
  note,
  context,
  reporterMemberId,
  autoInterventionId,
  pointsDeducted,
}, client = pool) => {
  const result = await client.query(
    `INSERT INTO issue_occurrence (issue_id, occurred_at, note, context, reporter_member_id, auto_intervention_id, points_deducted)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [issueId, occurredAt || new Date(), note, context, reporterMemberId, autoInterventionId, pointsDeducted || 0]
  );
  return result.rows[0];
};

/**
 * 获取问题的发生记录
 */
exports.getOccurrencesByIssueId = async (issueId, limit = 50, client = pool) => {
  const result = await client.query(
    `SELECT * FROM issue_occurrence 
     WHERE issue_id = $1
     ORDER BY occurred_at DESC
     LIMIT $2`,
    [issueId, limit]
  );
  return result.rows;
};

/**
 * 获取最近的发生记录
 */
exports.getRecentOccurrences = async (parentId, limit = 20, client = pool) => {
  const result = await client.query(
    `SELECT io.*, i.title as issue_title, i.icon as issue_icon, fm.name as member_name
     FROM issue_occurrence io
     JOIN issue i ON io.issue_id = i.id
     JOIN family_members fm ON i.owner_member_id = fm.id
     WHERE i.parent_id = $1
     ORDER BY io.occurred_at DESC
     LIMIT $2`,
    [parentId, limit]
  );
  return result.rows;
};

// ========== Intervention 干预措施 ==========

/**
 * 创建干预措施
 */
exports.createIntervention = async ({
  issueId,
  name,
  description,
  icon,
  actionType,
  template,
  triggerType,
  triggerConfig,
  priority,
}, client = pool) => {
  const result = await client.query(
    `INSERT INTO intervention (issue_id, name, description, icon, action_type, template, trigger_type, trigger_config, priority)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [issueId, name, description, icon || '🔧', actionType, template || {}, triggerType || 'manual', triggerConfig || {}, priority || 0]
  );
  return result.rows[0];
};

/**
 * 获取问题的干预措施
 */
exports.getInterventionsByIssueId = async (issueId, status = 'active', client = pool) => {
  const result = await client.query(
    `SELECT * FROM intervention 
     WHERE issue_id = $1 AND status = $2
     ORDER BY priority DESC, id`,
    [issueId, status]
  );
  return result.rows;
};

/**
 * 获取干预措施详情
 */
exports.getInterventionById = async (interventionId, client = pool) => {
  const result = await client.query(
    'SELECT * FROM intervention WHERE id = $1',
    [interventionId]
  );
  return result.rows[0];
};

/**
 * 更新干预执行记录
 */
exports.updateInterventionExecution = async (interventionId, client = pool) => {
  const result = await client.query(
    `UPDATE intervention 
     SET execution_count = execution_count + 1,
         last_executed_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [interventionId]
  );
  return result.rows[0];
};

// ========== Attention Event 关注度事件 ==========

/**
 * 创建关注度事件
 */
exports.createAttentionEvent = async ({
  issueId,
  eventType,
  scoreChange,
  scoreBefore,
  scoreAfter,
  note,
  relatedOccurrenceId,
  relatedInterventionId,
}, client = pool) => {
  const result = await client.query(
    `INSERT INTO issue_attention_event (issue_id, event_type, score_change, score_before, score_after, note, related_occurrence_id, related_intervention_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [issueId, eventType, scoreChange, scoreBefore, scoreAfter, note, relatedOccurrenceId, relatedInterventionId]
  );
  return result.rows[0];
};

/**
 * 获取关注度事件历史
 */
exports.getAttentionEventsByIssueId = async (issueId, limit = 50, client = pool) => {
  const result = await client.query(
    `SELECT * FROM issue_attention_event 
     WHERE issue_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [issueId, limit]
  );
  return result.rows;
};
