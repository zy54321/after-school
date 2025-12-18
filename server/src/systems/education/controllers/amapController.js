require('dotenv').config(); // 确保加载环境变量

// ✅ 从环境变量读取 Key
const AMAP_KEY = process.env.AMAP_WEB_KEY;

const searchTips = async (req, res) => {
  const { keywords, city } = req.query;

  if (!AMAP_KEY) {
    console.error('❌ 未配置 AMAP_WEB_KEY');
    return res.status(500).json({ code: 500, msg: '服务器配置错误' });
  }

  if (!keywords) {
    return res.status(400).json({ code: 400, msg: 'Keywords required' });
  }

  try {
    let url = `https://restapi.amap.com/v3/assistant/inputtips?key=${AMAP_KEY}&keywords=${encodeURIComponent(keywords)}`;
    if (city) {
      url += `&city=${encodeURIComponent(city)}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === '1') {
      res.json({ code: 200, data: data.tips });
    } else {
      res.json({ code: 500, msg: data.info || '高德 API 报错' });
    }
  } catch (err) {
    console.error('高德搜索代理失败:', err);
    res.status(500).json({ code: 500, msg: '服务器网络错误' });
  }
};

module.exports = { searchTips };

