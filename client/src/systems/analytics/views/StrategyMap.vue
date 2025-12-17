<template>
  <div class="analytics-map-container">
    <div id="map-container" class="map-container"></div>

    <header class="hud-header glass-panel">
      <div class="hud-left">
        <el-button circle plain :icon="Back" class="back-btn" @click="$router.push('/')" />
        <span class="system-title">{{ t('strategy.title') }} <span class="highlight">{{ t('strategy.subTitle')
            }}</span></span>
      </div>
      <div class="hud-center">
      </div>
      <div class="hud-right">
        <el-button link class="lang-btn" @click="toggleLang"
          style="color: #409EFF; margin-right: 15px; font-weight: bold;">
          {{ locale === 'zh' ? '中文' : 'English' }}
        </el-button>
        <span class="time">{{ currentTime }}</span>
      </div>
    </header>

    <aside class="hud-panel left-panel glass-panel">
      <div class="panel-title">{{ t('strategy.arsenal') }}</div>
      <div class="tool-grid">
        <el-button size="small" class="tool-btn" @click="startDraw('point')" :disabled="!isAdmin">
          <span class="tool-icon">📍</span> {{ t('strategy.actions.point') }}
        </el-button>
        <el-button size="small" class="tool-btn" @click="startDraw('line')" :disabled="!isAdmin">
          <span class="tool-icon">〰️</span> {{ t('strategy.actions.line') }}
        </el-button>
        <el-button size="small" class="tool-btn" @click="startDraw('polygon')" :disabled="!isAdmin">
          <span class="tool-icon">⬡</span> {{ t('strategy.actions.polygon') }}
        </el-button>
        <el-button size="small" class="tool-btn delete-btn" type="danger" @click="handleDelete" :disabled="!canDelete || !isAdmin">
          <span class="tool-icon">🗑️</span> {{ t('strategy.actions.delete') }}
        </el-button>
      </div>

      <div class="panel-divider"></div>

      <div class="panel-title">{{ t('strategy.layers') }}</div>
      <div class="layer-list">
        <div class="layer-item" v-for="cat in categoryConfig" :key="cat.value">
          <div class="layer-label">
            <span class="dot" :style="{ background: cat.color, boxShadow: `0 0 5px ${cat.color}` }"></span>
            {{ t(cat.label) }}
          </div>
          <el-switch v-model="layers[cat.value]" size="small" />
        </div>
      </div>
    </aside>

    <transition name="slide-fade">
      <aside class="hud-panel right-panel glass-panel" v-if="viewModeFeature">
        <div class="panel-header">
          <div class="panel-title">{{ t('strategy.details') }}</div>
          <el-button link size="small" @click="viewModeFeature = null">✖</el-button>
        </div>

        <div class="feature-detail">
          <h3 class="detail-title">{{ viewModeFeature.properties.name }}</h3>
          <el-tag size="small" effect="dark" :color="getCategoryColor(viewModeFeature.properties.category)"
            style="border:none; margin-bottom:15px;">
            {{ getCategoryLabel(viewModeFeature.properties.category) }}
          </el-tag>

          <div v-for="(val, key) in parseProperties(viewModeFeature.properties)" :key="key" class="stat-row">
            <span>{{ formatKey(key) }}:</span>
            <strong>{{ val }}</strong>
          </div>
        </div>
      </aside>
    </transition>

    <el-dialog v-model="formVisible" :title="t('strategy.dialogTitle')" width="400px" :close-on-click-modal="false"
      :show-close="false" class="cyber-dialog">
      <el-form :model="formData" label-position="top" size="large">
        <el-form-item :label="t('strategy.fields.name')">
          <el-input v-model="formData.name" :placeholder="t('strategy.placeholders.name')" />
        </el-form-item>

        <el-form-item :label="t('strategy.fields.category')">
          <el-select v-model="formData.category" :placeholder="t('strategy.placeholders.selectType')"
            @change="handleCategoryChange">
            <el-option v-for="opt in availableCategories" :key="opt.value" :label="t(opt.label)" :value="opt.value" />
          </el-select>
        </el-form-item>

        <div v-if="currentFormFields.length > 0" class="dynamic-fields">
          <div class="field-group-title">{{ t('strategy.fields.attributes') }}</div>

          <el-form-item v-for="field in currentFormFields" :key="field.key" :label="formatKey(field.key)">
            <el-input v-if="field.type === 'text' || field.type === 'number'" v-model="formData.properties[field.key]"
              :type="field.type" :placeholder="field.placeholder">
              <template v-if="field.suffix" #append>{{ field.suffix }}</template>
            </el-input>

            <el-rate v-if="field.type === 'rate'" v-model="formData.properties[field.key]" :max="field.max" show-score
              text-color="#ff9900" />

            <el-switch v-if="field.type === 'switch'" v-model="formData.properties[field.key]" />
          </el-form-item>
        </div>

      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="cancelDraw">{{ t('strategy.actions.cancel') }}</el-button>
          <el-button type="primary" @click="saveFeature" :loading="saving">{{ t('strategy.actions.save') }}</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, reactive, onMounted, onUnmounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { Back } from '@element-plus/icons-vue';
