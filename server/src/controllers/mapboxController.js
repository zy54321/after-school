require('dotenv').config();

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
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=5`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (response.ok) {
      res.json({ code: 200, data: data });
    } else {
      res.status(response.status).json({ code: response.status, msg: data.message || 'Mapbox API error' });
    }
  } catch (err) {
    console.error('Mapbox proxy error:', err);
    res.status(500).json({ code: 500, msg: 'Server network error' });
  }
};

module.exports = { searchPlaces };