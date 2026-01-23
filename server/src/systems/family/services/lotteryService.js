/**
 * Lottery Service Layer
 * 抽奖业务逻辑层
 * 
 * 核心功能：
 * - spin(): 执行抽奖（事务）
 * - 按权重抽取奖品
 * - 保底机制
 * - 记录日志（含 pool_version_id）
 */
const lotteryRepo = require('../repos/lotteryRepo');
const marketplaceRepo = require('../repos/marketplaceRepo');
const walletRepo = require('../repos/walletRepo');

/**
 * 执行抽奖 (事务)
 * 
 * 流程：
 * 1. 验证抽奖池和版本
 * 2. 检查并扣减抽奖券
 * 3. 按权重抽取奖品（含保底检查）
 * 4. 发放奖励（积分/抽奖券/SKU）
 * 5. 记录抽奖日志
 * 
 * @param {number} poolId - 抽奖池ID
 * @param {number} memberId - 成员ID
 * @param {string} idempotencyKey - 幂等键
 * @returns {object} 抽奖结果
 */
exports.spin = async (poolId, memberId, idempotencyKey) => {
  const pool = lotteryRepo.getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // ========== 1. 验证抽奖池 ==========
    const drawPool = await lotteryRepo.getPoolById(poolId, client);
    if (!drawPool) {
      throw new Error('抽奖池不存在');
    }
    if (drawPool.status !== 'active') {
      throw new Error('抽奖池已关闭');
    }
    
    // ========== 2. 获取当前版本 ==========
    const version = await lotteryRepo.getCurrentVersion(poolId, client);
    if (!version) {
      throw new Error('抽奖池未配置奖品');
    }
    
    const prizes = version.prizes || [];
    if (prizes.length === 0) {
      throw new Error('奖池为空');
    }
    
    // ========== 3. 检查并扣减抽奖券 ==========
    let ticketInventory = null;
    let ticketType = null;
    
    if (drawPool.entry_ticket_type_id) {
      ticketType = await lotteryRepo.getTicketTypeById(drawPool.entry_ticket_type_id, client);
      if (!ticketType) {
        throw new Error('抽奖券类型不存在');
      }
      
      // 检查每日/每周限制
      if (ticketType.daily_limit) {
        const todayUsage = await lotteryRepo.getTodayTicketUsage(memberId, ticketType.id, client);
        if (todayUsage >= ticketType.daily_limit) {
          throw new Error(`今日抽奖次数已达上限 (${ticketType.daily_limit}次)`);
        }
      }
      
      if (ticketType.weekly_limit) {
        const weeklyUsage = await lotteryRepo.getWeeklyTicketUsage(memberId, ticketType.id, client);
        if (weeklyUsage >= ticketType.weekly_limit) {
          throw new Error(`本周抽奖次数已达上限 (${ticketType.weekly_limit}次)`);
        }
      }
      
      // 查找可用的抽奖券库存
      ticketInventory = await lotteryRepo.findAvailableTicketInventory(memberId, ticketType.name, client);
      if (!ticketInventory || ticketInventory.quantity < drawPool.tickets_per_draw) {
        throw new Error(`抽奖券不足，需要 ${drawPool.tickets_per_draw} 张 ${ticketType.name}`);
      }
      
      // 扣减抽奖券
      await lotteryRepo.decrementInventory(ticketInventory.id, drawPool.tickets_per_draw, client);
    }
    
    // ========== 4. 计算连续抽奖次数（保底检查） ==========
    let consecutiveCount = 1;
    let isGuarantee = false;
    
    if (version.min_guarantee_count && version.guarantee_prize_id) {
      consecutiveCount = await lotteryRepo.getConsecutiveCountSinceLastBigWin(
        memberId, poolId, version.guarantee_prize_id, client
      ) + 1;
      
      if (consecutiveCount >= version.min_guarantee_count) {
        isGuarantee = true;
      }
    }
    
    // ========== 5. 抽取奖品 ==========
    let selectedPrize;
    
    if (isGuarantee) {
      // 触发保底，直接给保底奖品
      selectedPrize = prizes.find(p => p.id === version.guarantee_prize_id);
      if (!selectedPrize) {
        // 保底奖品不存在，按正常概率抽取
        selectedPrize = weightedRandom(prizes, version.total_weight);
        isGuarantee = false;
      }
    } else {
      // 按权重随机抽取
      selectedPrize = weightedRandom(prizes, version.total_weight);
    }
    
    // ========== 6. 发放奖励 ==========
    let orderId = null;
    let inventoryId = null;
    let pointsLogId = null;
    
    const rewardIdempotencyKey = `lottery_${idempotencyKey}`;
    
    switch (selectedPrize.type) {
      case 'points':
        // 积分奖励
        if (selectedPrize.value > 0) {
          const pointsLog = await walletRepo.createPointsLog({
            memberId,
            parentId: drawPool.parent_id,
            description: `抽奖奖励：${selectedPrize.name}`,
            pointsChange: selectedPrize.value,
            reasonCode: 'lottery',
            idempotencyKey: `points_${rewardIdempotencyKey}`,
          }, client);
          pointsLogId = pointsLog.id;
        }
        break;
        
      case 'ticket':
        // 抽奖券奖励（再来一次）
        // 需要找到对应的 SKU 并添加到库存
        if (selectedPrize.ticket_type_id && selectedPrize.value > 0) {
          const rewardTicketType = await lotteryRepo.getTicketTypeById(selectedPrize.ticket_type_id, client);
          if (rewardTicketType) {
            // 查找对应的 SKU
            const skuResult = await client.query(
              `SELECT id FROM family_sku 
               WHERE type = 'ticket' AND name ILIKE $1 AND is_active = TRUE
               LIMIT 1`,
              [`%${rewardTicketType.name}%`]
            );
            
            if (skuResult.rows.length > 0) {
              const skuId = skuResult.rows[0].id;
              const invResult = await client.query(
                `INSERT INTO family_inventory (member_id, sku_id, quantity, status)
                 VALUES ($1, $2, $3, 'unused')
                 RETURNING id`,
                [memberId, skuId, selectedPrize.value]
              );
              inventoryId = invResult.rows[0].id;
            }
          }
        }
        break;
        
      case 'sku':
        // SKU 奖励（道具/商品）
        if (selectedPrize.sku_id) {
          const order = await marketplaceRepo.createOrder({
            parentId: drawPool.parent_id,
            memberId,
            offerId: null,
            skuId: selectedPrize.sku_id,
            skuName: selectedPrize.name,
            cost: 0,
            quantity: selectedPrize.value || 1,
            status: 'paid',
            idempotencyKey: `order_${rewardIdempotencyKey}`,
          }, client);
          orderId = order.id;
          
          // 添加到库存
          const invResult = await client.query(
            `INSERT INTO family_inventory (member_id, sku_id, quantity, status, order_id)
             VALUES ($1, $2, $3, 'unused', $4)
             RETURNING id`,
            [memberId, selectedPrize.sku_id, selectedPrize.value || 1, order.id]
          );
          inventoryId = invResult.rows[0].id;
        }
        break;
        
      case 'empty':
        // 谢谢参与，无奖励
        break;
    }
    
    // ========== 7. 记录抽奖日志 ==========
    const drawLog = await lotteryRepo.createDrawLog({
      parentId: drawPool.parent_id,
      memberId,
      poolId,
      poolVersionId: version.id,  // 关键！记录版本ID
      ticketTypeId: ticketType?.id || null,
      ticketPointValue: ticketType?.point_value || 0,
      ticketsUsed: drawPool.tickets_per_draw,
      resultPrizeId: selectedPrize.id,
      resultType: selectedPrize.type,
      resultName: selectedPrize.name,
      resultValue: selectedPrize.value || 0,
      resultSkuId: selectedPrize.sku_id || null,
      orderId,
      inventoryId,
      pointsLogId,
      isGuarantee,
      consecutiveCount,
    }, client);
    
    await client.query('COMMIT');
    
    return {
      success: true,
      msg: isGuarantee ? `🎉 保底触发！恭喜获得 ${selectedPrize.name}！` : `恭喜获得 ${selectedPrize.name}！`,
      prize: {
        id: selectedPrize.id,
        name: selectedPrize.name,
        type: selectedPrize.type,
        value: selectedPrize.value,
        icon: selectedPrize.icon,
      },
      isGuarantee,
      consecutiveCount,
      poolVersionId: version.id,
      drawLogId: drawLog.id,
    };
    
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * 获取抽奖池详情（含奖品列表）
 */
exports.getPoolDetail = async (poolId) => {
  const drawPool = await lotteryRepo.getPoolById(poolId);
  if (!drawPool) {
    throw new Error('抽奖池不存在');
  }
  
  const version = await lotteryRepo.getCurrentVersion(poolId);
  
  return {
    pool: drawPool,
    version: version ? {
      id: version.id,
      version: version.version,
      prizes: version.prizes || [],
      totalWeight: version.total_weight,
      minGuaranteeCount: version.min_guarantee_count,
      guaranteePrizeId: version.guarantee_prize_id,
    } : null,
  };
};

/**
 * 获取用户的所有抽奖池
 */
exports.getPoolsForMember = async (parentId, memberId) => {
  const pools = await lotteryRepo.getPoolsByParentId(parentId);
  
  // 为每个池添加成员的券数量统计
  const result = [];
  for (const pool of pools) {
    let ticketCount = 0;
    
    if (pool.entry_ticket_type_id) {
      const ticketType = await lotteryRepo.getTicketTypeById(pool.entry_ticket_type_id);
      if (ticketType) {
        const inventory = await lotteryRepo.findAvailableTicketInventory(memberId, ticketType.name);
        ticketCount = inventory ? inventory.quantity : 0;
      }
    }
    
    result.push({
      ...pool,
      memberTicketCount: ticketCount,
    });
  }
  
  return result;
};

/**
 * 获取成员的抽奖记录
 */
exports.getDrawHistory = async (memberId, limit = 50) => {
  return await lotteryRepo.getDrawLogsByMemberId(memberId, limit);
};

/**
 * 获取成员的抽奖券统计
 */
exports.getMemberTicketStats = async (memberId, parentId) => {
  return await lotteryRepo.getMemberTicketStats(memberId, parentId);
};

// ========== 内部辅助函数 ==========

/**
 * 按权重随机抽取
 */
function weightedRandom(prizes, totalWeight) {
  if (!totalWeight) {
    totalWeight = prizes.reduce((sum, p) => sum + (p.weight || 0), 0);
  }
  
  const random = Math.random() * totalWeight;
  let cumulative = 0;
  
  for (const prize of prizes) {
    cumulative += prize.weight || 0;
    if (random <= cumulative) {
      return prize;
    }
  }
  
  // 兜底返回最后一个
  return prizes[prizes.length - 1];
}
