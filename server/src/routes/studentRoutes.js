// server/src/routes/studentRoutes.js
const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');

// 定义路径
router.get('/', studentController.getStudents);   // GET /api/students
router.post('/', studentController.createStudent); // POST /api/students

module.exports = router;