import axios from 'axios';
import { ElMessage, ElMessageBox } from 'element-plus';

const router = useRouter();

const { t, locale } = useI18n();
const toggleLang = () => {
  locale.value = locale.value === 'zh' ? 'en' : 'zh';
  ElMessage.success(`Language switched to ${locale.value.toUpperCase()}`);
};

const token = localStorage.getItem('user_token');
const userInfoStr = localStorage.getItem('user_info');

const userInfo = userInfoStr ? JSON.parse(userInfoStr) : {};
const userRole = userInfo.role || 'visitor';
const isAdmin = computed(() => userRole === 'admin');
const isVisitor = computed(() => userRole === 'visitor' || userInfo.username === 'visitor');

const saving = ref(false);
const isCanceling = ref(false);

const formatKey = (key) => {
  return t(`strategy.fields.${key}`, key);
};

const currentTime = ref('');
const map = ref(null);
const draw = ref(null);
const drawSelectedId = ref(null);

const layers = reactive({
  own: true,
  competitor: true,
  school: true,
  community: true,
  route: true,
  block: true,
  hotzone: true
});

const viewModeFeature = ref(null);

const formVisible = ref(false);
const formData = reactive({
  name: '',
  category: '',
  featureType: '',
  properties: {}
});
const currentDrawFeatureId = ref(null);

const categoryConfig = [
  { value: 'own', label: 'strategy.layerItems.own', color: '#409EFF', type: 'Point' },
  { value: 'competitor', label: 'strategy.layerItems.competitor', color: '#F56C6C', type: 'Point' },
  { value: 'school', label: 'strategy.layerItems.school', color: '#67C23A', type: 'Point' },
  { value: 'community', label: 'strategy.layerItems.community', color: '#E6A23C', type: 'Point' },
  { value: 'route', label: 'strategy.layerItems.route', color: '#00FFFF', type: 'LineString' },
  { value: 'block', label: 'strategy.layerItems.block', color: '#FF00FF', type: 'LineString' },
  { value: 'hotzone', label: 'strategy.layerItems.hotzone', color: '#FFFF00', type: 'Polygon' }
];

const formSchema = {
  competitor: [
    { key: 'price', label: '预估客单价', type: 'number', suffix: '元' },
    { key: 'students', label: '预估学员数', type: 'number', suffix: '人' },
    { key: 'threat', label: '威胁等级', type: 'rate', max: 5 }
  ],
  community: [
    { key: 'avg_price', label: '挂牌均价', type: 'number', suffix: '元/㎡' },
    { key: 'households', label: '总户数', type: 'number', suffix: '户' },
    { key: 'age', label: '建筑年代', type: 'text', placeholder: '如: 2010年' }
  ],
  school: [
    { key: 'level', label: '学校等级', type: 'text', placeholder: '省重点/市重点' },
    { key: 'students', label: '在校生总数', type: 'number', suffix: '人' }
  ],
  route: [
    { key: 'duration', label: '预计耗时', type: 'number', suffix: '分钟' },
    { key: 'safety', label: '安全系数', type: 'rate', max: 5 }
  ]
};

