/**
 * Lottery Routes - v2 API
 * 抽奖系统接口路由
 * 
 * 基础路径: /api/v2/draw
 */
const express = require('express');
const router = express.Router();
const controller = require('../controllers/lotteryController');

// ========== 概览（Family-level，不需要 member_id） ==========

// GET /api/v2/draw/overview - 获取抽奖概览
router.get('/overview', controller.getOverview);

// ========== 管理后台 ==========
// GET /api/v2/draw/admin/pools - 获取所有抽奖池
router.get('/admin/pools', controller.getAdminPools);
// POST /api/v2/draw/pools - 创建抽奖池
router.post('/pools', controller.createPool);
// PUT /api/v2/draw/pools/:id - 更新抽奖池
router.put('/pools/:id', controller.updatePool);
// DELETE /api/v2/draw/pools/:id - 停用抽奖池
router.delete('/pools/:id', controller.deletePool);
// POST /api/v2/draw/pools/:id/versions - 创建抽奖池版本
router.post('/pools/:id/versions', controller.createPoolVersion);

// ========== 抽奖操作（Member-level，需要 member_id） ==========

// POST /api/v2/draw/spin - 执行抽奖
router.post('/spin', controller.spin);

// ========== 抽奖池（member_id 可选） ==========

// GET /api/v2/draw/pools - 获取所有抽奖池
router.get('/pools', controller.getPools);

// GET /api/v2/draw/pools/:id - 获取抽奖池详情
router.get('/pools/:id', controller.getPoolDetail);

// ========== 历史记录 ==========

// GET /api/v2/draw/history - 获取抽奖历史
router.get('/history', controller.getHistory);

// ✅ 兼容旧接口：GET /api/v2/draw/logs -> 走同一套历史
router.get('/logs', controller.getHistory);

// ========== 抽奖券 ==========

// GET /api/v2/draw/tickets - 获取抽奖券统计
router.get('/tickets', controller.getTickets);

// GET /api/v2/draw/pools/:id/stats - 获取成员在指定抽奖池的统计信息
router.get('/pools/:id/stats', controller.getPoolStats);

module.exports = router;
