/**
 * Auction Service Layer
 * 负责拍卖业务逻辑处理
 * 
 * 核心概念：
 * - 拍卖场次是 Family-level 配置，全家共享
 * - 所有成员看到相同的场次和拍品
 * - member 仅作为参与者（bidder_member_id）
 * - 结算时使用 member 做扣款，但场次本身是家庭级
 * 
 * 查询口径：
 * - 场次/拍品查询：全部 parentId 维度
 * - 出价记录：memberId 维度（参与记录）
 * - 订单/库存：memberId 维度（归属记录）
 */
const auctionRepo = require('../repos/auctionRepo');
const walletRepo = require('../repos/walletRepo');
const marketplaceRepo = require('../repos/marketplaceRepo');
const seedrandom = require('seedrandom');

/**
 * 稀有度配置
 * - 起拍价倍数
 * - 默认数量权重（用于随机抽取时的概率）
 */
const RARITY_CONFIG = {
  r: { priceMultiplier: 1, weight: 40 },
  sr: { priceMultiplier: 1.5, weight: 30 },
  ssr: { priceMultiplier: 2.5, weight: 20 },
  ur: { priceMultiplier: 5, weight: 10 },
  // 兼容旧稀有度
  common: { priceMultiplier: 1, weight: 40 },
  rare: { priceMultiplier: 1.5, weight: 30 },
  epic: { priceMultiplier: 2.5, weight: 20 },
  legendary: { priceMultiplier: 5, weight: 10 },
};

/**
 * 确定性随机数生成器（使用 seed）
 * @param {string|number} seed - 随机种子
 * @returns {Function} 随机数生成函数（0-1之间）
 */
const createSeededRandom = (seed) => {
  if (seed === null || seed === undefined) {
    // 如果没有 seed，使用当前时间戳
    seed = Date.now().toString();
  }
  return seedrandom(String(seed));
};

/**
 * 从数组中确定性随机抽取指定数量的元素（使用 seed）
 * @param {Array} array - 源数组
 * @param {number} count - 抽取数量
 * @param {Function} rng - 随机数生成函数（0-1之间）
 * @param {boolean} unique - 是否不允许重复 sku_id
 * @returns {Array} 抽取的元素
 */
const deterministicPick = (array, count, rng, unique = false) => {
  if (array.length <= count && !unique) {
    return [...array];
  }
  
  const result = [];
  const usedIndices = new Set();
  const usedSkuIds = unique ? new Set() : null;
  
  while (result.length < count && result.length < array.length) {
    const index = Math.floor(rng() * array.length);
    if (!usedIndices.has(index)) {
      const item = array[index];
      // 如果 unique=true，检查 sku_id 是否已使用
      if (unique && usedSkuIds && usedSkuIds.has(item.id)) {
        continue;
      }
      usedIndices.add(index);
      if (unique && usedSkuIds) {
        usedSkuIds.add(item.id);
      }
      result.push(item);
    }
  }
  
  return result;
};

/**
 * 按权重分配稀有度数量
 * @param {number} totalCount - 总数量
 * @param {object} rarityWeights - 稀有度权重 { r: 40, sr: 30, ssr: 20, ur: 10 }
 * @param {Function} rng - 随机数生成函数
 * @returns {object} 各稀有度分配的数量 { r: 2, sr: 1, ssr: 1, ur: 0 }
 */
const distributeByRarityWeights = (totalCount, rarityWeights, rng) => {
  const weights = {
    r: rarityWeights.r || 40,
    sr: rarityWeights.sr || 30,
    ssr: rarityWeights.ssr || 20,
    ur: rarityWeights.ur || 10,
  };
  
  const totalWeight = weights.r + weights.sr + weights.ssr + weights.ur;
  if (totalWeight === 0) {
    // 默认均分
    const perRarity = Math.floor(totalCount / 4);
    return {
      r: perRarity,
      sr: perRarity,
      ssr: perRarity,
      ur: totalCount - perRarity * 3,
    };
  }
  
  // 按权重分配
  const counts = {
    r: 0,
    sr: 0,
    ssr: 0,
    ur: 0,
  };
  
  // 使用加权随机分配
  for (let i = 0; i < totalCount; i++) {
    const rand = rng() * totalWeight;
    let cumulative = 0;
    
    if (rand < (cumulative += weights.r)) {
      counts.r++;
    } else if (rand < (cumulative += weights.sr)) {
      counts.sr++;
    } else if (rand < (cumulative += weights.ssr)) {
      counts.ssr++;
    } else {
      counts.ur++;
    }
  }
  
  return counts;
};

/**
 * 计算起拍价
 * @param {number} baseCost - 基础成本
 * @param {string} rarity - 稀有度
 * @returns {number} 起拍价
 */
const normalizeRarity = (rarity) => {
  const map = {
    common: 'r',
    rare: 'sr',
    epic: 'ssr',
    legendary: 'ur',
  };
  return map[rarity] || rarity || 'r';
};

const calculateStartPrice = (baseCost, rarity) => {
  const normalized = normalizeRarity(rarity);
  const config = RARITY_CONFIG[normalized] || RARITY_CONFIG.r;
  // 起拍价 = 基础成本 * 倍数 * 0.5（起拍价通常低于实际价值）
  return Math.max(1, Math.floor(baseCost * config.priceMultiplier * 0.5));
};

const parseSessionConfig = (config) => {
  if (!config) return {};
  if (typeof config === 'string') {
    try {
      return JSON.parse(config);
    } catch (err) {
      return {};
    }
  }
  return config;
};

const getRarityOrderScore = (rarity) => {
  const order = ['r', 'sr', 'ssr', 'ur'];
  const normalized = normalizeRarity(rarity);
  const idx = order.indexOf(normalized);
  return idx === -1 ? 999 : idx;
};

/**
 * 生成拍卖品 (Lots)
 * 
 * 功能：
 * 1. 从可拍卖的 SKU/Offer 池中按稀有度随机抽取
 * 2. 为每个 lot 创建 auction_lot
 * 3. 每个 lot 生成一个专用的 offer
 * 4. 设置 rarity/start_price
 * 5. 防重：同一 session 只允许生成一次
 * 
 * @param {number} sessionId - 拍卖场次ID
 * @param {object} rarityCounts - 各稀有度数量配置
 * @param {number} rarityCounts.common - 普通数量
 * @param {number} rarityCounts.rare - 稀有数量
 * @param {number} rarityCounts.epic - 史诗数量
 * @param {number} rarityCounts.legendary - 传说数量
 * @returns {object} 生成结果
 */
