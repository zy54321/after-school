<template>
  <div class="analytics-map-container">
    <!-- 🟢 人口构成分析模式组件 -->
    <DemographicsAnalysis 
      v-if="isDemographicsAnalysisMode"
      :map="map"
      @exit="exitDemographicsAnalysis"
    />
    
    <div id="map-container" class="map-container"></div>

    <header class="hud-header glass-panel">
      <div class="hud-left">
        <el-button circle plain :icon="Back" class="back-btn" @click="$router.push('/')" />
        <span class="system-title">{{ t('strategy.title') }} <span class="highlight">{{ t('strategy.subTitle')
            }}</span></span>
      </div>
      <div class="hud-center">
        <div class="search-box">
          <el-input 
            v-if="locale === 'zh'" 
            v-model="searchCity" 
            :placeholder="t('strategy.search.city')"
            style="width: 100px; margin-right: 5px;" 
            clearable 
            size="small"
          />
          <el-select 
            v-model="searchResult" 
            filterable 
            remote 
            reserve-keyword
            :placeholder="t('strategy.search.placeholder')" 
            :remote-method="handleSearch"
            :loading="searching" 
            @change="onSelectLocation" 
            style="width: 300px;" 
            clearable 
            value-key="id"
            size="small"
          >
            <el-option 
              v-for="item in searchOptions" 
              :key="item.id" 
              :label="item.name" 
              :value="item"
            >
              <span style="float: left">{{ item.name }}</span>
              <span style="float: right; color: #8492a6; font-size: 12px; margin-left: 10px">
                {{ item.district }}
              </span>
            </el-option>
          </el-select>
        </div>
      </div>
      <div class="hud-right">
        <el-dropdown @command="handleMapStyleCommand">
          <el-button
            link
            class="style-btn"
            style="color: #67C23A; margin-right: 15px; font-weight: bold;"
          >
            {{ locale === 'zh' ? `底图: ${currentMapStyleLabel}` : `Base: ${currentMapStyleLabel}` }}
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="style in mapStyleOptions"
                :key="style.key"
                :command="style.key"
                :disabled="style.key === currentMapStyle"
              >
                {{ locale === 'zh' ? style.labelZh : style.labelEn }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button link class="lang-btn" @click="toggleLang"
          style="color: #409EFF; margin-right: 15px; font-weight: bold;">
          {{ locale === 'zh' ? '中文' : 'English' }}
        </el-button>
        <span class="time">{{ currentTime }}</span>
      </div>
    </header>

    <aside class="hud-panel left-panel glass-panel" v-if="!isDemographicsAnalysisMode">
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

      <!-- 🟢 分析工具 -->
      <div class="panel-title">{{ locale === 'zh' ? '分析工具' : 'Analysis Tools' }}</div>
      <div class="tool-grid">
        <el-button 
          size="small" 
          class="tool-btn" 
          @click="enterDemographicsAnalysis"
        >
          <span class="tool-icon">📊</span> {{ locale === 'zh' ? '人口构成分析' : 'Demographics Analysis' }}
        </el-button>
      </div>

      <div class="panel-divider"></div>

      <!-- 🟢 测量工具 -->
      <div class="panel-title">{{ t('strategy.measurement.title') }}</div>
      <div class="tool-grid">
        <el-button 
          size="small" 
          class="tool-btn" 
          :type="measurementMode === 'distance' ? 'primary' : 'default'"
          @click="startMeasureDistance"
        >
          <span class="tool-icon">📏</span> {{ t('strategy.measurement.distance') }}
        </el-button>
        <el-button 
          size="small" 
          class="tool-btn" 
          :type="measurementMode === 'area' ? 'primary' : 'default'"
          @click="startMeasureArea"
        >
          <span class="tool-icon">📐</span> {{ t('strategy.measurement.area') }}
        </el-button>
        <el-button 
          size="small" 
          class="tool-btn" 
          @click="clearMeasurement"
          :disabled="!hasMeasurement"
        >
          <span class="tool-icon">🗑️</span> {{ t('strategy.measurement.clear') }}
        </el-button>
      </div>
      
      <!-- 🟢 测量结果显示 -->
      <div v-if="hasMeasurement" class="measurement-result">
        <div v-if="measurementDistance" class="measurement-item">
          <span class="measurement-label">{{ t('strategy.measurement.distance') }}:</span>
          <span class="measurement-value">{{ formatDistance(measurementDistance) }}</span>
        </div>
        <div v-if="measurementArea" class="measurement-item">
          <span class="measurement-label">{{ t('strategy.measurement.area') }}:</span>
          <span class="measurement-value">{{ formatArea(measurementArea) }}</span>
        </div>
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
          <div>
            <el-button 
              v-if="isAdmin && !isEditingFeature" 
              link 
              size="small" 
              type="primary"
              @click="startEditFeature"
              style="margin-right: 10px;"
            >
              {{ locale === 'zh' ? '编辑' : 'Edit' }}
            </el-button>
            <el-button link size="small" @click="handleCloseDetailPanel">✖</el-button>
          </div>
        </div>

        <!-- 🟢 查看模式 -->
        <div v-if="!isEditingFeature" class="feature-detail">
          <h3 class="detail-title">{{ viewModeFeature.properties.name }}</h3>
          <el-tag size="small" effect="dark" :color="getCategoryColor(viewModeFeature.properties.category)"
            style="border:none; margin-bottom:15px;">
            {{ getCategoryLabel(viewModeFeature.properties.category) }}
          </el-tag>

          <!-- 🟢 显示所有字段，根据字典配置 -->
          <div v-for="field in detailFields" :key="field.field_key" class="stat-row">
            <span>{{ locale === 'zh' ? field.name_zh : field.name_en }}:</span>
            <strong>{{ formatFieldValue(field, viewModeFeature.properties[field.field_key]) }}</strong>
          </div>
        </div>

        <!-- 🟢 编辑模式 -->
        <div v-else class="feature-edit">
          <el-form :model="editFormData" label-position="top" size="default">
            <el-form-item :label="t('strategy.fields.name')">
              <el-input v-model="editFormData.name" :placeholder="t('strategy.placeholders.name')" />
            </el-form-item>

            <el-form-item :label="t('strategy.fields.category')">
              <el-select v-model="editFormData.category" :placeholder="t('strategy.placeholders.selectType')" disabled>
                <el-option 
                  v-for="opt in availableCategories" 
                  :key="opt.value" 
                  :label="t(opt.label)" 
                  :value="opt.value" 
                />
              </el-select>
            </el-form-item>

            <div v-if="editFormFields.length > 0" class="dynamic-fields">
              <div class="field-group-title">{{ t('strategy.fields.attributes') }}</div>

              <el-form-item 
                v-for="field in editFormFields" 
                :key="field.key" 
                :label="field.label"
                :required="field.is_required"
              >
                <!-- 文本输入 -->
                <el-input 
                  v-if="field.type === 'text' || field.type === 'textarea' || field.type === 'url'"
                  v-model="editFormData.properties[field.key]"
                  :type="field.type === 'textarea' ? 'textarea' : 'text'"
                  :placeholder="field.placeholder || ''"
                  :rows="field.type === 'textarea' ? 3 : undefined"
                >
                  <template v-if="field.suffix" #append>{{ field.suffix }}</template>
                </el-input>

                <!-- 数字输入 -->
                <el-input-number 
                  v-if="field.type === 'number'"
                  v-model="editFormData.properties[field.key]"
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
                  v-model="editFormData.properties[field.key]"
                  type="date"
                  :placeholder="field.placeholder || ''"
                  style="width: 100%"
                />

                <!-- 布尔值 -->
                <el-switch
                  v-if="field.type === 'boolean'"
                  v-model="editFormData.properties[field.key]"
                />

                <!-- 下拉选择 -->
                <el-select
                  v-if="field.type === 'select'"
                  v-model="editFormData.properties[field.key]"
                  :placeholder="field.placeholder || ''"
                  style="width: 100%"
                >
                  <el-option
                    v-for="opt in field.options"
                    :key="opt.value"
                    :label="locale === 'zh' ? opt.label_zh : opt.label_en"
                    :value="opt.value"
                  />
                </el-select>

                <!-- 评分 -->
                <el-rate
                  v-if="field.type === 'rate'"
                  v-model.number="editFormData.properties[field.key]"
                  :max="5"
                  allow-half="false"
                />
              </el-form-item>
            </div>

            <div class="edit-actions">
              <el-button @click="cancelEditFeature">{{ t('strategy.actions.cancel') }}</el-button>
              <el-button type="primary" @click="saveEditFeature" :loading="savingEdit">
                {{ locale === 'zh' ? '保存' : 'Save' }}
              </el-button>
            </div>
          </el-form>
        </div>
      </aside>
    </transition>

    <el-dialog 
      v-model="formVisible" 
      :title="t('strategy.dialogTitle')" 
      width="500px" 
      :close-on-click-modal="false"
      :close-on-press-escape="false"
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
import gcoord from 'gcoord';
import * as turf from '@turf/turf';
import DemographicsAnalysis from '../components/DemographicsAnalysis.vue';
import { usePermission } from '@/composables/usePermission';
import PERMISSIONS from '@/constants/permissions';
import { MAPBOX_TOKEN, AMAP_STYLES } from '@/config/mapStyles';

const router = useRouter();
const route = useRoute();

const { t, locale } = useI18n();

const token = MAPBOX_TOKEN;
const userInfoStr = localStorage.getItem('user_info');

// 🟢 人口构成分析模式状态
const isDemographicsAnalysisMode = ref(false);
const toggleLang = () => {
  locale.value = locale.value === 'zh' ? 'en' : 'zh';
  ElMessage.success(`Language switched to ${locale.value.toUpperCase()}`);
};

// 使用 RBAC 权限判断，不再依赖 user_token 和 role
const { hasPermission } = usePermission();
const canManageMap = computed(() => hasPermission(PERMISSIONS.MAP.MANAGE));
// 保留 isAdmin 作为别名，保持模板兼容性
const isAdmin = canManageMap;

const saving = ref(false);
const isCanceling = ref(false);

// 🟢 格式化字段键为显示名称（从字典配置中获取）
const formatKey = (key) => {
  // 如果有选中的要素，尝试从字典配置中查找字段名称
  if (viewModeFeature.value && viewModeFeature.value.properties) {
    const category = viewModeFeature.value.properties.category;
    if (category) {
      // 查找对应的类型配置
      const typeConfig = dictionaryConfig.value.find(t => t && t.type_code === category);
      if (typeConfig && typeConfig.fields) {
        // 在字段列表中查找匹配的字段
        const field = typeConfig.fields.find(f => f && f.field_key === key);
        if (field) {
          // 根据当前语言返回对应的名称
          return locale.value === 'zh' ? field.name_zh : field.name_en;
        }
      }
    }
  }
  
  // 如果找不到，尝试使用翻译文件（向后兼容）
  const translated = t(`strategy.fields.${key}`, '');
  if (translated && translated !== `strategy.fields.${key}`) {
    return translated;
  }
  
  // 如果都没有，返回原始键值（首字母大写）
  return key.charAt(0).toUpperCase() + key.slice(1);
};

const currentTime = ref('');
const map = ref(null);
const draw = ref(null);
const drawSelectedId = ref(null);

const COORD_SYSTEM = {
  WGS84: 'WGS84',
  GCJ02: 'GCJ02'
};

const mapStyleOptions = [
  {
    key: 'mapbox-dark',
    provider: 'mapbox',
    coordSystem: COORD_SYSTEM.WGS84,
    style: 'mapbox://styles/mapbox/dark-v11',
    labelZh: 'Mapbox 暗色',
    labelEn: 'Mapbox Dark'
  },
  {
    key: 'amap-standard',
    provider: 'amap',
    coordSystem: COORD_SYSTEM.GCJ02,
    style: AMAP_STYLES.standard,
    labelZh: '高德标准',
    labelEn: 'AMap Standard'
  }
];

const currentMapStyle = ref('mapbox-dark');
const currentMapStyleOption = computed(() => {
  return mapStyleOptions.find(item => item.key === currentMapStyle.value) || mapStyleOptions[0];
});
const currentMapStyleLabel = computed(() => {
  return locale.value === 'zh' ? currentMapStyleOption.value.labelZh : currentMapStyleOption.value.labelEn;
});
const isAmapProvider = computed(() => currentMapStyleOption.value.provider === 'amap');

const getMapStyle = () => {
  return currentMapStyleOption.value.style;
};

const getMapCoordSystem = () => {
  return currentMapStyleOption.value.coordSystem;
};

const getSearchResultCoordSystem = () => {
  return locale.value === 'zh' ? COORD_SYSTEM.GCJ02 : COORD_SYSTEM.WGS84;
};

const transformCoordinate = (coord, fromSystem, toSystem) => {
  if (!Array.isArray(coord) || coord.length < 2 || fromSystem === toSystem) return coord;
  try {
    const from = fromSystem === COORD_SYSTEM.GCJ02 ? gcoord.GCJ02 : gcoord.WGS84;
    const to = toSystem === COORD_SYSTEM.GCJ02 ? gcoord.GCJ02 : gcoord.WGS84;
    return gcoord.transform(coord, from, to);
  } catch (err) {
    console.warn('Coordinate transform failed:', err);
    return coord;
  }
};

const transformCoordinates = (coords, fromSystem, toSystem) => {
  if (!Array.isArray(coords)) return coords;
  if (coords.length > 0 && typeof coords[0] === 'number') {
    return transformCoordinate(coords, fromSystem, toSystem);
  }
  return coords.map(item => transformCoordinates(item, fromSystem, toSystem));
};

const transformGeometry = (geometry, fromSystem, toSystem) => {
  if (!geometry || fromSystem === toSystem) return geometry;
  if (geometry.type === 'GeometryCollection' && Array.isArray(geometry.geometries)) {
    return {
      ...geometry,
      geometries: geometry.geometries.map(g => transformGeometry(g, fromSystem, toSystem))
    };
  }
  if (!geometry.coordinates) return geometry;
  return {
    ...geometry,
    coordinates: transformCoordinates(geometry.coordinates, fromSystem, toSystem)
  };
};

const transformFeatureCollection = (geojson, fromSystem, toSystem) => {
  if (!geojson || !Array.isArray(geojson.features) || fromSystem === toSystem) return geojson;
  return {
    ...geojson,
    features: geojson.features.map(feature => ({
      ...feature,
      geometry: transformGeometry(feature.geometry, fromSystem, toSystem)
    }))
  };
};

const geometryToStoreSystem = (geometry) => {
  return transformGeometry(geometry, getMapCoordSystem(), COORD_SYSTEM.WGS84);
};

const geojsonToMapSystem = (geojson) => {
  return transformFeatureCollection(geojson, COORD_SYSTEM.WGS84, getMapCoordSystem());
};

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

// 🟢 编辑要素相关变量
const isEditingFeature = ref(false);
const savingEdit = ref(false);
const editingFeatureDrawId = ref(null); // 编辑模式下 Draw 中的要素 ID

// 🟢 测量工具相关状态
const measurementMode = ref(null); // 'distance' | 'area' | null
const measurementDistance = ref(null); // 距离（米）
const measurementArea = ref(null); // 面积（平方米）
const measurementFeatureId = ref(null); // 当前测量的要素 ID
const hasMeasurement = computed(() => measurementDistance.value !== null || measurementArea.value !== null);
const editFormData = reactive({
  name: '',
  category: '',
  properties: {}
});

// 🔍 搜索相关变量
const searching = ref(false);
const searchOptions = ref([]);
const searchResult = ref(null);
const searchCity = ref('');

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

// 🔍 搜索逻辑
const handleSearch = async (query) => {
  if (!query) {
    searchOptions.value = [];
    return;
  }
  searching.value = true;
  try {
    if (locale.value === 'zh') {
      // 中文模式：使用高德API
      let url = `/api/amap/tips?keywords=${encodeURIComponent(query)}`;
      if (searchCity.value) {
        url += `&city=${encodeURIComponent(searchCity.value)}`;
      }
      const res = await axios.get(url);
      if (res.data.code === 200) {
        searchOptions.value = res.data.data
          .filter(tip => tip.location && tip.location.length > 0)
          .map(tip => ({
            id: tip.id || tip.name,
            name: tip.name,
            district: tip.district,
            center: tip.location.split(',').map(Number)
          }));
      }
    } else {
      // 英文模式：使用Mapbox API
      const url = `/api/mapbox/places?query=${encodeURIComponent(query)}`;
      const res = await axios.get(url);
      if (res.data.code === 200 && res.data.data.features) {
        searchOptions.value = res.data.data.features.map(f => ({
          id: f.id,
          name: f.text, // 地点名
          district: f.place_name, // 完整地址
          center: f.center // [lng, lat]
        }));
      }
    }
  } catch (err) {
    console.error('Search failed:', err);
    ElMessage.error(locale.value === 'zh' ? '搜索失败，请稍后重试' : 'Search failed, please try again');
  } finally {
    searching.value = false;
  }
};

// 🎯 选中搜索结果，地图飞行到该位置
const onSelectLocation = (item) => {
  if (!item || !item.center || !map.value) return;

  const fromSystem = getSearchResultCoordSystem();
  const toSystem = getMapCoordSystem();
  const [lng, lat] = transformCoordinate(item.center, fromSystem, toSystem);

  // 地图飞行到该位置
  map.value.flyTo({
    center: [lng, lat],
    zoom: 14,
    duration: 1500
  });
};

const handleMapStyleCommand = (nextStyleKey) => {
  if (!nextStyleKey || nextStyleKey === currentMapStyle.value) return;
  const nextStyle = mapStyleOptions.find(item => item.key === nextStyleKey);
  if (!nextStyle) return;

  const currentCenter = map.value?.getCenter();
  const fromSystem = getMapCoordSystem();
  const toSystem = nextStyle.coordSystem;
  const convertedCenter = transformCoordinate(
    currentCenter ? [currentCenter.lng, currentCenter.lat] : [116.397, 39.918],
    fromSystem,
    toSystem
  );

  const currentView = {
    center: convertedCenter,
    zoom: map.value?.getZoom() ?? 13,
    bearing: map.value?.getBearing() ?? 0,
    pitch: map.value?.getPitch() ?? 0
  };

  if (isEditingFeature.value) {
    cancelEditFeature();
  }
  if (measurementMode.value) {
    clearMeasurement();
  }
  viewModeFeature.value = null;
  drawSelectedId.value = null;
  searchResult.value = null;

  currentMapStyle.value = nextStyleKey;
  initMap(currentView, { preserveView: true });

  ElMessage.success(
    locale.value === 'zh'
      ? `已切换到底图：${nextStyle.labelZh}`
      : `Switched base map to: ${nextStyle.labelEn}`
  );
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

// 🟢 编辑模式的字段列表（从字典配置获取）
const editFormFields = computed(() => {
  if (!editFormData.category || dictionaryConfig.value.length === 0) return [];
  
  const selectedType = dictionaryConfig.value.find(t => t && t.type_code === editFormData.category);
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

const initMap = (initialView = null, options = {}) => {
  if (!token) return ElMessage.error('Mapbox Token Missing');
  const preserveView = !!options.preserveView;

  if (map.value) {
    map.value.remove();
    map.value = null;
  }
  draw.value = null;
  drawSelectedId.value = null;

  const view = initialView || {
    center: [116.397, 39.918],
    zoom: 13,
    bearing: 0,
    pitch: 0
  };

  mapboxgl.accessToken = token;
  map.value = new mapboxgl.Map({
    container: 'map-container',
    style: getMapStyle(),
    center: view.center,
    zoom: view.zoom,
    bearing: view.bearing,
    pitch: view.pitch
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
          'circle-radius': 14,
          'circle-color': '#409EFF',
          'circle-stroke-width': 4,
          'circle-stroke-color': '#fff',
          'circle-opacity': 1
        }
      },
      {
        'id': 'gl-draw-point-inactive',
        'type': 'circle',
        'filter': ['all', ['==', '$type', 'Point'], ['==', 'mode', 'static']],
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
          'circle-radius': 8,
          'circle-color': '#fbb03b',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff'
        }
      }
    ]
  });
  map.value.addControl(draw.value);

  map.value.on('load', () => {
    if (!isAmapProvider.value) {
      add3DBuildings();
    }
    fetchFeatures({ fitToData: !preserveView });

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
    map.value.on('draw.update', handleDrawUpdate);
    // 🟢 监听测量相关的 Draw 事件
    map.value.on('draw.create', handleMeasurementCreate);
    map.value.on('draw.update', handleMeasurementUpdate);
  });

  map.value.on('click', (e) => {
    // 🟢 如果正在编辑模式，不允许点击其他要素
    if (isEditingFeature.value) {
      return;
    }

    // 🟢 在分析模式下，也允许点击查看要素详情（除非在特定的选择模式中）
    // 分析组件的点击事件处理器会在特定模式下处理，这里不做额外检查
    // 因为 Mapbox 允许多个事件监听器，它们会按顺序执行

    if (draw.value.getMode() !== 'simple_select' && draw.value.getMode() !== 'direct_select') {
      return;
    }

    // 🟢 检查图层是否存在，只查询已存在的图层
    const interactLayers = ['market-points', 'market-lines', 'market-polygons'];
    const existingLayers = interactLayers.filter(layerId => map.value.getLayer(layerId));
    
    // 如果没有任何图层存在，直接返回
    if (existingLayers.length === 0) {
      viewModeFeature.value = null;
      return;
    }

    let features = [];
    try {
      features = map.value.queryRenderedFeatures(e.point, {
        layers: existingLayers
      });
    } catch (err) {
      console.warn('查询要素失败:', err);
      return;
    }

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

    // 🟢 只移动到中心位置，不缩放
    let center;
    if (feature.geometry.type === 'Point') {
      center = feature.geometry.coordinates;
    } else {
      // 对于线要素和面要素，计算中心点
      const bounds = new mapboxgl.LngLatBounds();
      const geom = feature.geometry;

      if (geom.type === 'LineString') {
        geom.coordinates.forEach(coord => bounds.extend(coord));
      } else if (geom.type === 'Polygon') {
        geom.coordinates.forEach(ring => {
          ring.forEach(coord => bounds.extend(coord));
        });
      }

      // 获取边界框的中心点
      center = bounds.getCenter().toArray();
    }

    // 移动到中心位置，保持当前缩放级别
    map.value.flyTo({
      center: center,
      speed: 1.2,
      curve: 1
    });
  });

};

