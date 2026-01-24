/**
 * Marketplace Routes - v2 API
 * 商城接口路由
 * 
 * 基础路径: /api/v2
 */
const express = require('express');
const router = express.Router();
const controller = require('../controllers/marketplaceController');

// ========== 市场配置（Family-level，不需要 member_id） ==========

// GET /api/v2/catalog - 获取市场目录（含 SKU 和 Offer）
router.get('/catalog', controller.getCatalog);

// GET /api/v2/skus - 获取 SKU 列表
router.get('/skus', controller.getSkus);

// GET /api/v2/offers - 获取 Offer 列表
router.get('/offers', controller.getOffers);

// ========== 管理后台 ==========
// GET /api/v2/admin/skus - 获取家庭 SKU 列表
router.get('/admin/skus', controller.getAdminSkus);
// POST /api/v2/skus - 创建 SKU
router.post('/skus', controller.createSku);
// PUT /api/v2/skus/:id - 更新 SKU
router.put('/skus/:id', controller.updateSku);
// DELETE /api/v2/skus/:id - 停用 SKU
router.delete('/skus/:id', controller.deleteSku);

// GET /api/v2/admin/offers - 获取家庭 Offer 列表
router.get('/admin/offers', controller.getAdminOffers);
// POST /api/v2/offers - 创建 Offer
router.post('/offers', controller.createOffer);
// PUT /api/v2/offers/:id - 更新 Offer
router.put('/offers/:id', controller.updateOffer);
// DELETE /api/v2/offers/:id - 停用 Offer
router.delete('/offers/:id', controller.deleteOffer);

// GET /api/v2/family/members - 获取家庭成员列表（供选择成员使用）
router.get('/family/members', controller.getMembers);

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

// ========== 神秘商店（Family-level，不需要 member_id） ==========

// GET /api/v2/mystery-shop/overview - 获取神秘商店概览
router.get('/mystery-shop/overview', controller.getMysteryShopOverview);

// GET /api/v2/mystery-shop - 获取神秘商店商品
router.get('/mystery-shop', controller.getMysteryShop);

// POST /api/v2/mystery-shop/refresh - 刷新神秘商店（付费时需要 payer_member_id）
router.post('/mystery-shop/refresh', controller.refreshMysteryShop);

module.exports = router;
