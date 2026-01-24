/**
 * Lottery Repository Layer
 * 抽奖系统数据访问层
 */
const pool = require('../../../shared/config/db');

/**
 * 获取数据库连接池（用于事务）
 */
exports.getPool = () => pool;

// ========== Ticket Type 抽奖券类型 ==========

/**
 * 获取抽奖券类型
 */
exports.getTicketTypeById = async (ticketTypeId, client = pool) => {
  const result = await client.query(
    'SELECT * FROM ticket_type WHERE id = $1',
    [ticketTypeId]
  );
  return result.rows[0];
};

/**
 * 获取用户的所有抽奖券类型
 */
exports.getTicketTypesByParentId = async (parentId, client = pool) => {
  const result = await client.query(
    `SELECT * FROM ticket_type 
     WHERE parent_id = $1 AND status = 'active'
     ORDER BY sort_order, id`,
    [parentId]
  );
  return result.rows;
};

// ========== Draw Pool 抽奖池 ==========

/**
 * 获取抽奖池
 */
exports.getPoolById = async (poolId, client = pool) => {
  const result = await client.query(
    `SELECT dp.*, tt.name as ticket_type_name, tt.icon as ticket_type_icon
     FROM draw_pool dp
     LEFT JOIN ticket_type tt ON dp.entry_ticket_type_id = tt.id
     WHERE dp.id = $1`,
    [poolId]
  );
  return result.rows[0];
};

/**
 * 获取用户的所有抽奖池
 */
exports.getPoolsByParentId = async (parentId, status = 'active', client = pool) => {
  const result = await client.query(
    `SELECT dp.*, tt.name as ticket_type_name, tt.icon as ticket_type_icon
     FROM draw_pool dp
     LEFT JOIN ticket_type tt ON dp.entry_ticket_type_id = tt.id
     WHERE dp.parent_id = $1 AND dp.status = $2
     ORDER BY dp.id`,
    [parentId, status]
  );
  return result.rows;
};

// ========== Draw Pool Version 抽奖池版本 ==========

/**
 * 获取抽奖池当前版本
 */
exports.getCurrentVersion = async (poolId, client = pool) => {
  const result = await client.query(
    `SELECT * FROM draw_pool_version 
     WHERE pool_id = $1 AND is_current = TRUE
     LIMIT 1`,
    [poolId]
  );
  return result.rows[0];
};

/**
 * 获取版本详情
 */
exports.getVersionById = async (versionId, client = pool) => {
  const result = await client.query(
    'SELECT * FROM draw_pool_version WHERE id = $1',
    [versionId]
  );
  return result.rows[0];
};

// ========== Draw Log 抽奖记录 ==========

/**
 * 根据幂等键查找抽奖记录
 * 用于检查是否已处理过该请求
 */
exports.findDrawLogByIdempotencyKey = async (parentId, idempotencyKey, client = pool) => {
  if (!idempotencyKey) return null;
  
  const result = await client.query(
    `SELECT dl.*, dp.name as pool_name, dp.icon as pool_icon
     FROM draw_log dl
     JOIN draw_pool dp ON dl.pool_id = dp.id
     WHERE dl.parent_id = $1 AND dl.idempotency_key = $2
     LIMIT 1`,
    [parentId, idempotencyKey]
  );
  return result.rows[0];
};

/**
 * 创建抽奖记录
 */
exports.createDrawLog = async ({
  parentId,
  memberId,
  poolId,
  poolVersionId,
  ticketTypeId,
  ticketPointValue,
  ticketsUsed,
  resultPrizeId,
  resultType,
  resultName,
  resultValue,
  resultSkuId,
  orderId,
  inventoryId,
  pointsLogId,
  isGuarantee,
  consecutiveCount,
  idempotencyKey,
}, client = pool) => {
  const result = await client.query(
    `INSERT INTO draw_log (
      parent_id, member_id, pool_id, pool_version_id,
      ticket_type_id, ticket_point_value, tickets_used,
      result_prize_id, result_type, result_name, result_value, result_sku_id,
      order_id, inventory_id, points_log_id,
      is_guarantee, consecutive_count, idempotency_key
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    RETURNING *`,
    [
      parentId, memberId, poolId, poolVersionId,
      ticketTypeId, ticketPointValue, ticketsUsed,
      resultPrizeId, resultType, resultName, resultValue, resultSkuId,
      orderId, inventoryId, pointsLogId,
      isGuarantee, consecutiveCount, idempotencyKey,
    ]
  );
  return result.rows[0];
};

