/**
 * Bounty Repository
 * 悬赏任务数据访问层
 */
const pool = require('../../../shared/config/db');

exports.getPool = () => pool;

// ========== 悬赏任务 CRUD ==========

/**
 * 创建悬赏任务
 */
exports.createTask = async (data, client = pool) => {
  const {
    parentId,
    publisherMemberId,
    title,
    description,
    bountyPoints,
    escrowPoints,
    dueAt,
    acceptCriteria,
    status = 'open',
    issueId = null,
  } = data;

  const result = await client.query(
    `INSERT INTO bounty_task (
      parent_id, publisher_member_id, title, description,
      bounty_points, escrow_points, due_at, accept_criteria, status, issue_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      parentId,
      publisherMemberId,
      title,
      description,
      bountyPoints,
      escrowPoints,
      dueAt,
      acceptCriteria,
      status,
      issueId,
    ]
  );
  return result.rows[0];
};

/**
 * 根据ID获取任务
 */
exports.getTaskById = async (taskId, client = pool) => {
  const result = await client.query(
    'SELECT * FROM bounty_task WHERE id = $1',
    [taskId]
  );
  return result.rows[0];
};

/**
 * 获取任务详情（含发布者信息）
 */
exports.getTaskDetail = async (taskId, client = pool) => {
  const result = await client.query(
    `SELECT * FROM v_bounty_task_detail WHERE id = $1`,
    [taskId]
  );
  return result.rows[0];
};

/**
 * 更新任务状态
 */
exports.updateTaskStatus = async (taskId, status, client = pool) => {
  const result = await client.query(
    `UPDATE bounty_task SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [status, taskId]
  );
  return result.rows[0];
};

/**
 * 更新任务托管积分
 */
exports.updateTaskEscrow = async (taskId, escrowPoints, client = pool) => {
  const result = await client.query(
    `UPDATE bounty_task SET escrow_points = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [escrowPoints, taskId]
  );
  return result.rows[0];
};

/**
 * 获取用户的悬赏任务列表
 */
exports.getTasksByParentId = async (parentId, status = null, client = pool) => {
  let query = `
    SELECT bt.*, pm.name as publisher_name
    FROM bounty_task bt
    JOIN family_members pm ON bt.publisher_member_id = pm.id
    WHERE bt.parent_id = $1
  `;
  const params = [parentId];

  if (status) {
    query += ' AND bt.status = $2';
    params.push(status);
  }

  query += ' ORDER BY bt.created_at DESC';

  const result = await client.query(query, params);
  return result.rows;
};

/**
 * 获取成员可领取的任务列表
 */
exports.getOpenTasksForMember = async (parentId, memberId, client = pool) => {
  const result = await client.query(
    `SELECT bt.*, pm.name as publisher_name
     FROM bounty_task bt
     JOIN family_members pm ON bt.publisher_member_id = pm.id
     WHERE bt.parent_id = $1 
       AND bt.status = 'open'
       AND bt.publisher_member_id != $2
       AND (bt.due_at IS NULL OR bt.due_at > NOW())
     ORDER BY bt.bounty_points DESC, bt.created_at DESC`,
    [parentId, memberId]
  );
  return result.rows;
};

// ========== 任务领取 CRUD ==========

/**
 * 创建领取记录
 */
exports.createClaim = async (data, client = pool) => {
  const { taskId, claimerMemberId, status = 'active' } = data;

  const result = await client.query(
    `INSERT INTO task_claim (task_id, claimer_member_id, status)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [taskId, claimerMemberId, status]
  );
  return result.rows[0];
};

/**
 * 获取任务的当前活跃领取记录
 */
exports.getActiveClaimByTaskId = async (taskId, client = pool) => {
  const result = await client.query(
    `SELECT tc.*, m.name as claimer_name
     FROM task_claim tc
     JOIN family_members m ON tc.claimer_member_id = m.id
     WHERE tc.task_id = $1 AND tc.status = 'active'
     LIMIT 1`,
    [taskId]
  );
  return result.rows[0];
};

/**
 * 获取领取记录详情
 */
exports.getClaimById = async (claimId, client = pool) => {
  const result = await client.query(
    `SELECT tc.*, m.name as claimer_name
     FROM task_claim tc
     JOIN family_members m ON tc.claimer_member_id = m.id
     WHERE tc.id = $1`,
    [claimId]
  );
  return result.rows[0];
};

/**
 * 更新领取状态
 */
exports.updateClaimStatus = async (claimId, status, client = pool) => {
  const result = await client.query(
    `UPDATE task_claim SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [status, claimId]
  );
  return result.rows[0];
};

/**
 * 提交任务
 */
exports.submitClaim = async (claimId, submissionNote, client = pool) => {
  const result = await client.query(
    `UPDATE task_claim 
     SET status = 'submitted', submitted_at = NOW(), submission_note = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [submissionNote, claimId]
  );
  return result.rows[0];
};

/**
 * 获取成员的领取记录
 */
exports.getClaimsByMemberId = async (memberId, status = null, client = pool) => {
  let query = `
    SELECT tc.*, bt.title, bt.bounty_points, bt.due_at
    FROM task_claim tc
    JOIN bounty_task bt ON tc.task_id = bt.id
    WHERE tc.claimer_member_id = $1
  `;
  const params = [memberId];

  if (status) {
    query += ' AND tc.status = $2';
    params.push(status);
  }

  query += ' ORDER BY tc.claimed_at DESC';

  const result = await client.query(query, params);
  return result.rows;
};

// ========== 任务审核 CRUD ==========

/**
 * 创建审核记录
 */
exports.createReview = async (data, client = pool) => {
  const { taskId, claimId, reviewerMemberId, decision, comment } = data;

  const result = await client.query(
    `INSERT INTO task_review (task_id, claim_id, reviewer_member_id, decision, comment)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [taskId, claimId, reviewerMemberId, decision, comment]
  );
  return result.rows[0];
};

/**
 * 获取任务的审核历史
 */
exports.getReviewsByTaskId = async (taskId, client = pool) => {
  const result = await client.query(
    `SELECT tr.*, m.name as reviewer_name
     FROM task_review tr
     JOIN family_members m ON tr.reviewer_member_id = m.id
     WHERE tr.task_id = $1
     ORDER BY tr.created_at DESC`,
    [taskId]
  );
  return result.rows;
};

// ========== 辅助查询 ==========

/**
 * 检查成员是否已领取某任务
 */
exports.hasActiveClaim = async (taskId, memberId, client = pool) => {
  const result = await client.query(
    `SELECT 1 FROM task_claim 
     WHERE task_id = $1 AND claimer_member_id = $2 AND status IN ('active', 'submitted')
     LIMIT 1`,
    [taskId, memberId]
  );
  return result.rows.length > 0;
};

/**
 * 获取待审核的提交
 */
exports.getPendingSubmissions = async (parentId, client = pool) => {
  const result = await client.query(
    `SELECT tc.*, bt.title, bt.bounty_points, bt.publisher_member_id,
            cm.name as claimer_name, pm.name as publisher_name
     FROM task_claim tc
     JOIN bounty_task bt ON tc.task_id = bt.id
     JOIN family_members cm ON tc.claimer_member_id = cm.id
     JOIN family_members pm ON bt.publisher_member_id = pm.id
     WHERE bt.parent_id = $1 AND tc.status = 'submitted'
     ORDER BY tc.submitted_at ASC`,
    [parentId]
  );
  return result.rows;
};