watch(layers, (newVal) => {
  if (!map.value || !map.value.getSource('market-data')) return;

  const activeCategories = Object.keys(newVal).filter(key => newVal[key]);
  const categoryFilter = ['in', ['get', 'category'], ['literal', activeCategories]];

  const pointFilter = ['all', ['==', ['geometry-type'], 'Point'], categoryFilter];
  if (map.value.getLayer('market-points')) {
    map.value.setFilter('market-points', pointFilter);
  }
  if (map.value.getLayer('market-points-label')) {
    map.value.setFilter('market-points-label', pointFilter);
  }

  const lineFilter = ['all', ['==', ['geometry-type'], 'LineString'], categoryFilter];
  if (map.value.getLayer('market-lines')) {
    map.value.setFilter('market-lines', lineFilter);
  }
  if (map.value.getLayer('market-lines-label')) {
    map.value.setFilter('market-lines-label', lineFilter);
  }

  const polygonFilter = ['all', ['==', ['geometry-type'], 'Polygon'], categoryFilter];
  if (map.value.getLayer('market-polygons')) {
    map.value.setFilter('market-polygons', polygonFilter);
  }
  if (map.value.getLayer('market-polygons-label')) {
    map.value.setFilter('market-polygons-label', polygonFilter);
  }

}, { deep: true });

const availableCategories = computed(() => {
  if (!formData.featureType) return [];
  if (formData.featureType === 'Point') {
    return categoryConfig.filter(c => ['own', 'competitor', 'school', 'community'].includes(c.value));
  } else if (formData.featureType === 'LineString') {
    return categoryConfig.filter(c => ['route', 'block'].includes(c.value));
  } else {
    return categoryConfig.filter(c => ['hotzone', 'community'].includes(c.value));
  }
});

const currentFormFields = computed(() => {
  return formSchema[formData.category] || [];
});

