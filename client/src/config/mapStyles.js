// ⚠️ 重要：请去 mapbox.com 注册一个账号，复制你的 Default Public Token 替换下面这个
export const MAPBOX_TOKEN = 'pk.eyJ1IjoiMnZlbHQiLCJhIjoiY21hZzA5bWx0MDd2ODJpb2toeWpvY3lpNSJ9.0tb_XUj-FgS0Uei1Efy7Qg'; 

export const MAP_STYLES = {
  // 🇺🇸 英文模式：Mapbox 官方暗黑矢量底图 (支持 3D 建筑)
  en: 'mapbox://styles/mapbox/dark-v11', 

  // 🇨🇳 中文模式：高德地图栅格瓦片 (GCJ-02 坐标系)
  zh: {
    version: 8,
    sources: {
      'amap-tiles': {
        type: 'raster',
        tiles: [
          // 高德卫星图 (如需标准路网，把 style=6 改为 style=7)
          'https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}'
        ],
        tileSize: 256
      }
    },
    layers: [
      {
        id: 'amap-layer',
        type: 'raster',
        source: 'amap-tiles',
        minzoom: 0,
        maxzoom: 18
      }
    ]
  }
};