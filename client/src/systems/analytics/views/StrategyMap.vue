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

      <el-button 
        v-if="isAdmin" 
        size="small" 
        class="tool-btn" 
        style="width: 100%; margin-bottom: 15px;"
        @click="$router.push('/strategy/dictionary')"
      >
        <span class="tool-icon">📚</span> {{ $t('strategy.dictionary') }}
      </el-button>

      <div class="panel-divider"></div>

      <div class="panel-title">{{ t('strategy.layers') }}</div>
      <div class="layer-list">
        <template v-if="dictionaryConfig.length === 0 && !dictionaryLoading">
          <div class="empty-tip">
            {{ $t('dictionary.empty') }}
          </div>
        </template>
        <template v-else>
          <!-- 🟢 手风琴样式：按点线面分组 -->
          <el-collapse v-model="activeCollapsePanels" class="layer-collapse">
            <!-- 点要素 -->
            <el-collapse-item name="Point" v-if="pointTypes.length > 0">
              <template #title>
                <span class="collapse-title">
                  <span class="geometry-icon">📍</span>
                  {{ locale === 'zh' ? '点要素' : 'Point' }}
                </span>
              </template>
              <div 
                class="layer-item" 
                v-for="type in pointTypes" 
                :key="type.type_code"
              >
                <div class="layer-label">
                  <span class="dot" :style="{ background: type.color, boxShadow: `0 0 5px ${type.color}` }"></span>
                  {{ locale === 'zh' ? type.name_zh : type.name_en }}
                </div>
                <el-switch v-model="layers[type.type_code]" size="small" />
              </div>
            </el-collapse-item>

            <!-- 线要素 -->
            <el-collapse-item name="LineString" v-if="lineTypes.length > 0">
              <template #title>
                <span class="collapse-title">
                  <span class="geometry-icon">〰️</span>
                  {{ locale === 'zh' ? '线要素' : 'Line' }}
                </span>
              </template>
              <div 
                class="layer-item" 
                v-for="type in lineTypes" 
                :key="type.type_code"
              >
                <div class="layer-label">
                  <span class="dot" :style="{ background: type.color, boxShadow: `0 0 5px ${type.color}` }"></span>
                  {{ locale === 'zh' ? type.name_zh : type.name_en }}
                </div>
                <el-switch v-model="layers[type.type_code]" size="small" />
              </div>
            </el-collapse-item>

            <!-- 面要素 -->
            <el-collapse-item name="Polygon" v-if="polygonTypes.length > 0">
              <template #title>
                <span class="collapse-title">
                  <span class="geometry-icon">⬡</span>
                  {{ locale === 'zh' ? '面要素' : 'Polygon' }}
                </span>
              </template>
              <div 
                class="layer-item" 
                v-for="type in polygonTypes" 
                :key="type.type_code"
              >
                <div class="layer-label">
                  <span class="dot" :style="{ background: type.color, boxShadow: `0 0 5px ${type.color}` }"></span>
                  {{ locale === 'zh' ? type.name_zh : type.name_en }}
                </div>
                <el-switch v-model="layers[type.type_code]" size="small" />
              </div>
            </el-collapse-item>
          </el-collapse>
        </template>
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

    <el-dialog 
      v-model="formVisible" 
      :title="t('strategy.dialogTitle')" 
      width="500px" 
      :close-on-click-modal="false"
      :show-close="false" 
      class="cyber-dialog feature-form-dialog"
    >
      <div class="dialog-form-container">
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

          <el-form-item 
            v-for="field in currentFormFields" 
            :key="field.key" 
            :label="field.label"
            :required="field.is_required"
          >
            <!-- 文本输入 -->
            <el-input 
              v-if="field.type === 'text' || field.type === 'textarea' || field.type === 'url'"
              v-model="formData.properties[field.key]"
              :type="field.type === 'textarea' ? 'textarea' : 'text'"
              :placeholder="field.placeholder || ''"
              :rows="field.type === 'textarea' ? 3 : undefined"
            >
              <template v-if="field.suffix" #append>{{ field.suffix }}</template>
            </el-input>

            <!-- 数字输入 -->
            <el-input-number 
              v-if="field.type === 'number'"
              v-model="formData.properties[field.key]"
              :placeholder="field.placeholder || ''"
              :min="field.validation_rule?.min"
              :max="field.validation_rule?.max"
              style="width: 100%"
            >
              <template v-if="field.suffix" #append>{{ field.suffix }}</template>
            </el-input-number>

            <!-- 日期选择 -->
            <el-date-picker
              v-if="field.type === 'date'"
              v-model="formData.properties[field.key]"
              type="date"
              :placeholder="field.placeholder || ''"
              style="width: 100%"
            />

            <!-- 布尔值（开关） -->
            <el-switch 
              v-if="field.type === 'boolean'"
              v-model="formData.properties[field.key]"
            />

            <!-- 下拉选择 -->
            <el-select
              v-if="field.type === 'select'"
              v-model="formData.properties[field.key]"
              :placeholder="field.placeholder || ''"
              style="width: 100%"
            >
              <el-option
                v-for="opt in (field.options || [])"
                :key="opt.value"
                :label="locale === 'zh' ? opt.label_zh : opt.label_en"
                :value="opt.value"
              />
            </el-select>

            <!-- 评分 -->
            <el-rate 
              v-if="field.type === 'rate'"
              v-model.number="formData.properties[field.key]" 
              :max="field.max || 5" 
              :allow-half="false"
              show-score
              text-color="#ff9900"
            />
          </el-form-item>
        </div>

        </el-form>
      </div>
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
import { ref, reactive, onMounted, onUnmounted, onActivated, computed, watch, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { Back } from '@element-plus/icons-vue';
import axios from 'axios';
import { ElMessage, ElMessageBox } from 'element-plus';

const router = useRouter();
const route = useRoute();

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

// 🟢 字典配置（从API获取，替代硬编码）
const dictionaryConfig = ref([]); // 存储完整的字典配置 [{ type_code, name_zh, name_en, color, fields: [...] }]
const dictionaryLoading = ref(false);

// 🟢 获取字典配置
const fetchDictionaryConfig = async () => {
  dictionaryLoading.value = true;
  try {
    const res = await axios.get('/api/mapbox/dictionary/full');
    if (res.data.code === 200) {
      dictionaryConfig.value = res.data.data;
      // 初始化图层控制
      initializeLayers();
    }
  } catch (err) {
    console.error('获取字典配置失败:', err);
    ElMessage.error('获取字典配置失败，使用默认配置');
    // 如果API失败，使用空数组，避免报错
    dictionaryConfig.value = [];
  } finally {
    dictionaryLoading.value = false;
  }
};

// 🟢 初始化图层控制（根据字典配置）
const initializeLayers = () => {
  // 清空现有图层状态
  Object.keys(layers).forEach(key => {
    delete layers[key];
  });
  // 根据字典配置初始化
  dictionaryConfig.value.forEach(type => {
    if (type.is_active) {
      layers[type.type_code] = true;
    }
  });
};

// 🟢 更新地图图层颜色（当字典配置变化时调用）
const updateMapLayerColors = () => {
  if (!map.value) return;
  
  // 更新多边形颜色
  if (map.value.getLayer('market-polygons')) {
    map.value.setPaintProperty('market-polygons', 'fill-color', buildColorMatchExpression('Polygon'));
  }
  
  // 更新线颜色
  if (map.value.getLayer('market-lines')) {
    map.value.setPaintProperty('market-lines', 'line-color', buildColorMatchExpression('LineString'));
  }
  
  // 更新点颜色
  if (map.value.getLayer('market-points')) {
    map.value.setPaintProperty('market-points', 'circle-color', buildColorMatchExpression('Point'));
  }
};

// 🟢 监听字典配置变化，更新地图图层颜色
watch(() => dictionaryConfig.value, (newConfig) => {
  updateMapLayerColors();
}, { deep: true });

// 🟢 监听路由变化，从字典管理页面返回时刷新配置
watch(() => route.path, (newPath, oldPath) => {
  // 如果从字典管理页面返回到地图页面，重新获取字典配置
  if (oldPath === '/strategy/dictionary' && newPath === '/strategy/map') {
    fetchDictionaryConfig();
  }
});

// 🟢 监听字典配置更新事件（从字典管理页面触发）
onMounted(() => {
  const handleDictionaryUpdate = () => {
    // 如果当前在地图页面，刷新字典配置
    if (route.path === '/strategy/map' && map.value) {
      fetchDictionaryConfig();
    }
  };
  
  window.addEventListener('dictionary-config-updated', handleDictionaryUpdate);
  
  onUnmounted(() => {
    window.removeEventListener('dictionary-config-updated', handleDictionaryUpdate);
  });
});

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

// 🟢 启用的字典类型列表（用于图层控制）
const activeDictionaryTypes = computed(() => {
  return dictionaryConfig.value.filter(type => type && type.is_active);
});

// 🟢 按几何类型分组
const pointTypes = computed(() => {
  return activeDictionaryTypes.value.filter(type => type.geometry_type === 'Point');
});

const lineTypes = computed(() => {
  return activeDictionaryTypes.value.filter(type => type.geometry_type === 'LineString');
});

const polygonTypes = computed(() => {
  return activeDictionaryTypes.value.filter(type => type.geometry_type === 'Polygon');
});

// 🟢 手风琴展开的面板（默认全部收起）
const activeCollapsePanels = ref([]);

// 🟢 可用类型列表（根据当前几何类型和字典配置）
const availableCategories = computed(() => {
  if (!formData.featureType || dictionaryConfig.value.length === 0) return [];
  
  // 从字典配置中筛选匹配的几何类型，且为启用状态
  return dictionaryConfig.value
    .filter(type => 
      type && 
      type.geometry_type === formData.featureType && 
      type.is_active
    )
    .map(type => ({
      value: type.type_code,
      label: locale.value === 'zh' ? type.name_zh : type.name_en,
      color: type.color,
      type: type.geometry_type
    }));
});

// 🟢 当前类型的字段列表（从字典配置获取）
const currentFormFields = computed(() => {
  if (!formData.category || dictionaryConfig.value.length === 0) return [];
  
  const selectedType = dictionaryConfig.value.find(t => t && t.type_code === formData.category);
  if (!selectedType || !selectedType.fields || !Array.isArray(selectedType.fields)) return [];
  
  // 返回字段列表，并处理国际化
  return selectedType.fields
    .filter(field => field) // 过滤掉可能的 undefined
    .map(field => ({
      key: field.field_key,
      label: locale.value === 'zh' ? field.name_zh : field.name_en,
      type: field.field_type,
      suffix: field.suffix,
      placeholder: locale.value === 'zh' ? field.placeholder_zh : field.placeholder_en,
      is_required: field.is_required,
      default_value: field.default_value,
      validation_rule: field.validation_rule,
      options: field.options,
      max: field.field_type === 'rate' ? (field.validation_rule?.max || 5) : undefined
    }));
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

const handleDrawCreate = async (e) => {
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
  
  // 🟢 等待下一个 tick，确保 currentFormFields 已更新
  await nextTick();
  
  // 🟢 初始化字段默认值
  currentFormFields.value.forEach(field => {
    if (field.default_value !== null && field.default_value !== undefined && field.default_value !== '') {
      // 对于 rate 类型，确保是数字类型
      if (field.type === 'rate') {
        const numValue = typeof field.default_value === 'string' 
          ? parseFloat(field.default_value) 
          : Number(field.default_value);
        formData.properties[field.key] = isNaN(numValue) ? 0 : numValue;
      } else {
        formData.properties[field.key] = field.default_value;
      }
    } else if (field.type === 'rate') {
      // rate 类型如果没有默认值，初始化为 0
      formData.properties[field.key] = 0;
    } else if (field.type === 'boolean') {
      // boolean 类型如果没有默认值，初始化为 false
      formData.properties[field.key] = false;
    }
  });

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

// 🟢 动态生成颜色匹配表达式（用于 Mapbox）
const buildColorMatchExpression = (geometryType) => {
  const types = dictionaryConfig.value.filter(t => 
    t && 
    t.geometry_type === geometryType && 
    t.is_active
  );
  const expression = ['match', ['get', 'category']];
  
  types.forEach(type => {
    if (type && type.type_code && type.color) {
      expression.push(type.type_code, type.color);
    }
  });
  
  // 默认颜色
  expression.push('#888');
  return expression;
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

        // 🟢 使用字典配置动态生成颜色
        map.value.addLayer({
          id: 'market-polygons',
          type: 'fill',
          source: 'market-data',
          filter: ['==', '$type', 'Polygon'],
          paint: {
            'fill-color': buildColorMatchExpression('Polygon'),
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

        // 🟢 使用字典配置动态生成颜色
        map.value.addLayer({
          id: 'market-lines',
          type: 'line',
          source: 'market-data',
          filter: ['==', '$type', 'LineString'],
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': buildColorMatchExpression('LineString'),
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

        // 🟢 使用字典配置动态生成颜色
        map.value.addLayer({
          id: 'market-points',
          type: 'circle',
          source: 'market-data',
          filter: ['==', '$type', 'Point'],
          paint: {
            'circle-radius': 6,
            'circle-color': buildColorMatchExpression('Point'),
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

// 🟢 处理类型切换，初始化字段默认值
const handleCategoryChange = () => {
  formData.properties = {};
  
  // 根据字段配置设置默认值
  currentFormFields.value.forEach(field => {
    if (field.default_value !== null && field.default_value !== undefined && field.default_value !== '') {
      // 🟢 对于 rate 类型，确保是数字类型
      if (field.type === 'rate') {
        const numValue = typeof field.default_value === 'string' 
          ? parseFloat(field.default_value) 
          : Number(field.default_value);
        formData.properties[field.key] = isNaN(numValue) ? 0 : numValue;
      } else {
        formData.properties[field.key] = field.default_value;
      }
    } else if (field.type === 'rate') {
      // 🟢 rate 类型如果没有默认值，初始化为 0
      formData.properties[field.key] = 0;
    } else if (field.type === 'boolean') {
      // 🟢 boolean 类型如果没有默认值，初始化为 false
      formData.properties[field.key] = false;
    } else if (field.type === 'number') {
      // 🟢 number 类型如果没有默认值，初始化为 null（允许为空）
      formData.properties[field.key] = null;
    }
  });
};

// 🟢 获取类型标签（使用字典配置）
const getCategoryLabel = (val) => {
  const type = dictionaryConfig.value.find(t => t && t.type_code === val);
  if (type) {
    return locale.value === 'zh' ? type.name_zh : type.name_en;
  }
  return val;
};

// 🟢 获取类型颜色（使用字典配置）
const getCategoryColor = (val) => {
  const type = dictionaryConfig.value.find(t => t && t.type_code === val);
  return type?.color || '#999';
};
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

// 🟢 监听字典配置更新事件（从字典管理页面触发）
let dictionaryUpdateHandler = null;

onMounted(async () => {
  if (!token || !userInfoStr) {
    router.push({
      path: '/strategy/home',
      query: { redirect: '/strategy/map' }
    });
    return;
  }
  
  // 🟢 先获取字典配置
  await fetchDictionaryConfig();
  
  updateTime();
  const timeInterval = setInterval(updateTime, 1000);
  initMap();
  
  // 🟢 监听字典配置更新事件
  dictionaryUpdateHandler = () => {
    // 如果当前在地图页面，刷新字典配置
    if (route.path === '/strategy/map' && map.value) {
      fetchDictionaryConfig();
    }
  };
  window.addEventListener('dictionary-config-updated', dictionaryUpdateHandler);
  
  onUnmounted(() => {
    if (timeInterval) clearInterval(timeInterval);
    if (map.value) {
      map.value.remove();
    }
    // 移除事件监听
    if (dictionaryUpdateHandler) {
      window.removeEventListener('dictionary-config-updated', dictionaryUpdateHandler);
    }
  });
});

// 🟢 当组件被激活时（从其他页面返回），刷新字典配置
onActivated(async () => {
  // 如果地图已初始化，刷新字典配置以获取最新的颜色设置
  if (map.value) {
    await fetchDictionaryConfig();
  }
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

/* 🟢 取消 Element Plus 按钮的默认间距 */
.tool-grid .el-button + .el-button {
  margin-left: 0 !important;
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

/* 🟢 手风琴样式 - 与工具栏按钮保持一致 */
.layer-collapse {
  border: none;
  background: transparent;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.layer-collapse :deep(.el-collapse-item) {
  border: none;
  margin-bottom: 0;
}

.layer-collapse :deep(.el-collapse-item__header) {
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  border-radius: 4px;
  padding: 10px 15px !important;
  color: #fff !important;
  font-size: 0.9rem !important;
  height: auto !important;
  min-height: 40px !important;
  line-height: 1.5;
  width: 100% !important;
  box-sizing: border-box !important;
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  transition: all 0.3s;
}

.layer-collapse :deep(.el-collapse-item__header:hover) {
  border-color: #409EFF !important;
  background: rgba(64, 158, 255, 0.1) !important;
}

.layer-collapse :deep(.el-collapse-item__header.is-active) {
  border-bottom: none;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

.layer-collapse :deep(.el-collapse-item__wrap) {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-top: none;
  border-radius: 0 0 4px 4px;
  background: rgba(255, 255, 255, 0.02);
}

.layer-collapse :deep(.el-collapse-item__content) {
  padding: 10px 15px;
  padding-bottom: 10px;
}

/* 🟢 取消 Element Plus 手风琴按钮的默认间距 */
.layer-collapse .el-collapse-item + .el-collapse-item {
  margin-top: 0;
}

.collapse-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.geometry-icon {
  font-size: 1.1rem;
}

.layer-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
  color: #cbd5e1;
  padding: 6px 0;
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

/* 🟢 要素表单对话框 - 固定大小，内容可滚动 */
.feature-form-dialog :deep(.el-dialog) {
  height: 600px !important;
  max-height: 600px !important;
  display: flex !important;
  flex-direction: column !important;
}

.feature-form-dialog :deep(.el-dialog__header) {
  flex-shrink: 0;
  padding: 20px 20px 10px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.feature-form-dialog :deep(.el-dialog__body) {
  flex: 1;
  overflow: hidden !important;
  padding: 0 !important;
  display: flex !important;
  flex-direction: column !important;
}

.feature-form-dialog .dialog-form-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px;
  max-height: calc(600px - 120px); /* 减去 header 和 footer 的高度 */
}

/* 🟢 自定义滚动条样式 */
.feature-form-dialog .dialog-form-container::-webkit-scrollbar {
  width: 6px;
}

.feature-form-dialog .dialog-form-container::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.feature-form-dialog .dialog-form-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.feature-form-dialog .dialog-form-container::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

.feature-form-dialog :deep(.el-dialog__footer) {
  flex-shrink: 0;
  padding: 15px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
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

