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
        <small v-if="currentLang === 'zh'">📍 中文模式：天地图 (WGS-84)</small>
        <small v-else>🌍 EN Mode: 3D Buildings Enabled</small>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, onUnmounted } from 'vue';
import axios from 'axios';
import mapboxgl from 'mapbox-gl';
import { LngLatBounds } from 'mapbox-gl'; // 引入边界计算工具
import 'mapbox-gl/dist/mapbox-gl.css';
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

  if (map.value) map.value.remove();

  map.value = new mapboxgl.Map({
    container: 'mapbox-heat',
    style: style,
    center: [116.3974, 39.9093], // 默认北京
    zoom: 10,
    pitch: currentLang.value === 'en' ? 45 : 0,
    bearing: currentLang.value === 'en' ? -17.6 : 0,
    maxZoom: 22, // 允许最大缩放
    antialias: true
  });

  map.value.on('load', () => {
    fetchDataAndRender();

    // 英文模式下添加 3D 建筑
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

// 获取数据并渲染
const fetchDataAndRender = async () => {
  try {
    const res = await axios.get('/api/students/locations');
    if (res.data.code === 200) {
      let geojson = res.data.data;
      pointCount.value = geojson.features.length;

      // 🛑 核心修改：删除了 gcoord 转换逻辑！
      // 因为现在中文底图是天地图 (WGS-84)，数据库也是 WGS-84，直接显示即可，不需要转换。

      // 添加数据源
      if (map.value.getSource('students')) {
         map.value.getSource('students').setData(geojson);
      } else {
         map.value.addSource('students', { type: 'geojson', data: geojson });
      }

      // 添加热力图层
      if (!map.value.getLayer('student-heat')) {
        map.value.addLayer({
          id: 'student-heat',
          type: 'heatmap',
          source: 'students',
          // ✅ 关键修复：允许热力图一直显示到 22 级 (之前是 15，导致自动聚焦后消失)
          maxzoom: 22,
          paint: {
            'heatmap-weight': 1,
            'heatmap-intensity': 1,
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0, 'rgba(33,102,172,0)',
              0.2, 'rgb(103,169,207)',
              0.6, 'rgb(253,219,199)',
              1, 'rgb(178,24,43)'
            ],
            'heatmap-radius': 20,
            'heatmap-opacity': 0.8
          }
        });
      }

      // 添加圆点层 (辅助显示具体位置)
      if (!map.value.getLayer('student-point')) {
        map.value.addLayer({
          id: 'student-point',
          type: 'circle',
          source: 'students',
          minzoom: 14, // 放大到 14 级才显示具体点
          paint: {
            'circle-radius': 5,
            'circle-color': 'white',
            'circle-stroke-color': '#409EFF',
            'circle-stroke-width': 2
          }
        });
      }

      // ✨ 自动聚焦：地图飞过去适应所有点
      if (geojson.features.length > 0) {
        const bounds = new LngLatBounds();
        geojson.features.forEach(feature => {
          bounds.extend(feature.geometry.coordinates);
        });

        map.value.fitBounds(bounds, {
          padding: 100, // 留白多一点，好看
          maxZoom: 15,  // 自动缩放最大不超过 15 (防止单点时放太大)
          duration: 1500 // 慢一点飞过去，更有质感
        });
      }
    }
  } catch (err) {
    console.error(err);
  }
};

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