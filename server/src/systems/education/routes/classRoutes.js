const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');
const { checkPermission } = require('../../../shared/middleware/permissionMiddleware');
const PERMISSIONS = require('../../../shared/constants/permissions');

// 报名下拉框用 (保持不变)
router.get('/active', classController.getActiveClasses);

// 管理页面用 (新增)
router.get('/', classController.getAllClasses);
router.post('/', classController.createClass);

// 获取课程报名历史（必须在 /:id 之前）
router.get('/:id/enrollment-history', classController.getClassEnrollmentHistory);

router.put('/:id', classController.updateClass);

// 🛑 删除接口（需要 CLASS.DELETE 权限）
router.delete('/:id', checkPermission(PERMISSIONS.CLASS.DELETE), classController.deleteClass);

module.exports = router;
