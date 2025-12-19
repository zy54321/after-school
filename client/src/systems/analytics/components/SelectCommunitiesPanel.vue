<template>
  <div class="select-communities-panel glass-panel">
    <div class="panel-header">
      <h3>{{ locale === 'zh' ? '步骤 1/3: 选择分析小区' : 'Step 1/3: Select Communities' }}</h3>
    </div>

    <div class="panel-content">
      <div class="selection-info">
        <div class="info-item">
          <span class="info-label">{{ locale === 'zh' ? '已选择' : 'Selected' }}:</span>
          <span class="info-value">{{ selectedCommunities.length }} {{ locale === 'zh' ? '个小区' : 'communities' }}</span>
        </div>
      </div>

      <div v-if="selectedCommunities.length > 0" class="selected-list">
        <div class="list-title">{{ locale === 'zh' ? '选中小区列表' : 'Selected Communities' }}:</div>
        <div class="community-item" v-for="(community, index) in selectedCommunities" :key="community.id || index">
          <span class="community-name">{{ getCommunityName(community) }}</span>
          <span class="community-households" v-if="getHouseholds(community)">
            ({{ getHouseholds(community) }}{{ locale === 'zh' ? '户' : ' households' }})
          </span>
          <el-button 
            link 
            type="danger" 
            size="small" 
            @click="removeCommunity(community)"
            class="remove-btn"
          >
            ✕
          </el-button>
        </div>
      </div>

      <div v-else class="empty-tip">
        <p>{{ locale === 'zh' ? '请在地图上点击选择住宅小区' : 'Please click on the map to select residential communities' }}</p>
        <p class="tip-note">{{ locale === 'zh' ? '（只允许选择住宅小区类型）' : '(Only residential communities can be selected)' }}</p>
      </div>
    </div>

    <div class="panel-actions">
      <el-button 
        type="primary" 
        :disabled="selectedCommunities.length === 0"
        @click="handleComplete"
      >
        {{ locale === 'zh' ? '完成选择' : 'Complete Selection' }}
      </el-button>
      <el-button @click="handleCancel">
        {{ locale === 'zh' ? '取消' : 'Cancel' }}
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';

const props = defineProps({
  map: {
    type: Object,
    required: true
  },
  selectedCommunities: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['update:selectedCommunities', 'complete', 'cancel']);

const { locale } = useI18n();

// 地图选择模式状态
const isSelectionMode = ref(false);
const mapClickHandler = ref(null);
const mapHoverHandlers = ref([]);

// 获取小区名称
const getCommunityName = (community) => {
  if (typeof community === 'object' && community.properties) {
    return community.properties.name || community.properties.id || 'Unknown';
  }
  return 'Unknown';
};

// 获取住户数
const getHouseholds = (community) => {
  if (typeof community === 'object' && community.properties) {
    return community.properties.households || null;
  }
  return null;
};

// 移除小区
const removeCommunity = (community) => {
  const index = props.selectedCommunities.findIndex(c => {
    const id1 = c.id || c.properties?.id;
    const id2 = community.id || community.properties?.id;
    return id1 === id2;
  });
  
  if (index !== -1) {
    const updated = [...props.selectedCommunities];
    updated.splice(index, 1);
    emit('update:selectedCommunities', updated);
    
    // 取消地图高亮
    if (props.map && community.properties?.id) {
      unhighlightCommunity(community);
    }
  }
};

// 高亮图层数据源
const highlightSourceId = 'demographics-highlight';
const hoverSourceId = 'demographics-hover';

// 添加高亮图层
const addHighlightLayers = () => {
  if (!props.map || !props.map.getSource('market-data')) return;
  
  // 初始化数据源
  if (!props.map.getSource(highlightSourceId)) {
    props.map.addSource(highlightSourceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });
  }
  
  if (!props.map.getSource(hoverSourceId)) {
    props.map.addSource(hoverSourceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });
  }
  
  // 找到最后一个市场数据图层作为参考点
  const referenceLayers = [
    'market-polygons-label',
    'market-lines-label',
    'market-points-label',
    'market-polygons',
    'market-lines',
    'market-points'
  ];
  
  let beforeLayer = null;
  for (let i = referenceLayers.length - 1; i >= 0; i--) {
    if (props.map.getLayer(referenceLayers[i])) {
      beforeLayer = referenceLayers[i];
      break;
    }
  }
  
  // 添加选中高亮图层（填充）- 放在市场数据图层之后
  if (!props.map.getLayer('demographics-highlight-fill')) {
    props.map.addLayer({
      id: 'demographics-highlight-fill',
      type: 'fill',
      source: highlightSourceId,
      paint: {
        'fill-color': '#409EFF',
        'fill-opacity': 0.3
      }
    }, beforeLayer);
  }
  
  // 添加选中高亮图层（边框）
  if (!props.map.getLayer('demographics-highlight-border')) {
    props.map.addLayer({
      id: 'demographics-highlight-border',
      type: 'line',
      source: highlightSourceId,
      paint: {
        'line-color': '#409EFF',
        'line-width': 3,
        'line-opacity': 1
      }
    }, beforeLayer);
  }
  
  // 添加悬停高亮图层（填充）
  if (!props.map.getLayer('demographics-hover-fill')) {
    props.map.addLayer({
      id: 'demographics-hover-fill',
      type: 'fill',
      source: hoverSourceId,
      paint: {
        'fill-color': '#409EFF',
        'fill-opacity': 0.15
      }
    }, beforeLayer);
  }
  
  // 添加悬停高亮图层（边框）
  if (!props.map.getLayer('demographics-hover-border')) {
    props.map.addLayer({
      id: 'demographics-hover-border',
      type: 'line',
      source: hoverSourceId,
      paint: {
        'line-color': '#409EFF',
        'line-width': 2,
        'line-opacity': 0.8
      }
    }, beforeLayer);
  }
};

