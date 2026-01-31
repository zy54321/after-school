/**
 * Family Repository Layer
 * 负责所有数据库 SQL 操作
 */
const pool = require('../../../shared/config/db');

// ========== 成员相关 ==========

/**
 * 根据 userId 获取成员列表
 */
exports.getMembersByParentId = async (parentId) => {
  const result = await pool.query(
    'SELECT * FROM family_members WHERE parent_id = $1 ORDER BY id',
    [parentId]
  );
  return result.rows;
};

/**
 * 创建默认成员
 */
exports.createDefaultMember = async (parentId, name = '宝贝') => {
  const result = await pool.query(
    'INSERT INTO family_members (parent_id, name) VALUES ($1, $2) RETURNING *',
    [parentId, name]
  );
  return result.rows[0];
};

// ========== 分类相关 ==========

/**
 * 获取分类列表（包括公共分类和用户自定义分类）
 */
exports.getCategoriesByParentId = async (parentId) => {
  const result = await pool.query(
    'SELECT * FROM family_categories WHERE parent_id = 0 OR parent_id = $1 ORDER BY sort_order, id',
    [parentId]
  );
  return result.rows;
};

// ========== 任务相关 ==========

/**
 * 获取任务列表（包括公共任务和用户自定义任务）
 */
exports.getTasksByParentId = async (parentId) => {
  const result = await pool.query(
    'SELECT * FROM family_tasks WHERE parent_id = $1 OR parent_id = 0 ORDER BY id',
    [parentId]
  );
  return result.rows;
};

/**
 * 根据任务ID获取任务
 */
exports.getTaskById = async (taskId) => {
  const result = await pool.query(
    'SELECT title FROM family_tasks WHERE id=$1',
    [taskId]
  );
  return result.rows[0];
};

// ========== 奖励相关 ==========

/**
 * 获取奖励列表（包括公共奖励和用户自定义奖励）
 */
exports.getRewardsByParentId = async (parentId) => {
  const result = await pool.query(
    'SELECT * FROM family_rewards WHERE parent_id = $1 OR parent_id = 0 ORDER BY cost',
    [parentId]
  );
  return result.rows;
};

// ========== 积分流水相关 ==========

/**
 * 获取成员积分总额
 */
exports.getMemberTotalPoints = async (memberId) => {
  const result = await pool.query(
    'SELECT SUM(points_change) as total FROM family_points_log WHERE member_id = $1',
    [memberId]
  );
  return parseInt(result.rows[0].total || 0);
};

/**
 * 获取成员积分历史记录
 * @param {number} memberId - 成员ID
 * @param {object} options - 查询选项
 * @param {Date} options.startDate - 开始日期（可选）
 * @param {Date} options.endDate - 结束日期（可选）
 * @param {number} options.limit - 限制条数（可选，默认50）
 */
