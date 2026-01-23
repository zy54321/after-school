/**
 * Marketplace Routes - v2 API
 * 商城接口路由
 * 
 * 基础路径: /api/v2
 */
const express = require('express');
const router = express.Router();
const controller = require('../controllers/marketplaceController');

// ========== 商品相关 ==========

// GET /api/v2/skus - 获取 SKU 列表
router.get('/skus', controller.getSkus);

// GET /api/v2/offers - 获取 Offer 列表
router.get('/offers', controller.getOffers);

// ========== 订单相关 ==========

// POST /api/v2/orders - 创建订单
router.post('/orders', controller.createOrder);

// GET /api/v2/orders - 获取订单列表
router.get('/orders', controller.getOrders);

// ========== 库存相关 ==========

// GET /api/v2/inventory - 获取库存列表
router.get('/inventory', controller.getInventory);

// ========== 钱包相关 ==========

// GET /api/v2/wallet - 获取钱包信息
router.get('/wallet', controller.getWallet);

// GET /api/v2/wallet/logs - 获取积分流水
router.get('/wallet/logs', controller.getWalletLogs);

// ========== 神秘商店 ==========

// POST /api/v2/mystery-shop/refresh - 刷新神秘商店
router.post('/mystery-shop/refresh', controller.refreshMysteryShop);

// GET /api/v2/mystery-shop - 获取神秘商店商品
router.get('/mystery-shop', controller.getMysteryShop);

module.exports = router;
