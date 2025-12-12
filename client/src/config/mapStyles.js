// ⚠️ 重要：请去 mapbox.com 注册一个账号，复制你的 Default Public Token 替换下面这个
export const MAPBOX_TOKEN =
  'pk.eyJ1IjoiMnZlbHQiLCJhIjoiY21hZzA5bWx0MDd2ODJpb2toeWpvY3lpNSJ9.0tb_XUj-FgS0Uei1Efy7Qg';

const TDT_KEY = 'ff4b996af3c1c7fa2c25b2f8af860e07';

export const MAP_STYLES = {
  // 🇺🇸 英文模式：Mapbox 官方暗黑矢量底图 (支持 3D 建筑)
  en: 'mapbox://styles/mapbox/dark-v11',

  // 🇨🇳 中文模式：高德地图栅格瓦片 (GCJ-02 坐标系)
  zh: {
    version: 8,
    sources: {
      'tdt-vec': {
        type: 'raster',
        tiles: [
          // 天地图矢量底图 (球面墨卡托)
          `https://t0.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TDT_KEY}`,
        ],
        tileSize: 256,
        maxzoom: 18,
      },
      'tdt-cva': {
        type: 'raster',
        tiles: [
          // 天地图文字注记 (球面墨卡托)
          `https://t0.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TDT_KEY}`,
        ],
        tileSize: 256,
        maxzoom: 18,
      },
    },
    layers: [
      {
        id: 'tdt-vec-layer',
        type: 'raster',
        source: 'tdt-vec',
        minzoom: 0,
        maxzoom: 22,
      },
      {
        id: 'tdt-cva-layer',
        type: 'raster',
        source: 'tdt-cva',
        minzoom: 0,
        maxzoom: 22,
      },
    ],
  },
};
