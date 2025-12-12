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
import { MAPBOX_TOKEN, MAP_STYLES } from '../config/mapStyles';

const props = defineProps(['modelValue', 'title', 'initialLng', 'initialLat', 'readonly']);
const emit = defineEmits(['update:modelValue', 'confirm']);
const { locale } = useI18n();
const currentLang = computed(() => locale.value);

mapboxgl.accessToken = MAPBOX_TOKEN;
let map = null;
let marker = null;
const selectedCoord = ref(null);

// 搜索相关状态
const searching = ref(false);
const options = ref([]);
const searchResult = ref(null);
const searchCity = ref('');

const handleSearch = async (query) => {
  if (!query) return;
  searching.value = true;

  try {
    if (currentLang.value === 'zh') {
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

  if (currentLang.value === 'zh') {
    // 中文搜索结果(GCJ02) -> 转换成 WGS84 存下来
    // 注意：这里我们存 selectedCoord 是 WGS84，但是地图显示要飞到 GCJ02 (因为底图是高德)
    // 所以：
    // 1. 存: 转换后的 WGS84
    // 2. 显: 原始的 GCJ02 (飞过去)

    // 先存 WGS84
    const wgs84 = gcoord.transform([lng, lat], gcoord.GCJ02, gcoord.WGS84);
    selectedCoord.value = wgs84;

    // 再飞 GCJ02 (因为底图是歪的，所以我们要飞到歪的坐标去)
    map.flyTo({ center: [lng, lat], zoom: 14 });
    marker.setLngLat([lng, lat]);
  } else {
    // 英文模式：全是 WGS84
    map.flyTo({ center: [lng, lat], zoom: 14 });
    marker.setLngLat([lng, lat]);
    selectedCoord.value = [lng, lat];
  }
};

const initMap = () => {
  const isZh = currentLang.value === 'zh';

  // ✅ 修复点2：强制转 Number，防止字符串导致的计算错误
  let center = [116.3974, 39.9093];
  if (props.initialLng && props.initialLat) {
    let rawLng = Number(props.initialLng);
    let rawLat = Number(props.initialLat);

    // selectedCoord 永远存 WGS84 (数据库里的值)
    selectedCoord.value = [rawLng, rawLat];

    // center 用来控制地图显示
    // 如果是中文高德底图，要把 WGS84 -> GCJ02 才能对齐显示
    if (isZh) {
      center = gcoord.transform([rawLng, rawLat], gcoord.WGS84, gcoord.GCJ02);
    } else {
      center = [rawLng, rawLat];
    }
  }

  // ✅ 修复点3：销毁旧实例，防止内存泄漏
  if (map) {
    map.remove();
    map = null;
  }

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

      // 地图上点哪就是哪 (Mapbox 坐标)
      // 如果是中文模式，这个 [lng, lat] 其实是 GCJ02
      // 如果是英文模式，这个 [lng, lat] 是 WGS84
      // 我们统一在 handleConfirm 里做最终转换，这里先存原始点击坐标，方便 Marker 显示

      // 修正逻辑：selectedCoord 还是存 WGS84 比较好，保持统一
      if (isZh) {
        const wgs84 = gcoord.transform([lng, lat], gcoord.GCJ02, gcoord.WGS84);
        selectedCoord.value = wgs84;
      } else {
        selectedCoord.value = [lng, lat];
      }
    });

    marker.on('dragend', () => {
      const { lng, lat } = marker.getLngLat();
      if (isZh) {
        const wgs84 = gcoord.transform([lng, lat], gcoord.GCJ02, gcoord.WGS84);
        selectedCoord.value = wgs84;
      } else {
        selectedCoord.value = [lng, lat];
      }
    });
  }
};

const handleConfirm = () => {
  if (!selectedCoord.value) return;

  // selectedCoord 已经是 WGS84 了 (在 click/dragend/onSelect 里都转过了)
  // 直接保存！

  emit('confirm', {
    lng: selectedCoord.value[0],
    lat: selectedCoord.value[1],
    address: searchResult.value?.name || (currentLang.value === 'zh' ? '地图选点' : 'Map Location')
  });
  handleClose();
};

const handleClose = () => emit('update:modelValue', false);

watch(() => props.modelValue, (val) => {
  if (val) {
    nextTick(() => initMap());
  } else {
    // ✅ 修复点4：弹窗关闭时，彻底清理 map
    if (map) {
      map.remove();
      map = null;
    }
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