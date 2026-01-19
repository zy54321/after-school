// server/src/systems/education/routes/studentRoutes.js
const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { checkPermission } = require('../../../shared/middleware/permissionMiddleware');
const PERMISSIONS = require('../../../shared/constants/permissions');

// 定义路径
router.get('/', studentController.getStudents);   // GET /api/students
router.post('/', studentController.createStudent); // POST /api/students
router.get('/locations', studentController.getStudentLocations); // 必须在 /:id 之前，否则会被当成 ID 拦截
router.get('/nearby', studentController.getNearbyStudents); // GET /api/students/nearby
router.put('/:id', studentController.updateStudent); // PUT /api/students/:id
router.get('/:id', studentController.getStudentDetail); // GET /api/students/:id

// 🛑 删除接口（需要 STUDENT.DELETE 权限）
router.delete('/:id', checkPermission(PERMISSIONS.STUDENT.DELETE), studentController.deleteStudent);

// 🛑 办理退课/退费接口（需要 ORDER.REFUND 权限）
router.post('/:id/drop', checkPermission(PERMISSIONS.ORDER.REFUND), studentController.dropClass);

module.exports = router;
