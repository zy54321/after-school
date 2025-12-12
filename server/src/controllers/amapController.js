const AMAP_KEY = 'fe8481244d7d2f5f370d1c93adb9a9db';

const searchTips = async (req, res) => {
  const { keywords, city } = req.query;

  if (!keywords) {
    return res.status(400).json({ code: 400, msg: 'Keywords required' });
  }

  try {
    // 动态构建 URL
    // 如果有 city，就拼上去；如果没有，就不拼（高德默认搜全国）
    let url = `https://restapi.amap.com/v3/assistant/inputtips?key=${AMAP_KEY}&keywords=${encodeURIComponent(
      keywords
    )}`;

    if (city) {
      url += `&city=${encodeURIComponent(city)}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === '1') {
      res.json({
        code: 200,
        data: data.tips,
      });
    } else {
      res.json({
        code: 500,
        msg: data.info || '高德 API 报错',
      });
    }
  } catch (err) {
    console.error('高德搜索代理失败:', err);
    res.status(500).json({ code: 500, msg: '服务器网络错误' });
  }
};

module.exports = { searchTips };
