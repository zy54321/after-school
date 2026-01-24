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
 * 获取拍卖品的最高出价
 */
exports.getHighestBid = async (lotId, client = pool) => {
  const result = await client.query(
    `SELECT b.*, m.name as bidder_name
     FROM auction_bid b
     JOIN family_members m ON b.bidder_member_id = m.id
     WHERE b.lot_id = $1
     ORDER BY b.bid_points DESC, b.created_at ASC
     LIMIT 1`,
    [lotId]
  );
  return result.rows[0];
};

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
 * 获取成员对某拍品的最高出价
 */
exports.getMemberHighestBid = async (lotId, memberId, client = pool) => {
  const result = await client.query(
    `SELECT * FROM auction_bid 
     WHERE lot_id = $1 AND bidder_member_id = $2
     ORDER BY bid_points DESC
     LIMIT 1`,
    [lotId, memberId]
  );
  return result.rows[0];
};

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
 */
exports.getDistinctBidsByLotId = async (lotId, client = pool) => {
  // 获取每个出价人的最高出价
  const result = await client.query(
    `SELECT DISTINCT ON (bidder_member_id) 
       b.*, m.name as bidder_name, m.parent_id
     FROM auction_bid b
     JOIN family_members m ON b.bidder_member_id = m.id
     WHERE b.lot_id = $1
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
  winnerMemberId,
  payPoints,
  secondPrice = null,
  winningBidId = null,
  settledOrderId = null,
  settlementStatus = 'pending'
}, client = pool) => {
  const result = await client.query(
    `INSERT INTO auction_result 
     (lot_id, winner_member_id, pay_points, second_price, winning_bid_id, settled_order_id, settlement_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [lotId, winnerMemberId, payPoints, secondPrice, winningBidId, settledOrderId, settlementStatus]
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
