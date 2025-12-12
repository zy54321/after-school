<template>
  <el-dialog :model-value="modelValue" :title="title" width="800px" :close-on-click-modal="false" @close="handleClose"
    append-to-body>
    <div class="map-wrapper">
      <div id="picker-map-container" class="map-view"></div>

      <div class="map-tip">
        {{ currentLang === 'zh' ? '点击地图任意位置选点' : 'Click map to select location' }}
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <div class="coords-info" v-if="selectedCoord">
          <el-tag size="small" type="info">Lng: {{ selectedCoord[0].toFixed(6) }}</el-tag>
          <el-tag size="small" type="info" style="margin-left: 5px;">Lat: {{ selectedCoord[1].toFixed(6) }}</el-tag>
        </div>
        <div>
          <el-button @click="handleClose">{{ $t('common.cancel') }}</el-button>
          <el-button type="primary" @click="handleConfirm" :disabled="!selectedCoord">{{ $t('common.confirm')
            }}</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch, nextTick, computed } from 'vue';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import gcoord from 'gcoord';
import { useI18n } from 'vue-i18n';
import { MAPBOX_TOKEN, MAP_STYLES } from '../config/mapStyles';

const props = defineProps(['modelValue', 'title', 'initialLng', 'initialLat', 'readonly']);
const emit = defineEmits(['update:modelValue', 'confirm']);
const { locale } = useI18n();
const currentLang = computed(() => locale.value);

mapboxgl.accessToken = MAPBOX_TOKEN;
let map = null;
let marker = null;
const selectedCoord = ref(null); // 这是一个临时变量，永远存储当前地图上 Marker 的坐标

const initMap = () => {
  const isZh = currentLang.value === 'zh';

  // 1. 计算初始中心点 (默认北京)
  let center = [116.3974, 39.9093];

  // 如果父组件传来了坐标 (数据库里的 WGS84)
  if (props.initialLng && props.initialLat) {
    center = [props.initialLng, props.initialLat];

    // 🔄 转换：如果是中文高德底图(GCJ02)，必须把 WGS84 -> GCJ02，否则Marker会偏
    if (isZh) {
      center = gcoord.transform(center, gcoord.WGS84, gcoord.GCJ02);
    }
    selectedCoord.value = center;
  }

  // 2. 初始化 Mapbox
  map = new mapboxgl.Map({
    container: 'picker-map-container',
    style: isZh ? MAP_STYLES.zh : MAP_STYLES.en,
    center: center,
    zoom: 13
  });

  // 3. 添加 Marker
  marker = new mapboxgl.Marker({ draggable: !props.readonly })
    .setLngLat(center)
    .addTo(map);

  // 4. 绑定事件：点击地图移动 Marker
  if (!props.readonly) {
    map.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      marker.setLngLat([lng, lat]);
      selectedCoord.value = [lng, lat];
    });

    marker.on('dragend', () => {
      const lngLat = marker.getLngLat();
      selectedCoord.value = [lngLat.lng, lngLat.lat];
    });
  }
};

const handleConfirm = () => {
  if (!selectedCoord.value) return;

  // 这是当前地图上的坐标
  let finalCoord = selectedCoord.value;

  // 🔄 保存前转换：如果是中文模式，这个坐标是 GCJ02，必须转回 WGS84 才能存库
  if (currentLang.value === 'zh') {
    finalCoord = gcoord.transform(finalCoord, gcoord.GCJ02, gcoord.WGS84);
  }

  emit('confirm', {
    lng: finalCoord[0],
    lat: finalCoord[1],
    address: currentLang.value === 'zh' ? '地图选点坐标' : 'Map Selected Location'
  });
  handleClose();
};

const handleClose = () => emit('update:modelValue', false);

watch(() => props.modelValue, (val) => {
  if (val) {
    nextTick(() => initMap());
  } else {
    if (map) map.remove();
    selectedCoord.value = null;
  }
});
</script>

<style scoped>
.map-wrapper {
  position: relative;
  height: 450px;
  width: 100%;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
}

.map-view {
  width: 100%;
  height: 100%;
}

.map-tip {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(255, 255, 255, 0.9);
  padding: 5px 10px;
  font-size: 12px;
  border-radius: 4px;
  color: #606266;
  pointer-events: none;
}

.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>