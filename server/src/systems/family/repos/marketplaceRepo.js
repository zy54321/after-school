/**
 * Marketplace Repository Layer
 * 负责商城相关的数据库 SQL 操作
 */
const pool = require('../../../shared/config/db');

/**
 * 获取数据库连接池（用于事务）
 */
exports.getPool = () => pool;

// ========== SKU 相关 ==========

/**
 * 根据ID获取 SKU
 */
exports.getSkuById = async (skuId, client = pool) => {
  const result = await client.query(
    'SELECT * FROM family_sku WHERE id = $1 AND is_active = TRUE',
    [skuId]
  );
  return result.rows[0];
};

/**
 * 获取所有可用的 SKU 列表
 */
exports.getActiveSkus = async (parentId, client = pool) => {
  const result = await client.query(
    `SELECT * FROM family_sku 
     WHERE is_active = TRUE AND (parent_id = 0 OR parent_id = $1)
     ORDER BY base_cost`,
    [parentId]
  );
  return result.rows;
};

/**
 * 获取家庭自定义 SKU（管理后台）
 */
exports.getSkusByParentId = async (parentId, client = pool) => {
  const result = await client.query(
    `SELECT * FROM family_sku 
     WHERE parent_id = $1 OR parent_id = 0
     ORDER BY parent_id DESC, created_at DESC`,
    [parentId]
  );
  return result.rows;
};

/**
 * 获取 SKU（含停用）
 */
exports.getSkuByIdRaw = async (skuId, client = pool) => {
  const result = await client.query(
    'SELECT * FROM family_sku WHERE id = $1',
    [skuId]
  );
  return result.rows[0];
};

/**
 * 创建 SKU
 */
exports.createSku = async ({
  parentId,
  name,
  description,
  icon,
  type,
  baseCost,
  limitType,
  limitMax,
  targetMembers,
  isActive,
  sourceType,
  sourceId,
  sourceMeta
}, client = pool) => {
  const result = await client.query(
    `INSERT INTO family_sku
     (parent_id, name, description, icon, type, base_cost, limit_type, limit_max, target_members, is_active, source_type, source_id, source_meta)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      parentId,
      name,
      description || null,
      icon || null,
      type || 'reward',
      baseCost || 0,
      limitType || 'unlimited',
      limitMax || 0,
      targetMembers && targetMembers.length > 0 ? targetMembers : null,
      isActive !== false,
      sourceType || 'custom',
      sourceId || null,
      sourceMeta ? JSON.stringify(sourceMeta) : JSON.stringify({})
    ]
  );
  return result.rows[0];
};

/**
 * 更新 SKU
 */
exports.updateSku = async ({
  skuId,
  name,
  description,
  icon,
  type,
  baseCost,
  limitType,
  limitMax,
  targetMembers,
  isActive,
  sourceType,
  sourceId,
  sourceMeta
}, client = pool) => {
  const result = await client.query(
    `UPDATE family_sku
     SET name = $1,
         description = $2,
         icon = $3,
         type = $4,
         base_cost = $5,
         limit_type = $6,
         limit_max = $7,
         target_members = $8,
         is_active = $9,
         source_type = $10,
         source_id = $11,
         source_meta = $12,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $13
     RETURNING *`,
    [
      name,
      description || null,
      icon || null,
      type || 'reward',
      baseCost || 0,
      limitType || 'unlimited',
      limitMax || 0,
      targetMembers && targetMembers.length > 0 ? targetMembers : null,
      isActive !== false,
      sourceType || 'custom',
      sourceId || null,
      sourceMeta ? JSON.stringify(sourceMeta) : JSON.stringify({}),
      skuId
    ]
  );
  return result.rows[0];
};

/**
 * 停用 SKU
 */
exports.deactivateSku = async (skuId, client = pool) => {
  const result = await client.query(
    `UPDATE family_sku
     SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [skuId]
  );
  return result.rows[0];
};

// ========== Offer 相关 ==========

/**
 * 根据ID获取 Offer（含有效期校验）
 */
