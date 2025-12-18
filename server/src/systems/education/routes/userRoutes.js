const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/', userController.getUsers);
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser); // 修改基本信息
router.put('/:id/password', userController.resetPassword); // 专门重置密码

module.exports = router;

