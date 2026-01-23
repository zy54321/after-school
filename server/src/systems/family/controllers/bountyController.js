/**
 * Bounty Controller - v2 API
 * 悬赏任务接口控制层
 */
const bountyService = require('../services/bountyService');
const walletService = require('../services/walletService');

/**
 * POST /api/v2/tasks
 * 发布悬赏任务
 */
exports.publishTask = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const {
      publisher_member_id: publisherMemberId,
      title,
      description,
      bounty_points: bountyPoints,
      due_at: dueAt,
      accept_criteria: acceptCriteria,
      issue_id: issueId,
    } = req.body;

    // 参数校验
    if (!publisherMemberId) {
      return res.status(400).json({ code: 400, msg: '缺少必填参数: publisher_member_id' });
    }
    if (!title) {
      return res.status(400).json({ code: 400, msg: '缺少必填参数: title' });
    }
    if (!bountyPoints || bountyPoints <= 0) {
      return res.status(400).json({ code: 400, msg: '悬赏积分必须大于0' });
    }

    // 演示模式检查
    if (req.session.user.username === 'visitor') {
      return res.status(403).json({ code: 403, msg: '演示模式：游客账号仅供查看，禁止修改数据' });
    }

    // 校验成员归属
    const member = await walletService.getMemberById(parseInt(publisherMemberId));
    if (!member || member.parent_id !== userId) {
      return res.status(403).json({ code: 403, msg: '无权操作该成员' });
    }

    const result = await bountyService.publishTask({
      parentId: userId,
      publisherMemberId: parseInt(publisherMemberId),
      title,
      description,
      bountyPoints: parseInt(bountyPoints),
      dueAt: dueAt ? new Date(dueAt) : null,
      acceptCriteria,
      issueId,
    });

    res.json({
      code: 200,
      data: { task: result.task, order: result.order },
      msg: result.msg,
    });
  } catch (err) {
    console.error('publishTask 错误:', err);
    
    if (err.message.includes('积分不足')) {
      return res.status(400).json({ code: 400, msg: err.message });
    }
    
    res.status(500).json({ code: 500, msg: '发布任务失败', error: err.message });
  }
};

/**
 * GET /api/v2/tasks
 * 获取任务列表
 */
exports.getTasks = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { status, member_id: memberId } = req.query;

    let tasks;
    if (memberId) {
      // 获取成员可领取的任务
      tasks = await bountyService.getOpenTasksForMember(userId, parseInt(memberId));
    } else {
      // 获取所有任务
      tasks = await bountyService.getTasksByParentId(userId, status || null);
    }

    res.json({
      code: 200,
      data: { tasks, total: tasks.length },
    });
  } catch (err) {
    console.error('getTasks 错误:', err);
    res.status(500).json({ code: 500, msg: '获取任务列表失败', error: err.message });
  }
};

/**
 * GET /api/v2/tasks/:id
 * 获取任务详情
 */
exports.getTaskDetail = async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);

    if (!taskId) {
      return res.status(400).json({ code: 400, msg: '无效的任务ID' });
    }

    const task = await bountyService.getTaskDetail(taskId);
    if (!task) {
      return res.status(404).json({ code: 404, msg: '任务不存在' });
    }

    // 获取审核历史
    const reviews = await bountyService.getReviewHistory(taskId);

    res.json({
      code: 200,
      data: { task, reviews },
    });
  } catch (err) {
    console.error('getTaskDetail 错误:', err);
    res.status(500).json({ code: 500, msg: '获取任务详情失败', error: err.message });
  }
};

/**
 * POST /api/v2/tasks/:id/claim
 * 领取任务
 */
exports.claimTask = async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const { member_id: memberId } = req.body;

    if (!taskId) {
      return res.status(400).json({ code: 400, msg: '无效的任务ID' });
    }
    if (!memberId) {
      return res.status(400).json({ code: 400, msg: '缺少必填参数: member_id' });
    }

    // 演示模式检查
    if (req.session.user.username === 'visitor') {
      return res.status(403).json({ code: 403, msg: '演示模式：游客账号仅供查看，禁止修改数据' });
    }

    // 校验成员归属
    const userId = req.session.user.id;
    const member = await walletService.getMemberById(parseInt(memberId));
    if (!member || member.parent_id !== userId) {
      return res.status(403).json({ code: 403, msg: '无权操作该成员' });
    }

    const result = await bountyService.claimTask(taskId, parseInt(memberId));

    res.json({
      code: 200,
      data: { claim: result.claim },
      msg: result.msg,
    });
  } catch (err) {
    console.error('claimTask 错误:', err);

    if (err.message.includes('不存在') || err.message.includes('不可领取') ||
        err.message.includes('不能领取') || err.message.includes('已被') ||
        err.message.includes('已过期')) {
      return res.status(400).json({ code: 400, msg: err.message });
    }

    res.status(500).json({ code: 500, msg: '领取任务失败', error: err.message });
  }
};