// 移除高亮图层
const removeHighlightLayers = () => {
  if (!props.map) return;
  
  const layers = [
    'demographics-highlight-fill',
    'demographics-highlight-border',
    'demographics-hover-fill',
    'demographics-hover-border'
  ];
  
  layers.forEach(layerId => {
    if (props.map.getLayer(layerId)) {
      props.map.removeLayer(layerId);
    }
  });
  
  const sources = [highlightSourceId, hoverSourceId];
  sources.forEach(sourceId => {
    if (props.map.getSource(sourceId)) {
      props.map.removeSource(sourceId);
    }
  });
};

// 更新高亮显示
const updateHighlight = () => {
  if (!props.map || !props.map.getSource(highlightSourceId)) return;
  
  const features = props.selectedCommunities
    .filter(c => c.geometry && (c.geometry.type === 'Polygon' || c.geometry.type === 'Point'))
    .map(c => ({
      type: 'Feature',
      geometry: c.geometry,
      properties: {}
    }));
  
  props.map.getSource(highlightSourceId).setData({
    type: 'FeatureCollection',
    features: features
  });
};

// 高亮小区
const highlightCommunity = (feature) => {
  if (!props.map || !feature.properties?.id) return;
  updateHighlight();
};

// 取消高亮
const unhighlightCommunity = (feature) => {
  if (!props.map || !feature.properties?.id) return;
  updateHighlight();
};

// 设置悬停高亮
const setHoverHighlight = (feature) => {
  if (!props.map || !props.map.getSource(hoverSourceId)) return;
  
  if (feature && feature.geometry) {
    props.map.getSource(hoverSourceId).setData({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: feature.geometry,
        properties: {}
      }]
    });
  } else {
    props.map.getSource(hoverSourceId).setData({
      type: 'FeatureCollection',
      features: []
    });
  }
};

// 处理地图点击
const handleMapClick = (e) => {
  // 🟢 只有在选择模式下才处理点击，否则允许事件继续传播以查看要素详情
  if (!isSelectionMode.value || !props.map) {
    // 不在选择模式下，不处理事件，允许原有的事件处理器继续工作
    return;
  }

  const features = props.map.queryRenderedFeatures(e.point, {
    layers: ['market-polygons', 'market-points']
  });

  if (features.length === 0) {
    // 没有点击到要素，允许事件继续传播
    return;
  }

  const feature = features[0];

  // 验证：只允许选择住宅小区
  if (feature.properties.category !== 'residentialCommunity') {
    ElMessage.warning(locale.value === 'zh' ? '请选择住宅小区类型' : 'Please select residential community type');
    // 🟢 点击的不是住宅小区，不阻止事件传播，允许查看该要素的详情
    return;
  }
  
  // 🟢 如果点击的是住宅小区，处理选择逻辑，但不阻止事件传播
  // 这样用户可以选择小区，同时也能查看小区详情

  // 检查是否已选中
  const isSelected = props.selectedCommunities.some(c => {
    const id1 = c.id || c.properties?.id;
    const id2 = feature.properties.id;
    return id1 === id2;
  });

  let updated;
  if (isSelected) {
    // 取消选中
    updated = props.selectedCommunities.filter(c => {
      const id1 = c.id || c.properties?.id;
      const id2 = feature.properties.id;
      return id1 !== id2;
    });
    unhighlightCommunity(feature);
  } else {
    // 添加到选中列表
    updated = [...props.selectedCommunities, feature];
    highlightCommunity(feature);
  }

  emit('update:selectedCommunities', updated);
  
  // 更新高亮显示
  updateHighlight();
};

// 处理悬停效果
const handleMapMouseEnter = (layerId) => {
  return (e) => {
    if (!isSelectionMode.value || !props.map) return;
    
    const features = props.map.queryRenderedFeatures(e.point, {
      layers: [layerId]
    });

    if (features.length > 0) {
      const feature = features[0];
      // 只对住宅小区显示悬停效果
      if (feature.properties.category === 'residentialCommunity') {
        props.map.getCanvas().style.cursor = 'pointer';
        setHoverHighlight(feature);
      } else {
        props.map.getCanvas().style.cursor = 'not-allowed';
        setHoverHighlight(null);
      }
    } else {
      props.map.getCanvas().style.cursor = '';
      setHoverHighlight(null);
    }
  };
};