exports.generateLots = async (sessionId, rarityCounts = {}) => {
  const pool = auctionRepo.getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // ========== 1. 获取场次信息 ==========
    const session = await auctionRepo.getSessionById(sessionId, client);
    if (!session) {
      throw new Error('拍卖场次不存在');
    }
    
    // ========== 2. 防重检查：场次已有 lots 则拒绝 ==========
    const existingLotCount = await auctionRepo.getLotCountBySessionId(sessionId, client);
    if (existingLotCount > 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        msg: '该场次已生成过拍卖品，不可重复生成',
        existingCount: existingLotCount,
      };
    }
    
    // ========== 3. 获取可拍卖的 SKU 池 ==========
    let skuPool = await auctionRepo.getAuctionableSkus(session.parent_id, client);
    const sessionConfig = parseSessionConfig(session.config);
    if (Array.isArray(sessionConfig.pool_sku_ids) && sessionConfig.pool_sku_ids.length > 0) {
      const poolSet = new Set(sessionConfig.pool_sku_ids.map((id) => parseInt(id)));
      skuPool = skuPool.filter((sku) => poolSet.has(sku.id));
    }
    if (skuPool.length === 0) {
      throw new Error('没有可用的拍卖品，请先创建 SKU');
    }
    
    // ========== 4. 按稀有度分配并抽取 ==========
    const counts = {
      r: rarityCounts.r || 0,
      sr: rarityCounts.sr || 0,
      ssr: rarityCounts.ssr || 0,
      ur: rarityCounts.ur || 0,
    };
    
    const totalRequested = counts.r + counts.sr + counts.ssr + counts.ur;
    if (totalRequested === 0) {
      throw new Error('请至少指定一个稀有度的数量');
    }
    
    // 准备要创建的 lots
    const lotsToCreate = [];
    let sortOrder = 1;
    
    // 按稀有度从高到低生成（传说 -> 史诗 -> 稀有 -> 普通）
    const rarities = ['ur', 'ssr', 'sr', 'r'];
    
    for (const rarity of rarities) {
      const count = counts[rarity];
      if (count <= 0) continue;
      
      // 从 SKU 池中随机抽取
      const pickedSkus = randomPick(skuPool, count);
      
      for (let i = 0; i < Math.min(count, pickedSkus.length); i++) {
        const sku = pickedSkus[i % pickedSkus.length]; // 如果 SKU 不够，循环使用
        const baseCost = sku.default_cost || sku.base_cost || 10;
        const startPrice = calculateStartPrice(baseCost, rarity);
        
        lotsToCreate.push({
          sessionId,
          skuId: sku.id,
          offerId: null, // 稍后创建专用 offer
          rarity,
          startPrice,
          buyNowPrice: Math.floor(baseCost * (RARITY_CONFIG[rarity]?.priceMultiplier || 1) * 2),
          quantity: 1,
          status: 'pending',
          sortOrder: sortOrder++,
          skuName: sku.name,
          skuIcon: sku.icon,
          baseCost, // 临时保存用于创建 offer
        });
      }
      
      // 如果 SKU 不够，用重复的填充
      const remaining = count - pickedSkus.length;
      for (let i = 0; i < remaining; i++) {
        const sku = skuPool[i % skuPool.length];
        const baseCost = sku.default_cost || sku.base_cost || 10;
        const startPrice = calculateStartPrice(baseCost, rarity);
        
        lotsToCreate.push({
          sessionId,
          skuId: sku.id,
          offerId: null,
        rarity,
          startPrice,
        buyNowPrice: Math.floor(baseCost * (RARITY_CONFIG[normalizeRarity(rarity)]?.priceMultiplier || 1) * 2),
          quantity: 1,
          status: 'pending',
          sortOrder: sortOrder++,
          skuName: sku.name + (remaining > 0 ? ` #${i + 2}` : ''),
          skuIcon: sku.icon,
          baseCost,
        });
      }
    }
    
    // ========== 5. 为每个 lot 创建专用 offer 并创建 lot ==========
    const createdLots = [];
    
    for (const lotData of lotsToCreate) {
      // 创建专用 offer（供给侧配置必须包含 parent_id）
      const offer = await auctionRepo.createAuctionOffer({
        parentId: session.parent_id,  // 供给侧配置
        skuId: lotData.skuId,
        cost: lotData.startPrice, // 起拍价作为 offer 成本
        quantity: lotData.quantity,
      }, client);
      
      // 创建 lot，关联 offer
      const lot = await auctionRepo.createLot({
        sessionId: lotData.sessionId,
        offerId: offer.id,
        skuId: lotData.skuId,
        rarity: lotData.rarity,
        startPrice: lotData.startPrice,
        reservePrice: null,
        buyNowPrice: lotData.buyNowPrice,
        quantity: lotData.quantity,
        status: lotData.status,
        sortOrder: lotData.sortOrder,
        skuName: lotData.skuName,
        skuIcon: lotData.skuIcon,
      }, client);
      
      createdLots.push({
        ...lot,
        offer_id: offer.id,
      });
    }
    
    // ========== 6. 更新场次状态为 scheduled（如果是 draft） ==========
    if (session.status === 'draft') {
      await auctionRepo.updateSessionStatus(sessionId, 'scheduled', client);
    }
    
    await client.query('COMMIT');
    
    // ========== 7. 统计结果 ==========
    const summary = {
      r: createdLots.filter(l => normalizeRarity(l.rarity) === 'r').length,
      sr: createdLots.filter(l => normalizeRarity(l.rarity) === 'sr').length,
      ssr: createdLots.filter(l => normalizeRarity(l.rarity) === 'ssr').length,
      ur: createdLots.filter(l => normalizeRarity(l.rarity) === 'ur').length,
    };
    
    return {
      success: true,
      msg: `成功生成 ${createdLots.length} 个拍卖品`,
      sessionId,
      totalLots: createdLots.length,
      summary,
      lots: createdLots,
    };
    
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * 获取场次详情（含拍卖品列表）
 */
exports.getSessionWithLots = async (sessionId) => {
  const session = await auctionRepo.getSessionById(sessionId);
  if (!session) {
    throw new Error('拍卖场次不存在');
  }

  const lots = await auctionRepo.getLotDetails(sessionId);
  const sortedLots = [...lots].sort((a, b) => {
    const aScore = getRarityOrderScore(a.rarity);
    const bScore = getRarityOrderScore(b.rarity);
    if (aScore !== bScore) return aScore - bScore;
    return (a.sort_order || 0) - (b.sort_order || 0);
  });

  const sessionConfig = parseSessionConfig(session.config);
  const currentIndex = Number.isInteger(sessionConfig.current_lot_index)
    ? sessionConfig.current_lot_index
    : 0;

  return {
    session,
    lots: sortedLots,
    lotCount: sortedLots.length,
    currentLotIndex: currentIndex,
  };
};