const initMap = () => {
  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  if (!token) return ElMessage.error('Mapbox Token Missing');

  mapboxgl.accessToken = token;
  map.value = new mapboxgl.Map({
    container: 'map-container',
    style: 'mapbox://styles/mapbox/dark-v11',
    center: [116.397, 39.918],
    zoom: 13,
  });

  draw.value = new MapboxDraw({
    displayControlsDefault: false,
    controls: {
      point: isAdmin.value,
      line_string: isAdmin.value,
      polygon: isAdmin.value,
      trash: isAdmin.value
    },
    styles: [
      {
        'id': 'gl-draw-line',
        'type': 'line',
        'filter': ['all', ['==', '$type', 'LineString'], ['!=', 'mode', 'static']],
        'layout': { 'line-cap': 'round', 'line-join': 'round' },
        'paint': {
          'line-color': '#409EFF',
          'line-dasharray': [0.2, 2],
          'line-width': 4
        }
      },
      {
        'id': 'gl-draw-polygon-fill',
        'type': 'fill',
        'filter': ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
        'paint': {
          'fill-color': '#409EFF',
          'fill-opacity': 0.1
        }
      },
      {
        'id': 'gl-draw-polygon-stroke-active',
        'type': 'line',
        'filter': ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
        'layout': { 'line-cap': 'round', 'line-join': 'round' },
        'paint': {
          'line-color': '#409EFF',
          'line-dasharray': [0.2, 2],
          'line-width': 2
        }
      },
      {
        'id': 'gl-draw-point-active',
        'type': 'circle',
        'filter': ['all', ['==', '$type', 'Point'], ['!=', 'mode', 'static']],
        'paint': {
          'circle-radius': 6,
          'circle-color': '#fff'
        }
      },
      {
        'id': 'gl-draw-polygon-and-line-vertex-active',
        'type': 'circle',
        'filter': ['all', ['==', 'meta', 'vertex'], ['!=', 'mode', 'static']],
        'paint': {
          'circle-radius': 5,
          'circle-color': '#fbb03b'
        }
      }
    ]
  });
  map.value.addControl(draw.value);

  map.value.on('load', () => {
    add3DBuildings();
    fetchFeatures();

    map.value.on('contextmenu', (e) => {
      const mode = draw.value.getMode();

      if (mode.startsWith('draw_')) {
        e.originalEvent.preventDefault();

        isCanceling.value = true;

        draw.value.trash();

        draw.value.changeMode('simple_select');

        setTimeout(() => {
          isCanceling.value = false;
        }, 200);
      }
    });

    map.value.on('draw.create', handleDrawCreate);
    map.value.on('draw.selectionchange', handleSelectionChange);
  });

  map.value.on('click', (e) => {
    if (draw.value.getMode() !== 'simple_select' && draw.value.getMode() !== 'direct_select') {
      return;
    }

    const interactLayers = ['market-points', 'market-lines', 'market-polygons'];
    const features = map.value.queryRenderedFeatures(e.point, {
      layers: interactLayers
    });

    if (!features.length) {
      viewModeFeature.value = null;
      return;
    }

    const feature = features[0];

    if (draw.value.getMode() === 'simple_select') {
      draw.value.changeMode('simple_select', { featureIds: [] });
      drawSelectedId.value = null;
    }

    viewModeFeature.value = feature;

    if (feature.geometry.type === 'Point') {
      map.value.flyTo({
        center: feature.geometry.coordinates,
        zoom: 15,
        speed: 1.2,
        curve: 1
      });
    } else {
      const bounds = new mapboxgl.LngLatBounds();
      const geom = feature.geometry;

      if (geom.type === 'LineString') {
        geom.coordinates.forEach(coord => bounds.extend(coord));
      } else if (geom.type === 'Polygon') {
        geom.coordinates.forEach(ring => {
          ring.forEach(coord => bounds.extend(coord));
        });
      }

      map.value.fitBounds(bounds, {
        padding: 150,
        maxZoom: 15,
        duration: 1500
      });
    }
  });

  const interactLayers = ['market-points', 'market-lines', 'market-polygons'];
  interactLayers.forEach(layerId => {
    map.value.on('mouseenter', layerId, () => {
      map.value.getCanvas().style.cursor = 'pointer';
    });
    map.value.on('mouseleave', layerId, () => {
      map.value.getCanvas().style.cursor = '';
    });
  });
};

const startDraw = (type) => {
  if (!isAdmin.value) {
    ElMessage.warning('游客权限仅可查看，无法添加数据');
    return;
  }
  viewModeFeature.value = null;
  if (type === 'point') draw.value.changeMode('draw_point');
  if (type === 'line') draw.value.changeMode('draw_line_string');
  if (type === 'polygon') draw.value.changeMode('draw_polygon');
};

const canDelete = computed(() => {
  return !!drawSelectedId.value || !!viewModeFeature.value;
});
const handleDelete = async () => {
  if (!isAdmin.value) {
    ElMessage.warning('游客权限仅可查看，无法删除数据');
    return;
  }

  if (drawSelectedId.value) {
    draw.value.trash();
    drawSelectedId.value = null;
    viewModeFeature.value = null;
    return;
  }

  if (viewModeFeature.value) {
    const { id, name } = viewModeFeature.value.properties;

    const displayName = name || t('strategy.dialogs.defaultData');

    try {
      await ElMessageBox.confirm(
        t('strategy.dialogs.deleteMsg', { name: displayName }),
        t('strategy.dialogs.deleteTitle'),
        {
          confirmButtonText: t('strategy.dialogs.confirmDelete'),
          cancelButtonText: t('strategy.dialogs.cancel'),
          type: 'warning',
        }
      );

      const res = await axios.delete(`/api/mapbox/features/${id}`);

      if (res.data.code === 200) {
        ElMessage.success(t('common.success') || '删除成功');

        viewModeFeature.value = null;

        fetchFeatures();
      } else {
        ElMessage.error(res.data.msg || '删除失败');
      }
    } catch (err) {
      if (err !== 'cancel') {
        console.error(err);
        ElMessage.error(t('common.failed') || '操作失败');
      }
    }
  }
};

