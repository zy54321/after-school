/**
 * Bounty Routes - v2 API
 * 悬赏任务接口路由
 * 
 * 基础路径: /api/v2/tasks
 */
const express = require('express');
const router = express.Router();
const controller = require('../controllers/bountyController');

// ========== 任务市场（Family-level，不需要 member_id） ==========

// GET /api/v2/tasks/market - 获取任务市场概览
router.get('/market', controller.getTaskMarket);

// GET /api/v2/tasks - 获取任务列表（member_id 可选）
router.get('/', controller.getTasks);

// GET /api/v2/tasks/pending - 获取待审核的提交
router.get('/pending', controller.getPendingSubmissions);

// ========== 任务发布（需要 publisher_member_id） ==========

// POST /api/v2/tasks - 发布悬赏任务
router.post('/', controller.publishTask);

// GET /api/v2/tasks/my-claims - 获取我的领取记录
router.get('/my-claims', controller.getMyClaims);

// GET /api/v2/tasks/:id - 获取任务详情
router.get('/:id', controller.getTaskDetail);

// POST /api/v2/tasks/:id/claim - 领取任务
router.post('/:id/claim', controller.claimTask);

// POST /api/v2/tasks/:id/submit - 提交任务
router.post('/:id/submit', controller.submitTask);

// POST /api/v2/tasks/:id/review - 审核任务
router.post('/:id/review', controller.reviewTask);

// POST /api/v2/tasks/:id/cancel - 取消任务
router.post('/:id/cancel', controller.cancelTask);

module.exports = router;