const startDraw = (type) => {
  if (!isAdmin.value) {
    ElMessage.warning('游客权限仅可查看，无法添加数据');
    return;
  }
  // 🟢 如果正在测量模式，先退出测量模式
  if (measurementMode.value) {
    clearMeasurement();
  }
  viewModeFeature.value = null;
  if (type === 'point') draw.value.changeMode('draw_point');
  if (type === 'line') draw.value.changeMode('draw_line_string');
  if (type === 'polygon') draw.value.changeMode('draw_polygon');
};

// 🟢 开始测量距离
const startMeasureDistance = () => {
  if (measurementMode.value === 'distance') {
    // 如果已经在距离测量模式，则退出
    clearMeasurement();
    return;
  }
  
  clearMeasurement();
  measurementMode.value = 'distance';
  viewModeFeature.value = null;
  draw.value.changeMode('draw_line_string');
};

// 🟢 开始测量面积
const startMeasureArea = () => {
  if (measurementMode.value === 'area') {
    // 如果已经在面积测量模式，则退出
    clearMeasurement();
    return;
  }
  
  clearMeasurement();
  measurementMode.value = 'area';
  viewModeFeature.value = null;
  draw.value.changeMode('draw_polygon');
};

// 🟢 清除测量结果
const clearMeasurement = () => {
  if (measurementFeatureId.value && draw.value) {
    try {
      draw.value.delete(measurementFeatureId.value);
    } catch (err) {
      // 忽略错误，可能要素已经不存在
    }
  }
  measurementMode.value = null;
  measurementDistance.value = null;
  measurementArea.value = null;
  measurementFeatureId.value = null;
  
  // 切换回简单选择模式
  if (draw.value) {
    draw.value.changeMode('simple_select', { featureIds: [] });
  }
};

