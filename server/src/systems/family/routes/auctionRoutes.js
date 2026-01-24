/**
 * Auction Routes - v2 API
 * 拍卖接口路由
 * 
 * 基础路径: /api/v2/auction
 */
const express = require('express');
const router = express.Router();
const controller = require('../controllers/auctionController');

// ========== 概览（Family-level，不需要 member_id） ==========

// GET /api/v2/auction/overview - 获取拍卖概览
router.get('/overview', controller.getOverview);

// ========== SKU 相关 ==========

// GET /api/v2/auction/skus - 获取可拍卖的 SKU 列表
router.get('/skus', controller.getAuctionableSkus);

// ========== 场次相关（Family-level，不需要 member_id） ==========

// POST /api/v2/auction/sessions - 创建拍卖场次
router.post('/sessions', controller.createSession);

// GET /api/v2/auction/sessions - 获取场次列表
router.get('/sessions', controller.getSessions);

// GET /api/v2/auction/sessions/:id - 获取场次详情
router.get('/sessions/:id', controller.getSessionDetail);

// POST /api/v2/auction/sessions/:id/generate-lots - 生成拍卖品
router.post('/sessions/:id/generate-lots', controller.generateLots);

// POST /api/v2/auction/sessions/:id/settle - 结算场次
router.post('/sessions/:id/settle', controller.settleSession);

// ========== 拍品相关 ==========

// POST /api/v2/auction/lots/:id/bids - 提交出价
router.post('/lots/:id/bids', controller.submitBid);

// GET /api/v2/auction/lots/:id/bids - 获取出价列表
router.get('/lots/:id/bids', controller.getBids);

module.exports = router;
