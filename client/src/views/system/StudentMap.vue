<template>
  <div class="map-analysis-container">
    <div id="mapbox-heat" class="map-view"></div>

    <div class="search-panel">
      <el-input-number v-model="searchRadius" :min="500" :max="10000" :step="500" size="small"
        style="width: 120px; margin-right: 10px;" />
      <span class="unit">米</span>
      <el-button type="primary" @click="handleNearbySearch" :loading="searching" round>
        🔍 搜周边 ({{ searchRadius / 1000 }}km)
      </el-button>
      <el-button v-if="isFiltering" @click="resetMap" circle icon="Close" title="重置" />
    </div>

    <div class="control-panel">
      <h3>{{ $t('map.title') }}</h3>
      <div class="stat-item">
        <span class="label">当前显示:</span>
        <span class="value">{{ pointCount }}</span>
      </div>
      <div class="tip-box">
        <small v-if="currentLang === 'zh'">拖动地图设定圆心 -> 点击搜索</small>
        <small v-else>Drag map to set center -> Click Search</small>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, onUnmounted } from 'vue';
import axios from 'axios';
import mapboxgl from 'mapbox-gl';
import { LngLatBounds } from 'mapbox-gl';
import * as turf from '@turf/turf'; // 🟢 引入 Turf
import 'mapbox-gl/dist/mapbox-gl.css';
import { useI18n } from 'vue-i18n';
import { MAPBOX_TOKEN, MAP_STYLES } from '../../config/mapStyles';

mapboxgl.accessToken = MAPBOX_TOKEN;

const { locale } = useI18n();
const currentLang = computed(() => locale.value);
const map = ref(null);
const pointCount = ref(0);
const allFeatures = ref([]); // 存一份原始数据备份

// 🟢 新增状态
const searchRadius = ref(3000); // 默认 3公里
const searching = ref(false);
const isFiltering = ref(false);

const initMap = () => {
  const style = currentLang.value === 'zh' ? MAP_STYLES.zh : MAP_STYLES.en;
  if (map.value) map.value.remove();

  map.value = new mapboxgl.Map({
    container: 'mapbox-heat',
    style: style,
    center: [116.3974, 39.9093],
    zoom: 10,
    maxZoom: 22,
    antialias: true
  });

  map.value.on('load', () => {
    fetchDataAndRender();
    addCenterCrosshair(); // ➕ 添加十字准星
  });
};

// ➕ 在地图中间加一个十字准星，方便用户对准
const addCenterCrosshair = () => {
  const crosshair = document.createElement('div');
  crosshair.className = 'crosshair';
  // 直接用 CSS 画一个十字
  crosshair.innerHTML = `
    <svg viewBox="0 0 100 100" width="20" height="20" style="display:block;">
      <line x1="50" y1="0" x2="50" y2="100" stroke="#ff0000" stroke-width="8" />
      <line x1="0" y1="50" x2="100" y2="50" stroke="#ff0000" stroke-width="8" />
    </svg>
  `;
  // 利用 Mapbox Marker 把它固定在地图中心，但我们要让它一直悬浮在屏幕中心
  // 简单的做法是绝对定位 div
  const mapContainer = document.getElementById('mapbox-heat');
  crosshair.style.position = 'absolute';
  crosshair.style.top = '50%';
  crosshair.style.left = '50%';
  crosshair.style.transform = 'translate(-50%, -50%)';
  crosshair.style.zIndex = '10';
  crosshair.style.pointerEvents = 'none'; // 不阻挡点击
  mapContainer.appendChild(crosshair);
};

// 🟢 核心功能：周边搜索
const handleNearbySearch = async () => {
  if (!map.value) return;
  searching.value = true;
  isFiltering.true;

  try {
    // 1. 获取当前地图中心点 (用户拖哪儿就算哪儿)
    const center = map.value.getCenter();
    const lng = center.lng;
    const lat = center.lat;

    // 2. 调用后端 PostGIS 接口
    const res = await axios.get('/api/students/nearby', {
      params: { lng, lat, radius: searchRadius.value }
    });

    if (res.data.code === 200) {
      const students = res.data.data;
      pointCount.value = students.length;

      // 3. 在地图上画一个圆圈 (Visual)
      drawSearchCircle([lng, lat], searchRadius.value);

      // 4. 更新地图数据源，只显示搜到的点
      // 构造 GeoJSON
      const newGeoJSON = {
        type: 'FeatureCollection',
        features: students.map(s => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [Number(s.longitude), Number(s.latitude)]
          },
          properties: { id: s.id, name: s.name } // 这里可以放更多字段
        }))
      };

      map.value.getSource('students').setData(newGeoJSON);
      isFiltering.value = true;

      // 5. 自动缩放到圆圈大小
      const bounds = turf.bbox(turf.circle([lng, lat], searchRadius.value / 1000, { units: 'kilometers' }));
      map.value.fitBounds(bounds, { padding: 50 });
    }
  } catch (err) {
    console.error(err);
    alert('搜索失败，请检查网络');
  } finally {
    searching.value = false;
  }
};