const handleSelectionChange = (e) => {
  drawSelectedId.value = e.features.length > 0 ? e.features[0].id : null;
};

const handleDrawCreate = (e) => {
  if (!isAdmin.value) {
    if (e.features.length > 0) {
      draw.value.delete(e.features[0].id);
    }
    ElMessage.warning('游客权限仅可查看，无法添加数据');
    return;
  }

  if (isCanceling.value) {
    if (e.features.length > 0) {
      draw.value.delete(e.features[0].id);
    }
    return;
  }

  const feature = e.features[0];
  currentDrawFeatureId.value = feature.id;

  formData.name = '';
  formData.category = '';
  formData.featureType = feature.geometry.type;
  formData.properties = {};

  formVisible.value = true;
};

const cancelDraw = () => {
  formVisible.value = false;
  if (currentDrawFeatureId.value) {
    draw.value.delete(currentDrawFeatureId.value);
  }
};

const saveFeature = async () => {
  if (!isAdmin.value) {
    ElMessage.warning('游客权限仅可查看，无法添加数据');
    formVisible.value = false;
    if (currentDrawFeatureId.value) {
      draw.value.delete(currentDrawFeatureId.value);
    }
    return;
  }

  if (!formData.name || !formData.category) return ElMessage.warning('请填写完整信息');

  saving.value = true;
  try {
    const feature = draw.value.get(currentDrawFeatureId.value);

    const payload = {
      name: formData.name,
      feature_type: formData.featureType,
      category: formData.category,
      properties: formData.properties,
      geometry: feature.geometry
    };

    const res = await axios.post('/api/mapbox/features', payload);

    if (res.data.code === 200) {
      ElMessage.success('数据已入库');
      formVisible.value = false;

      draw.value.delete(currentDrawFeatureId.value);
      fetchFeatures();
    }
  } catch (err) {
    console.error(err);
    ElMessage.error('保存失败');
  } finally {
    saving.value = false;
  }
};

