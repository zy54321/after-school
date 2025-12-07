const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// 定义 POST /api/login 的处理函数
router.post('/login', authController.login);

// 未来可以在这里加: router.post('/logout', ...) 或 router.post('/reset-password', ...)

module.exports = router;