// 🎨 辅助：画圆圈
const drawSearchCircle = (center, radiusMeters) => {
  // 使用 Turf 生成圆的 GeoJSON Polygon
  const radiusKm = radiusMeters / 1000;
  const circleGeoJSON = turf.circle(center, radiusKm, {
    steps: 64,
    units: 'kilometers'
  });

  // 如果图层已存在，更新数据；否则添加图层
  if (map.value.getSource('search-circle')) {
    map.value.getSource('search-circle').setData(circleGeoJSON);
  } else {
    map.value.addSource('search-circle', {
      type: 'geojson',
      data: circleGeoJSON
    });
    // 圆的填充色
    map.value.addLayer({
      id: 'search-circle-fill',
      type: 'fill',
      source: 'search-circle',
      paint: {
        'fill-color': '#409EFF',
        'fill-opacity': 0.15
      }
    });
    // 圆的边框
    map.value.addLayer({
      id: 'search-circle-line',
      type: 'line',
      source: 'search-circle',
      paint: {
        'line-color': '#409EFF',
        'line-width': 2,
        'line-dasharray': [2, 2]
      }
    });
  }
};

// 🔄 重置地图
const resetMap = () => {
  fetchDataAndRender(); // 重新拉取所有数据
  // 清除圆圈
  if (map.value.getSource('search-circle')) {
    map.value.getSource('search-circle').setData({ type: 'FeatureCollection', features: [] });
  }
  isFiltering.value = false;
  // 恢复视野
  map.value.flyTo({ zoom: 10, pitch: 0 });
};

const fetchDataAndRender = async () => {
  try {
    const res = await axios.get('/api/students/locations');
    if (res.data.code === 200) {
      let geojson = res.data.data;
      allFeatures.value = geojson.features; // 备份原始数据
      pointCount.value = geojson.features.length;

      if (map.value.getSource('students')) {
        map.value.getSource('students').setData(geojson);
      } else {
        map.value.addSource('students', { type: 'geojson', data: geojson });
      }

      // 添加热力图层和点图层 (保持原有逻辑)
      addLayers();

      // 只有在非搜索模式下才自动 fitBounds
      if (!isFiltering.value && geojson.features.length > 0) {
        const bounds = new LngLatBounds();
        geojson.features.forEach(f => bounds.extend(f.geometry.coordinates));
        map.value.fitBounds(bounds, { padding: 50, maxZoom: 15 });
      }
    }
  } catch (err) { console.error(err); }
};

// 把添加图层的逻辑抽离出来，方便复用
const addLayers = () => {
  // 热力图
  if (!map.value.getLayer('student-heat')) {
    map.value.addLayer({
      id: 'student-heat',
      type: 'heatmap',
      source: 'students',
      maxzoom: 22,
      paint: {
        'heatmap-weight': 1,
        'heatmap-intensity': 1,
        'heatmap-color': [
          'interpolate', ['linear'], ['heatmap-density'],
          0, 'rgba(33,102,172,0)', 0.2, 'rgb(103,169,207)', 0.6, 'rgb(253,219,199)', 1, 'rgb(178,24,43)'
        ],
        'heatmap-radius': 20,
        'heatmap-opacity': 0.8
      }
    });
  }
  // 具体圆点
  if (!map.value.getLayer('student-point')) {
    map.value.addLayer({
      id: 'student-point',
      type: 'circle',
      source: 'students',
      minzoom: 13, // 稍微调整可见层级
      paint: {
        'circle-radius': 6,
        'circle-color': '#fff',
        'circle-stroke-color': '#ff0000',
        'circle-stroke-width': 2
      }
    });
  }
};

watch(currentLang, () => initMap());
onMounted(() => initMap());
onUnmounted(() => { if (map.value) map.value.remove(); });
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

/* 新增搜索栏样式 */
.search-panel {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 10;
  background: white;
  padding: 10px;
  border-radius: 30px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
}

.unit {
  margin-right: 10px;
  font-size: 12px;
  color: #666;
}

.control-panel {
  position: absolute;
  bottom: 30px;
  /* 移到底部，防止遮挡右上角 */
  right: 20px;
  background: rgba(255, 255, 255, 0.95);
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  min-width: 180px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
  font-size: 14px;
}

.value {
  font-weight: bold;
  color: #409EFF;
}

.tip-box {
  margin-top: 5px;
  color: #909399;
  border-top: 1px solid #eee;
  padding-top: 5px;
  font-size: 12px;
}
</style>