exports.getActiveOfferById = async (offerId, client = pool) => {
  const result = await client.query(
    `SELECT o.*, s.name as sku_name, s.limit_type, s.limit_max, s.target_members
     FROM family_offer o
     JOIN family_sku s ON o.sku_id = s.id
     WHERE o.id = $1 
       AND o.is_active = TRUE 
       AND s.is_active = TRUE
       AND o.valid_from <= CURRENT_TIMESTAMP
       AND (o.valid_until IS NULL OR o.valid_until >= CURRENT_TIMESTAMP)`,
    [offerId]
  );
  return result.rows[0];
};

/**
 * 根据 SKU ID 获取当前有效的 Offer
 */
exports.getActiveOfferBySkuId = async (skuId, client = pool) => {
  const result = await client.query(
    `SELECT * FROM family_offer 
     WHERE sku_id = $1 
       AND is_active = TRUE
       AND valid_from <= CURRENT_TIMESTAMP
       AND (valid_until IS NULL OR valid_until >= CURRENT_TIMESTAMP)
     ORDER BY created_at DESC
     LIMIT 1`,
    [skuId]
  );
  return result.rows[0];
};

/**
 * 获取所有可用的 Offer 列表
 * @param {number} parentId - 用户ID
 * @param {object} options - 查询选项
 * @param {string} options.offerType - SKU 类型过滤 (reward/auction)
 * @param {number} options.skuId - SKU ID 过滤
 */
exports.getActiveOffers = async (parentId, options = {}, client = pool) => {
  const { offerType, skuId } = options;
  
  // 直接使用 offer.parent_id 查询，不再需要通过 sku 反查
  let query = `
    SELECT 
      o.id,
      o.sku_id,
      o.cost,
      o.quantity,
      o.valid_from,
      o.valid_until,
      o.is_active,
      o.created_at,
      o.parent_id,
      s.name as sku_name,
      s.description as sku_description,
      s.icon as sku_icon,
      s.type as sku_type,
      s.base_cost as sku_base_cost,
      s.limit_type,
      s.limit_max,
      s.target_members
    FROM family_offer o
    JOIN family_sku s ON o.sku_id = s.id
    WHERE o.is_active = TRUE 
      AND s.is_active = TRUE
      AND o.valid_from <= CURRENT_TIMESTAMP
      AND (o.valid_until IS NULL OR o.valid_until >= CURRENT_TIMESTAMP)
      AND o.parent_id = $1
  `;
  const params = [parentId];
  let paramIndex = 2;
  
  if (offerType) {
    query += ` AND s.type = $${paramIndex}`;
    params.push(offerType);
    paramIndex++;
  }
  
  if (skuId) {
    query += ` AND o.sku_id = $${paramIndex}`;
    params.push(skuId);
    paramIndex++;
  }
  
  query += ' ORDER BY o.cost, o.created_at DESC';
  
  const result = await client.query(query, params);
  return result.rows;
};

/**
 * 获取家庭 Offer 列表（管理后台）
 */
exports.getOffersByParentId = async (parentId, client = pool) => {
  const result = await client.query(
    `SELECT o.*, s.name as sku_name, s.type as sku_type
     FROM family_offer o
     JOIN family_sku s ON o.sku_id = s.id
     WHERE o.parent_id = $1
     ORDER BY o.is_active DESC, o.created_at DESC`,
    [parentId]
  );
  return result.rows;
};

/**
 * 获取 Offer（含停用）
 */
exports.getOfferByIdRaw = async (offerId, client = pool) => {
  const result = await client.query(
    `SELECT * FROM family_offer WHERE id = $1`,
    [offerId]
  );
  return result.rows[0];
};

/**
 * 创建 Offer
 */
