const express = require('express');
const router = express.Router();
const controller = require('../controllers/dailyReportController');

const checkAuth = require('../../../shared/middleware/authMiddleware');

// ⭐ 1. 公开接口 (不需要登录)
// 家长查看日报 (对应前端 /api/reports/view)
router.get('/view', controller.getStudentReportByToken);

// ⭐ 2. 鉴权中间件 (在此之后的接口都需要登录)
router.use(checkAuth);

// ⭐ 3. 受保护接口 (老师/管理员用的)
router.get('/workflow', controller.getDailyWorkflowData);
router.post('/workflow', controller.saveDailyWorkflow);

module.exports = router;