/**
 * 获取成员的抽奖记录
 */
exports.getDrawLogsByMemberId = async (memberId, limit = 50, client = pool) => {
  const result = await client.query(
    `SELECT dl.*, dp.name as pool_name, dp.icon as pool_icon
     FROM draw_log dl
     JOIN draw_pool dp ON dl.pool_id = dp.id
     WHERE dl.member_id = $1
     ORDER BY dl.created_at DESC
     LIMIT $2`,
    [memberId, limit]
  );
  return result.rows;
};

/**
 * 获取成员在指定抽奖池的连续抽奖次数（未中大奖）
 * 用于保底计算
 */
exports.getConsecutiveCountSinceLastBigWin = async (memberId, poolId, guaranteePrizeId, client = pool) => {
  // 查找最后一次中保底奖品的记录
  const lastWinResult = await client.query(
    `SELECT id, created_at FROM draw_log 
     WHERE member_id = $1 AND pool_id = $2 AND result_prize_id = $3
     ORDER BY created_at DESC
     LIMIT 1`,
    [memberId, poolId, guaranteePrizeId]
  );
  
  let sinceTime = null;
  if (lastWinResult.rows.length > 0) {
    sinceTime = lastWinResult.rows[0].created_at;
  }
  
  // 计算从那之后的抽奖次数
  let query = `
    SELECT COUNT(*) FROM draw_log 
    WHERE member_id = $1 AND pool_id = $2
  `;
  const params = [memberId, poolId];
  
  if (sinceTime) {
    query += ' AND created_at > $3';
    params.push(sinceTime);
  }
  
  const countResult = await client.query(query, params);
  return parseInt(countResult.rows[0].count);
};

/**
 * 获取成员今日使用某类型抽奖券的次数
 */
exports.getTodayTicketUsage = async (memberId, ticketTypeId, client = pool) => {
  const result = await client.query(
    `SELECT COALESCE(SUM(tickets_used), 0) as used_count
     FROM draw_log 
     WHERE member_id = $1 
       AND ticket_type_id = $2
       AND created_at >= CURRENT_DATE`,
    [memberId, ticketTypeId]
  );
  return parseInt(result.rows[0].used_count);
};

/**
 * 获取成员本周使用某类型抽奖券的次数
 */
exports.getWeeklyTicketUsage = async (memberId, ticketTypeId, client = pool) => {
  const result = await client.query(
    `SELECT COALESCE(SUM(tickets_used), 0) as used_count
     FROM draw_log 
     WHERE member_id = $1 
       AND ticket_type_id = $2
       AND created_at >= DATE_TRUNC('week', CURRENT_DATE)`,
    [memberId, ticketTypeId]
  );
  return parseInt(result.rows[0].used_count);
};

// ========== Inventory (抽奖券库存) ==========

/**
 * 获取成员的抽奖券库存
 * 通过 SKU type = 'ticket' 关联
 */
exports.getMemberTicketInventory = async (memberId, ticketTypeId, client = pool) => {
  // 先找到对应的 SKU（通过 ticket_type 的 point_value 匹配）
  // 或者直接用名称匹配
  const ticketType = await exports.getTicketTypeById(ticketTypeId, client);
  if (!ticketType) return [];
  
  const result = await client.query(
    `SELECT inv.*, sku.name as sku_name, sku.icon as sku_icon
     FROM family_inventory inv
     JOIN family_sku sku ON inv.sku_id = sku.id
     WHERE inv.member_id = $1 
       AND sku.type = 'ticket'
       AND sku.name LIKE $2
       AND inv.quantity > 0
     ORDER BY inv.obtained_at`,
    [memberId, `%${ticketType.name.replace('抽奖券', '').trim()}%`]
  );
  return result.rows;
};