// 🟢 格式化距离显示
const formatDistance = (meters) => {
  if (meters < 1000) {
    return `${meters.toFixed(2)} ${locale.value === 'zh' ? '米' : 'm'}`;
  } else {
    return `${(meters / 1000).toFixed(2)} ${locale.value === 'zh' ? '千米' : 'km'}`;
  }
};

// 🟢 格式化面积显示
const formatArea = (squareMeters) => {
  if (squareMeters < 10000) {
    return `${squareMeters.toFixed(2)} ${locale.value === 'zh' ? '平方米' : 'm²'}`;
  } else {
    return `${(squareMeters / 10000).toFixed(2)} ${locale.value === 'zh' ? '公顷' : 'ha'}`;
  }
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
  
  // 🟢 如果是在编辑模式下，且是点要素，更新几何形状
  if (isEditingFeature.value && editingFeatureDrawId.value && viewModeFeature.value) {
    const selectedFeature = e.features.find(f => f.id === editingFeatureDrawId.value);
    if (selectedFeature && viewModeFeature.value.geometry.type === 'Point') {
      // 更新点要素的几何形状（点要素在 simple_select 模式下可以通过拖拽移动）
      viewModeFeature.value.geometry = selectedFeature.geometry;
    }
  }
};

// 🟢 处理测量要素的创建
const handleMeasurementCreate = (e) => {
  if (!measurementMode.value) return;
  
  const feature = e.features[0];
  measurementFeatureId.value = feature.id;
  
  // 计算距离或面积
  if (measurementMode.value === 'distance' && feature.geometry.type === 'LineString') {
    const length = turf.length(feature, { units: 'meters' });
    measurementDistance.value = length;
  } else if (measurementMode.value === 'area' && feature.geometry.type === 'Polygon') {
    const area = turf.area(feature);
    measurementArea.value = area;
  }
};

