/**
 * Reminder Routes
 * 提醒系统 API 路由
 */
const express = require('express');
const router = express.Router();
const controller = require('../controllers/reminderController');

// ========== 提醒策略 ==========
router.post('/reminders/policies', controller.createPolicy);
router.get('/reminders/policies', controller.getPolicies);
router.patch('/reminders/policies/:id/status', controller.updatePolicyStatus);

// ========== 提醒事件 ==========
router.get('/reminders', controller.getReminders);
router.post('/reminders', controller.createReminder);
router.get('/reminders/pending/:memberId', controller.getPendingReminders);
router.get('/reminders/overdue', controller.getOverdueReminders);
router.get('/reminders/stats', controller.getReminderStats);
router.patch('/reminders/:id/read', controller.markAsRead);
router.delete('/reminders/:id', controller.cancelReminder);

// ========== 扫描器 ==========
router.post('/reminders/scan', controller.scanReminders);

module.exports = router;
