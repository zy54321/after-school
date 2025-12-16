<template>
  <div class="war-room-container">
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
        <el-button size="small" class="tool-btn" @click="startDraw('point')">
          <span class="tool-icon">📍</span> {{ t('strategy.actions.point') }}
        </el-button>
        <el-button size="small" class="tool-btn" @click="startDraw('line')">
          <span class="tool-icon">〰️</span> {{ t('strategy.actions.line') }}
        </el-button>
        <el-button size="small" class="tool-btn" @click="startDraw('polygon')">
          <span class="tool-icon">⬡</span> {{ t('strategy.actions.polygon') }}
        </el-button>
        <el-button size="small" class="tool-btn delete-btn" type="danger" @click="deleteSelected"
          :disabled="!drawSelectedId">
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
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'; // 🟢 引入绘图样式
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { Back } from '@element-plus/icons-vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';

const router = useRouter();

const { t, locale } = useI18n();
const toggleLang = () => {
  locale.value = locale.value === 'zh' ? 'en' : 'zh';
  ElMessage.success(`Language switched to ${locale.value.toUpperCase()}`);
};

const saving = ref(false);
const isCanceling = ref(false);

// 🟢 修改：formatKey 函数，使用 i18n 翻译
const formatKey = (key) => {
  // 尝试去 strategy.fields 下找翻译，找不到就显示原 key
  return t(`strategy.fields.${key}`, key);
};

// === 状态管理 ===
const currentTime = ref('');
const map = ref(null);
const draw = ref(null);
const drawSelectedId = ref(null); // 当前选中的绘制图形ID

// 图层开关
const layers = reactive({
  own: true,
  competitor: true,
  school: true,
  community: true,
  route: true,
  block: true,
  hotzone: true
});

// 详情查看模式
const viewModeFeature = ref(null);

// 表单模式
const formVisible = ref(false);
const formData = reactive({
  name: '',
  category: '',
  featureType: '', // Point, LineString, Polygon
  properties: {}   // 动态属性
});
const currentDrawFeatureId = ref(null);

// === 配置：业务分类与颜色 ===
const categoryConfig = [
  // 点
  { value: 'own', label: 'strategy.layerItems.own', color: '#409EFF', type: 'Point' },
  { value: 'competitor', label: 'strategy.layerItems.competitor', color: '#F56C6C', type: 'Point' },
  { value: 'school', label: 'strategy.layerItems.school', color: '#67C23A', type: 'Point' },
  { value: 'community', label: 'strategy.layerItems.community', color: '#E6A23C', type: 'Point' },
  // 线
  { value: 'route', label: 'strategy.layerItems.route', color: '#00FFFF', type: 'LineString' },
  { value: 'block', label: 'strategy.layerItems.block', color: '#FF00FF', type: 'LineString' },
  // 面
  { value: 'hotzone', label: 'strategy.layerItems.hotzone', color: '#FFFF00', type: 'Polygon' }
];

// === 配置：动态表单字段 ===
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

// 核心过滤逻辑
watch(layers, (newVal) => {
  // 防御性检查：地图未加载完成时不执行
  if (!map.value || !map.value.getSource('market-data')) return;

  // 1. 找出所有“开启”的分类
  const activeCategories = Object.keys(newVal).filter(key => newVal[key]);

  // 2. 构造分类过滤器 (Common Filter)
  // 语法解释：判断 'category' 字段的值 是否存在于 activeCategories 数组中
  const categoryFilter = ['in', ['get', 'category'], ['literal', activeCategories]];

  // 3. 应用过滤器 (统一使用 'geometry-type' 代替 '$type')

  // 点图层 (Point)
  if (map.value.getLayer('market-points')) {
    map.value.setFilter('market-points', [
      'all',
      ['==', ['geometry-type'], 'Point'], // 🟢 修正：使用新版类型判断
      categoryFilter
    ]);
  }

  // 线图层 (LineString)
  if (map.value.getLayer('market-lines')) {
    map.value.setFilter('market-lines', [
      'all',
      ['==', ['geometry-type'], 'LineString'], // 🟢 修正
      categoryFilter
    ]);
  }

  // 面图层 (Polygon)
  if (map.value.getLayer('market-polygons')) {
    map.value.setFilter('market-polygons', [
      'all',
      ['==', ['geometry-type'], 'Polygon'], // 🟢 修正
      categoryFilter
    ]);
  }
}, { deep: true });

// 计算属性：当前可用的分类 (根据绘制的图形类型过滤)
const availableCategories = computed(() => {
  if (!formData.featureType) return [];
  // 简单的类型映射逻辑
  if (formData.featureType === 'Point') {
    return categoryConfig.filter(c => ['own', 'competitor', 'school', 'community'].includes(c.value));
  } else if (formData.featureType === 'LineString') {
    return categoryConfig.filter(c => ['route', 'block'].includes(c.value));
  } else {
    return categoryConfig.filter(c => ['hotzone', 'community'].includes(c.value));
  }
});

