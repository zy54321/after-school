<template>
  <el-dialog :model-value="modelValue" :title="title" width="800px" :close-on-click-modal="false" @close="handleClose"
    append-to-body>
    <div class="map-wrapper">
      <div class="search-box" v-if="!readonly">
        <el-input v-if="currentLang === 'zh'" v-model="searchCity" placeholder="城市(选填)"
          style="width: 100px; margin-right: 5px;" clearable />
        <el-select v-model="searchResult" filterable remote reserve-keyword
          :placeholder="currentLang === 'zh' ? '输入关键词 (如: 小区名)' : 'Search Places'" :remote-method="handleSearch"
          :loading="searching" @change="onSelectLocation" style="flex: 1;" clearable value-key="id">
          <el-option v-for="item in options" :key="item.id" :label="item.name" :value="item">
            <span style="float: left">{{ item.name }}</span>
            <span style="float: right; color: #8492a6; font-size: 13px; margin-left: 10px">
              {{ item.district }}
            </span>
          </el-option>
        </el-select>
      </div>

      <div id="picker-map-container" class="map-view"></div>
      <div class="map-tip">
        {{ currentLang === 'zh' ? '点击地图任意位置选点' : 'Click map to select location' }}
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <div class="coords-info" v-if="selectedCoord">
          <el-tag size="small" type="info">Lng: {{ Number(selectedCoord[0]).toFixed(6) }}</el-tag>
          <el-tag size="small" type="info" style="margin-left: 5px;">Lat: {{ Number(selectedCoord[1]).toFixed(6)
          }}</el-tag>
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
import axios from 'axios';
import { MAPBOX_TOKEN, MAP_STYLES } from '../../config/mapStyles';

const props = defineProps(['modelValue', 'title', 'initialLng', 'initialLat', 'readonly']);
const emit = defineEmits(['update:modelValue', 'confirm']);
const { locale } = useI18n();
const currentLang = computed(() => locale.value);

mapboxgl.accessToken = MAPBOX_TOKEN;
let map = null;
let marker = null;
const selectedCoord = ref(null);
const searching = ref(false);
const options = ref([]);
const searchResult = ref(null);
const searchCity = ref('');

// 🔍 搜索逻辑 (保持不变)
const handleSearch = async (query) => {
  if (!query) return;
  searching.value = true;
  try {
    if (currentLang.value === 'zh') {
      let url = `/api/amap/tips?keywords=${query}`;
      if (searchCity.value) url += `&city=${searchCity.value}`;
      const res = await axios.get(url);
      if (res.data.code === 200) {
        options.value = res.data.data
          .filter(tip => tip.location && tip.location.length > 0)
          .map(tip => ({
            id: tip.id || tip.name,
            name: tip.name,
            district: tip.district,
            center: tip.location.split(',').map(Number)
          }));
      }
    } else {
      // ✅ 请求自己的后端接口
      const url = `/api/mapbox/places?query=${encodeURIComponent(query)}`;
      const res = await axios.get(url);
      if (res.data.code === 200 && res.data.data.features) {
        options.value = res.data.data.features.map(f => ({
          id: f.id,
          name: f.text, // 地点名
          district: f.place_name, // 完整地址
          center: f.center // [lng, lat]
        }));
      }
    }
  } catch (err) {
    console.error('Search failed:', err);
  } finally {
    searching.value = false;
  }
};

// 🎯 选中搜索结果 (⭐ 唯一需要转换的地方)
const onSelectLocation = (item) => {
  if (!item || !item.center) return;

  let [lng, lat] = item.center;

  // 如果是高德搜索结果(GCJ02)，必须转回 WGS84 才能在天地图上显示正确
  if (currentLang.value === 'zh') {
    const result = gcoord.transform([lng, lat], gcoord.GCJ02, gcoord.WGS84);
    lng = result[0];
    lat = result[1];
  }

  map.flyTo({ center: [lng, lat], zoom: 14 });
  marker.setLngLat([lng, lat]);
  selectedCoord.value = [lng, lat];
};

// 🗺️ 初始化地图 (⭐ 移除所有转换)
const initMap = () => {
  const isZh = currentLang.value === 'zh';
  let center = [116.3974, 39.9093];

  if (props.initialLng && props.initialLat) {
    let rawLng = Number(props.initialLng);
    let rawLat = Number(props.initialLat);
    center = [rawLng, rawLat]; // 数据库是 WGS84，天地图也是 WGS84，直接用！
    selectedCoord.value = center;
  }

  if (map) { map.remove(); map = null; }

  map = new mapboxgl.Map({
    container: 'picker-map-container',
    style: isZh ? MAP_STYLES.zh : MAP_STYLES.en,
    center: center,
    zoom: 13
  });

  marker = new mapboxgl.Marker({ draggable: !props.readonly })
    .setLngLat(center)
    .addTo(map);

  if (!props.readonly) {
    map.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      marker.setLngLat([lng, lat]);
      selectedCoord.value = [lng, lat]; // 点击得到的直接就是 WGS84
    });
    marker.on('dragend', () => {
      const lngLat = marker.getLngLat();
      selectedCoord.value = [lngLat.lng, lngLat.lat];
    });
  }
};

// 💾 确认保存 (⭐ 移除所有转换)
const handleConfirm = () => {
  if (!selectedCoord.value) return;

  // 地图上的点已经是 WGS84 了，直接保存
  const finalCoord = selectedCoord.value;

  emit('confirm', {
    lng: finalCoord[0],
    lat: finalCoord[1],
    address: searchResult.value?.name || (currentLang.value === 'zh' ? '地图选点' : 'Map Location')
  });
  handleClose();
};

const handleClose = () => emit('update:modelValue', false);

watch(() => props.modelValue, (val) => {
  if (val) {
    nextTick(() => initMap());
  } else {
    if (map) { map.remove(); map = null; }
    selectedCoord.value = null;
    searchResult.value = null;
    options.value = [];
    searchCity.value = '';
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

.search-box {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 10;
  width: 380px;
  display: flex;
}

.map-tip {
  position: absolute;
  bottom: 10px;
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

