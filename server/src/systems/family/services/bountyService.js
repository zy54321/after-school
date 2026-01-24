/**
 * Bounty Service Layer
 * 悬赏任务业务逻辑层
 * 
 * 核心概念：
 * - 任务市场是 Family-level 配置，全家共享
 * - 所有家庭成员看到相同的任务列表
 * - member 只作为参与者：
 *   - publisher_member_id（发布者）
 *   - claimer_member_id（领取者）
 *   - reviewer_member_id（审核者）
 * - 不允许"按 memberId 生成专属市场"
 * 
 * 状态机流程：
 * open -> claimed -> submitted -> approved/rejected
 * 
 * 积分流转：
 * 1. 发布任务：发布者积分托管（escrow）
 * 2. 审核通过：托管积分转给领取者
 * 3. 审核拒绝/取消：托管积分返还发布者
 */
const bountyRepo = require('../repos/bountyRepo');
const walletRepo = require('../repos/walletRepo');
const marketplaceRepo = require('../repos/marketplaceRepo');

// ========== 发布任务 ==========

/**
 * 发布悬赏任务
 * 
 * 流程：
 * 1. 校验发布者余额
 * 2. 创建任务记录
 * 3. 创建托管订单（扣除积分）
 * 4. 创建积分流水（reason=escrow）
 * 
 * @param {object} data 任务数据
 * @param {number} data.parentId 用户ID
 * @param {number} data.publisherMemberId 发布者成员ID
 * @param {string} data.title 任务标题
 * @param {string} data.description 任务描述
 * @param {number} data.bountyPoints 悬赏积分
 * @param {Date} data.dueAt 截止时间
 * @param {string} data.acceptCriteria 验收标准
 * @returns {object} 创建结果
 */
exports.publishTask = async (data) => {
  const pool = bountyRepo.getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      parentId,
      publisherMemberId,
      title,
      description,
      bountyPoints,
      dueAt,
      acceptCriteria,
      issueId,
    } = data;

    // ========== 1. 校验发布者归属 ==========
    const publisher = await walletRepo.getMemberById(publisherMemberId, client);
    if (!publisher) {
      throw new Error('发布者成员不存在');
    }
    if (publisher.parent_id !== parentId) {
      throw new Error('发布者不属于此家庭');
    }
    
    // ========== 2. 校验发布者余额 ==========
    const balance = await walletRepo.getBalance(publisherMemberId, client);
    if (balance < bountyPoints) {
      throw new Error(`积分不足，当前余额: ${balance}，需要: ${bountyPoints}`);
    }

    // ========== 3. 创建任务记录 ==========
    const task = await bountyRepo.createTask({
      parentId,
      publisherMemberId,
      title,
      description,
      bountyPoints,
      escrowPoints: bountyPoints, // 托管金额等于悬赏金额
      dueAt,
      acceptCriteria,
      status: 'open',
      issueId,
    }, client);

    // ========== 4. 创建托管订单 ==========
    const idempotencyKey = `bounty_escrow_${task.id}`;
    
    const order = await marketplaceRepo.createOrder({
      parentId,
      memberId: publisherMemberId,
      offerId: null, // 悬赏任务无关联 offer
      skuId: null,
      skuName: `悬赏托管：${title}`,
      cost: bountyPoints,
      quantity: 1,
      status: 'paid',
      idempotencyKey,
    }, client);

    // ========== 5. 创建积分流水 ==========
    await walletRepo.createPointsLog({
      memberId: publisherMemberId,
      parentId,
      orderId: order.id,
      description: `发布悬赏：${title}`,
      pointsChange: -bountyPoints,
      reasonCode: 'escrow',
      idempotencyKey: `points_${idempotencyKey}`,
    }, client);

    await client.query('COMMIT');

    return {
      success: true,
      task,
      order,
      msg: `悬赏任务发布成功！已托管 ${bountyPoints} 积分`,
    };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ========== 领取任务 ==========

/**
 * 领取悬赏任务
 * 
 * 流程：
 * 1. 校验任务状态（必须是 open）
 * 2. 校验不能领取自己发布的任务
 * 3. 校验是否已有人领取
 * 4. 创建领取记录
 * 5. 更新任务状态为 claimed
 * 
 * @param {number} taskId 任务ID
 * @param {number} claimerMemberId 领取者成员ID
 * @returns {object} 领取结果
 */
