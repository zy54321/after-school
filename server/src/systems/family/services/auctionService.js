/**
 * Auction Service Layer
 * 负责拍卖业务逻辑处理
 */
const auctionRepo = require('../repos/auctionRepo');
const walletRepo = require('../repos/walletRepo');
const marketplaceRepo = require('../repos/marketplaceRepo');

/**
 * 稀有度配置
 * - 起拍价倍数
 * - 默认数量权重（用于随机抽取时的概率）
 */
const RARITY_CONFIG = {
  common: { priceMultiplier: 1, weight: 40 },
  rare: { priceMultiplier: 1.5, weight: 30 },
  epic: { priceMultiplier: 2.5, weight: 20 },
  legendary: { priceMultiplier: 5, weight: 10 },
};

/**
 * 从数组中随机抽取指定数量的元素
 * @param {Array} array - 源数组
 * @param {number} count - 抽取数量
 * @returns {Array} 抽取的元素
 */
const randomPick = (array, count) => {
  if (array.length <= count) return [...array];
  
  const result = [];
  const used = new Set();
  
  while (result.length < count && result.length < array.length) {
    const index = Math.floor(Math.random() * array.length);
    if (!used.has(index)) {
      used.add(index);
      result.push(array[index]);
    }
  }
  
  return result;
};

/**
 * 计算起拍价
 * @param {number} baseCost - 基础成本
 * @param {string} rarity - 稀有度
 * @returns {number} 起拍价
 */
const calculateStartPrice = (baseCost, rarity) => {
  const config = RARITY_CONFIG[rarity] || RARITY_CONFIG.common;
  // 起拍价 = 基础成本 * 倍数 * 0.5（起拍价通常低于实际价值）
  return Math.max(1, Math.floor(baseCost * config.priceMultiplier * 0.5));
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
    const skuPool = await auctionRepo.getAuctionableSkus(session.parent_id, client);
    if (skuPool.length === 0) {
      throw new Error('没有可用的拍卖品，请先创建 SKU');
    }
    
    // ========== 4. 按稀有度分配并抽取 ==========
    const counts = {
      common: rarityCounts.common || 0,
      rare: rarityCounts.rare || 0,
      epic: rarityCounts.epic || 0,
      legendary: rarityCounts.legendary || 0,
    };
    
    const totalRequested = counts.common + counts.rare + counts.epic + counts.legendary;
    if (totalRequested === 0) {
      throw new Error('请至少指定一个稀有度的数量');
    }
    
    // 准备要创建的 lots
    const lotsToCreate = [];
    let sortOrder = 1;
    
    // 按稀有度从高到低生成（传说 -> 史诗 -> 稀有 -> 普通）
    const rarities = ['legendary', 'epic', 'rare', 'common'];
    
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
          buyNowPrice: Math.floor(baseCost * (RARITY_CONFIG[rarity]?.priceMultiplier || 1) * 2),
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
      // 创建专用 offer（offer_type 通过 cost 区分是拍卖专用）
      const offer = await auctionRepo.createAuctionOffer({
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
      common: createdLots.filter(l => l.rarity === 'common').length,
      rare: createdLots.filter(l => l.rarity === 'rare').length,
      epic: createdLots.filter(l => l.rarity === 'epic').length,
      legendary: createdLots.filter(l => l.rarity === 'legendary').length,
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
  
  return {
    session,
    lots,
    lotCount: lots.length,
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

/**
 * 获取可用于拍卖的 SKU 列表
 */
exports.getAuctionableSkus = async (parentId) => {
  return await auctionRepo.getAuctionableSkus(parentId);
};

// ========== 密封出价 ==========

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
exports.submitBid = async (lotId, bidderId, bidPoints) => {
  const pool = auctionRepo.getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // ========== 1. 获取拍品信息 ==========
    const lot = await auctionRepo.getLotById(lotId, client);
    if (!lot) {
      throw new Error('拍品不存在');
    }
    
    // ========== 2. 校验拍品状态 ==========
    if (!['pending', 'active'].includes(lot.status)) {
      throw new Error(`拍品状态不允许出价 (当前: ${lot.status})`);
    }
    
    // ========== 3. 获取并校验场次状态 ==========
    const session = await auctionRepo.getSessionById(lot.session_id, client);
    if (!session) {
      throw new Error('拍卖场次不存在');
    }
    
    if (!['scheduled', 'active'].includes(session.status)) {
      throw new Error(`拍卖场次状态不允许出价 (当前: ${session.status})`);
    }
    
    // ========== 4. 校验出价金额 ==========
    if (bidPoints < lot.start_price) {
      throw new Error(`出价不能低于起拍价 (${lot.start_price})`);
    }
    
    // ========== 5. 校验成员余额 ==========
    const member = await walletRepo.getMemberById(bidderId, client);
    if (!member) {
      throw new Error('成员不存在');
    }
    
    // 校验成员是否属于场次创建者
    if (member.parent_id !== session.parent_id) {
      throw new Error('成员不属于此拍卖场次');
    }
    
    const balance = await walletRepo.getBalance(bidderId, client);
    if (balance < bidPoints) {
      throw new Error(`积分不足，当前余额: ${balance}，出价: ${bidPoints}`);
    }
    
    // ========== 6. 检查是否已有更高出价（同一成员） ==========
    const existingBid = await auctionRepo.getMemberHighestBid(lotId, bidderId, client);
    if (existingBid && existingBid.bid_points >= bidPoints) {
      throw new Error(`您已有更高的出价 (${existingBid.bid_points})，无需重复出价`);
    }
    
    // ========== 7. 创建出价记录 ==========
    const bid = await auctionRepo.createBid({
      lotId,
      bidderMemberId: bidderId,
      bidPoints,
      isAutoBid: false,
    }, client);
    
    // ========== 8. 更新拍品状态为 active（如果是 pending） ==========
    if (lot.status === 'pending') {
      await auctionRepo.updateLotStatus(lotId, 'active', client);
    }
    
    await client.query('COMMIT');
    
    return {
      success: true,
      bid,
      msg: `出价成功！您的出价: ${bidPoints} 积分`,
    };
    
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
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
      
      // ========== 5. 创建订单 ==========
      const idempotencyKey = `auction_${sessionId}_lot_${lot.id}`;
      
      const order = await marketplaceRepo.createOrder({
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
      
      // ========== 6. 创建积分流水 ==========
      await walletRepo.createPointsLog({
        memberId: winner.bidder_member_id,
        parentId: session.parent_id,
        orderId: order.id,
        description: `竞拍得标：${lot.sku_name}`,
        pointsChange: -payPoints,
        reasonCode: 'auction',
        idempotencyKey: `points_${idempotencyKey}`,
      }, client);
      
      // ========== 7. 创建库存 ==========
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
