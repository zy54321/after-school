// ✅ 从环境变量读取
export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const TDT_KEY = import.meta.env.VITE_TDT_KEY;

// ⚠️ 检查 Key 是否存在 (开发时的友好提示)
if (!MAPBOX_TOKEN) console.error('Missing VITE_MAPBOX_TOKEN in client/.env');
if (!TDT_KEY) console.error('Missing VITE_TDT_KEY in client/.env');

export const MAP_STYLES = {
  // 🇺🇸 英文模式：Mapbox
  en: 'mapbox://styles/mapbox/dark-v11', 

  // 🇨🇳 中文模式：天地图 (WGS-84)
  zh: {
    version: 8,
    sources: {
      'tdt-vec': {
        type: 'raster',
        tiles: [
          `https://t0.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TDT_KEY}`
        ],
        tileSize: 256
      },
      'tdt-cva': {
        type: 'raster',
        tiles: [
          `https://t0.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TDT_KEY}`
        ],
        tileSize: 256
      }
    },
    layers: [
      {
        id: 'tdt-vec-layer',
        type: 'raster',
        source: 'tdt-vec',
        minzoom: 0,
        maxzoom: 22
      },
      {
        id: 'tdt-cva-layer',
        type: 'raster',
        source: 'tdt-cva',
        minzoom: 0,
        maxzoom: 22
      }
    ]
  }
};