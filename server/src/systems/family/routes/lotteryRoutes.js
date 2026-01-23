/**
 * Lottery Routes - v2 API
 * 抽奖系统接口路由
 * 
 * 基础路径: /api/v2/draw
 */
const express = require('express');
const router = express.Router();
const controller = require('../controllers/lotteryController');

// ========== 抽奖操作 ==========

// POST /api/v2/draw/spin - 执行抽奖
router.post('/spin', controller.spin);

// ========== 抽奖池 ==========

// GET /api/v2/draw/pools - 获取所有抽奖池
router.get('/pools', controller.getPools);

// GET /api/v2/draw/pools/:id - 获取抽奖池详情
router.get('/pools/:id', controller.getPoolDetail);

// ========== 历史记录 ==========

// GET /api/v2/draw/history - 获取抽奖历史
router.get('/history', controller.getHistory);

// ========== 抽奖券 ==========

// GET /api/v2/draw/tickets - 获取抽奖券统计
router.get('/tickets', controller.getTickets);

module.exports = router;
