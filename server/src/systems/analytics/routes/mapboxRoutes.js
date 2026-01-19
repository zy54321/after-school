const express = require('express');
const router = express.Router();
const mapboxController = require('../controllers/mapboxController');
const { checkPermission } = require('../../../shared/middleware/permissionMiddleware');
const PERMISSIONS = require('../../../shared/constants/permissions');

// 1. 地点搜索（只读，无需权限检查）
router.get('/places', mapboxController.searchPlaces);

// 2. 获取所有地图要素（只读，无需权限检查）
router.get('/features', mapboxController.getFeatures);

// 3. 保存新要素（需要 map:manage 权限）
router.post('/features', checkPermission(PERMISSIONS.MAP.MANAGE), mapboxController.createFeature);

// 4. 更新要素（需要 map:manage 权限）
router.put('/features/:id', checkPermission(PERMISSIONS.MAP.MANAGE), mapboxController.updateFeature);

// 5. 删除要素（需要 map:manage 权限）
router.delete('/features/:id', checkPermission(PERMISSIONS.MAP.MANAGE), mapboxController.deleteFeature);

module.exports = router;
