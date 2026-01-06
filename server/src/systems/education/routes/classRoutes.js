const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');
const checkAdmin = require('../../../shared/middleware/adminMiddleware');

// 报名下拉框用 (保持不变)
router.get('/active', classController.getActiveClasses);

// 管理页面用 (新增)
router.get('/', classController.getAllClasses);
router.post('/', classController.createClass);

// 获取课程报名历史（必须在 /:id 之前）
router.get('/:id/enrollment-history', classController.getClassEnrollmentHistory);

router.put('/:id', classController.updateClass);

// 🛑 给删除接口加锁
router.delete('/:id', checkAdmin, classController.deleteClass);

module.exports = router;

