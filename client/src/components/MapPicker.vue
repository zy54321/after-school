<template>
  <el-dialog
    v-model="dialogVisible"
    :title="title"
    width="800px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <div class="map-container">
      <div id="amap-container" ref="mapContainer" class="map"></div>
      <div class="map-info">
        <div class="info-item">
          <span class="label">经度：</span>
          <span class="value">{{ selectedLng || '--' }}</span>
        </div>
        <div class="info-item">
          <span class="label">纬度：</span>
          <span class="value">{{ selectedLat || '--' }}</span>
        </div>
        <div class="info-item">
          <span class="label">地址：</span>
          <span class="value">{{ addressText || (readonly ? '--' : '请在地图上点击选择位置') }}</span>
        </div>
      </div>
    </div>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">{{ readonly ? '关闭' : '取消' }}</el-button>
        <el-button v-if="!readonly" type="primary" @click="handleConfirm" :disabled="!selectedLng || !selectedLat">
          确认
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from 'vue';
import AMapLoader from '@amap/amap-jsapi-loader';
import { AMAP_CONFIG } from '../config/amap';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  initialLng: {
    type: Number,
    default: null
  },
  initialLat: {
    type: Number,
    default: null
  },
  readonly: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: '选择地址位置'
  },
  initialAddress: {
    type: String,
    default: null
  }
});

const emit = defineEmits(['update:modelValue', 'confirm']);

const dialogVisible = ref(false);
const mapContainer = ref(null);
let map = null;
let marker = null;
let geocoder = null;
const selectedLng = ref(null);
const selectedLat = ref(null);
const addressText = ref('');

// 监听 modelValue 变化
watch(() => props.modelValue, (val) => {
  dialogVisible.value = val;
  if (val) {
    nextTick(() => {
      initMap();
    });
  }
});

// 监听 dialogVisible 变化
watch(dialogVisible, (val) => {
  emit('update:modelValue', val);
});

// 地理编码：坐标转地址
const geocodePosition = (lng, lat) => {
  if (!geocoder) {
    addressText.value = `${lng}, ${lat}`;
    return;
  }
  
  geocoder.getAddress([lng, lat], (status, result) => {
    if (status === 'complete' && result.info === 'OK') {
      // 优先使用格式化地址
      let address = result.regeocode.formattedAddress;
      
      // 如果没有格式化地址，拼接地址组件
      if (!address && result.regeocode.addressComponent) {
        const addr = result.regeocode.addressComponent;
        const parts = [];
        if (addr.province) parts.push(addr.province);
        if (addr.city) parts.push(addr.city);
        if (addr.district) parts.push(addr.district);
        if (addr.street) parts.push(addr.street);
        if (addr.streetNumber) parts.push(addr.streetNumber);
        address = parts.join('');
      }
      
      addressText.value = address || `${lng}, ${lat}`;
    } else {
      addressText.value = `${lng}, ${lat}`;
    }
  });
};