// 计算属性：当前表单字段
const currentFormFields = computed(() => {
  return formSchema[formData.category] || [];
});

// === 地图初始化 ===
const initMap = () => {
  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  if (!token) return ElMessage.error('Mapbox Token Missing');

  mapboxgl.accessToken = token;
  map.value = new mapboxgl.Map({
    container: 'map-container',
    style: 'mapbox://styles/mapbox/dark-v11',
    center: [116.397, 39.918],
    zoom: 13,
    // pitch: 90
  });

  // 🟢 初始化绘图控件
  draw.value = new MapboxDraw({
    displayControlsDefault: false,
    controls: {
      point: true,
      line_string: true,
      polygon: true,
      trash: true
    },
    // 👇 请完全覆盖 styles 数组
    styles: [
      // 1. 线条样式 (只针对 LineString)
      {
        'id': 'gl-draw-line',
        'type': 'line',
        'filter': ['all', ['==', '$type', 'LineString'], ['!=', 'mode', 'static']],
        'layout': { 'line-cap': 'round', 'line-join': 'round' },
        'paint': {
          'line-color': '#409EFF', // 科技蓝
          'line-dasharray': [0.2, 2], // 绘制时显示虚线，更有科技感
          'line-width': 4
        }
      },
      // 2. 多边形填充 (只针对 Polygon)
      {
        'id': 'gl-draw-polygon-fill',
        'type': 'fill',
        'filter': ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
        'paint': {
          'fill-color': '#409EFF',
          'fill-opacity': 0.1 // 淡淡的填充
        }
      },
      // 3. 多边形轮廓 (只针对 Polygon)
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
      // 4. 点位样式 (只针对 Point)
      {
        'id': 'gl-draw-point-active',
        'type': 'circle',
        'filter': ['all', ['==', '$type', 'Point'], ['!=', 'mode', 'static']],
        'paint': {
          'circle-radius': 6,
          'circle-color': '#fff'
        }
      },
      // 5. 🟢 关键补充：控制点样式 (Vertex)
      // 如果缺少这个，你在拖拽修改图形时看不到白色的控制点
      {
        'id': 'gl-draw-polygon-and-line-vertex-active',
        'type': 'circle',
        'filter': ['all', ['==', 'meta', 'vertex'], ['!=', 'mode', 'static']],
        'paint': {
          'circle-radius': 5,
          'circle-color': '#fbb03b' // 橙色控制点，显眼
        }
      }
    ]
  });
  map.value.addControl(draw.value);

  map.value.on('load', () => {
    add3DBuildings();
    fetchFeatures(); // 加载已保存的数据

    // 🟢 新增：右键取消绘制
    map.value.on('contextmenu', (e) => {
      const mode = draw.value.getMode();

      // 如果当前是绘图模式 (draw_line_string, draw_polygon, draw_point)
      if (mode.startsWith('draw_')) {
        // 1. 阻止浏览器默认右键菜单
        e.originalEvent.preventDefault();

        // 2. 标记正在取消
        isCanceling.value = true;

        // 3. 尝试删除当前正在画的要素
        draw.value.trash();

        // 4. 强制退出到选择模式
        draw.value.changeMode('simple_select');

        // 5. 延迟重置标志位 (确保 handleDrawCreate 能读到 true)
        setTimeout(() => {
          isCanceling.value = false;
        }, 200);
      }
    });

    // 🟢 监听绘制事件
    map.value.on('draw.create', handleDrawCreate);
    map.value.on('draw.selectionchange', handleSelectionChange);
  });

  map.value.on('click', (e) => {
    // 1. 如果正在绘图模式，不要触发查看详情 (防止画图时误触)
    if (draw.value.getMode() !== 'simple_select' && draw.value.getMode() !== 'direct_select') {
      return;
    }

    // 2. 查询鼠标点击位置的所有目标图层
    const interactLayers = ['market-points', 'market-lines', 'market-polygons'];

    // queryRenderedFeatures 会自动按照图层层级排序，最上面的图层在数组第 0 位
    const features = map.value.queryRenderedFeatures(e.point, {
      layers: interactLayers
    });

    // 3. 如果没点到任何东西，直接返回
    if (!features.length) return;

    // 4. 只取第一个（也就是最上面的那个）
    const feature = features[0];

    // 5. 执行原有的详情展示逻辑
    viewModeFeature.value = feature;

    // 🎯 智能聚焦
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

  // 🟢 鼠标手型样式 (依然可以保留分别绑定，互不影响)
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

// === 绘制逻辑 ===
const startDraw = (type) => {
  if (type === 'point') draw.value.changeMode('draw_point');
  if (type === 'line') draw.value.changeMode('draw_line_string');
  if (type === 'polygon') draw.value.changeMode('draw_polygon');
};

const deleteSelected = () => {
  draw.value.trash();
  drawSelectedId.value = null;
};

const handleSelectionChange = (e) => {
  drawSelectedId.value = e.features.length > 0 ? e.features[0].id : null;
};

// 🟢 绘制完成 -> 弹出表单
const handleDrawCreate = (e) => {
  // 🟢 拦截逻辑：如果是右键取消触发的 create，直接清理掉
  if (isCanceling.value) {
    if (e.features.length > 0) {
      draw.value.delete(e.features[0].id); // 彻底删除残留图形
    }
    return; // 不弹窗，直接结束
  }

  const feature = e.features[0];
  currentDrawFeatureId.value = feature.id;

  // 初始化表单
  formData.name = '';
  formData.category = '';
  formData.featureType = feature.geometry.type; // Point, LineString...
  formData.properties = {};

  formVisible.value = true;
};

// 取消绘制
const cancelDraw = () => {
  formVisible.value = false;
  if (currentDrawFeatureId.value) {
    draw.value.delete(currentDrawFeatureId.value); // 删除刚画的那个
  }
};

// === 🟢 核心：保存数据 ===
const saveFeature = async () => {
  if (!formData.name || !formData.category) return ElMessage.warning('请填写完整信息');

  saving.value = true;
  try {
    // 1. 获取几何数据
    const feature = draw.value.get(currentDrawFeatureId.value);

    // 2. 构造 Payload
    const payload = {
      name: formData.name,
      feature_type: formData.featureType,
      category: formData.category,
      properties: formData.properties, // 动态属性
      geometry: feature.geometry
    };

    // 3. 发送给后端
    const res = await axios.post('/api/mapbox/features', payload);

    if (res.data.code === 200) {
      ElMessage.success('情报已入库');
      formVisible.value = false;

      // 4. 清理绘制图层，重新加载所有数据 (让新数据变成不可编辑的图层)
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

// === 加载已保存数据 ===
const fetchFeatures = async () => {
  try {
    const res = await axios.get('/api/mapbox/features');
    if (res.data.code === 200) {
      const geojson = res.data.data;

      // 更新数据源
      if (map.value.getSource('market-data')) {
        map.value.getSource('market-data').setData(geojson);
      } else {
        map.value.addSource('market-data', { type: 'geojson', data: geojson });

        // 🟢 渲染面
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

        // 🟢 渲染线
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

        // 渲染点 (保持之前的样式)
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

        // 自动聚焦数据区域 (Auto Fit Bounds)
        if (geojson.features.length > 0) {
          // 创建一个空的边界框
          const bounds = new mapboxgl.LngLatBounds();

          geojson.features.forEach((feature) => {
            const geom = feature.geometry;

            if (geom.type === 'Point') {
              // 点：直接扩展坐标
              bounds.extend(geom.coordinates);
            } else if (geom.type === 'LineString') {
              // 线：遍历线上每个点扩展
              geom.coordinates.forEach(coord => bounds.extend(coord));
            } else if (geom.type === 'Polygon') {
              // 面：遍历面上每个点 (面是数组的数组)
              geom.coordinates.forEach(ring => {
                ring.forEach(coord => bounds.extend(coord));
              });
            }
          });

          // 执行平滑缩放
          map.value.fitBounds(bounds, {
            padding: 100,  // 四周留白 100px，防止点贴在屏幕边缘
            maxZoom: 15,   // 最大缩放级别 (防止只有一个点时缩得太近)
            duration: 2000 // 动画时长 2秒
          });
        }
      }
    }
  } catch (err) {
    console.error('Data Load Error', err);
  }
};

// 辅助函数
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
  return rest; // 只显示业务属性
};
const add3DBuildings = () => {
  // 防止重复添加报错
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
        'fill-extrusion-color': '#2a3b55', // 建筑颜色
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

// 周期更新时间
const updateTime = () => {
  const now = new Date();
  currentTime.value = now.toLocaleTimeString('en-US', { hour12: false });
};

onMounted(() => {
  updateTime();
  setInterval(updateTime, 1000);
  initMap();
});
</script>

<style scoped>
.war-room-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;

  width: 100%;
  height: 100%;
  background-color: #000;
  overflow: hidden;
  /* 强制裁剪溢出内容 */
  font-family: 'Inter', sans-serif;
  color: #fff;
}

/* 确保地图容器也是撑满的 */
.map-container {
  width: 100%;
  height: 100%;
}

/* 玻璃面板 */
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

/* 顶部 HUD */
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

/* 侧边面板 */
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

/* 工具按钮 */
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
  /* 强制左对齐 */
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
  /* 固定宽度，确保后面文字对齐 */
  text-align: center;
  margin-right: 8px;
}

.delete-btn:disabled {
  background: rgba(255, 255, 255, 0.02) !important;
  border-color: rgba(255, 255, 255, 0.05) !important;
  color: #555 !important;
}

/* 列表 */
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
  /* dot 和文字的间距 */
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

/* 详情 */
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

/* 弹窗定制 */
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
</style>