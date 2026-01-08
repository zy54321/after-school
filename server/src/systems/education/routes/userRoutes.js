const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// ✅ 引入权限中间件
const requirePermission = require('../../../shared/middleware/requirePermission');

// 1. 获取员工列表 -> 需要 'edu:user:view'
router.get('/', requirePermission('edu:user:view'), userController.getUsers);

// 2. 新增员工 -> 需要 'edu:user:manage'
router.post('/', requirePermission('edu:user:manage'), userController.createUser);

// 3. 修改员工信息 (包括权限配置) -> 必须严格检查 'edu:user:manage'
router.put('/:id', requirePermission('edu:user:manage'), userController.updateUser);

// 4. 重置密码 -> 需要 'edu:user:manage'
router.post('/:id/reset-password', requirePermission('edu:user:manage'), userController.resetPassword);

module.exports = router;