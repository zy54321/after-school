/**
 * Family Service Layer
 * 负责业务逻辑处理，调用 repo 层获取数据
 */
const dayjs = require('dayjs');
const familyRepo = require('../repos/familyRepo');

/**
 * 获取初始化数据
 * 包括：成员列表、分类、任务、奖励
 * 如果用户没有成员，自动创建默认成员
 */
exports.getInitData = async (userId) => {
  // 获取成员列表
  let members = await familyRepo.getMembersByParentId(userId);
  
  // 如果没有成员，创建默认成员
  if (members.length === 0) {
    const newMember = await familyRepo.createDefaultMember(userId, '宝贝');
    members = [newMember];
  }
  
  // 并行获取其他数据
  const [categories, tasks, rewards] = await Promise.all([
    familyRepo.getCategoriesByParentId(userId),
    familyRepo.getTasksByParentId(userId),
    familyRepo.getRewardsByParentId(userId),
  ]);
  
  return {
    members,
    categories,
    tasks,
    rewards,
  };
};

/**
 * 获取成员面板数据
 * 包括：积分总额、历史记录、兑换统计
 * @param {number} memberId - 成员ID
 * @param {string} month - 月份（可选，格式 YYYY-MM）
 */
exports.getMemberDashboard = async (memberId, month) => {
  // 构建查询选项
  const options = {};
  if (month) {
    options.startDate = dayjs(month).startOf('month').toDate();
    options.endDate = dayjs(month).endOf('month').toDate();
  }
  
  // 并行获取数据
  const [totalPoints, history, usageStats] = await Promise.all([
    familyRepo.getMemberTotalPoints(memberId),
    familyRepo.getMemberPointsHistory(memberId, options),
    familyRepo.getMemberUsageStats(memberId),
  ]);
  
  return {
    totalPoints,
    history,
    usageStats,
  };
};

/**
 * 记录行为（任务/手动记录）
 * @param {object} params - 参数对象
 * @param {number} params.memberId - 成员ID
 * @param {number} params.taskId - 任务ID（可选）
 * @param {string} params.customTitle - 自定义标题（可选）
 * @param {number} params.points - 积分变化值
 */
exports.logAction = async ({ memberId, taskId, customTitle, points }) => {
  // 确定描述文本
  let title = customTitle;
  
  if (!title && taskId) {
    const task = await familyRepo.getTaskById(taskId);
    if (task) {
      title = task.title;
    }
  }
  
  // 创建积分记录
  const log = await familyRepo.createPointsLog(
    memberId,
    taskId,
    title || '手动记录',
    points
  );
  
  return log;
};

// ========== 辅助函数 ==========

/**
 * 计算限制周期开始时间
 */
const getLimitStartTime = (limitType) => {
  let startTime = dayjs();
  if (limitType === 'daily') {
    startTime = startTime.startOf('day');
  } else if (limitType === 'weekly') {
    startTime = startTime.startOf('week').add(1, 'day');
  } else if (limitType === 'monthly') {
    startTime = startTime.startOf('month');
  }
  return startTime.toDate();
};

/**
 * 存入背包（支持合并数量）
 * @param {object} client - 数据库连接
 */
const addToBackpack = async (client, memberId, rewardId, pointsLogId) => {
  const existing = await familyRepo.findUnusedBackpackItem(memberId, rewardId, client);
  
  if (existing) {
    await familyRepo.incrementBackpackQuantity(existing.id, client);
  } else {
    await familyRepo.createBackpackItem(memberId, rewardId, pointsLogId, client);
  }
};

// ========== 兑换/竞拍业务逻辑 ==========

/**
 * 兑换奖励
 * @param {number} memberId - 成员ID
 * @param {number} rewardId - 奖励ID
 */
