const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');

// 定义 POST /api/login 的处理函数
router.post('/', attendanceController.checkIn);

module.exports = router;

