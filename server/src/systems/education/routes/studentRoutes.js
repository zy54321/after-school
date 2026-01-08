const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');

// 🛑 [删除] 旧的管理员中间件
// const checkAdmin = require('../../../shared/middleware/adminMiddleware');

// ✅ [新增] 引入新的细粒度权限中间件
const requirePermission = require('../../../shared/middleware/requirePermission');

// 定义路径

// 1. 查看列表 & 详情 -> 需要 'edu:student:view' 权限
router.get('/', requirePermission('edu:student:view'), studentController.getStudents);
router.get('/locations', requirePermission('edu:student:view'), studentController.getStudentLocations);
router.get('/nearby', requirePermission('edu:student:view'), studentController.getNearbyStudents);
router.get('/:id', requirePermission('edu:student:view'), studentController.getStudentDetail);

// 2. 新增学员 -> 需要 'edu:student:create' 权限
router.post('/', requirePermission('edu:student:create'), studentController.createStudent);

// 3. 编辑学员 -> 需要 'edu:student:edit' 权限
router.put('/:id', requirePermission('edu:student:edit'), studentController.updateStudent);

// 4. 删除学员 & 办理退课 -> 需要 'edu:student:delete' 权限
// (原来是 checkAdmin，现在变得更灵活了)
router.delete('/:id', requirePermission('edu:student:delete'), studentController.deleteStudent);
router.post('/:id/drop', requirePermission('edu:student:delete'), studentController.dropClass);

module.exports = router;