const handleMapMouseLeave = (layerId) => {
  return () => {
    if (!isSelectionMode.value || !props.map) return;
    props.map.getCanvas().style.cursor = '';
    setHoverHighlight(null);
  };
};

// 进入选择模式
const enterSelectionMode = () => {
  if (!props.map) return;
  
  isSelectionMode.value = true;
  
  // 添加高亮图层
  addHighlightLayers();
  
  // 保存原有点击事件处理器（如果有）
  // 这里我们直接添加新的点击事件
  mapClickHandler.value = handleMapClick;
  props.map.on('click', mapClickHandler.value);
  
  // 添加悬停效果
  const layers = ['market-polygons', 'market-points'];
  layers.forEach(layerId => {
    if (props.map.getLayer(layerId)) {
      const enterHandler = handleMapMouseEnter(layerId);
      const leaveHandler = handleMapMouseLeave(layerId);
      mapHoverHandlers.value.push({ 
        layerId, 
        enterHandler, 
        leaveHandler 
      });
      props.map.on('mouseenter', layerId, enterHandler);
      props.map.on('mouseleave', layerId, leaveHandler);
    }
  });
  
  // 修改鼠标样式
  props.map.getCanvas().style.cursor = 'pointer';
  
  ElMessage.info(locale.value === 'zh' ? '请在地图上选择住宅小区（可多选）' : 'Please select residential communities on the map (multiple selection)');
};

// 退出选择模式
const exitSelectionMode = () => {
  if (!props.map) return;
  
  isSelectionMode.value = false;
  
  // 移除点击事件
  if (mapClickHandler.value) {
    props.map.off('click', mapClickHandler.value);
    mapClickHandler.value = null;
  }
  
  // 移除悬停效果
  mapHoverHandlers.value.forEach(({ layerId, enterHandler, leaveHandler }) => {
    if (props.map.getLayer(layerId)) {
      props.map.off('mouseenter', layerId, enterHandler);
      props.map.off('mouseleave', layerId, leaveHandler);
    }
  });
  mapHoverHandlers.value = [];
  
  // 清除悬停高亮
  setHoverHighlight(null);
  
  // 移除高亮图层
  removeHighlightLayers();
  
  // 恢复鼠标样式
  props.map.getCanvas().style.cursor = '';
};

// 完成选择
const handleComplete = () => {
  if (props.selectedCommunities.length === 0) {
    ElMessage.warning(locale.value === 'zh' ? '请至少选择1个小区' : 'Please select at least 1 community');
    return;
  }
  
  exitSelectionMode();
  emit('complete');
};

// 取消
const handleCancel = () => {
  exitSelectionMode();
  emit('cancel');
};

// 监听选中小区变化，更新高亮
watch(() => props.selectedCommunities, () => {
  if (isSelectionMode.value) {
    updateHighlight();
  }
}, { deep: true });

onMounted(() => {
  // 延迟进入选择模式，确保地图已加载
  setTimeout(() => {
    enterSelectionMode();
  }, 500);
});

onUnmounted(() => {
  exitSelectionMode();
});
</script>

<style scoped>
.select-communities-panel {
  position: absolute;
  top: 160px;
  left: 20px;
  width: 320px;
  max-height: calc(100vh - 200px);
  display: flex;
  flex-direction: column;
}

.glass-panel {
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(56, 189, 248, 0.3);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  border-radius: 8px;
}

.panel-header {
  padding: 15px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.panel-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #409EFF;
}

.panel-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  overflow-x: hidden;
  /* Firefox 滚动条样式 */
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) rgba(255, 255, 255, 0.05);
}

/* 统一滚动条样式 - WebKit 浏览器 */
.panel-content::-webkit-scrollbar {
  width: 6px;
}

.panel-content::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.panel-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.panel-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

.selection-info {
  margin-bottom: 20px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: rgba(64, 158, 255, 0.1);
  border: 1px solid rgba(64, 158, 255, 0.3);
  border-radius: 6px;
}

.info-label {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.9rem;
}

.info-value {
  color: #409EFF;
  font-weight: bold;
  font-size: 1rem;
}

.selected-list {
  margin-top: 20px;
}

.list-title {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.85rem;
  margin-bottom: 10px;
  font-weight: 500;
}

.community-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  margin-bottom: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  transition: all 0.3s;
}

.community-item:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(64, 158, 255, 0.5);
}

.community-name {
  color: #fff;
  font-size: 0.9rem;
  flex: 1;
}

.community-households {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.85rem;
  margin-left: 8px;
}

.remove-btn {
  margin-left: 8px;
  padding: 4px 8px;
  color: #f56c6c;
}

.remove-btn:hover {
  color: #f56c6c;
  background: rgba(245, 108, 108, 0.1);
}

.empty-tip {
  text-align: center;
  padding: 40px 20px;
  color: rgba(255, 255, 255, 0.6);
}

.empty-tip p {
  margin: 0 0 10px 0;
  font-size: 0.9rem;
}

.tip-note {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.4);
}

.panel-actions {
  padding: 15px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.panel-actions .el-button {
  min-width: 100px;
}
</style>

