/**
 * 高德地图配置
 * 
 * 使用说明：
 * 1. 访问 https://console.amap.com/dev/key/app 申请 Key
 * 2. 将申请的 Key 替换下面的 AMAP_KEY
 * 3. 确保 Key 的安全设置中允许你的域名使用
 */

// 高德地图 Key（请替换为你的 Key）
// export const AMAP_KEY = import.meta.env.VITE_AMAP_KEY || 'YOUR_AMAP_KEY';
export const AMAP_KEY = import.meta.env.VITE_AMAP_KEY || '1f0ba3179fd1681394cb0f4ff7f76d0b';

// 高德地图配置
export const AMAP_CONFIG = {
  key: AMAP_KEY,
  version: '2.0',
  plugins: ['AMap.Geocoder', 'AMap.Geolocation', 'AMap.AutoComplete', 'AMap.PlaceSearch']
};

