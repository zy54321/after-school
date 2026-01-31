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

// ========== 成员级预设规则管理 ==========
// GET /api/v2/family/member/:memberId/presets - 获取成员预设规则列表
router.get('/member/:memberId/presets', controller.getMemberPresets);
// GET /api/v2/family/member/:memberId/rewards - 获取成员奖励规则
router.get('/member/:memberId/rewards', controller.getMemberRewardRules);
// GET /api/v2/family/member/:memberId/penalties - 获取成员惩罚规则
router.get('/member/:memberId/penalties', controller.getMemberPenaltyRules);
// POST /api/v2/family/member/:memberId/presets - 创建成员预设规则
router.post('/member/:memberId/presets', controller.createMemberPreset);
// PUT /api/v2/family/member/:memberId/presets/:id - 更新成员预设规则
router.put('/member/:memberId/presets/:id', controller.updateMemberPreset);
// DELETE /api/v2/family/member/:memberId/presets/:id - 删除成员预设规则
router.delete('/member/:memberId/presets/:id', controller.deleteMemberPreset);

// ========== 兼容旧接口（已废弃） ==========
// 🟢 预设管理 (Presets) - 已废弃，保留用于过渡
router.get('/presets', controller.getPresets);
router.post('/presets', controller.createPreset);
router.put('/presets/:id', controller.updatePreset);
router.delete('/presets/:id', controller.deletePreset);

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
router.put('/presets/category/update', controller.updatePresetCategory);
router.post('/presets/category/delete', controller.deletePresetCategory);

// 🎒 背包功能
router.get('/backpack', controller.getBackpack);
router.post('/backpack/use', controller.useBackpackItem);
router.post('/backpack/transfer', controller.transferBackpackItem);
router.get('/backpack/usage-history', controller.getUsageHistory);

module.exports = router;