/**
 * 权限管理路由
 */
const express = require('express');
const router = express.Router();
const permissionController = require('../controllers/permissionController');
const checkAuth = require('../../../shared/middleware/authMiddleware');
const { checkPermission } = require('../../../shared/middleware/permissionMiddleware');
const PERMISSIONS = require('../../../shared/constants/permissions');

// 权限管理接口（需要 permission:read 权限）
router.get('/permissions', 
  checkAuth, 
  checkPermission(PERMISSIONS.PERMISSION.READ), 
  permissionController.getAllPermissions
);

router.get('/permissions/tree', 
  checkAuth, 
  checkPermission(PERMISSIONS.PERMISSION.READ), 
  permissionController.getPermissionTree
);

// 角色管理接口（需要 permission:manage 权限）
router.get('/roles', 
  checkAuth, 
  checkPermission(PERMISSIONS.PERMISSION.MANAGE), 
  permissionController.getAllRoles
);

router.post('/roles', 
  checkAuth, 
  checkPermission(PERMISSIONS.PERMISSION.MANAGE), 
  permissionController.createRole
);

router.put('/roles/:id', 
  checkAuth, 
  checkPermission(PERMISSIONS.PERMISSION.MANAGE), 
  permissionController.updateRole
);

router.delete('/roles/:id', 
  checkAuth, 
  checkPermission(PERMISSIONS.PERMISSION.MANAGE), 
  permissionController.deleteRole
);

// 角色权限管理接口（需要 permission:manage 权限）
router.get('/roles/:id/permissions', 
  checkAuth, 
  checkPermission(PERMISSIONS.PERMISSION.READ), 
  permissionController.getRolePermissions
);

router.post('/roles/:id/permissions', 
  checkAuth, 
  checkPermission(PERMISSIONS.PERMISSION.MANAGE), 
  permissionController.assignRolePermissions
);

// 用户角色管理接口（需要 permission:manage 权限）
router.get('/users/:id/roles', 
  checkAuth, 
  checkPermission(PERMISSIONS.PERMISSION.READ), 
  permissionController.getUserRoles
);

router.post('/users/:id/roles', 
  checkAuth, 
  checkPermission(PERMISSIONS.PERMISSION.MANAGE), 
  permissionController.assignUserRoles
);

router.delete('/users/:id/roles/:roleId', 
  checkAuth, 
  checkPermission(PERMISSIONS.PERMISSION.MANAGE), 
  permissionController.removeUserRole
);

// 当前用户权限接口（已登录用户即可，用于前端权限初始化）
router.get('/auth/permissions', 
  checkAuth, 
  permissionController.getCurrentUserPermissions
);

router.post('/auth/check-permission', 
  checkAuth, 
  permissionController.checkCurrentUserPermission
);

module.exports = router;