exports.createOffer = async ({
  parentId,
  skuId,
  cost,
  quantity,
  validFrom,
  validUntil,
  isActive
}, client = pool) => {
  const result = await client.query(
    `INSERT INTO family_offer
     (parent_id, sku_id, cost, quantity, valid_from, valid_until, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      parentId,
      skuId,
      cost,
      quantity || 1,
      validFrom || new Date(),
      validUntil || null,
      isActive !== false
    ]
  );
  return result.rows[0];
};

/**
 * 更新 Offer
 */
exports.updateOffer = async ({
  offerId,
  cost,
  quantity,
  validFrom,
  validUntil,
  isActive
}, client = pool) => {
  const result = await client.query(
    `UPDATE family_offer
     SET cost = $1,
         quantity = $2,
         valid_from = $3,
         valid_until = $4,
         is_active = $5
     WHERE id = $6
     RETURNING *`,
    [
      cost,
      quantity || 1,
      validFrom || new Date(),
      validUntil || null,
      isActive !== false,
      offerId
    ]
  );
  return result.rows[0];
};

/**
 * 停用 Offer
 */
exports.deactivateOffer = async (offerId, client = pool) => {
  const result = await client.query(
    `UPDATE family_offer
     SET is_active = FALSE
     WHERE id = $1
     RETURNING *`,
    [offerId]
  );
  return result.rows[0];
};

// ========== Order 相关 ==========

/**
 * 根据幂等键查询订单
 */
exports.getOrderByIdempotencyKey = async (parentId, idempotencyKey, client = pool) => {
  const result = await client.query(
    `SELECT * FROM family_market_order 
     WHERE parent_id = $1 AND idempotency_key = $2`,
    [parentId, idempotencyKey]
  );
  return result.rows[0];
};

/**
 * 创建订单
 */
exports.createOrder = async ({
  parentId,
  memberId,
  offerId,
  skuId,
  skuName,
  cost,
  quantity,
  status,
  idempotencyKey
}, client = pool) => {
  const result = await client.query(
    `INSERT INTO family_market_order 
     (parent_id, member_id, offer_id, sku_id, sku_name, cost, quantity, status, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [parentId, memberId, offerId, skuId, skuName, cost, quantity, status, idempotencyKey]
  );
  return result.rows[0];
};

/**
 * 更新订单状态
 */
exports.updateOrderStatus = async (orderId, status, client = pool) => {
  await client.query(
    `UPDATE family_market_order 
     SET status = $1, updated_at = CURRENT_TIMESTAMP 
     WHERE id = $2`,
    [status, orderId]
  );
};

/**
 * 获取成员的订单列表
 */
exports.getOrdersByMemberId = async (memberId, limit = 50, client = pool) => {
  const result = await client.query(
    `SELECT * FROM family_market_order 
     WHERE member_id = $1 
     ORDER BY created_at DESC 
     LIMIT $2`,
    [memberId, limit]
  );
  return result.rows;
};

// ========== Inventory 相关 ==========

/**
 * 查询成员未使用的相同 SKU 库存
 */
exports.findUnusedInventoryItem = async (memberId, skuId, client = pool) => {
  const result = await client.query(
    `SELECT id, quantity FROM family_inventory 
     WHERE member_id = $1 AND sku_id = $2 AND status = 'unused'`,
    [memberId, skuId]
  );
  return result.rows[0];
};

/**
 * 根据订单ID查询库存记录
 * 用于幂等性检查，避免重复创建库存
 */
exports.getInventoryByOrderId = async (orderId, client = pool) => {
  const result = await client.query(
    `SELECT * FROM family_inventory WHERE order_id = $1`,
    [orderId]
  );
  return result.rows[0];
};

/**
 * 增加库存数量
 */
exports.incrementInventoryQuantity = async (inventoryId, quantity = 1, client = pool) => {
  await client.query(
    `UPDATE family_inventory 
     SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP 
     WHERE id = $2`,
    [quantity, inventoryId]
  );
};

/**
 * 创建库存记录
 */
exports.createInventoryItem = async ({
  memberId,
  skuId,
  orderId,
  quantity,
  status = 'unused'
}, client = pool) => {
  const result = await client.query(
    `INSERT INTO family_inventory 
     (member_id, sku_id, order_id, quantity, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [memberId, skuId, orderId, quantity, status]
  );
  return result.rows[0];
};

/**
 * 获取成员的库存列表
 */
exports.getInventoryByMemberId = async (memberId, status = null, client = pool) => {
  let query = `
    SELECT 
      i.*,
      s.name as sku_name,
      s.icon as sku_icon,
      s.type as sku_type,
      s.description as sku_description
    FROM family_inventory i
    LEFT JOIN family_sku s ON i.sku_id = s.id
    WHERE i.member_id = $1
  `;
  const params = [memberId];

  if (status && status !== 'all') {
    query += ' AND i.status = $2';
    params.push(status);
  }

  query += ' ORDER BY i.obtained_at DESC';

  const result = await client.query(query, params);
  return result.rows;
};

// ========== 限制次数统计 ==========

/**
 * 获取指定时间段内的订单次数（用于限制检查）
 */
exports.getOrderCountSince = async (memberId, skuId, sinceDate, client = pool) => {
  const result = await client.query(
    `SELECT COUNT(*) FROM family_market_order 
     WHERE member_id = $1 AND sku_id = $2 AND status = 'paid' AND created_at >= $3`,
    [memberId, skuId, sinceDate]
  );
  return parseInt(result.rows[0].count);
};

// ========== Offer 管理 ==========

/**
 * 创建 Offer
 * @param {object} params - Offer 参数
 * @param {number} params.parentId - 所属用户ID（必填，用于家庭级查询）
 * @param {number} params.skuId - SKU ID
 * @param {number} params.cost - 价格
 * @param {number} params.quantity - 数量
 * @param {Date} params.validFrom - 生效开始时间
 * @param {Date} params.validUntil - 生效结束时间
 * @param {boolean} params.isActive - 是否启用
 * @param {string} params.offerType - Offer 类型
 * @param {number} params.discountRate - 折扣率
 * @param {number} params.limitPerMember - 每成员限购
 * @param {object} params.metadata - 元数据
 */
exports.createOffer = async ({
  parentId,
  skuId,
  cost,
  quantity = 1,
  validFrom = new Date(),
  validUntil = null,
  isActive = true,
  offerType = null,
  discountRate = null,
  limitPerMember = null,
  metadata = null,
}, client = pool) => {
  const result = await client.query(
    `INSERT INTO family_offer 
     (parent_id, sku_id, cost, quantity, valid_from, valid_until, is_active, offer_type, discount_rate, limit_per_member, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [parentId, skuId, cost, quantity, validFrom, validUntil, isActive, offerType, discountRate, limitPerMember, metadata]
  );
  return result.rows[0];
};

/**
 * 使 Offer 过期/失效
 */
exports.deactivateOffer = async (offerId, client = pool) => {
  const result = await client.query(
    `UPDATE family_offer SET is_active = FALSE WHERE id = $1 RETURNING *`,
    [offerId]
  );
  return result.rows[0];
};

/**
 * 批量使 Offers 失效（按类型）
 */
exports.deactivateOffersByType = async (parentId, offerType, client = pool) => {
  // 需要先找出属于该用户的 SKU 关联的 offers
  const result = await client.query(
    `UPDATE family_offer o
     SET is_active = FALSE
     FROM family_sku s
     WHERE o.sku_id = s.id
       AND o.offer_type = $1
       AND (s.parent_id = 0 OR s.parent_id = $2)
       AND o.is_active = TRUE
     RETURNING o.*`,
    [offerType, parentId]
  );
  return result.rows;
};

/**
 * 获取指定类型的有效 Offers
 */
exports.getOffersByType = async (parentId, offerType, client = pool) => {
  const result = await client.query(
    `SELECT 
      o.*,
      s.name as sku_name,
      s.description as sku_description,
      s.icon as sku_icon,
      s.type as sku_type,
      s.base_cost as sku_base_cost,
      s.limit_type,
      s.limit_max
    FROM family_offer o
    JOIN family_sku s ON o.sku_id = s.id
    WHERE o.offer_type = $1
      AND o.is_active = TRUE
      AND s.is_active = TRUE
      AND o.valid_from <= CURRENT_TIMESTAMP
      AND (o.valid_until IS NULL OR o.valid_until >= CURRENT_TIMESTAMP)
      AND (s.parent_id = 0 OR s.parent_id = $2)
    ORDER BY o.cost`,
    [offerType, parentId]
  );
  return result.rows;
};

/**
 * 获取 Offer 的购买次数
 */
exports.getOfferPurchaseCount = async (offerId, memberId, client = pool) => {
  const result = await client.query(
    `SELECT COUNT(*) FROM family_market_order 
     WHERE offer_id = $1 AND member_id = $2 AND status = 'paid'`,
    [offerId, memberId]
  );
  return parseInt(result.rows[0].count);
};
