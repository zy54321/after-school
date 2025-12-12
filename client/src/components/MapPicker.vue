<template>
  <el-dialog 
    :model-value="modelValue" 
    :title="title" 
    width="800px" 
    :close-on-click-modal="false"
    @close="handleClose"
    append-to-body
  >
    <div class="map-wrapper">
      <div class="search-box">
        <el-input 
          v-if="currentLang === 'zh'"
          v-model="searchCity" 
          placeholder="城市(选填)" 
          style="width: 100px; margin-right: 5px;"
          clearable
        />

        <el-select
          v-model="searchResult"
          filterable
          remote
          reserve-keyword
          :placeholder="currentLang === 'zh' ? '输入关键词 (如: 小区名)' : 'Search Places'"
          :remote-method="handleSearch"
          :loading="searching"
          @change="onSelectLocation"
          style="flex: 1;" 
          clearable
        >
          <el-option
            v-for="item in options"
            :key="item.id"
            :label="item.name"
            :value="item"
          >
            <span style="float: left">{{ item.name }}</span>
            <span style="float: right; color: #8492a6; font-size: 13px; margin-left: 10px">
              {{ item.district }}
            </span>
          </el-option>
        </el-select>
      </div>

      <div id="picker-map-container" class="map-view"></div>
    </div>
    
    <template #footer>
      <div class="dialog-footer">
        <div class="coords-info" v-if="selectedCoord">
           <el-tag size="small" type="info">Lng: {{ selectedCoord[0].toFixed(6) }}</el-tag>
           <el-tag size="small" type="info" style="margin-left: 5px;">Lat: {{ selectedCoord[1].toFixed(6) }}</el-tag>
        </div>
        <div>
          <el-button @click="handleClose">{{ $t('common.cancel') }}</el-button>
          <el-button type="primary" @click="handleConfirm" :disabled="!selectedCoord">{{ $t('common.confirm') }}</el-button>
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
import { MAPBOX_TOKEN, MAP_STYLES } from '../config/mapStyles';

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
const searchCity = ref(''); // ⭐ 新增：城市变量

const handleSearch = async (query) => {
  if (!query) return;
  searching.value = true;
  options.value = [];

  try {
    if (currentLang.value === 'zh') {
      // 🇨🇳 中文模式：传 city 参数给后端
      // 如果 searchCity 为空，则不传，后端会默认搜全国
      let url = `/api/amap/tips?keywords=${query}`;
      if (searchCity.value) {
        url += `&city=${searchCity.value}`;
      }
      
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
      // 🇺🇸 英文模式：Mapbox 搜全球，不需要 city 参数
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=5`;
      const res = await axios.get(url);
      
      if (res.data.features) {
        options.value = res.data.features.map(f => ({
          id: f.id,
          name: f.text,
          district: f.place_name,
          center: f.center
        }));
      }
    }
  } catch (err) {
    console.error('Search failed:', err);
  } finally {
    searching.value = false;
  }
};

const onSelectLocation = (item) => {
  if (!item || !item.center) return;
  let [lng, lat] = item.center;

  // 🔄 如果是中文搜索(高德源)，必须转回 WGS-84 才能在天地图上对齐
  if (currentLang.value === 'zh') {
     const result = gcoord.transform([lng, lat], gcoord.GCJ02, gcoord.WGS84);
     lng = result[0];
     lat = result[1];
  }
  
  // 🔄 搜索结果跳转逻辑
  // 如果是中文模式，item.center 是 GCJ02，我们需要把它转为 WGS84 存库
  // 但是！在地图上显示时，底图是高德(GCJ02)，所以我们可以直接飞过去，不需要转
  // 因为我们的 map 也是“歪”的 (Marker 也是歪的)
  // 只有在 handleConfirm 保存时才统一转回 WGS84
  
  map.flyTo({ center: [lng, lat], zoom: 14 });
  marker.setLngLat([lng, lat]);
  selectedCoord.value = [lng, lat];
};

// ... (initMap, handleConfirm, handleClose, watch 等逻辑保持不变)
const initMap = () => {
  const isZh = currentLang.value === 'zh';
  let center = [116.3974, 39.9093]; 
  
  if (props.initialLng && props.initialLat) {
    center = [props.initialLng, props.initialLat];
    // if (isZh) {
    //   center = gcoord.transform(center, gcoord.WGS84, gcoord.GCJ02);
    // }
    selectedCoord.value = center;
  }

  if (map) map.remove(); 

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
  let finalCoord = selectedCoord.value; 

  // if (currentLang.value === 'zh') {
  //   finalCoord = gcoord.transform(finalCoord, gcoord.GCJ02, gcoord.WGS84);
  // }

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
    if (map) map.remove(); 
    selectedCoord.value = null;
    searchResult.value = null;
    options.value = [];
    searchCity.value = ''; // 重置城市
  }
});
</script>

<style scoped>
.map-wrapper { position: relative; height: 450px; width: 100%; border: 1px solid #dcdfe6; border-radius: 4px; }
.map-view { width: 100%; height: 100%; }
.search-box {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 10;
  width: 380px; /* 稍微宽一点容纳两个框 */
  display: flex; /* 让城市框和搜索框横向排列 */
}
.dialog-footer { display: flex; justify-content: space-between; align-items: center; }
</style>