exports.claimTask = async (taskId, claimerMemberId) => {
  const pool = bountyRepo.getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ========== 1. 获取任务信息 ==========
    const task = await bountyRepo.getTaskById(taskId, client);
    if (!task) {
      throw new Error('任务不存在');
    }

    // ========== 2. 校验任务状态 ==========
    if (task.status !== 'open') {
      throw new Error(`任务当前不可领取 (状态: ${task.status})`);
    }

    // ========== 3. 校验不能领取自己的任务 ==========
    if (task.publisher_member_id === claimerMemberId) {
      throw new Error('不能领取自己发布的任务');
    }

    // ========== 4. 校验成员是否属于同一家庭 ==========
    const claimer = await walletRepo.getMemberById(claimerMemberId, client);
    if (!claimer || claimer.parent_id !== task.parent_id) {
      throw new Error('无权领取此任务');
    }

    // ========== 5. 校验截止时间 ==========
    if (task.due_at && new Date(task.due_at) < new Date()) {
      // 更新任务状态为过期
      await bountyRepo.updateTaskStatus(taskId, 'expired', client);
      throw new Error('任务已过期');
    }

    // ========== 6. 校验是否已有人领取 ==========
    const existingClaim = await bountyRepo.getActiveClaimByTaskId(taskId, client);
    if (existingClaim) {
      throw new Error(`任务已被 ${existingClaim.claimer_name} 领取`);
    }

    // ========== 7. 创建领取记录 ==========
    const claim = await bountyRepo.createClaim({
      taskId,
      claimerMemberId,
      status: 'active',
    }, client);

    // ========== 8. 更新任务状态 ==========
    await bountyRepo.updateTaskStatus(taskId, 'claimed', client);

    await client.query('COMMIT');

    return {
      success: true,
      claim,
      msg: `任务领取成功！请在截止时间前完成`,
    };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ========== 提交任务 ==========

/**
 * 提交任务完成
 * 
 * 流程：
 * 1. 校验领取记录存在且状态为 active
 * 2. 更新领取状态为 submitted
 * 3. 更新任务状态为 submitted
 * 
 * @param {number} claimId 领取记录ID
 * @param {string} submissionNote 提交说明
 * @returns {object} 提交结果
 */
exports.submitTask = async (claimId, submissionNote = '') => {
  const pool = bountyRepo.getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ========== 1. 获取领取记录 ==========
    const claim = await bountyRepo.getClaimById(claimId, client);
    if (!claim) {
      throw new Error('领取记录不存在');
    }

    // ========== 2. 校验状态 ==========
    if (claim.status !== 'active') {
      throw new Error(`无法提交 (当前状态: ${claim.status})`);
    }

    // ========== 3. 获取任务信息 ==========
    const task = await bountyRepo.getTaskById(claim.task_id, client);
    if (!task) {
      throw new Error('任务不存在');
    }

    // ========== 4. 更新领取状态 ==========
    const updatedClaim = await bountyRepo.submitClaim(claimId, submissionNote, client);

    // ========== 5. 更新任务状态 ==========
    await bountyRepo.updateTaskStatus(task.id, 'submitted', client);

    await client.query('COMMIT');

    return {
      success: true,
      claim: updatedClaim,
      msg: '任务已提交，等待审核',
    };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ========== 审核任务 ==========

/**
 * 审核任务
 * 
 * 审核通过流程：
 * 1. 校验任务状态
 * 2. 创建审核记录
 * 3. 更新领取状态为 approved
 * 4. 创建奖励订单（领取者获得积分）
 * 5. 创建积分流水
 * 6. 清零托管积分
 * 7. 更新任务状态为 approved
 * 
 * 审核拒绝流程：
 * 1. 创建审核记录
 * 2. 更新领取状态为 rejected
 * 3. 更新任务状态为 rejected 或重新 open
 * 
 * @param {number} taskId 任务ID
 * @param {number} reviewerMemberId 审核者成员ID
 * @param {string} decision 审核决定: approved/rejected
 * @param {string} comment 审核意见
 * @param {boolean} allowReclaim 拒绝后是否允许重新领取
 * @returns {object} 审核结果
 */
exports.reviewTask = async (taskId, reviewerMemberId, decision, comment = '', allowReclaim = false) => {
  const pool = bountyRepo.getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ========== 1. 获取任务信息 ==========
    const task = await bountyRepo.getTaskById(taskId, client);
    if (!task) {
      throw new Error('任务不存在');
    }

    // ========== 2. 校验任务状态 ==========
    if (task.status !== 'submitted') {
      throw new Error(`任务当前不可审核 (状态: ${task.status})`);
    }

    // ========== 3. 获取领取记录 ==========
    // 首先尝试获取 submitted 状态的领取记录
    let claimRecord = null;
    const submittedResult = await client.query(
      `SELECT tc.*, m.name as claimer_name
       FROM task_claim tc
       JOIN family_members m ON tc.claimer_member_id = m.id
       WHERE tc.task_id = $1 AND tc.status = 'submitted'
       LIMIT 1`,
      [taskId]
    );
    
    if (submittedResult.rows.length > 0) {
      claimRecord = submittedResult.rows[0];
    } else {
      // 尝试获取 active 状态的领取记录
      claimRecord = await bountyRepo.getActiveClaimByTaskId(taskId, client);
    }
    
    if (!claimRecord) {
      throw new Error('没有找到待审核的提交记录');
    }

    // ========== 4. 校验审核者权限 ==========
    // 审核者必须是发布者或同家庭成员
    const reviewer = await walletRepo.getMemberById(reviewerMemberId, client);
    if (!reviewer || reviewer.parent_id !== task.parent_id) {
      throw new Error('无权审核此任务');
    }

    // ========== 5. 创建审核记录 ==========
    const review = await bountyRepo.createReview({
      taskId,
      claimId: claimRecord.id,
      reviewerMemberId,
      decision,
      comment,
    }, client);

    if (decision === 'approved') {
      // ========== 审核通过 ==========
      
      // 更新领取状态
      await bountyRepo.updateClaimStatus(claimRecord.id, 'approved', client);

      // 创建奖励订单
      const idempotencyKey = `bounty_reward_${task.id}_${claimRecord.id}`;
      
      const order = await marketplaceRepo.createOrder({
        parentId: task.parent_id,
        memberId: claimRecord.claimer_member_id,
        offerId: null,
        skuId: null,
        skuName: `悬赏奖励：${task.title}`,
        cost: 0, // 收入，不是支出
        quantity: 1,
        status: 'paid',
        idempotencyKey,
      }, client);

      // 创建积分流水（领取者获得积分）
      await walletRepo.createPointsLog({
        memberId: claimRecord.claimer_member_id,
        parentId: task.parent_id,
        orderId: order.id,
        description: `完成悬赏：${task.title}`,
        pointsChange: task.bounty_points,
        reasonCode: 'bounty',
        idempotencyKey: `points_${idempotencyKey}`,
      }, client);

      // 清零托管积分
      await bountyRepo.updateTaskEscrow(taskId, 0, client);

      // 更新任务状态
      await bountyRepo.updateTaskStatus(taskId, 'approved', client);

      await client.query('COMMIT');

      return {
        success: true,
        review,
        msg: `审核通过！${claimRecord.claimer_name} 获得 ${task.bounty_points} 积分`,
        pointsAwarded: task.bounty_points,
        claimerMemberId: claimRecord.claimer_member_id,
      };

    } else if (decision === 'rejected') {
      // ========== 审核拒绝 ==========
      
      // 更新领取状态
      await bountyRepo.updateClaimStatus(claimRecord.id, 'rejected', client);

      if (allowReclaim) {
        // 允许重新领取：任务状态改为 open
        await bountyRepo.updateTaskStatus(taskId, 'open', client);
        
        await client.query('COMMIT');

        return {
          success: true,
          review,
          msg: '审核未通过，任务已重新开放',
          allowReclaim: true,
        };
      } else {
        // 不允许重新领取：返还托管积分给发布者
        const idempotencyKey = `bounty_refund_${task.id}_${claimRecord.id}`;
        
        const order = await marketplaceRepo.createOrder({
          parentId: task.parent_id,
          memberId: task.publisher_member_id,
          offerId: null,
          skuId: null,
          skuName: `悬赏退还：${task.title}`,
          cost: 0,
          quantity: 1,
          status: 'paid',
          idempotencyKey,
        }, client);

        // 返还积分给发布者
        await walletRepo.createPointsLog({
          memberId: task.publisher_member_id,
          parentId: task.parent_id,
          orderId: order.id,
          description: `悬赏退还：${task.title}`,
          pointsChange: task.escrow_points,
          reasonCode: 'refund',
          idempotencyKey: `points_${idempotencyKey}`,
        }, client);

        // 清零托管积分
        await bountyRepo.updateTaskEscrow(taskId, 0, client);

        // 更新任务状态
        await bountyRepo.updateTaskStatus(taskId, 'rejected', client);

        await client.query('COMMIT');

        return {
          success: true,
          review,
          msg: `审核未通过，${task.escrow_points} 积分已返还发布者`,
          refundedPoints: task.escrow_points,
        };
      }
    } else {
      throw new Error(`无效的审核决定: ${decision}`);
    }

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ========== 取消任务 ==========

/**
 * 取消悬赏任务
 * 
 * 只有发布者可以取消，且任务状态必须是 open
 * 取消后返还托管积分
 * 
 * @param {number} taskId 任务ID
 * @param {number} publisherMemberId 发布者成员ID
 * @returns {object} 取消结果
 */
exports.cancelTask = async (taskId, publisherMemberId) => {
  const pool = bountyRepo.getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ========== 1. 获取任务信息 ==========
    const task = await bountyRepo.getTaskById(taskId, client);
    if (!task) {
      throw new Error('任务不存在');
    }

    // ========== 2. 校验发布者 ==========
    if (task.publisher_member_id !== publisherMemberId) {
      throw new Error('只有发布者可以取消任务');
    }

    // ========== 3. 校验任务状态 ==========
    if (task.status !== 'open') {
      throw new Error(`任务当前不可取消 (状态: ${task.status})`);
    }

    // ========== 4. 返还托管积分 ==========
    if (task.escrow_points > 0) {
      const idempotencyKey = `bounty_cancel_${task.id}`;
      
      const order = await marketplaceRepo.createOrder({
        parentId: task.parent_id,
        memberId: publisherMemberId,
        offerId: null,
        skuId: null,
        skuName: `悬赏取消退还：${task.title}`,
        cost: 0,
        quantity: 1,
        status: 'paid',
        idempotencyKey,
      }, client);

      await walletRepo.createPointsLog({
        memberId: publisherMemberId,
        parentId: task.parent_id,
        orderId: order.id,
        description: `悬赏取消退还：${task.title}`,
        pointsChange: task.escrow_points,
        reasonCode: 'refund',
        idempotencyKey: `points_${idempotencyKey}`,
      }, client);

      await bountyRepo.updateTaskEscrow(taskId, 0, client);
    }

    // ========== 5. 更新任务状态 ==========
    await bountyRepo.updateTaskStatus(taskId, 'cancelled', client);

    await client.query('COMMIT');

    return {
      success: true,
      msg: `任务已取消，${task.escrow_points} 积分已返还`,
      refundedPoints: task.escrow_points,
    };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ========== 市场配置入口（Family-level）==========

/**
 * 获取任务市场概览（Family-level 视角）
 * 
 * 用途：展示家庭任务市场的整体情况，不涉及具体成员
 * 不需要 memberId，返回全家庭共享的任务列表
 * 
 * @param {number} parentId - 用户ID
 * @param {object} options - 查询选项
 * @param {string} options.status - 任务状态筛选
 * @returns {object} 任务市场概览
 */
exports.getTaskMarket = async (parentId, options = {}) => {
  const { status } = options;
  
  // 获取所有任务
  const tasks = await bountyRepo.getTasksByParentId(parentId, status);
  
  // 获取待审核的提交
  const pendingSubmissions = await bountyRepo.getPendingSubmissions(parentId);
  
  // 统计各状态数量
  const stats = {
    open: tasks.filter(t => t.status === 'open').length,
    claimed: tasks.filter(t => t.status === 'claimed').length,
    submitted: tasks.filter(t => t.status === 'submitted').length,
    approved: tasks.filter(t => t.status === 'approved').length,
    rejected: tasks.filter(t => t.status === 'rejected').length,
    cancelled: tasks.filter(t => t.status === 'cancelled').length,
    expired: tasks.filter(t => t.status === 'expired').length,
  };
  
  // 计算总托管积分
  const totalEscrow = tasks.reduce((sum, t) => sum + (t.escrow_points || 0), 0);
  
  return {
    parentId,
    tasks,
    totalTasks: tasks.length,
    stats,
    totalEscrow,
    pendingSubmissionCount: pendingSubmissions.length,
  };
};

// ========== 查询接口 ==========

/**
 * 获取任务详情
 */
exports.getTaskDetail = async (taskId) => {
  return await bountyRepo.getTaskDetail(taskId);
};

/**
 * 获取用户的任务列表（Family-level）
 * 
 * 返回家庭任务市场的所有任务，不按成员过滤
 */
exports.getTasksByParentId = async (parentId, status = null) => {
  return await bountyRepo.getTasksByParentId(parentId, status);
};

/**
 * 获取成员可领取的任务
 */
exports.getOpenTasksForMember = async (parentId, memberId) => {
  return await bountyRepo.getOpenTasksForMember(parentId, memberId);
};

/**
 * 获取成员的领取记录
 */
exports.getClaimsByMemberId = async (memberId, status = null) => {
  return await bountyRepo.getClaimsByMemberId(memberId, status);
};

/**
 * 获取待审核的提交
 */
exports.getPendingSubmissions = async (parentId) => {
  return await bountyRepo.getPendingSubmissions(parentId);
};

/**
 * 获取任务的审核历史
 */
exports.getReviewHistory = async (taskId) => {
  return await bountyRepo.getReviewsByTaskId(taskId);
};
