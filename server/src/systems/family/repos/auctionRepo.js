/**
 * Auction Repository Layer
 * 负责拍卖相关的数据库 SQL 操作
 */
const pool = require('../../../shared/config/db');

/**
 * 获取数据库连接池（用于事务）
 */
exports.getPool = () => pool;

// ========== Session 相关 ==========

/**
 * 根据ID获取拍卖场次
 */
exports.getSessionById = async (sessionId, client = pool) => {
  const result = await client.query(
    'SELECT * FROM auction_session WHERE id = $1',
    [sessionId]
  );
  return result.rows[0];
};

/**
 * 根据ID获取拍卖场次（行锁 FOR UPDATE，settleSession 用）
 */
exports.getSessionForUpdate = async (sessionId, client = pool) => {
  const result = await client.query(
    'SELECT * FROM auction_session WHERE id = $1 FOR UPDATE',
    [sessionId]
  );
  return result.rows[0];
};

/**
 * 创建拍卖场次
 */
exports.createSession = async ({
  parentId,
  title,
  scheduledAt,
  status = 'draft',
  config = {}
}, client = pool) => {
  const result = await client.query(
    `INSERT INTO auction_session (parent_id, title, scheduled_at, status, config)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [parentId, title, scheduledAt, status, JSON.stringify(config)]
  );
  return result.rows[0];
};

/**
 * 更新拍卖场次状态
 */
exports.updateSessionStatus = async (sessionId, status, client = pool) => {
  await client.query(
    `UPDATE auction_session SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [status, sessionId]
  );
};

/**
 * 更新拍卖场次配置
 */