// 🟢 处理测量要素的更新
const handleMeasurementUpdate = (e) => {
  if (!measurementMode.value) return;
  
  const feature = e.features.find(f => f.id === measurementFeatureId.value);
  if (!feature) return;
  
  // 重新计算距离或面积
  if (measurementMode.value === 'distance' && feature.geometry.type === 'LineString') {
    const length = turf.length(feature, { units: 'meters' });
    measurementDistance.value = length;
  } else if (measurementMode.value === 'area' && feature.geometry.type === 'Polygon') {
    const area = turf.area(feature);
    measurementArea.value = area;
  }
};

const handleDrawCreate = async (e) => {
  // 🟢 如果是测量模式，不处理数据录入
  if (measurementMode.value) {
    return;
  }
  
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
      geometry: geometryToStoreSystem(feature.geometry)
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

// 🟢 为交互图层添加鼠标悬停效果
const addLayerHoverEffects = () => {
  if (!map.value) return;
  
  const interactLayers = ['market-points', 'market-lines', 'market-polygons'];
  interactLayers.forEach(layerId => {
    if (map.value.getLayer(layerId)) {
      // 移除旧的事件监听器（如果存在）
      map.value.off('mouseenter', layerId);
      map.value.off('mouseleave', layerId);
      
      map.value.on('mouseenter', layerId, () => {
        map.value.getCanvas().style.cursor = 'pointer';
      });
      map.value.on('mouseleave', layerId, () => {
        map.value.getCanvas().style.cursor = '';
      });
    }
  });
};

const fetchFeatures = async (options = {}) => {
  const fitToData = options.fitToData !== false;
  try {
    const res = await axios.get(`/api/mapbox/features?t=${new Date().getTime()}`);
    if (res.data.code === 200) {
      const geojson = geojsonToMapSystem(res.data.data);

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
          },
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
          },
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
            'circle-stroke-width': 1, 
            'circle-stroke-color': '#fff'
          },
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
        
        // 🟢 图层创建后添加悬停效果
        addLayerHoverEffects();

        if (fitToData && geojson.features.length > 0) {
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

// 🟢 获取详情面板要显示的所有字段（根据字典配置）
const detailFields = computed(() => {
  if (!viewModeFeature.value || !viewModeFeature.value.properties) {
    return [];
  }
  
  const category = viewModeFeature.value.properties.category;
  if (!category) {
    return [];
  }
  
  // 查找对应的类型配置
  const typeConfig = dictionaryConfig.value.find(t => t && t.type_code === category);
  if (!typeConfig || !typeConfig.fields) {
    return [];
  }
  
  // 返回所有字段，按 sort_order 排序
  return [...typeConfig.fields].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
});

// 🟢 格式化字段值显示（转译原始值）
const formatFieldValue = (field, value) => {
  // 如果值为空，返回空字符串
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  
  // 根据字段类型转译
  switch (field.field_type) {
    case 'boolean':
      // 布尔值转译
      if (value === true || value === 'true' || value === 1 || value === '1') {
        return locale.value === 'zh' ? '是' : 'Yes';
      } else if (value === false || value === 'false' || value === 0 || value === '0') {
        return locale.value === 'zh' ? '否' : 'No';
      }
      return String(value);
    
    case 'select':
      // 下拉选择值转译
      let options = field.options;
      // 如果 options 是字符串，尝试解析
      if (typeof options === 'string') {
        try {
          options = JSON.parse(options);
        } catch (e) {
          console.error('解析 options 失败:', e);
          options = null;
        }
      }
      if (options && Array.isArray(options)) {
        const option = options.find(opt => opt && (opt.value === String(value) || opt.value === value));
        if (option) {
          return locale.value === 'zh' ? option.label_zh : option.label_en;
        }
      }
      return String(value);
    
    case 'date':
      // 日期格式化
      if (value) {
        try {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            // 根据语言格式化日期
            if (locale.value === 'zh') {
              return date.toLocaleDateString('zh-CN', { 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit' 
              });
            } else {
              return date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit' 
              });
            }
          }
        } catch (e) {
          console.error('日期格式化失败:', e);
        }
      }
      return String(value);
    
    case 'rate':
      // 评分显示：显示星级
      const rateValue = Number(value) || 0;
      const stars = '★'.repeat(Math.floor(rateValue)) + '☆'.repeat(5 - Math.floor(rateValue));
      return `${stars} (${rateValue})`;
    
    case 'number':
      // 数字格式化：如果有后缀，添加后缀
      const numValue = Number(value);
      if (isNaN(numValue)) {
        return String(value);
      }
      if (field.suffix) {
        return `${numValue}${field.suffix}`;
      }
      return numValue.toLocaleString(locale.value === 'zh' ? 'zh-CN' : 'en-US');
    
    case 'url':
      // URL 显示为链接文本
      return String(value);
    
    case 'textarea':
    case 'text':
    default:
      // 文本类型直接显示
      return String(value);
  }
};

