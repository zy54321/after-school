/**
 * 人口构成分析路由
 */

const express = require('express');
const router = express.Router();
const demographicsController = require('../controllers/demographicsController');

// 单小区人口分析计算
router.post('/calculate', demographicsController.calculateSingle);

// 批量计算多个小区
router.post('/batch', demographicsController.calculateBatch);

// 获取算法元数据（系数表、基础分布等）
router.get('/metadata', demographicsController.getMetadata);

module.exports = router;