/**
 * 创建拍卖场次
 */
exports.createSession = async ({
  parentId,
  title,
  scheduledAt,
  config = {}
}) => {
  return await auctionRepo.createSession({
    parentId,
    title,
    scheduledAt,
    status: 'draft',
    config,
  });
};

/**
 * 获取用户的拍卖场次列表
 */
exports.getSessionsByParentId = async (parentId, status = null) => {
  return await auctionRepo.getSessionsByParentId(parentId, status);
};

// ========== 管理后台流程 ==========

exports.setSessionPool = async (sessionId, parentId, skuIds = []) => {
  const session = await auctionRepo.getSessionById(sessionId);
  if (!session || session.parent_id !== parentId) {
    throw new Error('拍卖场次不存在或无权限');
  }
  const config = parseSessionConfig(session.config);
  config.pool_sku_ids = Array.isArray(skuIds) ? skuIds.map((id) => parseInt(id)) : [];
  return await auctionRepo.updateSessionConfig(sessionId, config);
};

exports.startSession = async (sessionId, parentId) => {
  const session = await auctionRepo.getSessionById(sessionId);
  if (!session || session.parent_id !== parentId) {
    throw new Error('拍卖场次不存在或无权限');
  }
  const lots = await auctionRepo.getLotDetails(sessionId);
  if (!lots || lots.length === 0) {
    throw new Error('该场次暂无拍品');
  }
  const config = parseSessionConfig(session.config);
  config.current_lot_index = 0;
  await auctionRepo.updateSessionConfig(sessionId, config);
  if (session.status !== 'active') {
    await auctionRepo.updateSessionStatus(sessionId, 'active');
  }
  return { success: true };
};

exports.advanceSessionLot = async (sessionId, parentId) => {
  const session = await auctionRepo.getSessionById(sessionId);
  if (!session || session.parent_id !== parentId) {
    throw new Error('拍卖场次不存在或无权限');
  }
  const lots = await auctionRepo.getLotDetails(sessionId);
  const sortedLots = [...lots].sort((a, b) => {
    const aScore = getRarityOrderScore(a.rarity);
    const bScore = getRarityOrderScore(b.rarity);
    if (aScore !== bScore) return aScore - bScore;
    return (a.sort_order || 0) - (b.sort_order || 0);
  });
  const config = parseSessionConfig(session.config);
  const currentIndex = Number.isInteger(config.current_lot_index) ? config.current_lot_index : 0;
  const nextIndex = currentIndex + 1;
  if (nextIndex >= sortedLots.length) {
    await auctionRepo.updateSessionStatus(sessionId, 'ended');
    config.current_lot_index = sortedLots.length - 1;
  } else {
    config.current_lot_index = nextIndex;
  }
  await auctionRepo.updateSessionConfig(sessionId, config);
  return { success: true, currentLotIndex: config.current_lot_index };
};

/**
 * 获取可用于拍卖的 SKU 列表
 */
exports.getAuctionableSkus = async (parentId) => {
  return await auctionRepo.getAuctionableSkus(parentId);
};

// ========== 市场配置入口（Family-level）==========

/**
 * 获取拍卖概览（Family-level 视角）
 * 
 * 用途：展示家庭拍卖系统的整体情况，不涉及具体成员
 * 
 * @param {number} parentId - 用户ID
 * @param {object} options - 查询选项
 * @param {string} options.status - 场次状态筛选
 * @returns {object} 拍卖概览
 */
exports.getAuctionOverview = async (parentId, options = {}) => {
  const { status } = options;
  
  // 获取场次列表
  const sessions = await auctionRepo.getSessionsByParentId(parentId, status);
  
  // 统计各状态数量
  const stats = {
    draft: sessions.filter(s => s.status === 'draft').length,
    scheduled: sessions.filter(s => s.status === 'scheduled').length,
    active: sessions.filter(s => s.status === 'active').length,
    ended: sessions.filter(s => s.status === 'ended').length,
  };
  
  // 获取可拍卖的 SKU
  const auctionableSkus = await auctionRepo.getAuctionableSkus(parentId);
  
  return {
    parentId,
    sessions,
    totalSessions: sessions.length,
    stats,
    auctionableSkuCount: auctionableSkus.length,
  };
};

// ========== 拍卖台（大厅/会场聚合）==========

/**
 * 大厅聚合（拍卖台用）
 * - 返回 active/scheduled 场次的当前拍品信息
 */
/**
 * 获取拍卖大厅聚合数据
 * 返回：{ sessions: [...] }
 */
exports.getHall = async (parentId) => {
  return await auctionRepo.getHallSessions(parentId);
};

/**
 * 会场详情聚合（拍卖台用）
 * 返回：{ session, lots, members, recent_bids }
 */
exports.getSessionOverview = async (parentId, sessionId) => {
  const pool = auctionRepo.getPool();
  const client = await pool.connect();
  
  try {
    const result = await auctionRepo.getSessionOverviewDTO(parentId, sessionId, client);
    if (!result) {
      throw new Error('拍卖场次不存在或无权限');
    }
    return result;
  } finally {
    client.release();
  }
};

/**
 * 获取管理员场次列表（聚合统计）
 * 返回：{ sessions: [...] }
 */
exports.getSessionsAdmin = async (parentId) => {
  return await auctionRepo.getSessionsAdmin(parentId);
};

/**
 * 激活指定拍品
 * 事务：同一 session 下把所有 lot.status='active' -> 'pending'；把目标 lot -> 'active'
 */
exports.activateLot = async (actorUserId, sessionId, lotId) => {
  const pool = auctionRepo.getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1) 锁定 session
    const session = await auctionRepo.getSessionForUpdate(sessionId, client);
    if (!session) throw new Error('拍卖场次不存在');
    if (session.parent_id !== actorUserId) throw new Error('无权操作该场次');
    
    // 2) 验证 lot 属于该 session
    const lot = await auctionRepo.getLotForUpdate(lotId, client);
    if (!lot) throw new Error('拍品不存在');
    if (lot.session_id !== sessionId) throw new Error('拍品不属于该场次');
    
    // 3) 同一 session 下把所有 lot.status='active' -> 'pending'
    await auctionRepo.updateLotsStatusBySession(sessionId, 'active', 'pending', client);
    
    // 4) 把目标 lot -> 'active'
    await auctionRepo.updateLotStatus(lotId, 'active', client);
    
    // 5) 写 event
    await auctionRepo.createEvent({
      actorUserId,
      sessionId,
      lotId,
      eventType: 'activate_lot',
      payload: { lot_id: lotId },
    }, client);
    
    // 6) 获取激活后的 lot 信息
    const activeLot = await auctionRepo.getLotById(lotId, client);
    
    await client.query('COMMIT');
    
    return {
      active_lot: activeLot ? {
        id: activeLot.id,
        title: activeLot.sku_name,
        status: activeLot.status,
      } : null,
      session: {
        id: session.id,
        title: session.title,
        status: session.status,
      },
    };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