// 🟢 开始编辑要素
const startEditFeature = () => {
  if (!viewModeFeature.value || !map.value || !draw.value) return;
  
  // 初始化编辑表单数据
  editFormData.name = viewModeFeature.value.properties.name || '';
  editFormData.category = viewModeFeature.value.properties.category || '';
  editFormData.properties = { ...viewModeFeature.value.properties };
  
  // 移除系统字段
  delete editFormData.properties.id;
  delete editFormData.properties.name;
  delete editFormData.properties.category;
  delete editFormData.properties.feature_type;
  
  // 初始化字段默认值
  editFormFields.value.forEach(field => {
    if (editFormData.properties[field.key] === undefined || editFormData.properties[field.key] === null) {
      if (field.type === 'rate') {
        editFormData.properties[field.key] = 0;
      } else if (field.type === 'boolean') {
        editFormData.properties[field.key] = false;
      } else if (field.type === 'number') {
        editFormData.properties[field.key] = null;
      } else {
        editFormData.properties[field.key] = '';
      }
    }
  });
  
  // 🟢 将当前要素添加到 Draw 中，使其可编辑
  try {
    const geometryType = viewModeFeature.value.geometry.type;
    
    // 创建 Draw 格式的要素
    const drawFeature = {
      type: 'Feature',
      id: `edit-${viewModeFeature.value.properties.id}`,
      geometry: { ...viewModeFeature.value.geometry },
      properties: {}
    };
    
    // 添加到 Draw
    draw.value.add(drawFeature);
    editingFeatureDrawId.value = drawFeature.id;
    
    // 🟢 根据几何类型选择不同的编辑模式
    if (geometryType === 'Point') {
      // 点要素使用 simple_select 模式，通过拖拽来移动
      draw.value.changeMode('simple_select', { featureIds: [drawFeature.id] });
      
      // 🟢 确保点要素编辑控制点显示在最上层
      // 通过调整图层顺序，将 Draw 的图层移到所有市场数据图层之后
      setTimeout(() => {
        if (map.value) {
          // 获取所有市场数据图层 ID（作为参考点）
          const marketLayers = [
            'market-polygons',
            'market-polygons-label',
            'market-lines',
            'market-lines-label',
            'market-points',
            'market-points-label'
          ];
          
          // 找到最后一个存在的市场数据图层
          let lastMarketLayer = null;
          for (let i = marketLayers.length - 1; i >= 0; i--) {
            if (map.value.getLayer(marketLayers[i])) {
              lastMarketLayer = marketLayers[i];
              break;
            }
          }
          
          // 获取所有 Draw 相关的图层 ID（按顺序，确保控制点图层在最后）
          const drawLayers = [
            'gl-draw-line',
            'gl-draw-polygon-fill',
            'gl-draw-polygon-stroke-active',
            'gl-draw-point-inactive',
            'gl-draw-polygon-and-line-vertex-active',
            'gl-draw-point-active' // 点要素控制点放在最后，确保在最上层
          ];
          
          // 将 Draw 图层移到最后一个市场数据图层之后
          drawLayers.forEach(layerId => {
            if (map.value.getLayer(layerId)) {
              if (lastMarketLayer) {
                // 移到最后一个市场数据图层之后
                map.value.moveLayer(layerId, lastMarketLayer);
                // 更新 lastMarketLayer 为当前图层，这样下一个图层会在这个图层之后
                lastMarketLayer = layerId;
              } else {
                // 如果没有市场数据图层，直接移到最上层
                map.value.moveLayer(layerId);
              }
            }
          });
        }
      }, 200);
    } else {
      // 线和面要素使用 direct_select 模式，可以编辑节点
      draw.value.changeMode('direct_select', { featureId: drawFeature.id });
      
      // 🟢 确保编辑控制点显示在最上层
      setTimeout(() => {
        if (map.value) {
          // 获取所有市场数据图层 ID（作为参考点）
          const marketLayers = [
            'market-polygons',
            'market-polygons-label',
            'market-lines',
            'market-lines-label',
            'market-points',
            'market-points-label'
          ];
          
          // 找到最后一个存在的市场数据图层
          let lastMarketLayer = null;
          for (let i = marketLayers.length - 1; i >= 0; i--) {
            if (map.value.getLayer(marketLayers[i])) {
              lastMarketLayer = marketLayers[i];
              break;
            }
          }
          
          const drawLayers = [
            'gl-draw-polygon-fill',
            'gl-draw-polygon-stroke-active',
            'gl-draw-line',
            'gl-draw-polygon-and-line-vertex-active' // 控制点图层放在最后，确保在最上层
          ];
          
          // 将 Draw 图层移到最后一个市场数据图层之后
          drawLayers.forEach(layerId => {
            if (map.value.getLayer(layerId)) {
              if (lastMarketLayer) {
                // 移到最后一个市场数据图层之后
                map.value.moveLayer(layerId, lastMarketLayer);
                // 更新 lastMarketLayer 为当前图层，这样下一个图层会在这个图层之后
                lastMarketLayer = layerId;
              } else {
                // 如果没有市场数据图层，直接移到最上层
                map.value.moveLayer(layerId);
              }
            }
          });
        }
      }, 200);
    }
    
    isEditingFeature.value = true;
  } catch (err) {
    console.error('添加要素到 Draw 失败:', err);
    ElMessage.error(locale.value === 'zh' ? '无法启用编辑模式' : 'Failed to enable edit mode');
  }
};