exports.redeemReward = async (memberId, rewardId) => {
  const pool = familyRepo.getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 获取奖励信息
    const reward = await familyRepo.getRewardById(rewardId, client);
    if (!reward) {
      throw new Error('商品不存在');
    }
    
    // 检查积分余额
    const balance = await familyRepo.getMemberBalance(memberId, client);
    if (balance < reward.cost) {
      throw new Error('积分不足');
    }
    
    // 检查兑换限制
    if (reward.limit_type !== 'unlimited') {
      const startTime = getLimitStartTime(reward.limit_type);
      const count = await familyRepo.getRedeemCountSince(memberId, rewardId, startTime, client);
      if (count >= reward.limit_max) {
        throw new Error('已达兑换上限');
      }
    }
    
    // 记录积分流水
    const logResult = await familyRepo.createRedeemLog(
      memberId,
      rewardId,
      `兑换：${reward.name}`,
      -reward.cost,
      client
    );
    
    // 存入背包
    await addToBackpack(client, memberId, rewardId, logResult.id);
    
    await client.query('COMMIT');
    return { success: true, msg: '兑换成功！物品已存入背包 🎒' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * 竞拍结算
 * @param {number} memberId - 成员ID
 * @param {number} auctionId - 拍品ID（奖励ID）
 * @param {number} bidPoints - 竞拍出价
 */
exports.settleAuction = async (memberId, auctionId, bidPoints) => {
  const pool = familyRepo.getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 获取拍品信息
    const item = await familyRepo.getRewardById(auctionId, client);
    if (!item) {
      throw new Error('拍品不存在');
    }
    
    // 检查出价是否高于起拍价
    if (bidPoints < item.cost) {
      throw new Error(`出价不能低于起拍价 (${item.cost})`);
    }
    
    // 检查积分余额
    const balance = await familyRepo.getMemberBalance(memberId, client);
    if (balance < bidPoints) {
      throw new Error('该成员积分不足以支付此竞拍价');
    }
    
    // 检查竞拍限制
    if (item.limit_type !== 'unlimited') {
      const startTime = getLimitStartTime(item.limit_type);
      const count = await familyRepo.getRedeemCountSince(memberId, auctionId, startTime, client);
      if (count >= item.limit_max) {
        throw new Error('已达竞拍上限');
      }
    }
    
    // 记录积分流水
    const logResult = await familyRepo.createRedeemLog(
      memberId,
      auctionId,
      `竞拍得标：${item.name}`,
      -bidPoints,
      client
    );
    
    // 存入背包
    await addToBackpack(client, memberId, auctionId, logResult.id);
    
    await client.query('COMMIT');
    return { success: true, msg: '竞拍结算成功！物品已存入背包 🎒' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ========== 背包业务逻辑 ==========

/**
 * 获取背包数据
 * @param {number} memberId - 成员ID
 * @param {string} status - 状态筛选（unused/used/all）
 */
exports.getBackpack = async (memberId, status) => {
  const [items, stats] = await Promise.all([
    familyRepo.getBackpackItems(memberId, status),
    familyRepo.getBackpackStats(memberId),
  ]);
  
  return { items, stats };
};

/**
 * 使用背包物品
 * @param {number} memberId - 成员ID
 * @param {number} backpackId - 背包物品ID
 * @param {number} quantity - 使用数量
 */
exports.useBackpackItem = async (memberId, backpackId, quantity = 1) => {
  const pool = familyRepo.getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 获取背包物品
    const backpackItem = await familyRepo.getBackpackItemById(backpackId, memberId, client);
    if (!backpackItem) {
      throw new Error('背包物品不存在或不属于该成员');
    }
    
    // 检查状态
    if (backpackItem.status !== 'unused') {
      throw new Error('该物品已使用');
    }
    
    // 检查数量
    if (backpackItem.quantity < quantity) {
      throw new Error(`数量不足，当前数量：${backpackItem.quantity}`);
    }
    
    // 更新背包物品
    if (backpackItem.quantity === quantity) {
      // 全部使用，标记为已使用
      await familyRepo.markBackpackItemUsed(backpackId, client);
    } else {
      // 部分使用，减少数量
      await familyRepo.decrementBackpackQuantity(backpackId, quantity, client);
    }
    
    // 记录使用历史
    await familyRepo.createBackpackUsageLog(
      backpackId,
      memberId,
      backpackItem.reward_id,
      quantity,
      client
    );
    
    await client.query('COMMIT');
    return { success: true, msg: '使用成功' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ========== 成员管理 ==========

/**
 * 创建成员
 */
exports.createMember = async (parentId, name, avatar) => {
  return await familyRepo.createMember(parentId, name, avatar);
};

/**
 * 更新成员
 */
exports.updateMember = async (id, name, avatar) => {
  await familyRepo.updateMember(id, name, avatar);
};

/**
 * 删除成员（含关联数据）
 */
exports.deleteMember = async (memberId) => {
  const pool = familyRepo.getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 先删除积分记录
    await familyRepo.deletePointsLogByMemberId(memberId, client);
    // 再删除成员
    await familyRepo.deleteMember(memberId, client);
    
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ========== 任务/奖励管理 ==========

/**
 * 创建任务或奖励
 */
exports.createItem = async (userId, { type, name, points, category, limitType, limitMax, targetMembers, description }) => {
  const targets = targetMembers && targetMembers.length > 0 ? targetMembers : null;
  
  if (type === 'task') {
    return await familyRepo.createTask(userId, name, category, points, targets);
  } else {
    return await familyRepo.createReward(userId, name, points, limitType, limitMax, targets, type, description);
  }
};

/**
 * 更新任务或奖励
 */
exports.updateItem = async ({ id, type, name, points, category, limitType, limitMax, targetMembers, description }) => {
  const targets = targetMembers && targetMembers.length > 0 ? targetMembers : null;
  
  if (type === 'task') {
    await familyRepo.updateTask(id, name, category, points, targets);
  } else {
    await familyRepo.updateReward(id, name, points, limitType, limitMax, targets, type, description);
  }
};

/**
 * 删除任务或奖励
 */
exports.deleteItem = async (id, type) => {
  if (type === 'task') {
    await familyRepo.deleteTask(id);
  } else {
    await familyRepo.deleteReward(id);
  }
};

// ========== 分类管理 ==========

/**
 * 创建分类
 */
exports.createCategory = async (parentId, name) => {
  const key = 'cat_' + Date.now();
  return await familyRepo.createCategory(parentId, name, key);
};

/**
 * 删除分类
 */
exports.deleteCategory = async (id) => {
  await familyRepo.deleteCategory(id);
};

// ========== 转赠背包物品 ==========

/**
 * 转赠背包物品
 */
exports.transferBackpackItem = async (backpackId, fromMemberId, toMemberId, quantity = 1) => {
  const pool = familyRepo.getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 获取源背包物品
    const backpackItem = await familyRepo.getBackpackItemById(backpackId, fromMemberId, client);
    if (!backpackItem) {
      throw new Error('背包物品不存在或不属于该成员');
    }
    
    // 检查状态
    if (backpackItem.status !== 'unused') {
      throw new Error('只能转赠未使用的物品');
    }
    
    // 检查数量
    if (backpackItem.quantity < quantity) {
      throw new Error(`数量不足，当前数量：${backpackItem.quantity}`);
    }
    
    // 验证成员是否属于同一家庭
    const fromMember = await familyRepo.getMemberById(fromMemberId, client);
    const toMember = await familyRepo.getMemberById(toMemberId, client);
    
    if (!fromMember || !toMember) {
      throw new Error('成员不存在');
    }
    
    if (fromMember.parent_id !== toMember.parent_id) {
      throw new Error('只能转赠给同一家庭的成员');
    }
    
    // 执行转赠
    if (backpackItem.quantity === quantity) {
      // 全部转赠，直接更新归属
      await familyRepo.updateBackpackOwner(backpackId, toMemberId, client);
    } else {
      // 部分转赠
      await familyRepo.decrementBackpackQuantity(backpackId, quantity, client);
      
      // 检查目标成员是否已有相同物品
      const existing = await familyRepo.findUnusedBackpackItem(toMemberId, backpackItem.reward_id, client);
      
      if (existing) {
        await familyRepo.incrementBackpackQuantityBy(existing.id, quantity, client);
      } else {
        await familyRepo.createBackpackItemWithQuantity(
          toMemberId,
          backpackItem.reward_id,
          backpackItem.points_log_id,
          quantity,
          client
        );
      }
    }
    
    await client.query('COMMIT');
    return { success: true, msg: '转赠成功' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ========== 撤销流水 ==========

/**
 * 撤销积分流水（含关联背包数据）
 */
exports.revokeLog = async (logIds) => {
  const pool = familyRepo.getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 获取关联的背包记录
    const backpackIds = await familyRepo.getBackpackByPointsLogIds(logIds, client);
    
    // 删除背包使用记录
    await familyRepo.deleteBackpackUsageLogByBackpackIds(backpackIds, client);
    
    // 删除背包记录
    await familyRepo.deleteBackpackByIds(backpackIds, client);
    
    // 删除积分流水
    await familyRepo.deletePointsLogByIds(logIds, client);
    
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ========== 使用记录查询 ==========

/**
 * 获取背包使用历史
 */
exports.getUsageHistory = async (memberId, rewardId, limit) => {
  const history = await familyRepo.getUsageHistory(memberId, rewardId, limit);
  return {
    history,
    total: history.length,
  };
};
