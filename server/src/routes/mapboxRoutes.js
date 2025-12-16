const express = require('express');
const router = express.Router();
const mapboxController = require('../controllers/mapboxController');

// 1. 地点搜索
router.get('/places', mapboxController.searchPlaces);

// 2. 获取所有地图要素
router.get('/features', mapboxController.getFeatures);

// 3. 保存新要素
router.post('/features', mapboxController.createFeature);

// 4. 删除要素
router.delete('/features/:id', mapboxController.deleteFeature);

module.exports = router;