// 🟢 关闭详情面板
const handleCloseDetailPanel = () => {
  // 如果正在编辑，先取消编辑
  if (isEditingFeature.value) {
    cancelEditFeature();
  }
  // 关闭详情面板
  viewModeFeature.value = null;
};

// 🟢 取消编辑
const cancelEditFeature = () => {
  // 🟢 从 Draw 中移除编辑的要素
  if (editingFeatureDrawId.value && draw.value) {
    try {
      draw.value.delete(editingFeatureDrawId.value);
    } catch (err) {
      console.error('移除 Draw 要素失败:', err);
    }
    editingFeatureDrawId.value = null;
  }
  
  // 🟢 切换回简单选择模式
  if (draw.value) {
    draw.value.changeMode('simple_select', { featureIds: [] });
  }
  
  isEditingFeature.value = false;
  editFormData.name = '';
  editFormData.category = '';
  editFormData.properties = {};
};

// 🟢 处理 Draw 更新事件（几何形状被修改时）
const handleDrawUpdate = (e) => {
  // 如果是在编辑模式下，更新 viewModeFeature 的几何形状
  if (isEditingFeature.value && editingFeatureDrawId.value) {
    const updatedFeature = e.features.find(f => f.id === editingFeatureDrawId.value);
    if (updatedFeature && viewModeFeature.value) {
      // 更新几何形状
      viewModeFeature.value.geometry = updatedFeature.geometry;
    }
  }
};