const fetchFeatures = async () => {
  try {
    const res = await axios.get(`/api/mapbox/features?t=${new Date().getTime()}`);
    if (res.data.code === 200) {
      const geojson = res.data.data;

      if (map.value.getSource('market-data')) {
        map.value.getSource('market-data').setData(geojson);
      } else {
        map.value.addSource('market-data', { type: 'geojson', data: geojson });

        map.value.addLayer({
          id: 'market-polygons',
          type: 'fill',
          source: 'market-data',
          filter: ['==', '$type', 'Polygon'],
          paint: {
            'fill-color': [
              'match', ['get', 'category'],
              'hotzone', '#FFFF00',
              'community', '#E6A23C',
              '#888'
            ],
            'fill-opacity': 0.3
          }
        });
        map.value.addLayer({
          id: 'market-polygons-label',
          type: 'symbol',
          source: 'market-data',
          filter: ['==', '$type', 'Polygon'],
          layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': 12,
            'text-allow-overlap': false
          },
          paint: {
            'text-color': '#fff',
            'text-halo-color': '#000',
            'text-halo-width': 1
          }
        });

        map.value.addLayer({
          id: 'market-lines',
          type: 'line',
          source: 'market-data',
          filter: ['==', '$type', 'LineString'],
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': [
              'match', ['get', 'category'],
              'route', '#00FFFF',
              'block', '#FF00FF',
              '#888'
            ],
            'line-width': 4
          }
        });
        map.value.addLayer({
          id: 'market-lines-label',
          type: 'symbol',
          source: 'market-data',
          filter: ['==', '$type', 'LineString'],
          layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': 12,
            'symbol-placement': 'line',
            'text-offset': [0, 1]
          },
          paint: {
            'text-color': '#fff',
            'text-halo-color': '#000',
            'text-halo-width': 1
          }
        });

        map.value.addLayer({
          id: 'market-points',
          type: 'circle',
          source: 'market-data',
          filter: ['==', '$type', 'Point'],
          paint: {
            'circle-radius': 6,
            'circle-color': [
              'match', ['get', 'category'],
              'own', '#409EFF',
              'competitor', '#F56C6C',
              'school', '#67C23A',
              'community', '#E6A23C',
              '#ffffff'
            ],
            'circle-stroke-width': 1, 'circle-stroke-color': '#fff'
          }
        });
        map.value.addLayer({
          id: 'market-points-label',
          type: 'symbol',
          source: 'market-data',
          filter: ['==', '$type', 'Point'],
          layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': 12,
            'text-anchor': 'top',
            'text-offset': [0, 0.8]
          },
          paint: {
            'text-color': '#fff',
            'text-halo-color': '#000',
            'text-halo-width': 1
          }
        });

        if (geojson.features.length > 0) {
          const bounds = new mapboxgl.LngLatBounds();

          geojson.features.forEach((feature) => {
            const geom = feature.geometry;

            if (geom.type === 'Point') {
              bounds.extend(geom.coordinates);
            } else if (geom.type === 'LineString') {
              geom.coordinates.forEach(coord => bounds.extend(coord));
            } else if (geom.type === 'Polygon') {
              geom.coordinates.forEach(ring => {
                ring.forEach(coord => bounds.extend(coord));
              });
            }
          });

          map.value.fitBounds(bounds, {
            padding: 100,
            maxZoom: 15,
            duration: 2000
          });
        }
      }
    }
  } catch (err) {
    console.error('Data Load Error', err);
  }
};

const handleCategoryChange = () => {
  formData.properties = {};
};
const getCategoryLabel = (val) => {
  const item = categoryConfig.find(c => c.value === val);
  return item ? t(item.label) : val;
};
const getCategoryColor = (val) => categoryConfig.find(c => c.value === val)?.color || '#999';
const parseProperties = (props) => {
  const { id, name, category, feature_type, ...rest } = props;
  return rest;
};
const add3DBuildings = () => {
  if (map.value.getLayer('add-3d-buildings')) return;

  const layers = map.value.getStyle().layers;
  const labelLayerId = layers.find(
    (layer) => layer.type === 'symbol' && layer.layout['text-field']
  ).id;

  map.value.addLayer(
    {
      'id': 'add-3d-buildings',
      'source': 'composite',
      'source-layer': 'building',
      'filter': ['==', 'extrude', 'true'],
      'type': 'fill-extrusion',
      'minzoom': 13,
      'paint': {
        'fill-extrusion-color': '#2a3b55',
        'fill-extrusion-height': [
          'interpolate',
          ['linear'],
          ['zoom'],
          15,
          0,
          15.05,
          ['get', 'height']
        ],
        'fill-extrusion-base': [
          'interpolate',
          ['linear'],
          ['zoom'],
          15,
          0,
          15.05,
          ['get', 'min_height']
        ],
        'fill-extrusion-opacity': 0.6
      }
    },
    labelLayerId
  );
};

const updateTime = () => {
  const now = new Date();
  currentTime.value = now.toLocaleTimeString('en-US', { hour12: false });
};

