const express = require('express');
const router = express.Router();
const controller = require('../controllers/cateringController');
const checkAuth = require('../../../shared/middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- 📷 配置图片上传 (Multer) ---
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'uploads/';
    // 自动创建文件夹 (如果不存在)
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    // 生成文件名: 时间戳 + 随机数 + 原后缀 (如: 16899999_123.jpg)
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// 所有接口都需要登录权限
router.use(checkAuth);

// 📷 上传接口 (新增)
router.post('/upload', upload.single('file'), controller.uploadImage);

// 🥦 食材接口
router.get('/ingredients', controller.getIngredients);
router.post('/ingredients', controller.createIngredient);
router.put('/ingredients/:id', controller.updateIngredient);
router.delete('/ingredients/:id', controller.deleteIngredient);

// 🍲 菜品接口
router.get('/dishes', controller.getDishes);
router.post('/dishes', controller.createDish);
router.put('/dishes/:id', controller.updateDish);
router.delete('/dishes/:id', controller.deleteDish);

// 📅 食谱排期接口
router.get('/menus', controller.getMenus);      
router.post('/menus', controller.addMenuItem);
router.delete('/menus/:id', controller.removeMenuItem);
router.get('/shopping-list', controller.getShoppingList);
router.get('/cost-analysis', controller.getCostAnalysis);

module.exports = router;