// 🟢 处理 Draw 选择变化事件（用于点要素的拖拽更新）
const handleDrawSelectionChange = (e) => {
  // 如果是在编辑模式下，且是点要素，监听拖拽
  if (isEditingFeature.value && editingFeatureDrawId.value && viewModeFeature.value) {
    const selectedFeature = e.features.find(f => f.id === editingFeatureDrawId.value);
    if (selectedFeature && viewModeFeature.value.geometry.type === 'Point') {
      // 更新点要素的几何形状
      viewModeFeature.value.geometry = selectedFeature.geometry;
    }
  }
  
  // 🟢 调用原有的选择变化处理函数
  handleSelectionChange(e);
};

// 🟢 保存编辑
const saveEditFeature = async () => {
  if (!viewModeFeature.value || !viewModeFeature.value.properties.id) {
    ElMessage.error(locale.value === 'zh' ? '要素ID不存在' : 'Feature ID not found');
    return;
  }
  
  savingEdit.value = true;
  try {
    const featureId = viewModeFeature.value.properties.id;
    
    // 🟢 从 Draw 中获取更新后的几何形状
    let updatedGeometry = viewModeFeature.value.geometry;
    if (editingFeatureDrawId.value && draw.value) {
      try {
        const drawFeature = draw.value.get(editingFeatureDrawId.value);
        if (drawFeature) {
          updatedGeometry = drawFeature.geometry;
        }
      } catch (err) {
        console.warn('获取 Draw 要素失败，使用原始几何形状:', err);
      }
    }
    
    // 准备更新数据（包含几何形状）
    const updateData = {
      name: editFormData.name,
      category: editFormData.category,
      properties: { ...editFormData.properties },
      geometry: geometryToStoreSystem(updatedGeometry)
    };
    
    const res = await axios.put(`/api/mapbox/features/${featureId}`, updateData);
    
    if (res.data.code === 200) {
      ElMessage.success(locale.value === 'zh' ? '更新成功' : 'Update successful');
      
      // 🟢 从 Draw 中移除编辑的要素
      if (editingFeatureDrawId.value && draw.value) {
        try {
          draw.value.delete(editingFeatureDrawId.value);
        } catch (err) {
          console.error('移除 Draw 要素失败:', err);
        }
        editingFeatureDrawId.value = null;
      }
      
      // 🟢 切换回简单选择模式
      if (draw.value) {
        draw.value.changeMode('simple_select', { featureIds: [] });
      }
      
      // 刷新地图数据
      await fetchFeatures();
      
      // 更新当前查看的要素数据
      if (map.value && map.value.getSource('market-data')) {
        const updatedFeature = map.value.getSource('market-data')._data.features.find(
          f => f.properties.id === featureId
        );
        if (updatedFeature) {
          viewModeFeature.value = updatedFeature;
        }
      }
      
      // 退出编辑模式
      isEditingFeature.value = false;
    } else {
      ElMessage.error(res.data.msg || (locale.value === 'zh' ? '更新失败' : 'Update failed'));
    }
  } catch (err) {
    console.error('保存编辑失败:', err);
    ElMessage.error(err.response?.data?.msg || (locale.value === 'zh' ? '更新失败' : 'Update failed'));
  } finally {
    savingEdit.value = false;
  }
};