/**
 * 获取成员指定 SKU 的库存数量
 */
exports.getInventoryQuantity = async (memberId, skuId, client = pool) => {
  const result = await client.query(
    `SELECT COALESCE(SUM(quantity), 0) as total
     FROM family_inventory 
     WHERE member_id = $1 AND sku_id = $2 AND quantity > 0`,
    [memberId, skuId]
  );
  return parseInt(result.rows[0].total);
};

/**
 * 扣减库存
 */
exports.decrementInventory = async (inventoryId, quantity = 1, client = pool) => {
  const result = await client.query(
    `UPDATE family_inventory 
     SET quantity = quantity - $2, 
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND quantity >= $2
     RETURNING *`,
    [inventoryId, quantity]
  );
  return result.rows[0];
};

/**
 * 查找可用的抽奖券库存（优先使用最早的）
 * @param {number} memberId - 成员ID
 * @param {number} skuId - SKU ID（显式关联，不再使用名称匹配）
 * @param {object} client - 数据库连接
 */
exports.findAvailableTicketInventoryBySkuId = async (memberId, skuId, client = pool) => {
  const result = await client.query(
    `SELECT inv.*, sku.name as sku_name
     FROM family_inventory inv
     JOIN family_sku sku ON inv.sku_id = sku.id
     WHERE inv.member_id = $1 
       AND inv.sku_id = $2
       AND inv.quantity > 0
     ORDER BY inv.obtained_at
     LIMIT 1`,
    [memberId, skuId]
  );
  return result.rows[0];
};

/**
 * 兼容旧版：通过名称查找库存（已废弃，建议使用 findAvailableTicketInventoryBySkuId）
 * @deprecated 使用 findAvailableTicketInventoryBySkuId 替代
 */
exports.findAvailableTicketInventory = async (memberId, ticketTypeName, client = pool) => {
  // 先尝试精确匹配
  let result = await client.query(
    `SELECT inv.*, sku.name as sku_name
     FROM family_inventory inv
     JOIN family_sku sku ON inv.sku_id = sku.id
     WHERE inv.member_id = $1 
       AND sku.type = 'ticket'
       AND sku.name = $2
       AND inv.quantity > 0
     ORDER BY inv.obtained_at
     LIMIT 1`,
    [memberId, ticketTypeName]
  );
  
  if (result.rows.length > 0) {
    return result.rows[0];
  }
  
  // 精确匹配失败，回退到模糊匹配（兼容旧数据）
  result = await client.query(
    `SELECT inv.*, sku.name as sku_name
     FROM family_inventory inv
     JOIN family_sku sku ON inv.sku_id = sku.id
     WHERE inv.member_id = $1 
       AND sku.type = 'ticket'
       AND sku.name ILIKE $2
       AND inv.quantity > 0
     ORDER BY inv.obtained_at
     LIMIT 1`,
    [memberId, `%${ticketTypeName}%`]
  );
  return result.rows[0];
};

/**
 * 获取成员的所有抽奖券统计
 * 使用 ticket_type.sku_id 显式关联，不再依赖名称匹配
 */
exports.getMemberTicketStats = async (memberId, parentId, client = pool) => {
  const result = await client.query(
    `SELECT 
      tt.id as ticket_type_id,
      tt.name as ticket_type_name,
      tt.icon as ticket_type_icon,
      tt.point_value,
      tt.daily_limit,
      tt.weekly_limit,
      tt.sku_id,
      COALESCE(SUM(inv.quantity), 0) as quantity
     FROM ticket_type tt
     LEFT JOIN family_inventory inv ON inv.sku_id = tt.sku_id AND inv.member_id = $1 AND inv.quantity > 0
     WHERE tt.parent_id = $2 AND tt.status = 'active'
     GROUP BY tt.id, tt.name, tt.icon, tt.point_value, tt.daily_limit, tt.weekly_limit, tt.sku_id
     ORDER BY tt.sort_order, tt.id`,
    [memberId, parentId]
  );
  return result.rows;
};