exports.updateSessionConfig = async (sessionId, config, client = pool) => {
  const result = await client.query(
    `UPDATE auction_session SET config = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
    [JSON.stringify(config || {}), sessionId]
  );
  return result.rows[0];
};

/**
 * 获取用户的拍卖场次列表
 */
exports.getSessionsByParentId = async (parentId, status = null, client = pool) => {
  let query = 'SELECT * FROM auction_session WHERE parent_id = $1';
  const params = [parentId];
  
  if (status) {
    query += ' AND status = $2';
    params.push(status);
  }
  
  query += ' ORDER BY scheduled_at DESC';
  
  const result = await client.query(query, params);
  return result.rows;
};

/**
 * 获取拍卖大厅聚合数据（CTE + 聚合统计）
 * SQL 模板：hall
 * 返回：{ sessions: [...] }
 * 
 * 字段映射说明：
 * - auction_session.scheduled_at -> starts_at
 * - auction_lot.status='active' -> open_count
 * - auction_bid.bidder_member_id -> bidder_count（DISTINCT）
 */
exports.getHallSessions = async (parentId, client = pool) => {
  const result = await client.query(
    `WITH s AS (
      SELECT id, title, status, scheduled_at as starts_at, NULL::TIMESTAMP as ends_at
      FROM auction_session
      WHERE parent_id = $1
      ORDER BY id DESC
      LIMIT 50
    ),
    lot_stats AS (
      SELECT session_id,
             COUNT(*) AS lot_count,
             COUNT(*) FILTER (WHERE status='active') AS open_count,
             COUNT(*) FILTER (WHERE status='sold') AS sold_count,
             COUNT(*) FILTER (WHERE status='unsold') AS unsold_count
      FROM auction_lot
      WHERE session_id IN (SELECT id FROM s)
      GROUP BY session_id
    ),
    bidder_stats AS (
      SELECT l.session_id,
             COUNT(DISTINCT b.bidder_member_id) AS bidder_count
      FROM auction_lot l
      JOIN auction_bid b ON b.lot_id = l.id AND (b.is_void IS NOT TRUE)
      WHERE l.session_id IN (SELECT id FROM s)
      GROUP BY l.session_id
    )
    SELECT json_agg(json_build_object(
      'id', s.id,
      'title', s.title,
      'status', s.status,
      'starts_at', s.starts_at,
      'ends_at', s.ends_at,
      'lot_count', COALESCE(ls.lot_count,0),
      'open_count', COALESCE(ls.open_count,0),
      'sold_count', COALESCE(ls.sold_count,0),
      'unsold_count', COALESCE(ls.unsold_count,0),
      'bidder_count', COALESCE(bs.bidder_count,0)
    ) ORDER BY s.id DESC) AS sessions
    FROM s
    LEFT JOIN lot_stats ls ON ls.session_id = s.id
    LEFT JOIN bidder_stats bs ON bs.session_id = s.id`,
    [parentId]
  );
  
  const sessions = result.rows[0]?.sessions || [];
  return { sessions };
};

// ========== Lot 相关 ==========

/**
 * 根据ID获取拍卖品
 */
exports.getLotById = async (lotId, client = pool) => {
  const result = await client.query(
    'SELECT * FROM auction_lot WHERE id = $1',
    [lotId]
  );
  return result.rows[0];
};

/**
 * 根据ID获取拍卖品（行锁 FOR UPDATE）
 */
exports.getLotByIdForUpdate = async (lotId, client = pool) => {
  const result = await client.query(
    'SELECT * FROM auction_lot WHERE id = $1 FOR UPDATE',
    [lotId]
  );
  return result.rows[0];
};

/**
 * 根据ID获取拍卖品（行锁 FOR UPDATE，别名）
 */
exports.getLotForUpdate = exports.getLotByIdForUpdate;

/**
 * 获取拍品当前最高出价（仅返回数值，排除 void）
 * 使用 is_void IS NOT TRUE 符合 SQL 模板
 */
exports.getCurrentHighestBidPoints = async (lotId, client = pool) => {
  const result = await client.query(
    `SELECT COALESCE(MAX(bid_points), 0) AS max_points 
     FROM auction_bid 
     WHERE lot_id = $1 
       AND (is_void IS NOT TRUE)`,
    [lotId]
  );
  return parseInt(result.rows[0].max_points);
};

// ========== Hold 相关（018_auction_hold_and_events.sql） ==========

/**
 * 获取某成员在某拍品的冻结记录（行锁 FOR UPDATE）
 */
exports.getHoldForUpdate = async (lotId, bidderId, client = pool) => {
  const result = await client.query(
    `SELECT * FROM auction_hold 
     WHERE lot_id = $1 AND bidder_id = $2
     FOR UPDATE`,
    [lotId, bidderId]
  );
  return result.rows[0];
};

/**
 * Upsert 冻结记录：hold_points = 最新出价（最高价）
 * SQL 模板：upsertHold
 */
exports.upsertHold = async ({
  sessionId,
  lotId,
  bidderId,
  holdPoints,
  status = 'active',
}, client = pool) => {
  const result = await client.query(
    `INSERT INTO auction_hold(session_id, lot_id, bidder_id, hold_points, status, updated_at)
     VALUES($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
     ON CONFLICT(lot_id, bidder_id)
     DO UPDATE SET hold_points = EXCLUDED.hold_points, status = EXCLUDED.status, updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [sessionId, lotId, bidderId, holdPoints, status]
  );
  return result.rows[0];
};

/**
 * Upsert 冻结记录（参数顺序：lotId, sessionId, bidderId, newHold）
 */
exports.upsertHoldByOrder = async (lotId, sessionId, bidderId, newHold, client = pool) => {
  return await exports.upsertHold({
    sessionId,
    lotId,
    bidderId,
    holdPoints: newHold,
    status: 'active',
  }, client);
};

/**
 * 获取该 lot 的所有冻结记录（用于 closeLot 释放输家）
 */
exports.getHoldsByLotId = async (lotId, client = pool) => {
  const result = await client.query(
    `SELECT h.*, m.name as bidder_name, m.parent_id as bidder_parent_id
     FROM auction_hold h
     JOIN family_members m ON h.bidder_id = m.id
     WHERE h.lot_id = $1 AND h.status = 'active'
     ORDER BY h.hold_points DESC`,
    [lotId]
  );
  return result.rows;
};

/**
 * 更新冻结记录状态（released/converted）
 */
exports.updateHoldStatus = async (holdId, status, client = pool) => {
  const result = await client.query(
    `UPDATE auction_hold 
     SET status = $1, updated_at = CURRENT_TIMESTAMP 
     WHERE id = $2
     RETURNING *`,
    [status, holdId]
  );
  return result.rows[0];
};

/**
 * 标记赢家的 hold 为 converted（实现A：冻结已扣，不再扣分）
 * SQL 模板：markHoldConverted
 */
exports.markHoldConverted = async (lotId, bidderId, client = pool) => {
  const result = await client.query(
    `UPDATE auction_hold
     SET status='converted', updated_at=CURRENT_TIMESTAMP
     WHERE lot_id=$1 AND bidder_id=$2
     RETURNING *`,
    [lotId, bidderId]
  );
  return result.rows[0];
};

/**
 * 获取输家的 hold 列表（FOR UPDATE，用于释放）
 * SQL 模板：listLoserHoldsForUpdate
 */
exports.listLoserHoldsForUpdate = async (lotId, winnerId, client = pool) => {
  const result = await client.query(
    `SELECT bidder_id, hold_points
     FROM auction_hold
     WHERE lot_id = $1 AND status = 'active' AND bidder_id <> $2
     FOR UPDATE`,
    [lotId, winnerId]
  );
  return result.rows;
};

/**
 * 标记 hold 为 released
 * SQL 模板：markHoldReleased
 */
exports.markHoldReleased = async (lotId, bidderId, client = pool) => {
  const result = await client.query(
    `UPDATE auction_hold
     SET status='released', updated_at=CURRENT_TIMESTAMP
     WHERE lot_id=$1 AND bidder_id=$2
     RETURNING *`,
    [lotId, bidderId]
  );
  return result.rows[0];
};

/**
 * 获取成员当前可用积分 = 余额 - 当前 active 冻结总额（跨 lot）
 */
exports.getAvailablePoints = async (bidderId, client = pool) => {
  const result = await client.query(
    `SELECT
       COALESCE((SELECT SUM(points_change) FROM family_points_log WHERE member_id = $1), 0)
       - COALESCE((SELECT SUM(hold_points) FROM auction_hold WHERE bidder_id = $1 AND status = 'active'), 0)
       AS available_points`,
    [bidderId]
  );
  return parseInt(result.rows[0].available_points);
};

/**
 * 释放该 lot 的所有 hold（closeLot 给输家释放用）
 */
exports.releaseAllHoldsByLot = async (lotId, client = pool) => {
  const result = await client.query(
    `UPDATE auction_hold 
     SET status = 'released', updated_at = CURRENT_TIMESTAMP 
     WHERE lot_id = $1 AND status = 'active'
     RETURNING *`,
    [lotId]
  );
  return result.rows;
};

/**
 * 计算成员当前 active 冻结总额（跨 lot，算可用余额时扣除）
 * SQL 模板：sumActiveHoldsByMember
 */
exports.sumActiveHoldsByMember = async (memberId, client = pool) => {
  const result = await client.query(
    `SELECT COALESCE(SUM(h.hold_points), 0) AS locked_total
     FROM auction_hold h
     WHERE h.bidder_id = $1 AND h.status = 'active'`,
    [memberId]
  );
  return parseInt(result.rows[0].locked_total);
};

/**
 * 获取场次的拍卖品列表
 */
exports.getLotsBySessionId = async (sessionId, client = pool) => {
  const result = await client.query(
    `SELECT * FROM auction_lot WHERE session_id = $1 ORDER BY sort_order, id`,
    [sessionId]
  );
  return result.rows;
};

/**
 * 获取场次的拍卖品数量
 */
exports.getLotCountBySessionId = async (sessionId, client = pool) => {
  const result = await client.query(
    'SELECT COUNT(*) FROM auction_lot WHERE session_id = $1',
    [sessionId]
  );
  return parseInt(result.rows[0].count);
};

/**
 * 创建拍卖品
 */
exports.createLot = async ({
  sessionId,
  offerId,
  skuId,
  rarity = 'common',
  startPrice,
  reservePrice = null,
  buyNowPrice = null,
  quantity = 1,
  status = 'pending',
  sortOrder = 0,
  skuName,
  skuIcon
}, client = pool) => {
  const result = await client.query(
    `INSERT INTO auction_lot 
     (session_id, offer_id, sku_id, rarity, start_price, reserve_price, buy_now_price, 
      quantity, status, sort_order, sku_name, sku_icon)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [sessionId, offerId, skuId, rarity, startPrice, reservePrice, buyNowPrice,
     quantity, status, sortOrder, skuName, skuIcon]
  );
  return result.rows[0];
};

/**
 * 更新拍卖品状态
 */
exports.updateLotStatus = async (lotId, status, client = pool) => {
  await client.query(
    `UPDATE auction_lot SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [status, lotId]
  );
};

/**
 * 批量创建拍卖品
 */
exports.createLotsBatch = async (lots, client = pool) => {
  if (lots.length === 0) return [];
  
  const values = [];
  const params = [];
  let paramIndex = 1;
  
  for (const lot of lots) {
    values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, 
                  $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, 
                  $${paramIndex + 8}, $${paramIndex + 9}, $${paramIndex + 10}, $${paramIndex + 11})`);
    params.push(
      lot.sessionId,
      lot.offerId || null,
      lot.skuId,
      lot.rarity || 'common',
      lot.startPrice,
      lot.reservePrice || null,
      lot.buyNowPrice || null,
      lot.quantity || 1,
      lot.status || 'pending',
      lot.sortOrder || 0,
      lot.skuName,
      lot.skuIcon || null
    );
    paramIndex += 12;
  }
  
  const result = await client.query(
    `INSERT INTO auction_lot 
     (session_id, offer_id, sku_id, rarity, start_price, reserve_price, buy_now_price, 
      quantity, status, sort_order, sku_name, sku_icon)
     VALUES ${values.join(', ')}
     RETURNING *`,
    params
  );
  
  return result.rows;
};

// ========== Bid 相关 ==========

/**
 * 创建出价记录
 */
exports.createBid = async ({
  lotId,
  bidderMemberId,
  bidPoints,
  isAutoBid = false,
  maxAutoBid = null
}, client = pool) => {
  const result = await client.query(
    `INSERT INTO auction_bid (lot_id, bidder_member_id, bid_points, is_auto_bid, max_auto_bid)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [lotId, bidderMemberId, bidPoints, isAutoBid, maxAutoBid]
  );
  return result.rows[0];
};