/**
 * 激活下一拍品
 * 规则：按 sort_order 找下一个 status='pending' 的 lot，调用激活逻辑
 * 若没有 pending，session.status -> ended
 */
exports.activateNext = async (actorUserId, sessionId) => {
  const pool = auctionRepo.getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1) 锁定 session
    const session = await auctionRepo.getSessionForUpdate(sessionId, client);
    if (!session) throw new Error('拍卖场次不存在');
    if (session.parent_id !== actorUserId) throw new Error('无权操作该场次');
    
    // 2) 查找下一个待激活的拍品
    const nextLot = await auctionRepo.getNextPendingLot(sessionId, client);
    
    if (!nextLot) {
      // 没有待激活的拍品，结束场次
      await auctionRepo.updateSessionStatus(sessionId, 'ended', client);
      
      await auctionRepo.createEvent({
        actorUserId,
        sessionId,
        eventType: 'activate_next',
        payload: { result: 'no_more_pending', session_status: 'ended' },
      }, client);
      
      await client.query('COMMIT');
      
      return {
        active_lot: null,
        session: {
          id: session.id,
          title: session.title,
          status: 'ended',
        },
        message: '没有更多待激活的拍品，场次已结束',
      };
    }
    
    // 3) 激活该拍品
    await auctionRepo.updateLotsStatusBySession(sessionId, 'active', 'pending', client);
    await auctionRepo.updateLotStatus(nextLot.id, 'active', client);
    
    // 4) 写 event
    await auctionRepo.createEvent({
      actorUserId,
      sessionId,
      lotId: nextLot.id,
      eventType: 'activate_next',
      payload: { lot_id: nextLot.id },
    }, client);
    
    // 5) 获取激活后的 lot 信息
    const activeLot = await auctionRepo.getLotById(nextLot.id, client);
    
    await client.query('COMMIT');
    
    return {
      active_lot: activeLot ? {
        id: activeLot.id,
        title: activeLot.sku_name,
        status: activeLot.status,
      } : null,
      session: {
        id: session.id,
        title: session.title,
        status: session.status,
      },
    };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

// ========== 拍卖台动作（逐 lot 成交 / 撤销最后一次出价）==========

/**
 * 逐 lot 成交（实现A：最高价成交，冻结已扣）
 * 
 * @param {number} actorUserId - 操作者用户ID（parent_id）
 * @param {number} lotId - 拍品ID
 * @returns {object} 成交结果 { status, finalPrice, winnerId, result, order }
 * 
 * 严格事务顺序：
 * 1) 锁定 lot + session
 * 2) 校验 lot=open
 * 3) 取最高 bid
 * 4) 若无出价：流拍
 * 5) 幂等检查：result 已存在就返回
 * 6) 赢家：标记 hold 为 converted（不再扣分）
 * 7) 输家：释放 hold，写正数 points_log
 * 8) 生成订单+入库
 * 9) 写 result
 * 10) 更新 lot 状态为 sold
 * 11) 写 event
 */
