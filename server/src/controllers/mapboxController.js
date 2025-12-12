// ⚠️ 你的 Mapbox Token (建议后续放入 .env 文件)
const MAPBOX_TOKEN = 'pk.eyJ1IjoiMnZlbHQiLCJhIjoiY21hZzA5bWx0MDd2ODJpb2toeWpvY3lpNSJ9.0tb_XUj-FgS0Uei1Efy7Qg';

const searchPlaces = async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ code: 400, msg: 'Query parameter required' });
  }

  try {
    // 后端请求 Mapbox (服务器之间无跨域限制)
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=5`;
    
    // Node.js 原生 fetch
    const response = await fetch(url);
    const data = await response.json();

    if (response.ok) {
      res.json({
        code: 200,
        data: data // 直接把 Mapbox 的 GeoJSON 结果传回去
      });
    } else {
      res.status(response.status).json({
        code: response.status,
        msg: data.message || 'Mapbox API error'
      });
    }
  } catch (err) {
    console.error('Mapbox proxy error:', err);
    res.status(500).json({ code: 500, msg: 'Server network error' });
  }
};

module.exports = { searchPlaces };