/**
 * 获取拍卖品的出价列表
 */
exports.getBidsByLotId = async (lotId, limit = 50, client = pool) => {
  const result = await client.query(
    `SELECT b.*, m.name as bidder_name
     FROM auction_bid b
     JOIN family_members m ON b.bidder_member_id = m.id
     WHERE b.lot_id = $1
     ORDER BY b.bid_points DESC, b.created_at ASC
     LIMIT $2`,
    [lotId, limit]
  );
  return result.rows;
};

/**
 * 获取拍品的最后一条出价（按时间倒序，排除 void）
 */
exports.getLastBidByLotId = async (lotId, client = pool) => {
  const result = await client.query(
    `SELECT b.*, m.name as bidder_name, m.parent_id as bidder_parent_id
     FROM auction_bid b
     JOIN family_members m ON b.bidder_member_id = m.id
     WHERE b.lot_id = $1 
       AND (b.is_void IS NOT TRUE)
     ORDER BY b.created_at DESC, b.id DESC
     LIMIT 1`,
    [lotId]
  );
  return result.rows[0];
};

/**
 * 获取拍品最后一条出价（别名，撤销用）
 */
exports.getLastBid = exports.getLastBidByLotId;

/**
 * 获取拍品最后一条出价（FOR UPDATE，撤销用）
 * SQL 模板：getLastBidForUpdate
 */
exports.getLastBidForUpdate = async (lotId, client = pool) => {
  const result = await client.query(
    `SELECT id, bidder_member_id, bidder_member_id as bidder_id, bid_points, created_at
     FROM auction_bid
     WHERE lot_id = $1 AND (is_void IS NOT TRUE)
     ORDER BY created_at DESC
     LIMIT 1
     FOR UPDATE`,
    [lotId]
  );
  return result.rows[0];
};

/**
 * 删除出价记录（用于撤销最后一次出价）
 * @deprecated 使用 markBidVoid 代替，保留用于兼容
 */
exports.deleteBidById = async (bidId, client = pool) => {
  const result = await client.query(
    'DELETE FROM auction_bid WHERE id = $1 RETURNING *',
    [bidId]
  );
  return result.rows[0];
};

/**
 * 标记出价为 void（撤销，不删除）
 * SQL 模板：voidBid
 */
exports.markBidVoid = async (bidId, client = pool) => {
  const result = await client.query(
    `UPDATE auction_bid
     SET is_void = TRUE
     WHERE id = $1
     RETURNING *`,
    [bidId]
  );
  return result.rows[0];
};

/**
 * 标记出价为 void（撤销，别名）
 */
exports.voidBid = exports.markBidVoid;

