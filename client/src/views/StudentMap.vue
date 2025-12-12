<template>
  <div class="map-analysis-container">
    <div id="ol-map" class="map-view"></div>
    
    <div class="control-panel">
      <h3>{{ $t('map.title') }}</h3>
      <div class="stat-item">
        <span class="label">{{ $t('map.totalPoints') }}:</span>
        <span class="value">{{ pointCount }}</span>
      </div>
      <div class="slider-item">
        <span class="label">{{ $t('map.blur') }}:</span>
        <el-slider v-model="blur" :min="1" :max="50" size="small" @input="updateHeatmap" />
      </div>
      <div class="slider-item">
        <span class="label">{{ $t('map.radius') }}:</span>
        <el-slider v-model="radius" :min="1" :max="50" size="small" @input="updateHeatmap" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';

// OpenLayers 核心模块
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import { Tile as TileLayer, Heatmap as HeatmapLayer } from 'ol/layer';
import { OSM } from 'ol/source';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { fromLonLat } from 'ol/proj';

const map = ref(null);
const heatmapLayer = ref(null);
const pointCount = ref(0);
const blur = ref(15);
const radius = ref(10);

// 初始化地图
const initMap = () => {
  // 1. 创建底图图层 (使用 OpenStreetMap，完全免费且国际化)
  const raster = new TileLayer({
    source: new OSM()
  });

  // 2. 创建热力图数据源 (暂时为空，稍后填入)
  const vectorSource = new VectorSource({
    features: [] 
  });

  // 3. 创建热力图层
  heatmapLayer.value = new HeatmapLayer({
    source: vectorSource,
    blur: blur.value,
    radius: radius.value,
    weight: function (feature) {
      // 这里可以根据 properties.weight 动态调整热力权重
      // 目前默认都是 1，未来可以改成"剩余课时越多，热力越强"
      return feature.get('weight') || 1;
    }
  });

  // 4. 实例化地图
  map.value = new Map({
    target: 'ol-map',
    layers: [raster, heatmapLayer.value],
    view: new View({
      center: fromLonLat([116.3974, 39.9093]), // 默认中心：北京 (稍后会自动跳转到数据中心)
      zoom: 4
    })
  });
};

// 获取数据并渲染
const fetchData = async () => {
  try {
    const res = await axios.get('/api/students/locations');
    if (res.data.code === 200) {
      const geoJsonData = res.data.data;
      pointCount.value = geoJsonData.features.length;

      // 解析 GeoJSON 并转换坐标系 (WGS84 -> Web Mercator)
      const features = new GeoJSON().readFeatures(geoJsonData, {
        featureProjection: 'EPSG:3857' // OpenLayers 默认投影
      });

      // 更新数据源
      const source = heatmapLayer.value.getSource();
      source.clear();
      source.addFeatures(features);

      // 自动缩放地图以适应所有点
      if (features.length > 0) {
        const extent = source.getExtent();
        map.value.getView().fit(extent, { padding: [50, 50, 50, 50], maxZoom: 16 });
      }
    }
  } catch (err) {
    console.error(err);
    ElMessage.error('加载热力图数据失败');
  }
};

// 实时更新热力图参数
const updateHeatmap = () => {
  if (heatmapLayer.value) {
    heatmapLayer.value.setBlur(parseInt(blur.value));
    heatmapLayer.value.setRadius(parseInt(radius.value));
  }
};

onMounted(() => {
  initMap();
  fetchData();
});
</script>

<style scoped>
.map-analysis-container {
  position: relative;
  width: 100%;
  height: calc(100vh - 80px); /* 减去顶部导航高度 */
  overflow: hidden;
  border-radius: 8px;
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
  backdrop-filter: blur(4px);
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  width: 250px;
  z-index: 1000;
}

.control-panel h3 {
  margin: 0 0 15px 0;
  font-size: 16px;
  color: #303133;
  border-bottom: 1px solid #ebeef5;
  padding-bottom: 10px;
}

.stat-item {
  margin-bottom: 15px;
  font-size: 14px;
  color: #606266;
  display: flex;
  justify-content: space-between;
}
.stat-item .value {
  font-weight: bold;
  color: #409EFF;
}

.slider-item {
  margin-bottom: 10px;
}
.slider-item .label {
  font-size: 12px;
  color: #909399;
  display: block;
  margin-bottom: 5px;
}
</style>