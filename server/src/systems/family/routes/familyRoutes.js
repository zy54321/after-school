const express = require('express');
const router = express.Router();
const controller = require('../controllers/familyController');

router.get('/init', controller.getInitData);           // 初始化数据
router.get('/member-dashboard', controller.getMemberDashboard); // 指定孩子的面板
router.post('/action', controller.logAction);          // 加分/扣分
router.post('/redeem', controller.redeemReward);       // 兑换
router.post('/create', controller.createItem);         // 数据录入 (新增规则)

module.exports = router;