/**
 * 获取拍卖品的最高有效出价（排除 void）
 * SQL 模板：getTopBid
 * 返回：{ bidder_member_id (as bidder_id), bid_points, created_at }
 */
exports.getHighestBid = async (lotId, client = pool) => {
  const result = await client.query(
    `SELECT bidder_member_id, bidder_member_id as bidder_id, bid_points, created_at
     FROM auction_bid
     WHERE lot_id = $1 AND (is_void IS NOT TRUE)
     ORDER BY bid_points DESC, created_at ASC
     LIMIT 1`,
    [lotId]
  );
  return result.rows[0];
};

/**
 * 获取拍品最高有效出价（别名，只取最高有效 bid）
 */
exports.getTopBid = exports.getHighestBid;

/**
 * 获取拍卖品的次高出价
 */
exports.getSecondHighestBid = async (lotId, client = pool) => {
  const result = await client.query(
    `SELECT b.*, m.name as bidder_name
     FROM auction_bid b
     JOIN family_members m ON b.bidder_member_id = m.id
     WHERE b.lot_id = $1
     ORDER BY b.bid_points DESC, b.created_at ASC
     LIMIT 1 OFFSET 1`,
    [lotId]
  );
  return result.rows[0];
};

/**
 * 获取成员对某拍品的最高有效出价（排除 void）
 * SQL 模板：getMaxBidByBidder（返回对象）
 */
exports.getMemberHighestBid = async (lotId, memberId, client = pool) => {
  const result = await client.query(
    `SELECT * FROM auction_bid 
     WHERE lot_id = $1 
       AND bidder_member_id = $2
       AND (is_void IS NOT TRUE)
     ORDER BY bid_points DESC, created_at ASC
     LIMIT 1`,
    [lotId, memberId]
  );
  return result.rows[0];
};

/**
 * 获取成员对某拍品的最高有效出价数值（排除 void）
 * SQL 模板：getMaxBidByBidder（返回数值）
 */
exports.getMaxBidPointsByBidder = async (lotId, bidderId, client = pool) => {
  const result = await client.query(
    `SELECT COALESCE(MAX(bid_points), 0) AS max_bid
     FROM auction_bid
     WHERE lot_id = $1 AND bidder_member_id = $2 AND (is_void IS NOT TRUE)`,
    [lotId, bidderId]
  );
  return parseInt(result.rows[0].max_bid);
};

/**
 * 获取成员在某拍品的最高有效出价（别名，撤销后重算用）
 */
exports.getMaxBidByBidder = exports.getMemberHighestBid;

/**
 * 获取拍品的出价数量
 */
exports.getBidCountByLotId = async (lotId, client = pool) => {
  const result = await client.query(
    'SELECT COUNT(*) FROM auction_bid WHERE lot_id = $1',
    [lotId]
  );
  return parseInt(result.rows[0].count);
};

/**
 * 获取拍品的不同出价人数量
 */
exports.getUniqueBidderCount = async (lotId, client = pool) => {
  const result = await client.query(
    'SELECT COUNT(DISTINCT bidder_member_id) FROM auction_bid WHERE lot_id = $1',
    [lotId]
  );
  return parseInt(result.rows[0].count);
};

/**
 * 获取拍品按出价排序的所有不同出价（用于二价结算）
 * 按出价金额降序，同金额按时间升序（先出价者优先）
 * 排除 void 的出价
 */
exports.getDistinctBidsByLotId = async (lotId, client = pool) => {
  // 获取每个出价人的最高有效出价
  const result = await client.query(
    `SELECT DISTINCT ON (bidder_member_id) 
       b.*, m.name as bidder_name, m.parent_id
     FROM auction_bid b
     JOIN family_members m ON b.bidder_member_id = m.id
     WHERE b.lot_id = $1
       AND (b.is_void IS NOT TRUE)
     ORDER BY bidder_member_id, bid_points DESC, created_at ASC`,
    [lotId]
  );
  
  // 按出价金额降序排序
  return result.rows.sort((a, b) => {
    if (b.bid_points !== a.bid_points) {
      return b.bid_points - a.bid_points;
    }
    return new Date(a.created_at) - new Date(b.created_at);
  });
};

// ========== Result 相关 ==========

/**
 * 创建拍卖结果
 */
