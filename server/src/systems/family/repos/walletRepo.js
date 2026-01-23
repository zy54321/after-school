/**
 * Wallet Repository Layer
 * 负责钱包/积分相关的数据库 SQL 操作
 */
const pool = require('../../../shared/config/db');

/**
 * 获取数据库连接池（用于事务）
 */
exports.getPool = () => pool;

// ========== 余额相关 ==========

/**
 * 获取成员积分余额
 * @param {number} memberId - 成员ID
 * @param {object} client - 数据库连接（支持事务）
 */
exports.getBalance = async (memberId, client = pool) => {
  const result = await client.query(
    'SELECT COALESCE(SUM(points_change), 0) as balance FROM family_points_log WHERE member_id = $1',
    [memberId]
  );
  return parseInt(result.rows[0].balance);
};

/**
 * 获取成员信息（含 parent_id 用于幂等键约束）
 */
exports.getMemberById = async (memberId, client = pool) => {
  const result = await client.query(
    'SELECT * FROM family_members WHERE id = $1',
    [memberId]
  );
  return result.rows[0];
};

// ========== 积分流水相关 ==========

/**
 * 根据幂等键查询积分流水
 */
exports.getPointsLogByIdempotencyKey = async (parentId, idempotencyKey, client = pool) => {
  const result = await client.query(
    `SELECT * FROM family_points_log 
     WHERE parent_id = $1 AND idempotency_key = $2`,
    [parentId, idempotencyKey]
  );
  return result.rows[0];
};

/**
 * 创建积分流水（完整版，支持商城字段）
 * @param {object} params - 流水参数
 * @param {number} params.memberId - 成员ID
 * @param {number} params.parentId - 父用户ID（用于幂等约束）
 * @param {number} params.taskId - 任务ID（可选）
 * @param {number} params.rewardId - 奖励ID（可选）
 * @param {number} params.orderId - 商城订单ID（可选）
 * @param {string} params.description - 描述
 * @param {number} params.pointsChange - 积分变化值
 * @param {string} params.reasonCode - 原因代码
 * @param {string} params.idempotencyKey - 幂等键（可选）
 * @param {object} client - 数据库连接
 */
exports.createPointsLog = async ({
  memberId,
  parentId,
  taskId = null,
  rewardId = null,
  orderId = null,
  description,
  pointsChange,
  reasonCode,
  idempotencyKey = null
}, client = pool) => {
  const result = await client.query(
    `INSERT INTO family_points_log 
     (member_id, parent_id, task_id, reward_id, order_id, description, points_change, reason_code, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [memberId, parentId, taskId, rewardId, orderId, description, pointsChange, reasonCode, idempotencyKey]
  );
  return result.rows[0];
};

/**
 * 获取成员积分流水列表
 * @param {number} memberId - 成员ID
 * @param {object} options - 查询选项
 * @param {number} options.limit - 限制条数
 * @param {number} options.offset - 偏移量
 * @param {string} options.reasonCode - 筛选原因代码
 * @param {Date} options.startDate - 开始日期
 * @param {Date} options.endDate - 结束日期
 */
exports.listLogs = async (memberId, options = {}, client = pool) => {
  const { limit = 50, offset = 0, reasonCode, startDate, endDate } = options;
  
  let query = `
    SELECT 
      pl.*,
      t.title as task_title,
      r.name as reward_name
    FROM family_points_log pl
    LEFT JOIN family_tasks t ON pl.task_id = t.id
    LEFT JOIN family_rewards r ON pl.reward_id = r.id
    WHERE pl.member_id = $1
  `;
  const params = [memberId];
  let paramIndex = 2;
  
  if (reasonCode) {
    query += ` AND pl.reason_code = $${paramIndex}`;
    params.push(reasonCode);
    paramIndex++;
  }
  
  if (startDate) {
    query += ` AND pl.created_at >= $${paramIndex}`;
    params.push(startDate);
    paramIndex++;
  }
  
  if (endDate) {
    query += ` AND pl.created_at <= $${paramIndex}`;
    params.push(endDate);
    paramIndex++;
  }
  
  query += ` ORDER BY pl.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);
  
  const result = await client.query(query, params);
  return result.rows;
};

/**
 * 获取成员积分流水总数（用于分页）
 */
exports.countLogs = async (memberId, options = {}, client = pool) => {
  const { reasonCode, startDate, endDate } = options;
  
  let query = 'SELECT COUNT(*) FROM family_points_log WHERE member_id = $1';
  const params = [memberId];
  let paramIndex = 2;
  
  if (reasonCode) {
    query += ` AND reason_code = $${paramIndex}`;
    params.push(reasonCode);
    paramIndex++;
  }
  
  if (startDate) {
    query += ` AND created_at >= $${paramIndex}`;
    params.push(startDate);
    paramIndex++;
  }
  
  if (endDate) {
    query += ` AND created_at <= $${paramIndex}`;
    params.push(endDate);
    paramIndex++;
  }
  
  const result = await client.query(query, params);
  return parseInt(result.rows[0].count);
};

/**
 * 获取积分统计信息
 */
exports.getPointsStats = async (memberId, client = pool) => {
  const result = await client.query(
    `SELECT 
      COALESCE(SUM(CASE WHEN points_change > 0 THEN points_change ELSE 0 END), 0) as total_earned,
      COALESCE(SUM(CASE WHEN points_change < 0 THEN ABS(points_change) ELSE 0 END), 0) as total_spent,
      COALESCE(SUM(points_change), 0) as balance
    FROM family_points_log 
    WHERE member_id = $1`,
    [memberId]
  );
  const row = result.rows[0];
  return {
    totalEarned: parseInt(row.total_earned),
    totalSpent: parseInt(row.total_spent),
    balance: parseInt(row.balance),
  };
};