onMounted(() => {
  if (!token || !userInfoStr) {
    router.push({
      path: '/system/home',
      query: { redirect: '/strategy/map' }
    });
    return;
  }
  
  updateTime();
  const timeInterval = setInterval(updateTime, 1000);
  initMap();
  
  onUnmounted(() => {
    if (timeInterval) clearInterval(timeInterval);
    if (map.value) {
      map.value.remove();
    }
  });
});
</script>

<style scoped>
.analytics-map-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;

  width: 100%;
  height: 100%;
  background-color: #000;
  overflow: hidden;
  font-family: 'Inter', sans-serif;
  color: #fff;
}

.map-container {
  width: 100%;
  height: 100%;
}

.glass-panel {
  background: rgba(15, 23, 42, 0.9);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(56, 189, 248, 0.2);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  position: absolute;
  z-index: 10;
  border-radius: 4px;
  box-sizing: border-box;
}

.hud-header {
  top: 0;
  left: 0;
  width: 100%;
  height: 60px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  border-bottom: 1px solid rgba(56, 189, 248, 0.3);
  box-sizing: border-box;
}

.system-title {
  font-size: 1.2rem;
  font-weight: 800;
  letter-spacing: 2px;
  margin-left: 15px;
}

.highlight {
  color: #409EFF;
  font-size: 0.8rem;
}

.hud-right .time {
  font-family: monospace;
  font-size: 1.2rem;
  font-weight: bold;
  color: #409EFF;
}

.hud-panel {
  top: 80px;
  bottom: 30px;
  width: 280px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  max-height: calc(100% - 140px);
  overflow-y: auto;
  scrollbar-width: none;
}

.hud-panel::-webkit-scrollbar {
  display: none;
}

.left-panel {
  left: 20px;
}

.right-panel {
  right: 20px;
  min-height: 200px;
  height: auto;
  bottom: auto;
}

.panel-title {
  font-size: 0.8rem;
  color: #409EFF;
  font-weight: bold;
  letter-spacing: 1px;
  border-left: 3px solid #409EFF;
  padding-left: 10px;
  margin-bottom: 15px;
}

.panel-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 20px 0;
}

.tool-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.tool-btn {
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  color: #fff !important;
  justify-content: flex-start !important;
  padding-left: 15px !important;
  font-size: 0.9rem !important;
}

.tool-btn:hover {
  border-color: #409EFF !important;
  background: rgba(64, 158, 255, 0.1) !important;
}

.tool-icon {
  display: inline-block;
  width: 24px;
  text-align: center;
  margin-right: 8px;
}

.delete-btn:disabled {
  background: rgba(255, 255, 255, 0.02) !important;
  border-color: rgba(255, 255, 255, 0.05) !important;
  color: #555 !important;
}

.layer-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.layer-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
  color: #cbd5e1;
  cursor: pointer;
}

.layer-label {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.detail-title {
  margin: 0 0 10px 0;
  font-size: 1.2rem;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.1);
  padding: 5px 0;
  font-size: 0.9rem;
  color: #aaa;
}

.stat-row strong {
  color: #fff;
}

:deep(.cyber-dialog) {
  background: rgba(16, 23, 40, 0.95) !important;
  border: 1px solid #409EFF;
  box-shadow: 0 0 20px rgba(64, 158, 255, 0.3);
}

:deep(.el-dialog__title) {
  color: #fff;
  font-weight: bold;
  letter-spacing: 1px;
}

:deep(.el-form-item__label) {
  color: #409EFF !important;
}

:deep(.el-input__wrapper) {
  background-color: rgba(255, 255, 255, 0.05);
  box-shadow: none;
  border: 1px solid #555;
}

:deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #409EFF;
}

:deep(.el-input__inner) {
  color: #fff;
}

.field-group-title {
  margin: 20px 0 10px;
  font-size: 0.8rem;
  color: #909399;
  text-transform: uppercase;
  border-bottom: 1px solid #333;
}

:deep(.mapboxgl-ctrl-top-right) {
  display: none !important;
}

:deep(.mapboxgl-ctrl-bottom-left) {
  display: none !important;
}
</style>

