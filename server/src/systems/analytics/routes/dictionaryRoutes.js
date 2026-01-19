const express = require('express');
const router = express.Router();
const dictionaryController = require('../controllers/dictionaryController');
const { checkPermission } = require('../../../shared/middleware/permissionMiddleware');
const PERMISSIONS = require('../../../shared/constants/permissions');

// ============================================
// 字典类型路由
// ============================================

// 获取类型列表（可按 geometry_type 筛选）
router.get('/types', dictionaryController.getTypes);

// 获取单个类型详情（包含字段）
router.get('/types/:id', dictionaryController.getTypeById);

// 创建类型（需要 MAP.MANAGE 权限）
router.post('/types', checkPermission(PERMISSIONS.MAP.MANAGE), dictionaryController.createType);

// 更新类型（需要 MAP.MANAGE 权限）
router.put('/types/:id', checkPermission(PERMISSIONS.MAP.MANAGE), dictionaryController.updateType);

// 删除类型（需要 MAP.MANAGE 权限）
router.delete('/types/:id', checkPermission(PERMISSIONS.MAP.MANAGE), dictionaryController.deleteType);

// ============================================
// 字典字段路由
// ============================================

// 获取字段列表（按 type_id 筛选）
router.get('/fields', dictionaryController.getFields);

// 获取单个字段详情
router.get('/fields/:id', dictionaryController.getFieldById);

// 创建字段（需要 MAP.MANAGE 权限）
router.post('/fields', checkPermission(PERMISSIONS.MAP.MANAGE), dictionaryController.createField);

// 更新字段（需要 MAP.MANAGE 权限）
router.put('/fields/:id', checkPermission(PERMISSIONS.MAP.MANAGE), dictionaryController.updateField);

// 删除字段（需要 MAP.MANAGE 权限）
router.delete('/fields/:id', checkPermission(PERMISSIONS.MAP.MANAGE), dictionaryController.deleteField);

// ============================================
// 完整配置路由（用于前端）
// ============================================

// 获取完整配置（类型+字段，可按 geometry_type 筛选）
router.get('/full', dictionaryController.getFullConfig);

module.exports = router;
