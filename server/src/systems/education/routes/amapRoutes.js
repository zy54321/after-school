const express = require('express');
const router = express.Router();
const amapController = require('../controllers/amapController');

// 定义路由: GET /api/amap/tips
router.get('/tips', amapController.searchTips);

module.exports = router;

