require('dotenv').config(); // 确保加载环境变量

// ✅ 从环境变量读取 Key，并清理可能的格式问题
let AMAP_KEY = process.env.AMAP_WEB_KEY;
if (AMAP_KEY) {
  // 去除首尾空格、引号、分号等常见格式问题
  AMAP_KEY = AMAP_KEY.trim().replace(/^["']|["']$/g, '').replace(/[;\s]+$/, '');
}

const searchTips = async (req, res) => {
  const { keywords, city } = req.query;

  if (!AMAP_KEY) {
    console.error('❌ 未配置 AMAP_WEB_KEY');
    return res.status(500).json({ code: 500, msg: '服务器配置错误：未配置高德地图API密钥，请在环境变量中设置 AMAP_WEB_KEY' });
  }

  // 仅在密钥格式异常时警告
  if (AMAP_KEY && AMAP_KEY.length !== 32) {
    console.warn('⚠️ 警告：高德API密钥通常应该是32位字符，当前长度:', AMAP_KEY.length);
    console.warn('⚠️ 请检查 .env 文件中的 AMAP_WEB_KEY 配置，确保没有多余的空格、引号或分号');
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
      // 更详细的错误信息
      const errorMsg = data.info || '高德 API 报错';
      console.error('❌ 高德API错误:', errorMsg, 'Status:', data.status);
      
      // 针对常见错误提供更友好的提示
      if (errorMsg.includes('INVALID_USER_KEY')) {
        return res.status(500).json({ 
          code: 500, 
          msg: '高德地图API密钥无效。请检查环境变量 AMAP_WEB_KEY 是否正确配置，或密钥是否已过期。' 
        });
      }
      
      res.json({ code: 500, msg: errorMsg });
    }
  } catch (err) {
    console.error('❌ 高德搜索代理失败:', err);
    res.status(500).json({ code: 500, msg: '服务器网络错误: ' + err.message });
  }
};

module.exports = { searchTips };