const parseProperties = (props) => {
  const { id, name, category, feature_type, ...rest } = props;
  return rest;
};
const add3DBuildings = () => {
  if (map.value.getLayer('add-3d-buildings')) return;

  const layers = map.value.getStyle().layers;
  const labelLayer = layers.find(
    (layer) => layer.type === 'symbol' && layer.layout['text-field']
  );
  if (!labelLayer) return;
  const labelLayerId = labelLayer.id;

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

// 🟢 进入人口构成分析模式
const enterDemographicsAnalysis = () => {
  isDemographicsAnalysisMode.value = true;
};

// 🟢 退出人口构成分析模式
const exitDemographicsAnalysis = () => {
  isDemographicsAnalysisMode.value = false;
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

.hud-center {
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
}

.search-box {
  display: flex;
  align-items: center;
  width: 100%;
  max-width: 420px;
}

.search-box :deep(.el-input__wrapper) {
  background-color: rgba(255, 255, 255, 0.1);
  box-shadow: none;
  border: 1px solid rgba(64, 158, 255, 0.3);
}

.search-box :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #409EFF;
  border-color: #409EFF;
}

.search-box :deep(.el-input__inner) {
  color: #fff;
}

.search-box :deep(.el-select__wrapper) {
  background-color: rgba(255, 255, 255, 0.1);
  box-shadow: none;
  border: 1px solid rgba(64, 158, 255, 0.3);
}

.search-box :deep(.el-select__wrapper.is-focused) {
  box-shadow: 0 0 0 1px #409EFF;
  border-color: #409EFF;
}

.search-box :deep(.el-select__placeholder) {
  color: rgba(255, 255, 255, 0.6);
}

.search-box :deep(.el-select__selected-item) {
  color: #fff;
}

.search-box :deep(.el-select__caret) {
  color: rgba(255, 255, 255, 0.6);
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

/* 🟢 测量结果显示样式 */
.measurement-result {
  margin-top: 15px;
  padding: 12px;
  background: rgba(64, 158, 255, 0.1);
  border: 1px solid rgba(64, 158, 255, 0.3);
  border-radius: 6px;
}

.measurement-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
}

.measurement-item:last-child {
  margin-bottom: 0;
}

.measurement-label {
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
}

.measurement-value {
  color: #409EFF;
  font-weight: bold;
  font-size: 14px;
}

/* 🟢 测量结果显示样式 */
.measurement-result {
  margin-top: 15px;
  padding: 12px;
  background: rgba(64, 158, 255, 0.1);
  border: 1px solid rgba(64, 158, 255, 0.3);
  border-radius: 6px;
}

.measurement-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
}

.measurement-item:last-child {
  margin-bottom: 0;
}

.measurement-label {
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
}

.measurement-value {
  color: #409EFF;
  font-weight: bold;
  font-size: 14px;
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

/* 🟢 编辑表单样式 */
.feature-edit {
  padding: 10px 0;
  max-height: calc(100vh - 200px);
  overflow-y: auto;
  overflow-x: hidden;
  /* Firefox 滚动条样式 */
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) rgba(255, 255, 255, 0.05);
}

/* 统一滚动条样式 - WebKit 浏览器 */
.feature-edit::-webkit-scrollbar {
  width: 6px;
}

.feature-edit::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.feature-edit::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.feature-edit::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

.feature-edit :deep(.el-form-item__label) {
  color: #409EFF !important;
  font-size: 0.85rem;
}

.feature-edit :deep(.el-input__wrapper) {
  background-color: rgba(255, 255, 255, 0.05);
  box-shadow: none;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.feature-edit :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #409EFF;
  border-color: #409EFF;
}

.feature-edit :deep(.el-input__inner) {
  color: #fff;
}

.feature-edit :deep(.el-select__wrapper) {
  background-color: rgba(255, 255, 255, 0.05);
  box-shadow: none;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.feature-edit :deep(.el-select__wrapper.is-focused) {
  box-shadow: 0 0 0 1px #409EFF;
  border-color: #409EFF;
}

.feature-edit :deep(.el-select__placeholder) {
  color: rgba(255, 255, 255, 0.6);
}

.feature-edit :deep(.el-select__selected-item) {
  color: #fff;
}

.edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
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
