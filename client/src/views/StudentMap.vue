<template>
  <div class="map-analysis-container">
    <div id="mapbox-heat" class="map-view"></div>

    <div class="control-panel">
      <h3>{{ $t('map.title') }}</h3>
      <div class="stat-item">
        <span class="label">{{ $t('map.totalPoints') }}:</span>
        <span class="value">{{ pointCount }}</span>
      </div>

      <div class="tip-box">
        <small v-if="currentLang === 'zh'">📍 中文模式：已校准火星坐标偏移</small>
        <small v-else>🌍 EN Mode: 3D Buildings Enabled</small>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, onUnmounted } from 'vue';
import axios from 'axios';
import mapboxgl from 'mapbox-gl';
// 🆕 引入 LngLatBounds
import { LngLatBounds } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import gcoord from 'gcoord';
import { useI18n } from 'vue-i18n';
import { MAPBOX_TOKEN, MAP_STYLES } from '../config/mapStyles';

// 设置 Token
mapboxgl.accessToken = MAPBOX_TOKEN;

const { locale } = useI18n();
const currentLang = computed(() => locale.value);
const map = ref(null);
const pointCount = ref(0);

// 初始化地图
const initMap = () => {
  const style = currentLang.value === 'zh' ? MAP_STYLES.zh : MAP_STYLES.en;

  // 防止重复初始化
  if (map.value) map.value.remove();

  map.value = new mapboxgl.Map({
    container: 'mapbox-heat',
    style: style,
    center: [116.3974, 39.9093],
    zoom: 10,
    pitch: currentLang.value === 'en' ? 45 : 0,
    bearing: currentLang.value === 'en' ? -17.6 : 0,
    // ⭐ 关键优化 3：统一放开最大缩放限制到 22
    // 之前中文模式锁死 18，现在放开，用户体验会更丝滑
    maxZoom: 22, 
    antialias: true
  });

  map.value.on('load', () => {
    fetchDataAndRender();

    // 如果是英文模式，额外加载 3D 建筑层
    if (currentLang.value === 'en') {
      add3DBuildings();
    }
  });
};

// 添加 3D 建筑 (仅英文模式)
const add3DBuildings = () => {
  const layers = map.value.getStyle().layers;
  const labelLayerId = layers.find(l => l.type === 'symbol' && l.layout['text-field'])?.id;

  map.value.addLayer({
    'id': '3d-buildings',
    'source': 'composite',
    'source-layer': 'building',
    'filter': ['==', 'extrude', 'true'],
    'type': 'fill-extrusion',
    'minzoom': 14,
    'paint': {
      'fill-extrusion-color': '#aaa',
      'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.05, ['get', 'height']],
      'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.05, ['get', 'min_height']],
      'fill-extrusion-opacity': 0.6
    }
  }, labelLayerId);
};

// 获取数据并渲染热力图
const fetchDataAndRender = async () => {
  try {
    const res = await axios.get('/api/students/locations');
    if (res.data.code === 200) {
      let geojson = res.data.data;
      pointCount.value = geojson.features.length;

      // 🔄 坐标转换逻辑 (保持不变)
      // if (currentLang.value === 'zh') {
      //   geojson.features = geojson.features.map(f => {
      //     const converted = gcoord.transform(f.geometry.coordinates, gcoord.WGS84, gcoord.GCJ02);
      //     return { ...f, geometry: { ...f.geometry, coordinates: converted } };
      //   });
      // }
      
      // ⭐ 新增：自动聚焦逻辑
      if (geojson.features.length > 0) {
        // 1. 创建一个空的边界对象
        const bounds = new LngLatBounds();

        // 2. 把所有点都塞进去
        geojson.features.forEach(feature => {
          bounds.extend(feature.geometry.coordinates);
        });

        // 3. 让地图飞过去适应这个边界 (留点 padding 边距)
        map.value.fitBounds(bounds, {
          padding: 50,
          maxZoom: 15, // 防止只有一个点时缩放太大
          duration: 1000 // 动画时长
        });
      }
    }
  } catch (err) {
    console.error(err);
  }
};

// 监听语言变化，重新初始化地图
watch(currentLang, () => {
  initMap();
});

onMounted(() => {
  initMap();
});

onUnmounted(() => {
  if (map.value) map.value.remove();
});
</script>

<style scoped>
.map-analysis-container {
  position: relative;
  width: 100%;
  height: calc(100vh - 80px);
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #dcdfe6;
}

.map-view {
  width: 100%;
  height: 100%;
}

.control-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(5px);
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  min-width: 200px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  font-size: 14px;
}

.value {
  font-weight: bold;
  color: #409EFF;
}

.tip-box {
  margin-top: 10px;
  color: #909399;
  border-top: 1px solid #eee;
  padding-top: 10px;
}
</style>