exports.closeLot = async (actorUserId, lotId) => {
  const pool = auctionRepo.getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const lot = await auctionRepo.getLotForUpdate(lotId, client);
    if (!lot) throw new Error('lot 不存在');

    const session = await auctionRepo.getSessionForUpdate(lot.session_id, client);
    if (!session) throw new Error('session 不存在');
    if (!['pending', 'active'].includes(lot.status)) throw new Error('该拍品已成交/已流拍/已关闭');

    // 1) 取最高 bid（只取有效 bid）
    const top = await auctionRepo.getTopBid(lotId, client);

    // 2) 若无出价：流拍
    if (!top) {
      await auctionRepo.insertResultIfAbsent({
        sessionId: lot.session_id,
        lotId,
        winnerBidderId: null,
        finalPrice: 0,
        status: 'unsold',
      }, client);

      await auctionRepo.updateLotStatus(lotId, 'unsold', client);
      await auctionRepo.createEvent({
        actorUserId,
        sessionId: lot.session_id,
        lotId,
        bidderId: null,
        eventType: 'close_lot',
        payload: { status: 'unsold' },
      }, client);

      await client.query('COMMIT');
      return { status: 'unsold' };
    }

    const winnerId = top.bidder_member_id || top.bidder_id;
    const finalPrice = top.bid_points; // ✅ 最高价成交

    // 3) 幂等：result 已存在就直接返回（unique(session_id, lot_id) 保护）
    const existed = await auctionRepo.getResultBySessionLot(lot.session_id, lotId, client);
    if (existed) {
      await client.query('COMMIT');
      return { status: existed.settlement_status || existed.status, result: existed };
    }

    // 4) 赢家冻结（实现A：赢家冻结通常=finalPrice，不需要额外扣分）
    //    但仍建议把 winner hold 标记 converted
    await auctionRepo.markHoldConverted(lotId, winnerId, client);

    // 5) 输家释放：释放所有非赢家 hold
    //    返回：[{ bidder_id, hold_points }, ...]
    const losersHolds = await auctionRepo.listLoserHoldsForUpdate(lotId, winnerId, client);

    for (const h of losersHolds) {
      if (h.hold_points > 0) {
        await walletRepo.createPointsLog({
          memberId: h.bidder_id,
          parentId: actorUserId,
          description: `拍卖释放(${lot.sku_name || lotId})`,
          pointsChange: +h.hold_points,
          reasonCode: 'auction_release',
          idempotencyKey: `auction_release_${lotId}_${h.bidder_id}_close`,
        }, client);
      }
      await auctionRepo.markHoldReleased(lotId, h.bidder_id, client);
    }

    // 6) 生成订单 + 入库（用你现有 marketplace 的 fulfill 逻辑）
    //    这里你有两种资产类型：
    //    - lot 关联 offer/sku：用 marketplaceService 的 "创建订单+入库"复用
    //    - lot 只是一个文本拍品：只写 result，不入库
    //
    // 建议：lot 表上存 offer_id 或 sku_id（你已有 family_market 体系）
    const idempotencyKey = `auction_lot_${lotId}`;
    let order = null;
    
    if (lot.sku_id || lot.offer_id) {
      // 使用现有的 createOrderAndFulfill，但需要修改为不扣分（实现A下已扣）
      // 或者创建一个新的方法 createAuctionOrderAndFulfill
      // 这里先使用 createOrderAndFulfill，但跳过扣分步骤
      const existingOrder = await marketplaceRepo.getOrderByIdempotencyKey(actorUserId, idempotencyKey, client);
      if (!existingOrder) {
        // 创建订单（不扣分，因为实现A下已扣）
        order = await marketplaceRepo.createOrder({
          parentId: actorUserId,
          memberId: winnerId,
          offerId: lot.offer_id,
          skuId: lot.sku_id,
          skuName: lot.sku_name,
          cost: finalPrice,
          quantity: lot.quantity || 1,
          status: 'paid',
          idempotencyKey,
        }, client);

        // 创建库存
        const existingInventory = await marketplaceRepo.findUnusedInventoryItem(winnerId, lot.sku_id, client);
        if (existingInventory) {
          await marketplaceRepo.incrementInventoryQuantity(existingInventory.id, lot.quantity || 1, client);
        } else {
          await marketplaceRepo.createInventoryItem({
            memberId: winnerId,
            skuId: lot.sku_id,
            orderId: order.id,
            quantity: lot.quantity || 1,
            status: 'unused',
          }, client);
        }
      } else {
        order = existingOrder;
      }
    }

    // 7) 写 result（unique 保证不重复）
    const result = await auctionRepo.insertResultIfAbsent({
      sessionId: lot.session_id,
      lotId,
      winnerBidderId: winnerId,
      finalPrice,
      status: 'sold',
      orderId: order ? order.id : null,
    }, client);

    // 8) lot 状态 -> sold
    await auctionRepo.updateLotStatus(lotId, 'sold', client);

    // 9) event
    await auctionRepo.createEvent({
      actorUserId,
      sessionId: lot.session_id,
      lotId,
      bidderId: winnerId,
      eventType: 'close_lot',
      payload: { status: 'sold', finalPrice },
    }, client);

    await client.query('COMMIT');
    return { status: 'sold', finalPrice, winnerId, result, order };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

/**
 * 撤销最后一次出价（仅允许撤销该 lot 最新一条 bid）
 * 
 * 约束：只能撤销该 lot 最新一条 bid 且 lot=open
 */
exports.undoLastBid = async (actorUserId, lotId) => {
  const pool = auctionRepo.getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const lot = await auctionRepo.getLotForUpdate(lotId, client);
    if (!lot) throw new Error('lot 不存在');
    if (!['pending', 'active'].includes(lot.status)) throw new Error('该拍品已关闭，无法撤销出价');

    // 1) 最新 bid（有效且未 void）
    const lastBid = await auctionRepo.getLastBidForUpdate(lotId, client);
    if (!lastBid) throw new Error('没有可撤销的出价');

    // 2) 将 last bid 标记 void
    await auctionRepo.voidBid(lastBid.id, client);

    const bidderId = lastBid.bidder_member_id || lastBid.bidder_id;

    // 3) 重算该 bidder 在该 lot 的最大有效出价
    const newMaxBid = await auctionRepo.getMaxBidByBidder(lotId, bidderId, client); // { bid_points } or null
    const newMax = newMaxBid ? parseInt(newMaxBid.bid_points) : 0;

    // 4) 读 hold（FOR UPDATE）
    const hold = await auctionRepo.getHoldForUpdate(lotId, bidderId, client);
    const oldHold = hold ? hold.hold_points : 0;

    // 5) 释放差额
    const release = oldHold - newMax;
    if (release < 0) throw new Error('内部错误：释放差额为负');

    if (release > 0) {
      await walletRepo.createPointsLog({
        memberId: bidderId,
        parentId: actorUserId,
        description: `撤销出价释放(${lot.sku_name || lotId})`,
        pointsChange: +release,
        reasonCode: 'auction_release',
        idempotencyKey: `auction_release_${lotId}_${bidderId}_undo_${lastBid.id}`,
      }, client);
    }

    // 6) 更新 hold 为 newMax（若 newMax=0 则可直接标记 released）
    if (newMax === 0) {
      await auctionRepo.markHoldReleased(lotId, bidderId, client);
    } else {
      await auctionRepo.upsertHold({
        sessionId: lot.session_id,
        lotId,
        bidderId,
        holdPoints: newMax,
        status: 'active',
      }, client);
    }

    // 7) event
    await auctionRepo.createEvent({
      actorUserId,
      sessionId: lot.session_id,
      lotId,
      bidderId,
      eventType: 'undo_bid',
      payload: { voidBidId: lastBid.id, oldHold, newMax, release },
    }, client);

    await client.query('COMMIT');
    return { voidBidId: lastBid.id, bidderId, oldHold, newMax, release };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ========== 密封出价（Member-level）==========

/**
 * 提交密封出价
 * 
 * 流程：
 * 1. 校验拍品状态（必须是 pending 或 active）
 * 2. 校验场次状态（必须是 scheduled 或 active）
 * 3. 校验出价金额（必须 >= 起拍价）
 * 4. 校验成员余额
 * 5. 创建出价记录
 * 
 * @param {number} lotId - 拍品ID
 * @param {number} bidderId - 出价成员ID
 * @param {number} bidPoints - 出价积分
 * @returns {object} 出价结果
 */
/**
 * 提交出价（实现A：冻结增量）
 * 
 * 严格事务顺序：
 * 1) 锁定 lot + session（避免结算/关标并发）
 * 2) 状态校验
 * 3) 归属校验
 * 4) 当前最高价校验
 * 5) 查询该 bidder 该 lot 当前冻结（FOR UPDATE）
 * 6) delta 冻结增量
 * 7) 计算可用余额
 * 8) 写/更新 hold
 * 9) 写 bid（先写，获取 bidId）
 * 10) 写冻结流水（负数 delta，幂等键使用 bidId）
 * 11) 写 event
 */
exports.submitBid = async (actorUserId, lotId, bidderId, bidPoints) => {
  const pool = auctionRepo.getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // 1) 锁定 lot + session（避免结算/关标并发）
    const lot = await auctionRepo.getLotForUpdate(lotId, client);
    if (!lot) throw new Error('lot 不存在');

    const session = await auctionRepo.getSessionForUpdate(lot.session_id, client);
    if (!session) throw new Error('session 不存在');

    // 2) 状态校验
    if (session.status !== 'active') throw new Error('拍卖场未开始或已结束');
    if (!['pending', 'active'].includes(lot.status)) throw new Error('该拍品当前不可出价');
    if (session.ends_at && new Date() > new Date(session.ends_at)) throw new Error('拍卖已到截止时间');
    
    // 检查是否已成交/流拍
    const existingResult = await auctionRepo.getResultByLotId(lotId, client);
    if (existingResult) throw new Error('拍品已成交/流拍，禁止出价');

    // 3) 归属校验：bidder 必须属于当前 parent（你的系统：parent_id = userId）
    const bidder = await walletRepo.getMemberById(bidderId, client);
    if (!bidder) throw new Error('成员不存在');
    if (bidder.parent_id !== actorUserId) throw new Error('无权为该成员出价');

    // 4) 当前最高价（只考虑有效 bid）
    const top = await auctionRepo.getTopBid(lotId, client); // { bid_points, bidder_id, created_at } or null
    const currentTop = top ? top.bid_points : (lot.reserve_price || lot.start_price || 0);

    if (bidPoints <= currentTop) throw new Error(`出价必须大于当前最高价：${currentTop}`);

    // 5) 查询该 bidder 该 lot 当前冻结/最高出价（FOR UPDATE）
    const hold = await auctionRepo.getHoldForUpdate(lotId, bidderId, client); // { hold_points } or null
    const oldHold = hold ? hold.hold_points : 0;

    if (bidPoints <= oldHold) throw new Error(`出价必须大于该成员当前最高出价：${oldHold}`);

    // 6) delta 冻结增量
    const delta = bidPoints - oldHold;

    // 7) 实现A 下 balance 已扣冻结：冻结已经写入 points_log（负数），walletBalance 已经是"净余额"
    //    这里只需要校验净余额是否足够覆盖新增冻结 delta
    const walletBalance = await walletRepo.getBalance(bidderId, client);

    if (walletBalance < delta) throw new Error('可用积分不足（需要冻结增量）');

    // 8) 写/更新 hold（把 hold_points 提升到 bidPoints）
    await auctionRepo.upsertHold({
      sessionId: lot.session_id,
      lotId,
      bidderId,
      holdPoints: bidPoints,
      status: 'active',
    }, client);

    // 9) 写 bid（建议不要 delete，用 status/is_void）
    const bidRow = await auctionRepo.createBid({
      lotId,
      bidderMemberId: bidderId,
      bidPoints,
      isAutoBid: false,
    }, client);

    // 10) 写冻结流水（负数 delta）
    // idempotency_key 使用 bidRow.id
    await walletRepo.createPointsLog({
      memberId: bidderId,
      parentId: actorUserId,
      description: `拍卖冻结(${lot.sku_name || lotId})`,
      pointsChange: -delta,
      reasonCode: 'auction_hold',
      idempotencyKey: `auction_hold_${lotId}_${bidderId}_${bidRow.id}`,
    }, client);

    // 11) 写 event（便于回放/调试）
    await auctionRepo.createEvent({
      actorUserId,
      sessionId: lot.session_id,
      lotId,
      bidderId,
      eventType: 'bid',
      payload: { bidPoints, delta, currentTop },
    }, client);

    // 兼容：首次出价将拍品置为 active
    if (lot.status === 'pending') {
      await auctionRepo.updateLotStatus(lotId, 'active', client);
    }

    await client.query('COMMIT');
    return { bid: bidRow };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

// ========== 二价结算 ==========

/**
 * 结算拍卖场次（二价拍卖机制）
 * 
 * 流程：
 * 1. 校验场次状态
 * 2. 遍历所有拍品
 * 3. 每个拍品找最高出价者（winner）
 * 4. winner 支付二价（次高价 + 1，或起拍价）
 * 5. 生成订单、积分流水、库存
 * 6. 写入拍卖结果
 * 7. 更新场次状态为 ended
 * 
 * 二价规则：
 * - 有第二高出价：支付 second_price + 1
 * - 只有一个出价：支付起拍价
 * - 无出价：流拍
 * 
 * @param {number} sessionId - 拍卖场次ID
 * @returns {object} 结算结果
 */
exports.settleSession = async (sessionId) => {
  const pool = auctionRepo.getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // ========== 1. 获取并校验场次 ==========
    const session = await auctionRepo.getSessionById(sessionId, client);
    if (!session) {
      throw new Error('拍卖场次不存在');
    }
    
    if (!['scheduled', 'active'].includes(session.status)) {
      throw new Error(`场次状态不允许结算 (当前: ${session.status})`);
    }
    
    // ========== 2. 获取所有拍品 ==========
    const lots = await auctionRepo.getLotsBySessionId(sessionId, client);
    if (lots.length === 0) {
      throw new Error('该场次没有拍卖品');
    }
    
    // ========== 3. 结算每个拍品 ==========
    const results = [];
    const settledLots = [];
    const unsoldLots = [];
    
    for (const lot of lots) {
      // 跳过已结算的拍品
      if (['sold', 'unsold'].includes(lot.status)) {
        continue;
      }
      
      // 获取按出价排序的所有不同出价
      const bids = await auctionRepo.getDistinctBidsByLotId(lot.id, client);
      
      if (bids.length === 0) {
        // ========== 无出价：流拍 ==========
        await auctionRepo.updateLotStatus(lot.id, 'unsold', client);
        unsoldLots.push(lot);
        continue;
      }
      
      // ========== 确定获胜者和支付价格 ==========
      const winner = bids[0]; // 最高出价者
      let payPoints;
      let secondPrice = null;
      
      if (bids.length >= 2) {
        // 有第二高出价：支付 second_price + 1
        secondPrice = bids[1].bid_points;
        payPoints = secondPrice + 1;
        
        // 确保不超过获胜者的出价
        if (payPoints > winner.bid_points) {
          payPoints = winner.bid_points;
        }
      } else {
        // 只有一个出价：支付起拍价
        payPoints = lot.start_price;
      }
      
      // ========== 4. 检查获胜者余额 ==========
      const winnerBalance = await walletRepo.getBalance(winner.bidder_member_id, client);
      if (winnerBalance < payPoints) {
        // 余额不足，跳过此获胜者，尝试下一个出价者
        // 简化处理：标记为流拍
        await auctionRepo.updateLotStatus(lot.id, 'unsold', client);
        unsoldLots.push({
          ...lot,
          reason: `获胜者余额不足 (需要: ${payPoints}, 实际: ${winnerBalance})`,
        });
        continue;
      }
      
      // ========== 5. 创建订单（幂等性检查） ==========
      const idempotencyKey = `auction_${sessionId}_lot_${lot.id}`;
      
      // 幂等性检查：查询是否已存在该订单
      let order = await marketplaceRepo.getOrderByIdempotencyKey(
        session.parent_id,
        idempotencyKey,
        client
      );
      
      if (!order) {
        // 不存在，创建新订单
        order = await marketplaceRepo.createOrder({
          parentId: session.parent_id,
          memberId: winner.bidder_member_id,
          offerId: lot.offer_id,
          skuId: lot.sku_id,
          skuName: lot.sku_name,
          cost: payPoints,
          quantity: lot.quantity || 1,
          status: 'paid',
          idempotencyKey,
        }, client);
      }
      // 如果订单已存在，直接复用，不重复创建
      
      // ========== 6. 创建积分流水（幂等性检查） ==========
      const pointsIdempotencyKey = `points_${idempotencyKey}`;
      const existingPointsLog = await walletRepo.getPointsLogByIdempotencyKey(
        session.parent_id,
        pointsIdempotencyKey,
        client
      );
      
      if (!existingPointsLog) {
        // 不存在，创建新流水
        await walletRepo.createPointsLog({
          memberId: winner.bidder_member_id,
          parentId: session.parent_id,
          orderId: order.id,
          description: `竞拍得标：${lot.sku_name}`,
          pointsChange: -payPoints,
          reasonCode: 'auction',
          idempotencyKey: pointsIdempotencyKey,
        }, client);
      }
      // 如果流水已存在，跳过创建
      
      // ========== 7. 创建库存（幂等性检查） ==========
      // 先检查是否已有此订单关联的库存
      const inventoryByOrder = await marketplaceRepo.getInventoryByOrderId(order.id, client);
      
      if (!inventoryByOrder) {
        // 没有订单关联的库存，检查是否有可合并的未使用库存
        const existingInventory = await marketplaceRepo.findUnusedInventoryItem(
          winner.bidder_member_id,
          lot.sku_id,
          client
        );
        
        if (existingInventory) {
          await marketplaceRepo.incrementInventoryQuantity(
            existingInventory.id,
            lot.quantity || 1,
            client
          );
        } else {
          await marketplaceRepo.createInventoryItem({
            memberId: winner.bidder_member_id,
            skuId: lot.sku_id,
            orderId: order.id,
            quantity: lot.quantity || 1,
            status: 'unused',
          }, client);
        }
      }
      // 如果订单关联的库存已存在，跳过创建
      
      // ========== 8. 创建拍卖结果 ==========
      const result = await auctionRepo.createResult({
        lotId: lot.id,
        winnerMemberId: winner.bidder_member_id,
        payPoints,
        secondPrice,
        winningBidId: winner.id,
        settledOrderId: order.id,
        settlementStatus: 'settled',
      }, client);
      
      // ========== 9. 更新拍品状态 ==========
      await auctionRepo.updateLotStatus(lot.id, 'sold', client);
      
      results.push({
        lot,
        winner: {
          memberId: winner.bidder_member_id,
          memberName: winner.bidder_name,
          bidPoints: winner.bid_points,
        },
        payPoints,
        secondPrice,
        orderId: order.id,
        result,
      });
      
      settledLots.push(lot);
    }
    
    // ========== 10. 更新场次状态 ==========
    await auctionRepo.updateSessionStatus(sessionId, 'ended', client);
    
    await client.query('COMMIT');
    
    return {
      success: true,
      msg: `结算完成！成交 ${settledLots.length} 件，流拍 ${unsoldLots.length} 件`,
      sessionId,
      totalLots: lots.length,
      settledCount: settledLots.length,
      unsoldCount: unsoldLots.length,
      results,
      unsoldLots,
    };
    
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * 获取拍品的出价列表
 */
exports.getBidsByLotId = async (lotId, limit = 50) => {
  return await auctionRepo.getBidsByLotId(lotId, limit);
};

/**
 * 获取拍品的当前最高出价
 */
exports.getHighestBid = async (lotId) => {
  return await auctionRepo.getHighestBid(lotId);
};

// ========== 内部：事件写入（可选）==========
async function safeCreateEvent(client, evt) {
  try {
    return await auctionRepo.createEvent(evt, client);
  } catch (e) {
    // 如果迁移未执行/表不存在，不阻塞主流程
    if ((e?.message || '').includes('auction_event') || e?.code === '42P01') {
      return null;
    }
    throw e;
  }
}

/**
 * 预览生成拍品（不落库）
 * 
 * @param {number} sessionId - 拍卖场次ID
 * @param {object} options - 生成选项
 * @param {number} options.count - 总数量（如果指定，则按 rarity_weights 分配）
 * @param {string|number} options.seed - 随机种子（可选，不提供则自动生成）
 * @param {boolean} options.unique - 是否不允许重复 sku_id
 * @param {object} options.rarity_weights - 稀有度权重 { r: 40, sr: 30, ssr: 20, ur: 10 }
 * @param {object} options.counts - 各稀有度数量（如果指定，则忽略 count 和 rarity_weights）{ r: 2, sr: 1, ssr: 1, ur: 0 }
 * @param {object} options.filters - 过滤条件（暂未实现）
 * @param {Array<number>} options.locked_sku_ids - 锁定必须包含的 SKU IDs
 * @returns {object} 预览结果 { seed, preview_lots, pool_stats }
 */
exports.previewGenerateLots = async (sessionId, options = {}) => {
  const pool = auctionRepo.getPool();
  const client = await pool.connect();
  
  try {
    // 1) 获取 session
    const session = await auctionRepo.getSessionById(sessionId, client);
    if (!session) {
      throw new Error('拍卖场次不存在');
    }
    
    // 2) 获取可拍卖的 SKU 池
    let skuPool = await auctionRepo.getAuctionableSkus(session.parent_id, client);
    const sessionConfig = parseSessionConfig(session.config);
    if (Array.isArray(sessionConfig.pool_sku_ids) && sessionConfig.pool_sku_ids.length > 0) {
      const poolSet = new Set(sessionConfig.pool_sku_ids.map((id) => parseInt(id)));
      skuPool = skuPool.filter((sku) => poolSet.has(sku.id));
    }
    
    // 应用 locked_sku_ids 过滤
    if (Array.isArray(options.locked_sku_ids) && options.locked_sku_ids.length > 0) {
      const lockedSet = new Set(options.locked_sku_ids.map(id => parseInt(id)));
      skuPool = skuPool.filter((sku) => lockedSet.has(sku.id));
    }
    
    if (skuPool.length === 0) {
      throw new Error('没有可用的拍卖品，请先创建 SKU 或设置池子');
    }
    
    // 3) 生成或使用 seed
    let seed = options.seed;
    if (!seed) {
      seed = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
    }
    const rng = createSeededRandom(seed);
    
    // 4) 确定各稀有度数量
    let counts = options.counts;
    if (!counts) {
      if (options.count) {
        // 按 count 和 rarity_weights 分配
        counts = distributeByRarityWeights(
          options.count,
          options.rarity_weights || {},
          rng
        );
      } else {
        // 默认配置
        counts = {
          r: 0,
          sr: 0,
          ssr: 0,
          ur: 0,
        };
      }
    }
    
    const totalRequested = counts.r + counts.sr + counts.ssr + counts.ur;
    if (totalRequested === 0) {
      throw new Error('请至少指定一个稀有度的数量');
    }
    
    // 5) 按稀有度分组 SKU（假设 SKU 有 rarity 字段，如果没有则随机分配）
    const skuByRarity = {
      r: [],
      sr: [],
      ssr: [],
      ur: [],
    };
    
    // 如果 SKU 没有 rarity 字段，按顺序循环分配
    skuPool.forEach((sku, index) => {
      const rarity = sku.rarity || ['r', 'sr', 'ssr', 'ur'][index % 4];
      const normalized = normalizeRarity(rarity);
      if (skuByRarity[normalized]) {
        skuByRarity[normalized].push(sku);
      }
    });
    
    // 6) 生成预览 lots
    const previewLots = [];
    let sortOrder = 1;
    const usedSkuIds = options.unique ? new Set() : null;
    
    // 按稀有度从高到低生成
    const rarities = ['ur', 'ssr', 'sr', 'r'];
    
    for (const rarity of rarities) {
      const count = counts[rarity] || 0;
      if (count <= 0) continue;
      
      const availableSkus = skuByRarity[rarity] || [];
      if (availableSkus.length === 0) continue;
      
      // 确定性抽取
      const pickedSkus = deterministicPick(availableSkus, count, rng, options.unique);
      
      for (const sku of pickedSkus) {
        if (options.unique && usedSkuIds && usedSkuIds.has(sku.id)) {
          continue;
        }
        if (options.unique && usedSkuIds) {
          usedSkuIds.add(sku.id);
        }
        
        const baseCost = sku.default_cost || sku.base_cost || 10;
        const startPrice = calculateStartPrice(baseCost, rarity);
        
        previewLots.push({
          sku_id: sku.id,
          sku_name: sku.name,
          sku_icon: sku.icon || null,
          rarity,
          reserve_price: startPrice,
          start_price: startPrice,
          sort_order: sortOrder++,
          status: 'pending',
        });
      }
    }
    
    // 7) 统计池子信息
    const poolStats = {
      total_skus: skuPool.length,
      by_rarity: {
        r: skuByRarity.r.length,
        sr: skuByRarity.sr.length,
        ssr: skuByRarity.ssr.length,
        ur: skuByRarity.ur.length,
      },
    };
    
    return {
      seed: String(seed),
      preview_lots: previewLots,
      pool_stats: poolStats,
      counts: {
        r: previewLots.filter(l => l.rarity === 'r').length,
        sr: previewLots.filter(l => l.rarity === 'sr').length,
        ssr: previewLots.filter(l => l.rarity === 'ssr').length,
        ur: previewLots.filter(l => l.rarity === 'ur').length,
      },
    };
  } finally {
    client.release();
  }
};

/**
 * 确认生成拍品（落库）
 * 
 * @param {number} sessionId - 拍卖场次ID
 * @param {number} actorUserId - 操作者用户ID
 * @param {object} options - 确认选项
 * @param {string|number} options.seed - 随机种子（必须与预览时一致）
 * @param {Array} options.preview_lots - 预览的 lots 数据（必须与预览时一致）
 * @param {boolean} options.replace - 是否替换现有 lots（true: 清空 pending/active 且未成交的，false: 追加）
 * @returns {object} 生成结果
 */
exports.commitGenerateLots = async (sessionId, actorUserId, options = {}) => {
  const pool = auctionRepo.getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1) 锁定 session
    const session = await auctionRepo.getSessionForUpdate(sessionId, client);
    if (!session) {
      throw new Error('拍卖场次不存在');
    }
    if (session.parent_id !== actorUserId) {
      throw new Error('无权操作该场次');
    }
    
    // 2) 验证 preview_lots
    if (!Array.isArray(options.preview_lots) || options.preview_lots.length === 0) {
      throw new Error('预览数据为空，请先生成预览');
    }
    
    // 3) 如果 replace=true，清空现有 lots
    if (options.replace) {
      // 清空 status in (pending, active) 且未成交的 lot
      await client.query(
        `DELETE FROM auction_lot 
         WHERE session_id = $1 
         AND status IN ('pending', 'active')
         AND id NOT IN (SELECT lot_id FROM auction_result WHERE lot_id IS NOT NULL)`,
        [sessionId]
      );
    }
    
    // 4) 获取当前最大 sort_order（用于追加模式）
    let maxSortOrder = 0;
    if (!options.replace) {
      const result = await client.query(
        `SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM auction_lot WHERE session_id = $1`,
        [sessionId]
      );
      maxSortOrder = result.rows[0]?.max_order || 0;
    }
    
    // 5) 按 preview_lots 写入 auction_lot
    const createdLots = [];
    for (const previewLot of options.preview_lots) {
      // 调整 sort_order（追加模式）
      const sortOrder = options.replace ? previewLot.sort_order : (maxSortOrder + previewLot.sort_order);
      
      const lot = await auctionRepo.createLot({
        sessionId,
        skuId: previewLot.sku_id,
        offerId: null, // 稍后创建
        rarity: previewLot.rarity,
        startPrice: previewLot.start_price || previewLot.reserve_price,
        reservePrice: previewLot.reserve_price,
        buyNowPrice: null,
        quantity: 1,
        status: 'pending',
        sortOrder,
        skuName: previewLot.sku_name,
        skuIcon: previewLot.sku_icon,
      }, client);
      
      // 为每个 lot 创建专用 offer
      const baseCost = previewLot.start_price || previewLot.reserve_price || 10;
      const offer = await marketplaceRepo.createOffer({
        parentId: session.parent_id,
        skuId: previewLot.sku_id,
        cost: baseCost,
        quantity: 1,
        isActive: true,
      }, client);
      
      // 更新 lot 的 offer_id
      await client.query(
        `UPDATE auction_lot SET offer_id = $1 WHERE id = $2`,
        [offer.id, lot.id]
      );
      
      createdLots.push({
        ...lot,
        offer_id: offer.id,
      });
    }
    
    // 6) 写 event
    await auctionRepo.createEvent({
      actorUserId,
      sessionId,
      eventType: 'generate_lots_commit',
      payload: {
        seed: String(options.seed || ''),
        replace: options.replace || false,
        total_lots: createdLots.length,
        preview_lots: options.preview_lots.map(l => ({
          sku_id: l.sku_id,
          rarity: l.rarity,
          sort_order: l.sort_order,
        })),
      },
    }, client);
    
    await client.query('COMMIT');
    
    return {
      success: true,
      msg: `成功生成 ${createdLots.length} 个拍卖品`,
      sessionId,
      totalLots: createdLots.length,
      lots: createdLots,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