exports.createResult = async ({
  lotId,
  sessionId = null, // 用于唯一约束 (session_id, lot_id)
  winnerMemberId,
  payPoints,
  secondPrice = null,
  winningBidId = null,
  settledOrderId = null,
  settlementStatus = 'pending'
}, client = pool) => {
  // 如果未提供 sessionId，通过 lot_id 关联获取
  if (!sessionId) {
    const lotResult = await client.query('SELECT session_id FROM auction_lot WHERE id = $1', [lotId]);
    if (lotResult.rows[0]) {
      sessionId = lotResult.rows[0].session_id;
    }
  }

  const result = await client.query(
    `INSERT INTO auction_result 
     (session_id, lot_id, winner_member_id, pay_points, second_price, winning_bid_id, settled_order_id, settlement_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [sessionId, lotId, winnerMemberId, payPoints, secondPrice, winningBidId, settledOrderId, settlementStatus]
  );
  return result.rows[0];
};

/**
 * 根据 lot_id 获取拍卖结果
 */
exports.getResultByLotId = async (lotId, client = pool) => {
  const result = await client.query(
    'SELECT * FROM auction_result WHERE lot_id = $1',
    [lotId]
  );
  return result.rows[0];
};

/**
 * 根据 session_id 和 lot_id 获取拍卖结果（用于幂等检查）
 * SQL 模板：getResultBySessionLot
 */
exports.getResultBySessionLot = async (sessionId, lotId, client = pool) => {
  const result = await client.query(
    'SELECT * FROM auction_result WHERE session_id=$1 AND lot_id=$2',
    [sessionId, lotId]
  );
  return result.rows[0];
};

/**
 * 插入拍卖结果（如果不存在，使用 ON CONFLICT 处理唯一约束）
 * SQL 模板：insertResultIfAbsent（依赖 UNIQUE(session_id, lot_id)）
 * 注意：实际字段名是 winner_member_id, pay_points, settlement_status
 */
exports.insertResultIfAbsent = async ({
  sessionId,
  lotId,
  winnerBidderId,
  finalPrice,
  status,
  orderId = null,
}, client = pool) => {
  const result = await client.query(
    `INSERT INTO auction_result(session_id, lot_id, winner_member_id, pay_points, settlement_status, settled_order_id, created_at)
     VALUES($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP)
     ON CONFLICT(session_id, lot_id) DO NOTHING
     RETURNING *`,
    [sessionId, lotId, winnerBidderId, finalPrice, status, orderId]
  );
  
  // 如果插入失败（冲突），返回已存在的结果
  if (result.rows.length === 0) {
    return await exports.getResultBySessionLot(sessionId, lotId, client);
  }
  
  return result.rows[0];
};

/**
 * 更新拍卖结果的订单ID
 */
exports.updateResultOrderId = async (resultId, orderId, client = pool) => {
  await client.query(
    `UPDATE auction_result 
     SET settled_order_id = $1, settlement_status = 'settled', settled_at = CURRENT_TIMESTAMP 
     WHERE id = $2`,
    [orderId, resultId]
  );
};

// ========== Event 相关（018_auction_hold_and_events.sql） ==========

/**
 * 记录拍卖事件（审计/回放）
 */
exports.createEvent = async ({
  actorUserId = null,
  sessionId = null,
  lotId = null,
  bidderId = null,
  eventType,
  payload = {},
}, client = pool) => {
  const result = await client.query(
    `INSERT INTO auction_event (actor_user_id, session_id, lot_id, bidder_id, event_type, payload)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [actorUserId, sessionId, lotId, bidderId, eventType, payload]
  );
  return result.rows[0];
};

// ========== SKU 池相关 ==========

/**
 * 获取可用于拍卖的 SKU 列表
 * 筛选条件：is_active=true, type='auction' 或可用于拍卖的 reward
 */
exports.getAuctionableSkus = async (parentId, client = pool) => {
  const result = await client.query(
    `SELECT s.*, 
            (SELECT o.id FROM family_offer o 
             WHERE o.sku_id = s.id AND o.is_active = TRUE 
             ORDER BY o.created_at DESC LIMIT 1) as default_offer_id,
            (SELECT o.cost FROM family_offer o 
             WHERE o.sku_id = s.id AND o.is_active = TRUE 
             ORDER BY o.created_at DESC LIMIT 1) as default_cost
     FROM family_sku s
     WHERE s.is_active = TRUE 
       AND (s.parent_id = 0 OR s.parent_id = $1)
     ORDER BY s.base_cost`,
    [parentId]
  );
  return result.rows;
};

// ========== Offer 相关 ==========

/**
 * 创建拍卖专用的 Offer
 * @param {object} params - Offer 参数
 * @param {number} params.parentId - 所属用户ID（供给侧配置必填）
 * @param {number} params.skuId - SKU ID
 * @param {number} params.cost - 起拍价
 * @param {number} params.quantity - 数量
 */
exports.createAuctionOffer = async ({
  parentId,
  skuId,
  cost,
  quantity = 1
}, client = pool) => {
  const result = await client.query(
    `INSERT INTO family_offer (parent_id, sku_id, cost, quantity, is_active, offer_type)
     VALUES ($1, $2, $3, $4, TRUE, 'auction')
     RETURNING *`,
    [parentId, skuId, cost, quantity]
  );
  return result.rows[0];
};

/**
 * 插入或更新 Offer 并返回 ID（用于拍卖生成，避免唯一约束冲突）
 * @param {object} params - Offer 参数
 * @param {number} params.parentId - 所属用户ID
 * @param {number} params.skuId - SKU ID
 * @param {number} params.cost - 价格
 * @param {number} params.quantity - 数量
 * @param {boolean} params.isActive - 是否激活
 * @param {string} params.offerType - Offer 类型（可选，默认 'auction'）
 * @param {object} client - 数据库连接
 * @returns {object} Offer 对象（含 id）
 */
exports.upsertOfferAndGetId = async ({
  parentId,
  skuId,
  cost,
  quantity = 1,
  isActive = true,
  offerType = 'auction'
}, client = pool) => {
  const result = await client.query(
    `INSERT INTO family_offer (parent_id, sku_id, cost, quantity, is_active, offer_type, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
     ON CONFLICT (parent_id, sku_id)
     DO UPDATE SET
       cost = EXCLUDED.cost,
       quantity = EXCLUDED.quantity,
       is_active = EXCLUDED.is_active,
       offer_type = EXCLUDED.offer_type
     RETURNING id, parent_id, sku_id, cost, quantity, is_active, offer_type`,
    [parentId, skuId, cost, quantity, isActive, offerType]
  );
  
  // 如果冲突时 DO UPDATE 没有返回行（理论上不会发生），则查询
  if (result.rows.length === 0) {
    const selectResult = await client.query(
      `SELECT id, parent_id, sku_id, cost, quantity, is_active, offer_type
       FROM family_offer
       WHERE parent_id = $1 AND sku_id = $2`,
      [parentId, skuId]
    );
    if (selectResult.rows.length > 0) {
      return selectResult.rows[0];
    }
    throw new Error('upsertOfferAndGetId: 无法获取或创建 offer');
  }
  
  return result.rows[0];
};

// ========== 视图查询 ==========

/**
 * 获取拍卖品详情（使用视图）
 */
