const express = require('express');
const router = express.Router();
const controller = require('../controllers/familyController');

// 基础数据
router.get('/init', controller.getInitData);
router.get('/member-dashboard', controller.getMemberDashboard);

// 核心功能
router.post('/action', controller.logAction);
router.post('/redeem', controller.redeemReward);
router.post('/revoke', controller.revokeLog);

// 🟢 新增：竞拍结算
router.post('/auction/settle', controller.settleAuction);

// 规则管理
router.post('/create', controller.createItem);
router.post('/update', controller.updateItem);
router.post('/delete', controller.deleteItem);

// 分类管理
router.post('/category/create', controller.createCategory);
router.post('/category/delete', controller.deleteCategory);

// 成员管理
router.post(
  '/member/create',
  controller.uploadMiddleware,
  controller.createMember
);
router.post(
  '/member/update',
  controller.uploadMiddleware,
  controller.updateMember
);
router.post('/member/delete', controller.deleteMember);

// 🎒 背包功能
router.get('/backpack', controller.getBackpack);
router.post('/backpack/use', controller.useBackpackItem);
router.post('/backpack/transfer', controller.transferBackpackItem);
router.get('/backpack/usage-history', controller.getUsageHistory);

module.exports = router;
