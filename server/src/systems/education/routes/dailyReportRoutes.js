const express = require('express');
const router = express.Router();
const dailyReportController = require('../controllers/dailyReportController');

// 老师用的接口
router.get('/workflow', dailyReportController.getDailyWorkflowData);
router.post('/workflow', dailyReportController.saveDailyWorkflow);

// ⭐ 家长用的接口 (查询)
router.get('/view', dailyReportController.getStudentReportByToken);

module.exports = router;