/**
 * POST /api/v2/tasks/:id/submit
 * 提交任务
 */
exports.submitTask = async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const { claim_id: claimId, submission_note: submissionNote } = req.body;

    if (!claimId) {
      return res.status(400).json({ code: 400, msg: '缺少必填参数: claim_id' });
    }

    // 演示模式检查
    if (req.session.user.username === 'visitor') {
      return res.status(403).json({ code: 403, msg: '演示模式：游客账号仅供查看，禁止修改数据' });
    }

    const result = await bountyService.submitTask(parseInt(claimId), submissionNote || '');

    res.json({
      code: 200,
      data: { claim: result.claim },
      msg: result.msg,
    });
  } catch (err) {
    console.error('submitTask 错误:', err);

    if (err.message.includes('不存在') || err.message.includes('无法提交')) {
      return res.status(400).json({ code: 400, msg: err.message });
    }

    res.status(500).json({ code: 500, msg: '提交任务失败', error: err.message });
  }
};

/**
 * POST /api/v2/tasks/:id/review
 * 审核任务
 */
exports.reviewTask = async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const {
      reviewer_member_id: reviewerMemberId,
      decision,
      comment,
      allow_reclaim: allowReclaim,
    } = req.body;

    if (!taskId) {
      return res.status(400).json({ code: 400, msg: '无效的任务ID' });
    }
    if (!reviewerMemberId) {
      return res.status(400).json({ code: 400, msg: '缺少必填参数: reviewer_member_id' });
    }
    if (!decision || !['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ code: 400, msg: '无效的审核决定，必须是 approved 或 rejected' });
    }

    // 演示模式检查
    if (req.session.user.username === 'visitor') {
      return res.status(403).json({ code: 403, msg: '演示模式：游客账号仅供查看，禁止修改数据' });
    }

    // 校验成员归属
    const userId = req.session.user.id;
    const member = await walletService.getMemberById(parseInt(reviewerMemberId));
    if (!member || member.parent_id !== userId) {
      return res.status(403).json({ code: 403, msg: '无权操作该成员' });
    }

    const result = await bountyService.reviewTask(
      taskId,
      parseInt(reviewerMemberId),
      decision,
      comment || '',
      allowReclaim === true
    );

    res.json({
      code: 200,
      data: result,
      msg: result.msg,
    });
  } catch (err) {
    console.error('reviewTask 错误:', err);

    if (err.message.includes('不存在') || err.message.includes('不可审核') ||
        err.message.includes('无权')) {
      return res.status(400).json({ code: 400, msg: err.message });
    }

    res.status(500).json({ code: 500, msg: '审核任务失败', error: err.message });
  }
};

/**
 * POST /api/v2/tasks/:id/cancel
 * 取消任务
 */
exports.cancelTask = async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const { publisher_member_id: publisherMemberId } = req.body;

    if (!taskId) {
      return res.status(400).json({ code: 400, msg: '无效的任务ID' });
    }
    if (!publisherMemberId) {
      return res.status(400).json({ code: 400, msg: '缺少必填参数: publisher_member_id' });
    }

    // 演示模式检查
    if (req.session.user.username === 'visitor') {
      return res.status(403).json({ code: 403, msg: '演示模式：游客账号仅供查看，禁止修改数据' });
    }

    const result = await bountyService.cancelTask(taskId, parseInt(publisherMemberId));

    res.json({
      code: 200,
      data: result,
      msg: result.msg,
    });
  } catch (err) {
    console.error('cancelTask 错误:', err);

    if (err.message.includes('不存在') || err.message.includes('不可取消') ||
        err.message.includes('只有发布者')) {
      return res.status(400).json({ code: 400, msg: err.message });
    }

    res.status(500).json({ code: 500, msg: '取消任务失败', error: err.message });
  }
};

/**
 * GET /api/v2/tasks/pending
 * 获取待审核的提交
 */
exports.getPendingSubmissions = async (req, res) => {
  try {
    const userId = req.session.user.id;

    const submissions = await bountyService.getPendingSubmissions(userId);

    res.json({
      code: 200,
      data: { submissions, total: submissions.length },
    });
  } catch (err) {
    console.error('getPendingSubmissions 错误:', err);
    res.status(500).json({ code: 500, msg: '获取待审核列表失败', error: err.message });
  }
};

/**
 * GET /api/v2/tasks/my-claims
 * 获取我的领取记录
 */
exports.getMyClaims = async (req, res) => {
  try {
    const { member_id: memberId, status } = req.query;

    if (!memberId) {
      return res.status(400).json({ code: 400, msg: '缺少必填参数: member_id' });
    }

    const claims = await bountyService.getClaimsByMemberId(parseInt(memberId), status || null);

    res.json({
      code: 200,
      data: { claims, total: claims.length },
    });
  } catch (err) {
    console.error('getMyClaims 错误:', err);
    res.status(500).json({ code: 500, msg: '获取领取记录失败', error: err.message });
  }
};
