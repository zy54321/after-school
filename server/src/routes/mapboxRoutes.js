const express = require('express');
const router = express.Router();
const mapboxController = require('../controllers/mapboxController');

// 定义路由: GET /api/mapbox/places
router.get('/places', mapboxController.searchPlaces);

module.exports = router;