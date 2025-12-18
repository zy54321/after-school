const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

router.post('/', orderController.createOrder); // POST /api/orders
router.get('/', orderController.getOrders); // GET /api/orders

module.exports = router;