exports.getMemberPointsHistory = async (memberId, options = {}) => {
  const { startDate, endDate, limit = 50 } = options;

  let query = 'SELECT * FROM family_points_log WHERE member_id = $1';
  const params = [memberId];

  if (startDate && endDate) {
    query += ' AND created_at >= $2 AND created_at <= $3 ORDER BY created_at DESC';
    params.push(startDate, endDate);
  } else {
    query += ` ORDER BY created_at DESC LIMIT ${limit}`;
  }

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * 获取成员兑换统计
 */
exports.getMemberUsageStats = async (memberId) => {
  const result = await pool.query(
    `SELECT reward_id, COUNT(*) as usage_count FROM family_points_log 
     WHERE member_id = $1 AND points_change < 0 AND reward_id IS NOT NULL GROUP BY reward_id`,
    [memberId]
  );
  return result.rows;
};

/**
 * 创建积分流水记录
 */
exports.createPointsLog = async (memberId, taskId, description, pointsChange, reasonCode = null) => {
  const result = await pool.query(
    'INSERT INTO family_points_log (member_id, task_id, description, points_change, reason_code) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [memberId, taskId || null, description, pointsChange, reasonCode]
  );
  return result.rows[0];
};

// ========== 奖励/兑换相关（支持事务） ==========

/**
 * 根据ID获取奖励详情
 * @param {object} client - 数据库连接（支持事务）
 */
exports.getRewardById = async (rewardId, client = pool) => {
  const result = await client.query(
    'SELECT * FROM family_rewards WHERE id = $1',
    [rewardId]
  );
  return result.rows[0];
};

/**
 * 获取成员积分余额（事务版）
 * @param {object} client - 数据库连接
 */
exports.getMemberBalance = async (memberId, client = pool) => {
  const result = await client.query(
    'SELECT SUM(points_change) as total FROM family_points_log WHERE member_id = $1',
    [memberId]
  );
  return parseInt(result.rows[0].total || 0);
};

/**
 * 获取指定时间段内的兑换次数
 * @param {object} client - 数据库连接
 */
exports.getRedeemCountSince = async (memberId, rewardId, sinceDate, client = pool) => {
  const result = await client.query(
    'SELECT COUNT(*) FROM family_points_log WHERE member_id=$1 AND reward_id=$2 AND created_at >= $3',
    [memberId, rewardId, sinceDate]
  );
  return parseInt(result.rows[0].count);
};

/**
 * 创建兑换流水记录（带奖励ID）
 * @param {object} client - 数据库连接
 */
exports.createRedeemLog = async (memberId, rewardId, description, pointsChange, client = pool) => {
  const result = await client.query(
    'INSERT INTO family_points_log (member_id, reward_id, description, points_change) VALUES ($1, $2, $3, $4) RETURNING id',
    [memberId, rewardId, description, pointsChange]
  );
  return result.rows[0];
};

// ========== 背包相关 ==========

/**
 * 查询成员未使用的相同物品
 * @param {object} client - 数据库连接
 */
exports.findUnusedBackpackItem = async (memberId, rewardId, client = pool) => {
  const result = await client.query(
    'SELECT id, quantity FROM family_backpack WHERE member_id=$1 AND reward_id=$2 AND status=$3',
    [memberId, rewardId, 'unused']
  );
  return result.rows[0];
};

/**
 * 增加背包物品数量
 * @param {object} client - 数据库连接
 */
exports.incrementBackpackQuantity = async (backpackId, client = pool) => {
  await client.query(
    'UPDATE family_backpack SET quantity=quantity+1, updated_at=CURRENT_TIMESTAMP WHERE id=$1',
    [backpackId]
  );
};

/**
 * 创建背包物品
 * @param {object} client - 数据库连接
 */
exports.createBackpackItem = async (memberId, rewardId, pointsLogId, client = pool) => {
  const result = await client.query(
    'INSERT INTO family_backpack (member_id, reward_id, points_log_id, quantity, status, obtained_at) VALUES ($1, $2, $3, 1, $4, CURRENT_TIMESTAMP) RETURNING *',
    [memberId, rewardId, pointsLogId, 'unused']
  );
  return result.rows[0];
};

/**
 * 获取背包物品列表
 */
exports.getBackpackItems = async (memberId, status = null) => {
  let query = `
    SELECT 
      bp.*,
      r.name as reward_name,
      r.icon as reward_icon,
      r.type as reward_type,
      r.description as reward_description
    FROM family_backpack bp
    LEFT JOIN family_rewards r ON bp.reward_id = r.id
    WHERE bp.member_id = $1
  `;
  const params = [memberId];

  if (status && status !== 'all') {
    query += ' AND bp.status = $2';
    params.push(status);
  }

  query += ' ORDER BY bp.obtained_at DESC';

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * 获取背包统计信息
 */
exports.getBackpackStats = async (memberId) => {
  const result = await pool.query(
    `SELECT 
      COUNT(*) as total_items,
      SUM(CASE WHEN status = 'unused' THEN quantity ELSE 0 END) as unused_count,
      SUM(CASE WHEN status = 'used' THEN quantity ELSE 0 END) as used_count
    FROM family_backpack 
    WHERE member_id = $1`,
    [memberId]
  );
  const stats = result.rows[0] || { total_items: 0, unused_count: 0, used_count: 0 };
  return {
    total_items: parseInt(stats.total_items || 0),
    unused_count: parseInt(stats.unused_count || 0),
    used_count: parseInt(stats.used_count || 0),
  };
};

/**
 * 根据ID获取背包物品（支持事务）
 * @param {object} client - 数据库连接
 */
exports.getBackpackItemById = async (backpackId, memberId, client = pool) => {
  const result = await client.query(
    'SELECT * FROM family_backpack WHERE id = $1 AND member_id = $2',
    [backpackId, memberId]
  );
  return result.rows[0];
};

/**
 * 标记背包物品为已使用
 * @param {object} client - 数据库连接
 */
exports.markBackpackItemUsed = async (backpackId, client = pool) => {
  await client.query(
    'UPDATE family_backpack SET status=$1, used_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=$2',
    ['used', backpackId]
  );
};

/**
 * 减少背包物品数量
 * @param {object} client - 数据库连接
 */
exports.decrementBackpackQuantity = async (backpackId, quantity, client = pool) => {
  await client.query(
    'UPDATE family_backpack SET quantity=quantity-$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2',
    [quantity, backpackId]
  );
};

/**
 * 记录背包使用历史
 * @param {object} client - 数据库连接
 */
exports.createBackpackUsageLog = async (backpackId, memberId, rewardId, quantity, client = pool) => {
  await client.query(
    `INSERT INTO family_backpack_usage_log (backpack_id, member_id, reward_id, quantity, used_at) 
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
    [backpackId, memberId, rewardId, quantity]
  );
};

/**
 * 获取数据库连接池（用于事务）
 */
exports.getPool = () => pool;

// ========== 成员管理 ==========

/**
 * 创建成员
 */
exports.createMember = async (parentId, name, avatar = '') => {
  const result = await pool.query(
    'INSERT INTO family_members (parent_id, name, avatar) VALUES ($1, $2, $3) RETURNING *',
    [parentId, name, avatar]
  );
  return result.rows[0];
};

/**
 * 更新成员
 */
exports.updateMember = async (id, name, avatar = null, bio = null) => {
  // 验证 id 必须是有效的整数
  const memberId = parseInt(id, 10);
  if (isNaN(memberId) || memberId <= 0) {
    throw new Error('无效的成员ID');
  }

  const updates = [];
  const values = [];
  let paramIndex = 1;

  if (name !== undefined && name !== null) {
    updates.push(`name=$${paramIndex++}`);
    values.push(name);
  }
  if (avatar !== null && avatar !== undefined) {
    updates.push(`avatar=$${paramIndex++}`);
    values.push(avatar);
  }
  if (bio !== null && bio !== undefined) {
    updates.push(`bio=$${paramIndex++}`);
    values.push(bio);
  }

  if (updates.length === 0) {
    throw new Error('没有需要更新的字段');
  }

  values.push(memberId);
  await pool.query(
    `UPDATE family_members SET ${updates.join(', ')} WHERE id=$${paramIndex}`,
    values
  );
};

/**
 * 删除成员相关的积分记录
 */
exports.deletePointsLogByMemberId = async (memberId, client = pool) => {
  await client.query('DELETE FROM family_points_log WHERE member_id=$1', [memberId]);
};

/**
 * 删除成员
 */
exports.deleteMember = async (memberId, client = pool) => {
  await client.query('DELETE FROM family_members WHERE id=$1', [memberId]);
};

// ========== 任务/奖励管理 ==========

/**
 * 创建任务
 */
exports.createTask = async (parentId, title, category, points, targetMembers) => {
  const result = await pool.query(
    'INSERT INTO family_tasks (parent_id, title, category, points, icon, target_members) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [parentId, title, category, points, '🌟', targetMembers]
  );
  return result.rows[0];
};

/**
 * 更新任务
 */
exports.updateTask = async (id, title, category, points, targetMembers) => {
  await pool.query(
    'UPDATE family_tasks SET title=$1, category=$2, points=$3, target_members=$4 WHERE id=$5',
    [title, category, points, targetMembers, id]
  );
};

/**
 * 删除任务
 */
exports.deleteTask = async (id) => {
  await pool.query('DELETE FROM family_tasks WHERE id=$1', [id]);
};

/**
 * 创建奖励
 */
exports.createReward = async (parentId, name, cost, limitType, limitMax, targetMembers, type, description) => {
  const result = await pool.query(
    'INSERT INTO family_rewards (parent_id, name, cost, limit_type, limit_max, target_members, type, description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
    [parentId, name, cost, limitType || 'unlimited', limitMax || 0, targetMembers, type || 'reward', description || null]
  );
  return result.rows[0];
};

/**
 * 更新奖励
 */
exports.updateReward = async (id, name, cost, limitType, limitMax, targetMembers, type, description) => {
  await pool.query(
    'UPDATE family_rewards SET name=$1, cost=$2, limit_type=$3, limit_max=$4, target_members=$5, type=$6, description=$7 WHERE id=$8',
    [name, cost, limitType, limitMax, targetMembers, type, description || null, id]
  );
};

/**
 * 删除奖励
 */
exports.deleteReward = async (id) => {
  await pool.query('DELETE FROM family_rewards WHERE id=$1', [id]);
};

// ========== 分类管理 ==========

/**
 * 创建分类
 */
exports.createCategory = async (parentId, name, key) => {
  const result = await pool.query(
    'INSERT INTO family_categories (parent_id, name, key, sort_order) VALUES ($1, $2, $3, 99) RETURNING *',
    [parentId, name, key]
  );
  return result.rows[0];
};

/**
 * 删除分类
 */
exports.deleteCategory = async (id) => {
  await pool.query('DELETE FROM family_categories WHERE id=$1', [id]);
};

// ========== 转赠背包物品 ==========

/**
 * 获取成员信息（支持事务）
 */
exports.getMemberById = async (memberId, client = pool) => {
  const result = await client.query(
    'SELECT * FROM family_members WHERE id = $1',
    [memberId]
  );
  return result.rows[0];
};

/**
 * 更新背包物品归属
 */
exports.updateBackpackOwner = async (backpackId, newMemberId, client = pool) => {
  await client.query(
    'UPDATE family_backpack SET member_id=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2',
    [newMemberId, backpackId]
  );
};

/**
 * 增加背包物品数量（指定数量）
 */
exports.incrementBackpackQuantityBy = async (backpackId, quantity, client = pool) => {
  await client.query(
    'UPDATE family_backpack SET quantity=quantity+$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2',
    [quantity, backpackId]
  );
};

/**
 * 创建背包物品（指定数量）
 */
exports.createBackpackItemWithQuantity = async (memberId, rewardId, pointsLogId, quantity, client = pool) => {
  const result = await client.query(
    `INSERT INTO family_backpack (member_id, reward_id, points_log_id, quantity, status, obtained_at) 
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP) RETURNING *`,
    [memberId, rewardId, pointsLogId, quantity, 'unused']
  );
  return result.rows[0];
};

// ========== 撤销流水 ==========

/**
 * 根据流水ID获取关联的背包记录
 */
exports.getBackpackByPointsLogIds = async (logIds, client = pool) => {
  const result = await client.query(
    'SELECT id FROM family_backpack WHERE points_log_id = ANY($1)',
    [logIds]
  );
  return result.rows.map(row => row.id);
};

/**
 * 删除背包使用记录
 */
exports.deleteBackpackUsageLogByBackpackIds = async (backpackIds, client = pool) => {
  if (backpackIds.length > 0) {
    await client.query(
      'DELETE FROM family_backpack_usage_log WHERE backpack_id = ANY($1)',
      [backpackIds]
    );
  }
};

/**
 * 删除背包记录
 */
exports.deleteBackpackByIds = async (backpackIds, client = pool) => {
  if (backpackIds.length > 0) {
    await client.query(
      'DELETE FROM family_backpack WHERE id = ANY($1)',
      [backpackIds]
    );
  }
};

/**
 * 删除积分流水记录
 */
exports.deletePointsLogByIds = async (logIds, client = pool) => {
  await client.query('DELETE FROM family_points_log WHERE id = ANY($1)', [logIds]);
};

// ========== 使用记录查询 ==========

/**
 * 获取背包使用历史
 */
exports.getUsageHistory = async (memberId, rewardId = null, limit = 50) => {
  let query = `
    SELECT 
      ul.*,
      r.name as reward_name,
      r.icon as reward_icon,
      r.type as reward_type
    FROM family_backpack_usage_log ul
    LEFT JOIN family_rewards r ON ul.reward_id = r.id
    WHERE ul.member_id = $1
  `;
  const params = [memberId];

  if (rewardId) {
    query += ' AND ul.reward_id = $2';
    params.push(rewardId);
  }

  query += ' ORDER BY ul.used_at DESC';
  query += ` LIMIT $${params.length + 1}`;
  params.push(parseInt(limit) || 50);

  const result = await pool.query(query, params);
  return result.rows;
};

// ========== ✅ 预设管理 (Presets) - 成员级 ==========

/**
 * 获取成员的所有预设规则
 * @param {number} memberId - 成员ID
 * @param {object} client - 数据库连接（可选）
 */
exports.getMemberPresets = async (memberId, client = pool) => {
  const result = await client.query(
    'SELECT * FROM family_point_presets WHERE member_id = $1 ORDER BY category, id ASC',
    [memberId]
  );
  return result.rows;
};

/**
 * 获取成员的奖励规则（type='add'）
 * @param {number} memberId - 成员ID
 * @param {object} client - 数据库连接（可选）
 */
exports.getMemberRewardRules = async (memberId, client = pool) => {
  const result = await client.query(
    'SELECT * FROM family_point_presets WHERE member_id = $1 AND type = $2 ORDER BY category, id ASC',
    [memberId, 'add']
  );
  return result.rows;
};

/**
 * 获取成员的惩罚规则（type='deduct'）
 * @param {number} memberId - 成员ID
 * @param {object} client - 数据库连接（可选）
 */
exports.getMemberPenaltyRules = async (memberId, client = pool) => {
  const result = await client.query(
    'SELECT * FROM family_point_presets WHERE member_id = $1 AND type = $2 ORDER BY category, id ASC',
    [memberId, 'deduct']
  );
  return result.rows;
};

/**
 * 创建成员预设规则
 * @param {number} parentId - 用户ID
 * @param {number} memberId - 成员ID
 * @param {string} label - 规则名称
 * @param {number} points - 积分值
 * @param {string} type - 类型（'add' 或 'deduct'）
 * @param {string} icon - 图标
 * @param {string} category - 分类
 * @param {object} client - 数据库连接（可选）
 */
exports.createMemberPreset = async (parentId, memberId, label, points, type, icon, category, client = pool) => {
  const result = await client.query(
    `INSERT INTO family_point_presets (parent_id, member_id, label, points, type, icon, category) 
     VALUES ($1, $2, $3, $4, $5, $6, $7) 
     RETURNING *`,
    [parentId, memberId, label, points, type, icon || '🌟', category || '常规']
  );
  return result.rows[0];
};

/**
 * 插入或更新成员预设规则（UPSERT）
 * @param {number} parentId - 用户ID
 * @param {number} memberId - 成员ID
 * @param {string} label - 规则名称
 * @param {number} points - 积分值
 * @param {string} type - 类型（'add' 或 'deduct'）
 * @param {string} icon - 图标
 * @param {string} category - 分类
 * @param {object} client - 数据库连接（可选）
 */
exports.upsertMemberPreset = async (parentId, memberId, label, points, type, icon, category, client = pool) => {
  const result = await client.query(
    `INSERT INTO family_point_presets (parent_id, member_id, label, points, type, icon, category) 
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (member_id, label)
     DO UPDATE SET
       points = EXCLUDED.points,
       type = EXCLUDED.type,
       icon = EXCLUDED.icon,
       category = EXCLUDED.category
     RETURNING *`,
    [parentId, memberId, label, points, type, icon || '🌟', category || '常规']
  );
  return result.rows[0];
};

/**
 * 更新成员预设规则
 * @param {number} id - 预设ID
 * @param {number} memberId - 成员ID（用于权限校验）
 * @param {string} label - 规则名称
 * @param {number} points - 积分值
 * @param {string} type - 类型（'add' 或 'deduct'）
 * @param {string} icon - 图标
 * @param {string} category - 分类
 * @param {object} client - 数据库连接（可选）
 */
exports.updateMemberPreset = async (id, memberId, label, points, type, icon, category, client = pool) => {
  const result = await client.query(
    `UPDATE family_point_presets 
     SET label=$1, points=$2, type=$3, icon=$4, category=$5 
     WHERE id=$6 AND member_id=$7 
     RETURNING *`,
    [label, points, type, icon || '🌟', category || '常规', id, memberId]
  );
  return result.rows[0];
};

/**
 * 删除成员预设规则
 * @param {number} id - 预设ID
 * @param {number} memberId - 成员ID（用于权限校验和约束）
 * @param {object} client - 数据库连接（可选）
 * @returns {Promise<boolean>} 是否成功删除（true=已删除，false=未找到）
 */
exports.deleteMemberPreset = async (id, memberId, client = pool) => {
  // 固定使用 member_id 约束的删除，禁止仅按 id 或 parent_id 删除
  const result = await client.query(
    'DELETE FROM family_point_presets WHERE id=$1 AND member_id=$2 RETURNING id',
    [id, memberId]
  );
  // 返回是否真的删除了（影响行数 > 0）
  return result.rows.length > 0;
};

// ========== 兼容旧接口（已废弃，保留用于过渡） ==========

/**
 * 获取所有预设（已废弃，请使用 getMemberPresets）
 * @deprecated 请使用 getMemberPresets(memberId)
 */
exports.getPresets = async () => {
  // 按分类和ID排序，让同类聚在一起
  const result = await pool.query('SELECT * FROM family_point_presets ORDER BY category, id ASC');
  return result.rows;
};

/**
 * 创建预设（已废弃，请使用 createMemberPreset）
 * @deprecated 请使用 createMemberPreset(parentId, memberId, ...)
 */
exports.createPreset = async (label, points, type, icon, category) => {
  const result = await pool.query(
    'INSERT INTO family_point_presets (label, points, type, icon, category) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [label, points, type, icon, category || '常规']
  );
  return result.rows[0];
};

/**
 * 更新预设（已废弃，请使用 updateMemberPreset）
 * @deprecated 请使用 updateMemberPreset(id, memberId, ...)
 */
exports.updatePreset = async (id, label, points, type, icon, category) => {
  const result = await pool.query(
    'UPDATE family_point_presets SET label=$1, points=$2, type=$3, icon=$4, category=$5 WHERE id=$6 RETURNING *',
    [label, points, type, icon, category || '常规', id]
  );
  return result.rows[0];
};

/**
 * 删除预设（已废弃，请使用 deleteMemberPreset）
 * @deprecated 请使用 deleteMemberPreset(id, memberId)
 */
exports.deletePreset = async (id) => {
  await pool.query('DELETE FROM family_point_presets WHERE id=$1', [id]);
  return true;
};

/**
 * 批量更新预设分类 (重命名)
 */
exports.updatePresetCategory = async (oldCategory, newCategory) => {
  await pool.query(
    'UPDATE family_point_presets SET category = $1 WHERE category = $2',
    [newCategory, oldCategory]
  );
};

/**
 * 删除预设分类 (实际上是将该分类下的所有项移动到 '常规')
 */
exports.deletePresetCategory = async (category) => {
  await pool.query(
    "UPDATE family_point_presets SET category = '常规' WHERE category = $1",
    [category]
  );
};