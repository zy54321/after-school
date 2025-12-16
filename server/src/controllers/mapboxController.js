require('dotenv').config();
const pool = require('../config/db');

// ✅ 从环境变量读取 Token
const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;

const searchPlaces = async (req, res) => {
  const { query } = req.query;

  if (!MAPBOX_TOKEN) {
    console.error('❌ 未配置 MAPBOX_TOKEN');
    return res.status(500).json({ code: 500, msg: '服务器配置错误' });
  }

  if (!query) {
    return res.status(400).json({ code: 400, msg: 'Query parameter required' });
  }

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      query
    )}.json?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=5`;

    const response = await fetch(url);
    const data = await response.json();

    if (response.ok) {
      res.json({ code: 200, data: data });
    } else {
      res
        .status(response.status)
        .json({
          code: response.status,
          msg: data.message || 'Mapbox API error',
        });
    }
  } catch (err) {
    console.error('Mapbox proxy error:', err);
    res.status(500).json({ code: 500, msg: 'Server network error' });
  }
};

const getFeatures = async (req, res) => {
  try {
    // ST_AsGeoJSON 直接把数据库的 geometry 转成 GeoJSON 格式
    const query = `
      SELECT 
        id, name, feature_type, category, properties, 
        ST_AsGeoJSON(geom)::json as geometry 
      FROM market_features
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query);

    // 构造成 Mapbox 标准的 GeoJSON FeatureCollection
    const geoJson = {
      type: 'FeatureCollection',
      features: result.rows.map((row) => ({
        type: 'Feature',
        id: row.id,
        properties: {
          ...row.properties, // 展开 JSONB 属性
          id: row.id, // 确保 ID 在 properties 里也有，方便前端点击
          name: row.name,
          category: row.category,
          feature_type: row.feature_type,
        },
        geometry: row.geometry,
      })),
    };

    res.json({ code: 200, data: geoJson });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, msg: '获取地图数据失败' });
  }
};

const createFeature = async (req, res) => {
  const { name, feature_type, category, properties, geometry } = req.body;

  try {
    const query = `
      INSERT INTO market_features (name, feature_type, category, properties, geom)
      VALUES ($1, $2, $3, $4, ST_SetSRID(ST_GeomFromGeoJSON($5), 4326))
      RETURNING id
    `;

    const values = [
      name,
      feature_type,
      category,
      properties || {},
      JSON.stringify(geometry),
    ];

    const result = await pool.query(query, values);

    res.json({
      code: 200,
      msg: '保存成功',
      data: { id: result.rows[0].id },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, msg: '保存地图数据失败' });
  }
};

module.exports = { searchPlaces, getFeatures, createFeature };
