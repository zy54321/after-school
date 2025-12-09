// server/src/routes/studentRoutes.js
const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
// 引入管理员中间件
const checkAdmin = require('../middleware/adminMiddleware');

// 定义路径
router.get('/', studentController.getStudents);   // GET /api/students
router.post('/', studentController.createStudent); // POST /api/students
router.put('/:id', studentController.updateStudent); // PUT /api/students/:id
router.get('/:id', studentController.getStudentDetail);

// 🛑 给删除接口加锁
router.delete('/:id', checkAdmin, studentController.deleteStudent);
// 🛑 办理退课/退费接口 (管理员权限)
router.post('/:id/drop', checkAdmin, studentController.dropClass);

module.exports = router;