// 添加标记
const addMarker = (lng, lat) => {
  if (!map) return;
  
  // 移除旧标记
  if (marker) {
    map.remove(marker);
    marker = null;
  }
  
  // 创建新标记
  marker = new AMap.Marker({
    position: [lng, lat],
    icon: new AMap.Icon({
      size: new AMap.Size(32, 32),
      image: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
        <svg width="32" height="32" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#FF4444"/>
        </svg>
      `),
      imageSize: new AMap.Size(32, 32)
    }),
    draggable: !props.readonly
  });
  
  map.add(marker);
  map.setCenter([lng, lat]);
  map.setZoom(15);
  
  // 如果可拖拽，监听拖拽事件
  if (!props.readonly) {
    marker.on('dragend', () => {
      const position = marker.getPosition();
      const lng = parseFloat(position.getLng().toFixed(6));
      const lat = parseFloat(position.getLat().toFixed(6));
      selectedLng.value = lng;
      selectedLat.value = lat;
      geocodePosition(lng, lat);
    });
  }
};

// 获取浏览器当前位置
const getCurrentPosition = () => {
  return new Promise((resolve, reject) => {
    if (!map) {
      reject(new Error('地图未初始化'));
      return;
    }
    
    // 使用高德地图定位服务
    const geolocation = new AMap.Geolocation({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
      convert: true,
      showButton: false,
      buttonPosition: 'RB',
      showMarker: false,
      showCircle: false,
      panToLocation: false,
      zoomToAccuracy: false
    });
    
    geolocation.getCurrentPosition((status, result) => {
      if (status === 'complete') {
        const lng = parseFloat(result.position.getLng().toFixed(6));
        const lat = parseFloat(result.position.getLat().toFixed(6));
        resolve({ lng, lat });
      } else {
        reject(new Error('定位失败：' + result.message));
      }
    });
  });
};

// 初始化地图
const initMap = async () => {
  if (!mapContainer.value) return;
  
  try {
    // 加载高德地图
    const AMap = await AMapLoader.load({
      key: AMAP_CONFIG.key,
      version: AMAP_CONFIG.version,
      plugins: AMAP_CONFIG.plugins
    });
    
    // 创建地图实例
    map = new AMap.Map('amap-container', {
      zoom: 10,
      center: [116.3974, 39.9093], // 默认北京天安门
      viewMode: '3D',
      mapStyle: 'amap://styles/normal'
    });
    
    // 创建地理编码实例
    geocoder = new AMap.Geocoder({
      city: '全国'
    });
    
    // 确定地图中心点
    let centerLng = null;
    let centerLat = null;
    let defaultZoom = 10;
    
    // 如果有初始坐标，使用初始坐标
    if (props.initialLng && props.initialLat) {
      centerLng = props.initialLng;
      centerLat = props.initialLat;
      defaultZoom = 15;
      addMarker(centerLng, centerLat);
      selectedLng.value = centerLng;
      selectedLat.value = centerLat;
      geocodePosition(centerLng, centerLat);
    } else if (!props.readonly) {
      // 如果没有初始坐标且不是只读模式，尝试获取浏览器定位
      try {
        const position = await getCurrentPosition();
        centerLng = position.lng;
        centerLat = position.lat;
        defaultZoom = 15;
        // 自动添加标记到当前位置
        addMarker(centerLng, centerLat);
        selectedLng.value = centerLng;
        selectedLat.value = centerLat;
        geocodePosition(centerLng, centerLat);
      } catch (error) {
        // 定位失败，使用默认位置
        console.warn('获取浏览器定位失败，使用默认位置:', error.message);
        centerLng = 116.3974;
        centerLat = 39.9093;
      }
    } else {
      // 只读模式且没有初始坐标
      centerLng = 116.3974;
      centerLat = 39.9093;
      addressText.value = props.initialAddress || '该位置未设置坐标';
    }
    
    // 设置地图中心
    if (centerLng && centerLat) {
      map.setCenter([centerLng, centerLat]);
      map.setZoom(defaultZoom);
    }
    
    // 地图点击事件（只读模式下禁用）
    if (!props.readonly) {
      map.on('click', (e) => {
        const lng = parseFloat(e.lnglat.getLng().toFixed(6));
        const lat = parseFloat(e.lnglat.getLat().toFixed(6));
        
        selectedLng.value = lng;
        selectedLat.value = lat;
        
        addMarker(lng, lat);
        geocodePosition(lng, lat);
      });
    }
    
  } catch (error) {
    console.error('地图加载失败:', error);
    addressText.value = '地图加载失败，请检查网络连接或联系管理员';
  }
};

// 确认选择
const handleConfirm = () => {
  if (props.readonly) {
    handleClose();
    return;
  }
  if (selectedLng.value && selectedLat.value) {
    emit('confirm', {
      lng: selectedLng.value,
      lat: selectedLat.value,
      address: addressText.value
    });
    handleClose();
  }
};

// 关闭对话框
const handleClose = () => {
  dialogVisible.value = false;
  // 清理地图
  if (map) {
    map.destroy();
    map = null;
  }
  marker = null;
  geocoder = null;
  selectedLng.value = null;
  selectedLat.value = null;
  addressText.value = '';
};

onMounted(() => {
  if (props.modelValue) {
    nextTick(() => {
      initMap();
    });
  }
});
</script>

<style scoped>
.map-container {
  width: 100%;
  height: 500px;
  position: relative;
}

.map {
  width: 100%;
  height: 450px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
}

.map-info {
  margin-top: 10px;
  padding: 10px;
  background-color: #f5f7fa;
  border-radius: 4px;
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.info-item {
  display: flex;
  align-items: center;
}

.label {
  font-weight: bold;
  color: #606266;
  margin-right: 5px;
}

.value {
  color: #303133;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

:deep(.el-dialog__body) {
  padding: 20px;
}
</style>
