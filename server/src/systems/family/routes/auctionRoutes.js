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

// ========== 拍卖台（大厅/会场聚合） ==========
// GET /api/v2/auction/hall - 大厅聚合
router.get('/hall', controller.getHall);

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

// GET /api/v2/auction/sessions/:id/overview - 会场详情聚合（拍卖台用）
router.get('/sessions/:id/overview', controller.getSessionOverview);

// GET /api/v2/auction/sessions-admin - 管理员场次列表（聚合统计）
router.get('/sessions-admin', controller.getSessionsAdmin);

// POST /api/v2/auction/sessions/:id/generate-lots - 生成拍卖品（旧接口，保留兼容）
router.post('/sessions/:id/generate-lots', controller.generateLots);

// POST /api/v2/auction/sessions/:id/lots/preview-generate - 预览生成拍品（不落库）
router.post('/sessions/:id/lots/preview-generate', controller.previewGenerateLots);

// POST /api/v2/auction/sessions/:id/lots/commit-generate - 确认生成拍品（落库）
router.post('/sessions/:id/lots/commit-generate', controller.commitGenerateLots);

// POST /api/v2/auction/sessions/:id/pool - 设置拍卖品池子
router.post('/sessions/:id/pool', controller.setSessionPool);

// POST /api/v2/auction/sessions/:id/start - 开始拍卖
router.post('/sessions/:id/start', controller.startSession);

// POST /api/v2/auction/sessions/:id/next - 进入下一拍品
router.post('/sessions/:id/next', controller.advanceSessionLot);

// POST /api/v2/auction/sessions/:id/activate-lot - 激活指定拍品
router.post('/sessions/:id/activate-lot', controller.activateLot);

// POST /api/v2/auction/sessions/:id/activate-next - 激活下一拍品
router.post('/sessions/:id/activate-next', controller.activateNext);

// POST /api/v2/auction/sessions/:id/lots/reorder - 拍品拖拽排序
router.post('/sessions/:id/lots/reorder', controller.reorderSessionLots);

// POST /api/v2/auction/sessions/:id/settle - 结算场次
router.post('/sessions/:id/settle', controller.settleSession);

// ========== 拍品相关 ==========

// GET /api/v2/auction/bids - 获取成员竞拍记录
router.get('/bids', controller.getMemberBids);

// POST /api/v2/auction/lots/:id/bids - 提交出价
router.post('/lots/:id/bids', controller.submitBid);

// ✅ 兼容前端旧路径：POST /api/v2/auction/lots/:id/bid
router.post('/lots/:id/bid', controller.submitBid);

// POST /api/v2/auction/lots/:id/close - 逐 lot 成交（线下拍完一个就点成交）
router.post('/lots/:id/close', controller.closeLot);

// POST /api/v2/auction/lots/:id/undo-last-bid - 撤销最后一次出价（仅允许撤销该 lot 最新一条 bid）
router.post('/lots/:id/undo-last-bid', controller.undoLastBid);

// GET /api/v2/auction/lots/:id/bids - 获取出价列表
router.get('/lots/:id/bids', controller.getBids);

// GET /api/v2/auction/lots/:id/record - 获取拍品交易记录
router.get('/lots/:id/record', controller.getLotRecord);

module.exports = router;
