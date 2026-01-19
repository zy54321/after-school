const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { checkPermission } = require('../../../shared/middleware/permissionMiddleware');
const PERMISSIONS = require('../../../shared/constants/permissions');

// 用户管理路由（RBAC 权限控制）
router.get('/', checkPermission(PERMISSIONS.USER.READ), userController.getUsers);
router.post('/', checkPermission(PERMISSIONS.USER.CREATE), userController.createUser);
router.put('/:id', checkPermission(PERMISSIONS.USER.UPDATE), userController.updateUser);
router.put('/:id/password', checkPermission(PERMISSIONS.USER.RESET_PASSWORD), userController.resetPassword);

module.exports = router;
