/**
 * Issue Routes - v2 API
 * Issue Tracker 接口路由
 * 
 * 基础路径: /api/v2/issues
 */
const express = require('express');
const router = express.Router();
const controller = require('../controllers/issueController');

// ========== 问题管理 ==========

// POST /api/v2/issues - 创建问题
router.post('/', controller.createIssue);

// GET /api/v2/issues - 获取问题列表
router.get('/', controller.getIssues);

// GET /api/v2/issues/top - 获取 Top Issues
router.get('/top', controller.getTopIssues);

// GET /api/v2/issues/occurrences - 获取最近发生记录
router.get('/occurrences', controller.getRecentOccurrences);

// GET /api/v2/issues/:id - 获取问题详情
router.get('/:id', controller.getIssueDetail);

// PATCH /api/v2/issues/:id/status - 更新问题状态
router.patch('/:id/status', controller.updateStatus);

// ========== 发生记录 ==========

// POST /api/v2/issues/:id/occurrence - 记录问题发生
router.post('/:id/occurrence', controller.recordOccurrence);

// ========== 关注度管理 ==========

// POST /api/v2/issues/:id/decay - 衰减关注度
router.post('/:id/decay', controller.decayAttentionScore);

// POST /api/v2/issues/decay-all - 批量衰减（定时任务用）
router.post('/decay-all', controller.decayAttentionScore);

// ========== 干预措施 ==========

// POST /api/v2/issues/:id/interventions - 创建干预措施
router.post('/:id/interventions', controller.createIntervention);

// POST /api/v2/issues/:id/intervention - 执行干预措施
router.post('/:id/intervention', controller.executeIntervention);

module.exports = router;
