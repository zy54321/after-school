/**
 * 权限管理路由
 */
const express = require('express');
const router = express.Router();
const permissionController = require('../controllers/permissionController');
const checkAuth = require('../../../shared/middleware/authMiddleware');
const { checkPermission } = require('../../../shared/middleware/permissionMiddleware');
const { PERMISSION } = require('../../../shared/constants/permissions');

// 权限管理接口（需要 permission:read 权限）
router.get('/permissions', 
  checkAuth, 
  checkPermission(PERMISSION.READ), 
  permissionController.getAllPermissions
);

router.get('/permissions/tree', 
  checkAuth, 
  checkPermission(PERMISSION.READ), 
  permissionController.getPermissionTree
);

// 角色管理接口（需要 role:manage 权限）
router.get('/roles', 
  checkAuth, 
  checkPermission(PERMISSION.ROLE_MANAGE), 
  permissionController.getAllRoles
);

router.post('/roles', 
  checkAuth, 
  checkPermission(PERMISSION.ROLE_MANAGE), 
  permissionController.createRole
);

router.put('/roles/:id', 
  checkAuth, 
  checkPermission(PERMISSION.ROLE_MANAGE), 
  permissionController.updateRole
);

router.delete('/roles/:id', 
  checkAuth, 
  checkPermission(PERMISSION.ROLE_MANAGE), 
  permissionController.deleteRole
);

// 角色权限管理接口（需要 permission:assign 权限）
router.get('/roles/:id/permissions', 
  checkAuth, 
  checkPermission(PERMISSION.READ), 
  permissionController.getRolePermissions
);

router.post('/roles/:id/permissions', 
  checkAuth, 
  checkPermission(PERMISSION.ASSIGN), 
  permissionController.assignRolePermissions
);

// 用户角色管理接口（需要 permission:assign 权限）
router.get('/users/:id/roles', 
  checkAuth, 
  checkPermission(PERMISSION.READ), 
  permissionController.getUserRoles
);

router.post('/users/:id/roles', 
  checkAuth, 
  checkPermission(PERMISSION.ASSIGN), 
  permissionController.assignUserRoles
);

router.delete('/users/:id/roles/:roleId', 
  checkAuth, 
  checkPermission(PERMISSION.ASSIGN), 
  permissionController.removeUserRole
);

// 当前用户权限接口（已登录用户即可）
router.get('/auth/permissions', 
  checkAuth, 
  permissionController.getCurrentUserPermissions
);

router.post('/auth/check-permission', 
  checkAuth, 
  permissionController.checkCurrentUserPermission
);

module.exports = router;