exports.getLotDetails = async (sessionId, client = pool) => {
  const result = await client.query(
    `SELECT * FROM v_auction_lot_detail WHERE session_id = $1 ORDER BY sort_order, id`,
    [sessionId]
  );
  return result.rows;
};

// ========== 聚合视图（CTE + json_agg） ==========

/**
 * 大厅聚合 DTO（拍卖台用）
 * 返回 active/scheduled 场次的当前拍品信息
 */
exports.getHallDTO = async (parentUserId, client = pool) => {
  const result = await client.query(
    `WITH session_lots AS (
      SELECT 
        s.id as session_id,
        json_agg(
          json_build_object(
            'id', l.id,
            'sku_name', l.sku_name,
            'sku_icon', l.sku_icon,
            'start_price', l.start_price,
            'status', l.status,
            'current_price', COALESCE((
              SELECT MAX(b.bid_points) 
              FROM auction_bid b 
              WHERE b.lot_id = l.id 
                AND (b.is_void IS NULL OR b.is_void = FALSE)
            ), l.start_price),
            'bid_count', (
              SELECT COUNT(*) 
              FROM auction_bid b 
              WHERE b.lot_id = l.id 
                AND (b.is_void IS NULL OR b.is_void = FALSE)
            )
          ) ORDER BY l.sort_order, l.id
        ) as lots
      FROM auction_session s
      LEFT JOIN auction_lot l ON s.id = l.session_id
      WHERE s.parent_id = $1 
        AND s.status IN ('scheduled', 'active')
      GROUP BY s.id
    )
    SELECT 
      s.*,
      COALESCE(sl.lots, '[]'::json) as lots,
      (SELECT COUNT(*) FROM auction_lot WHERE session_id = s.id) as lot_count,
      (SELECT 
         CASE 
           WHEN config->>'current_lot_index' IS NOT NULL 
           THEN (config->>'current_lot_index')::int
           ELSE 0
         END
       ) as current_lot_index
    FROM auction_session s
    LEFT JOIN session_lots sl ON s.id = sl.session_id
    WHERE s.parent_id = $1 
      AND s.status IN ('scheduled', 'active')
    ORDER BY s.scheduled_at DESC`,
    [parentUserId]
  );
  return result.rows;
};

/**
 * 获取会场详情聚合 DTO（拍卖台用）
 * SQL 模板：overview
 * 返回：{ session, lots, members, recent_bids }
 * 
 * 字段映射说明：
 * - auction_session.scheduled_at -> starts_at
 * - auction_lot.sku_name -> title
 * - auction_lot.status='active' -> status='open'
 * - auction_bid.bidder_member_id -> bidder_id
 * - family_points_log.points_change -> wallet_balance (SUM)
 */
exports.getSessionOverviewDTO = async (parentUserId, sessionId, client = pool) => {
  const result = await client.query(
    `WITH sess AS (
      SELECT id, title, status, scheduled_at as starts_at, NULL::TIMESTAMP as ends_at, parent_id
      FROM auction_session
      WHERE id = $2 AND parent_id = $1
    ),
    lots AS (
      SELECT l.*
      FROM auction_lot l
      WHERE l.session_id = (SELECT id FROM sess)
    ),
    top_bids AS (
      SELECT DISTINCT ON (b.lot_id)
        b.lot_id,
        b.bidder_member_id as bidder_id,
        b.bid_points,
        b.created_at
      FROM auction_bid b
      WHERE b.lot_id IN (SELECT id FROM lots)
        AND (b.is_void IS NOT TRUE)
      ORDER BY b.lot_id, b.bid_points DESC, b.created_at ASC
    ),
    bid_counts AS (
      SELECT lot_id, COUNT(*) AS bid_count
      FROM auction_bid
      WHERE lot_id IN (SELECT id FROM lots) AND (is_void IS NOT TRUE)
      GROUP BY lot_id
    ),
    members AS (
      SELECT m.id, m.name
      FROM family_members m
      WHERE m.parent_id = $1
    ),
    wallet AS (
      SELECT member_id, COALESCE(SUM(points_change),0) AS wallet_balance
      FROM family_points_log
      WHERE member_id IN (SELECT id FROM members)
      GROUP BY member_id
    ),
    locked AS (
      SELECT bidder_id AS member_id, COALESCE(SUM(hold_points),0) AS locked_total
      FROM auction_hold
      WHERE bidder_id IN (SELECT id FROM members) AND status='active'
      GROUP BY bidder_id
    ),
    recent_bids AS (
      SELECT b.lot_id, b.bidder_member_id as bidder_id, b.bid_points, b.created_at
      FROM auction_bid b
      JOIN lots l ON l.id=b.lot_id
      WHERE (b.is_void IS NOT TRUE)
      ORDER BY b.created_at DESC
      LIMIT 50
    )
    SELECT
      (SELECT json_build_object(
        'id', sess.id,
        'title', sess.title,
        'status', sess.status
      ) FROM sess) AS session,
      (SELECT json_agg(json_build_object(
        'id', l.id,
        'title', l.sku_name,
        'status', l.status,
        'reserve_price', l.reserve_price,
        'current_highest_bid', COALESCE(tb.bid_points, l.reserve_price, l.start_price, 0),
        'leading_bidder', CASE WHEN tb.bidder_id IS NULL THEN NULL ELSE json_build_object('id', tb.bidder_id, 'name', m.name) END,
        'bid_count', COALESCE(bc.bid_count,0)
      ) ORDER BY l.sort_order, l.id)
       FROM lots l
       LEFT JOIN top_bids tb ON tb.lot_id=l.id
       LEFT JOIN bid_counts bc ON bc.lot_id=l.id
       LEFT JOIN family_members m ON m.id=tb.bidder_id
      ) AS lots,
      (SELECT json_agg(json_build_object(
        'id', mem.id,
        'name', mem.name,
        'wallet_balance', COALESCE(w.wallet_balance,0),
        'locked_total', COALESCE(k.locked_total,0)
      ) ORDER BY mem.id)
       FROM members mem
       LEFT JOIN wallet w ON w.member_id=mem.id
       LEFT JOIN locked k ON k.member_id=mem.id
      ) AS members,
      (SELECT json_agg(row_to_json(recent_bids.*)) FROM recent_bids) AS recent_bids`,
    [parentUserId, sessionId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  return result.rows[0];
};

/**
 * 获取管理员场次列表（聚合统计）
 * 返回每个 session 的详细信息，包括拍品统计、当前拍品、出价者数量等
 */
exports.getSessionsAdmin = async (parentId, client = pool) => {
  const result = await client.query(
    `WITH s AS (
      SELECT id, title, scheduled_at, status, config
      FROM auction_session
      WHERE parent_id = $1
      ORDER BY id DESC
      LIMIT 100
    ),
    pool_stats AS (
      SELECT 
        s.id AS session_id,
        CASE 
          WHEN s.config->>'pool_sku_ids' IS NOT NULL AND s.config->'pool_sku_ids' IS NOT NULL
          THEN jsonb_array_length(s.config->'pool_sku_ids')
          ELSE 0
        END AS pool_count
      FROM s
    ),
    lot_stats AS (
      SELECT session_id,
             COUNT(*) AS lot_count,
             COUNT(*) FILTER (WHERE status='active') AS open_count,
             COUNT(*) FILTER (WHERE status='sold') AS sold_count,
             COUNT(*) FILTER (WHERE status='unsold') AS unsold_count
      FROM auction_lot
      WHERE session_id IN (SELECT id FROM s)
      GROUP BY session_id
    ),
    active_lots AS (
      SELECT DISTINCT ON (session_id)
        session_id,
        id AS lot_id,
        sku_name AS lot_title,
        status AS lot_status
      FROM auction_lot
      WHERE session_id IN (SELECT id FROM s) AND status = 'active'
      ORDER BY session_id, sort_order, id
    ),
    bidder_stats AS (
      SELECT l.session_id,
             COUNT(DISTINCT b.bidder_member_id) AS bidder_count
      FROM auction_lot l
      JOIN auction_bid b ON b.lot_id = l.id AND (b.is_void IS NOT TRUE)
      WHERE l.session_id IN (SELECT id FROM s)
      GROUP BY l.session_id
    ),
    last_events AS (
      SELECT DISTINCT ON (session_id)
        session_id,
        created_at AS last_event_at
      FROM auction_event
      WHERE session_id IN (SELECT id FROM s)
      ORDER BY session_id, created_at DESC
    )
    SELECT json_agg(json_build_object(
      'id', s.id,
      'title', s.title,
      'scheduled_at', s.scheduled_at,
      'status', s.status,
      'pool_count', COALESCE(ps.pool_count, 0),
      'lot_count', COALESCE(ls.lot_count, 0),
      'active_lot', CASE 
        WHEN al.lot_id IS NULL THEN NULL 
        ELSE json_build_object('id', al.lot_id, 'title', al.lot_title, 'status', al.lot_status)
      END,
      'open_count', COALESCE(ls.open_count, 0),
      'sold_count', COALESCE(ls.sold_count, 0),
      'unsold_count', COALESCE(ls.unsold_count, 0),
      'bidder_count', COALESCE(bs.bidder_count, 0),
      'last_event_at', le.last_event_at
    ) ORDER BY s.id DESC) AS sessions
    FROM s
    LEFT JOIN pool_stats ps ON ps.session_id = s.id
    LEFT JOIN lot_stats ls ON ls.session_id = s.id
    LEFT JOIN active_lots al ON al.session_id = s.id
    LEFT JOIN bidder_stats bs ON bs.session_id = s.id
    LEFT JOIN last_events le ON le.session_id = s.id`,
    [parentId]
  );
  
  return result.rows[0]?.sessions || [];
};

/**
 * 批量更新同一 session 下的 lot 状态
 */
exports.updateLotsStatusBySession = async (sessionId, fromStatus, toStatus, client = pool) => {
  const result = await client.query(
    `UPDATE auction_lot 
     SET status = $1, updated_at = CURRENT_TIMESTAMP 
     WHERE session_id = $2 AND status = $3
     RETURNING id`,
    [toStatus, sessionId, fromStatus]
  );
  return result.rows;
};

/**
 * 获取下一个待激活的拍品（按 sort_order）
 */
exports.getNextPendingLot = async (sessionId, client = pool) => {
  const result = await client.query(
    `SELECT * FROM auction_lot 
     WHERE session_id = $1 AND status = 'pending'
     ORDER BY sort_order, id
     LIMIT 1`,
    [sessionId]
  );
  return result.rows[0] || null;
};

/**
 * 获取可重排序的拍品 ID 列表（只包含 pending/active 状态）
 */
exports.getReorderableLotIds = async (sessionId, client = pool) => {
  const r = await client.query(
    `SELECT id FROM auction_lot 
     WHERE session_id = $1 AND status IN ('pending','active')
     ORDER BY sort_order ASC, id ASC`,
    [sessionId]
  );
  return r.rows.map(x => x.id);
};

/**
 * 批量更新拍品排序
 * @param {number} sessionId - 拍卖场次ID
 * @param {Array<number>} orderedIds - 排序后的 lot ID 数组
 * @param {object} client - 数据库客户端
 */
exports.updateLotSortOrders = async (sessionId, orderedIds, client = pool) => {
  // orderedIds 必须是 int[]
  const ids = orderedIds.map((x) => Number(x)).filter((x) => Number.isInteger(x));

  const sql = `
    WITH ord AS (
      SELECT id, (ord_idx * 10) AS sort_order
      FROM unnest($2::int[]) WITH ORDINALITY AS t(id, ord_idx)
    )
    UPDATE auction_lot AS l
    SET sort_order = ord.sort_order,
        updated_at = CURRENT_TIMESTAMP
    FROM ord
    WHERE l.session_id = $1
      AND l.id = ord.id
      AND l.status IN ('pending', 'active');
  `;
  await client.query(sql, [sessionId, ids]);
};

/**
 * 获取拍品交易记录（result+order+winner+bids）
 * @param {number} lotId - 拍品ID
 * @param {object} client - 数据库客户端
 * @returns {object} {result, order, bids}
 */
/**
 * 统计剩余可拍拍品数量
 * @param {number} sessionId - 场次ID
 * @param {object} client - 数据库客户端
 * @returns {number} 剩余可拍拍品数量
 */
exports.countUnfinishedLots = async (sessionId, client = pool) => {
  const result = await client.query(
    `SELECT COUNT(*)::int AS c FROM auction_lot WHERE session_id = $1 AND status IN ('pending', 'active')`,
    [sessionId]
  );
  return result.rows[0]?.c || 0;
};

/**
 * 获取拍品交易记录（result+order+winner+bids）
 * @param {number} lotId - 拍品ID
 * @param {object} client - 数据库客户端
 * @returns {object} {lot, result, order, bids}
 */
exports.getLotRecord = async (lotId, client = pool) => {
  // A) lot 基本信息（auction_lot）
  const lotResult = await client.query(
    'SELECT id, session_id, sku_id, sku_name, rarity, status, reserve_price, sort_order, created_at FROM auction_lot WHERE id = $1',
    [lotId]
  );
  const lot = lotResult.rows[0];
  
  if (!lot) {
    return { lot: null, result: null, order: null, bids: [] };
  }
  
  // B) result+winner+order
  const resultQuery = await client.query(
    `SELECT r.id, r.lot_id, r.session_id, r.winner_member_id, m.name AS winner_name, r.pay_points AS final_price, r.second_price, r.winning_bid_id, r.settled_order_id AS order_id, r.settlement_status, r.settled_at, o.cost AS order_cost, o.quantity AS order_quantity, o.status AS order_status, o.created_at AS order_created_at
     FROM auction_result r
     LEFT JOIN family_members m ON m.id = r.winner_member_id
     LEFT JOIN family_market_order o ON o.id = r.settled_order_id
     WHERE r.lot_id = $1`,
    [lotId]
  );
  const resultRow = resultQuery.rows[0];
  
  // C) bids 列表
  const bidsQuery = await client.query(
    `SELECT b.id, b.bidder_member_id AS bidder_id, m.name AS bidder_name, b.bid_points, b.created_at
     FROM auction_bid b
     LEFT JOIN family_members m ON m.id = b.bidder_member_id
     WHERE b.lot_id = $1 AND COALESCE(b.is_void, FALSE) = FALSE
     ORDER BY b.created_at DESC
     LIMIT 100`,
    [lotId]
  );
  
  const bids = bidsQuery.rows.map(row => ({
    id: row.id,
    bidder_id: row.bidder_id,
    bidder_name: row.bidder_name,
    bid_points: row.bid_points,
    created_at: row.created_at,
  }));
  
  // 如果 result 为空且 lot.status in ('sold','unsold')，从 bids 推导 result
  let derivedResult = null;
  if (!resultRow && lot && ['sold', 'unsold'].includes(lot.status) && bids.length > 0) {
    // 按出价从高到低排序
    const sortedBids = [...bids].sort((a, b) => b.bid_points - a.bid_points);
    const topBid = sortedBids[0];
    const secondBid = sortedBids[1] || null;
    
    derivedResult = {
      result_derived: true,
      winner_member_id: topBid.bidder_id,
      winner_name: topBid.bidder_name,
      final_price: topBid.bid_points,
      second_price: secondBid ? secondBid.bid_points : null,
    };
  }
  
  return {
    lot: lot,
    result: resultRow ? {
      id: resultRow.id,
      lot_id: resultRow.lot_id,
      session_id: resultRow.session_id,
      winner_member_id: resultRow.winner_member_id,
      winner_name: resultRow.winner_name,
      final_price: resultRow.final_price,
      second_price: resultRow.second_price,
      winning_bid_id: resultRow.winning_bid_id,
      settlement_status: resultRow.settlement_status,
      settled_at: resultRow.settled_at,
    } : derivedResult,
    order: resultRow && resultRow.order_id ? {
      order_id: resultRow.order_id,
      order_cost: resultRow.order_cost,
      order_quantity: resultRow.order_quantity,
      order_status: resultRow.order_status,
      order_created_at: resultRow.order_created_at,
    } : null,
    bids: bids,
  };
};

/**
 * 获取成员的竞拍记录（带拍品名称和是否中标）
 * @param {number} memberId - 成员ID
 * @param {number} limit - 限制数量
 * @param {object} client - 数据库连接
 */
exports.getBidsByMemberId = async (memberId, limit = 10, client = pool) => {
  const result = await client.query(
    `SELECT b.id, b.lot_id, l.sku_name AS lot_name, b.bid_points, b.created_at,
            CASE WHEN r.winning_bid_id = b.id THEN TRUE ELSE FALSE END AS is_winner
       FROM auction_bid b
       JOIN auction_lot l ON l.id = b.lot_id
       LEFT JOIN auction_result r ON r.lot_id = b.lot_id
      WHERE b.bidder_member_id = $1 AND COALESCE(b.is_void, FALSE) = FALSE
      ORDER BY b.created_at DESC
      LIMIT $2`,
    [memberId, limit]
  );
  return result.rows;
};
