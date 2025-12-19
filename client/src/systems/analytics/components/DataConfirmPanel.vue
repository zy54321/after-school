<template>
  <div class="data-confirm-panel glass-panel">
    <div class="panel-header">
      <h3>{{ locale === 'zh' ? '步骤 2/3: 确认数据与参数' : 'Step 2/3: Confirm Data & Parameters' }}</h3>
    </div>

    <div class="panel-content">
      <!-- 数据确认区域 -->
      <div class="data-section">
        <div class="section-title">{{ locale === 'zh' ? '小区列表' : 'Communities List' }}</div>
        
        <div v-if="communitiesData.length === 0" class="loading-state">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span>{{ locale === 'zh' ? '正在加载数据...' : 'Loading data...' }}</span>
        </div>

        <div v-else class="communities-list">
          <div 
            v-for="(community, index) in communitiesData" 
            :key="community.community_id || index"
            class="community-card"
          >
            <div class="community-header">
              <span class="community-index">{{ index + 1 }}.</span>
              <span class="community-name">{{ community.name || `小区 ${index + 1}` }}</span>
            </div>
            
            <div class="community-data">
              <div class="data-item">
                <span class="data-label">{{ locale === 'zh' ? '住户数' : 'Households' }}:</span>
                <span :class="['data-value', { missing: !community.basic_info?.households }]">
                  {{ community.basic_info?.households || (locale === 'zh' ? '⚠ 缺失' : '⚠ Missing') }}
                </span>
              </div>
              
              <div class="data-item">
                <span class="data-label">{{ locale === 'zh' ? '房龄' : 'Building Age' }}:</span>
                <span :class="['data-value', { missing: community.basic_info?.building_age === undefined }]">
                  {{ community.basic_info?.building_age !== undefined 
                    ? `${community.basic_info.building_age}${locale === 'zh' ? '年' : ' years'}` 
                    : (locale === 'zh' ? '⚠ 缺失' : '⚠ Missing') }}
                </span>
              </div>
              
              <div class="data-item">
                <span class="data-label">{{ locale === 'zh' ? '价格' : 'Price' }}:</span>
                <span :class="['data-value', { missing: community.basic_info?.avg_price_sqm === undefined }]">
                  {{ community.basic_info?.avg_price_sqm !== undefined 
                    ? `${community.basic_info.avg_price_sqm}${locale === 'zh' ? '元/㎡' : ' ¥/㎡'}` 
                    : (locale === 'zh' ? '⚠ 缺失' : '⚠ Missing') }}
                </span>
              </div>
              
              <div class="data-item">
                <span class="data-label">{{ locale === 'zh' ? '学校' : 'Schools' }}:</span>
                <div class="school-controls">
                  <span class="school-count">{{ community.schools?.length || 0 }}{{ locale === 'zh' ? '所' : ' schools' }}</span>
                  <el-button 
                    link 
                    type="primary" 
                    size="small"
                    @click="enterSchoolSelectionMode(index)"
                    :disabled="schoolSelectionMode !== null"
                  >
                    <el-icon><Plus /></el-icon>
                    {{ locale === 'zh' ? '添加' : 'Add' }}
                  </el-button>
                  <el-button 
                    v-if="community.schools && community.schools.length > 0"
                    link 
                    type="danger" 
                    size="small"
                    @click="clearSchools(index)"
                  >
                    {{ locale === 'zh' ? '清空' : 'Clear' }}
                  </el-button>
                </div>
              </div>
              
              <!-- 学校列表 -->
              <div v-if="community.schools && community.schools.length > 0" class="school-list-mini">
                <div 
                  v-for="(school, sIdx) in community.schools" 
                  :key="sIdx"
                  class="school-item-mini"
                >
                  <span class="school-name">{{ school.name }}</span>
                  <el-button 
                    link 
                    type="danger" 
                    size="small"
                    @click="removeSchoolFromCommunity(index, sIdx)"
                  >
                    ✕
                  </el-button>
                </div>
              </div>
              
              <!-- 添加学校提示 -->
              <div v-if="schoolSelectionMode === index" class="school-selection-hint">
                <el-alert
                  :title="locale === 'zh' ? '请在地图上点击学校进行添加' : 'Please click on schools on the map to add'"
                  type="info"
                  :closable="false"
                  show-icon
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 数据完整性提示 -->
        <div v-if="communitiesData.length > 0" class="confidence-section">
          <div class="confidence-info">
            <span class="confidence-label">{{ locale === 'zh' ? '数据完整性' : 'Data Completeness' }}:</span>
            <el-progress 
              :percentage="overallConfidence" 
              :color="confidenceColor"
              :stroke-width="8"
            />
            <span class="confidence-level">{{ confidenceLevel }}</span>
          </div>
          
          <div v-if="warnings.length > 0" class="warnings">
            <el-alert
              v-for="(warning, index) in warnings"
              :key="index"
              :title="warning"
              type="warning"
              :closable="false"
              show-icon
              style="margin-bottom: 10px;"
            />
          </div>
        </div>
      </div>

      <!-- 参数调整区域 -->
      <div class="parameters-section">
        <div class="section-title">{{ locale === 'zh' ? '参数调整' : 'Parameters' }}</div>
        
        <div class="parameter-item">
          <div class="parameter-label">
            <span>{{ locale === 'zh' ? '入住率' : 'Occupancy Rate' }}</span>
            <span class="parameter-value">{{ Math.round(parameters.occupancyRate * 100) }}%</span>
          </div>
          <el-slider
            v-model="parameters.occupancyRate"
            :min="0.5"
            :max="1"
            :step="0.01"
            :show-tooltip="true"
            :format-tooltip="(val) => Math.round(val * 100) + '%'"
          />
        </div>

        <div class="parameter-item">
          <div class="parameter-label">
            <span>{{ locale === 'zh' ? '户均人数' : 'Avg People per Household' }}</span>
            <span class="parameter-value">
              {{ parameters.avgPeoplePerHousehold !== null && parameters.avgPeoplePerHousehold !== undefined 
                ? parameters.avgPeoplePerHousehold.toFixed(1) 
                : (locale === 'zh' ? '自动估算' : 'Auto') }}
            </span>
          </div>
          <el-input-number
            v-model="parameters.avgPeoplePerHousehold"
            :min="1"
            :max="10"
            :step="0.1"
            :precision="1"
            :placeholder="locale === 'zh' ? '自动计算' : 'Auto calculated'"
            style="width: 100%"
          />
          <div class="parameter-hint">
            {{ locale === 'zh' 
              ? `（已根据房价自动计算为 ${parameters.avgPeoplePerHousehold !== null && parameters.avgPeoplePerHousehold !== undefined ? parameters.avgPeoplePerHousehold.toFixed(1) : 'N/A'} 人/户，可手动修改）` 
              : `(Auto calculated as ${parameters.avgPeoplePerHousehold !== null && parameters.avgPeoplePerHousehold !== undefined ? parameters.avgPeoplePerHousehold.toFixed(1) : 'N/A'} people/household, can be manually adjusted)` }}
          </div>
        </div>
      </div>
    </div>

    <div class="panel-actions">
      <el-button @click="handleBack">
        {{ locale === 'zh' ? '上一步' : 'Previous' }}
      </el-button>
      <el-button 
        type="primary" 
        :loading="isAnalyzing"
        :disabled="!canAnalyze"
        @click="handleAnalyze"
      >
        {{ locale === 'zh' ? '开始分析' : 'Start Analysis' }}
      </el-button>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { Loading, Plus } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import axios from 'axios';
import * as turf from '@turf/turf';

const props = defineProps({
  selectedCommunities: {
    type: Array,
    required: true
  },
  map: {
    type: Object,
    required: true
  },
  initialParameters: {
    type: Object,
    default: () => ({
      occupancyRate: 0.85,
      avgPeoplePerHousehold: null,
      age_distribution_adjustment: undefined
    })
  }
});

const emit = defineEmits(['analyze', 'back']);

const { locale } = useI18n();

// 加载状态
const isLoading = ref(true);
const isAnalyzing = ref(false);

// 小区数据（包含基础信息和学校信息）
const communitiesData = ref([]);

// 学校选择模式（值为小区索引，null表示未激活）
const schoolSelectionMode = ref(null);
const mapClickHandler = ref(null);

// 分析参数
const parameters = ref({
  occupancyRate: props.initialParameters?.occupancyRate || 0.85,
  avgPeoplePerHousehold: props.initialParameters?.avgPeoplePerHousehold || null,
  age_distribution_adjustment: props.initialParameters?.age_distribution_adjustment || undefined
});

// 监听初始参数变化（用于重新分析时更新参数）
watch(() => props.initialParameters, (newParams) => {
  if (newParams) {
    parameters.value.occupancyRate = newParams.occupancyRate || parameters.value.occupancyRate;
    if (newParams.avgPeoplePerHousehold !== undefined) {
      parameters.value.avgPeoplePerHousehold = newParams.avgPeoplePerHousehold;
    }
    if (newParams.age_distribution_adjustment) {
      parameters.value.age_distribution_adjustment = newParams.age_distribution_adjustment;
    }
  }
}, { deep: true });

// 根据房价估算户均人数（与后端算法保持一致）
const estimateHouseholdSize = (avgPriceSqm) => {
  if (!avgPriceSqm || avgPriceSqm === undefined) return null;
  
  // 1. 根据房价估算平均户型面积
  let avgUnitSize;
  if (avgPriceSqm < 10000) {
    avgUnitSize = 80; // 低房价区域，小户型为主
  } else if (avgPriceSqm < 15000) {
    avgUnitSize = 100; // 中等房价，中等户型
  } else if (avgPriceSqm < 20000) {
    avgUnitSize = 120; // 高房价，大户型
  } else {
    avgUnitSize = 150; // 豪宅，超大户型
  }
  
  // 2. 根据户型面积估算户均人数（基于济南消费水平）
  let avgPeople;
  if (avgUnitSize < 90) {
    avgPeople = 2.5; // 小户型，2-3人
  } else if (avgUnitSize < 120) {
    avgPeople = 3.0; // 中等户型，3人
  } else if (avgUnitSize < 150) {
    avgPeople = 3.5; // 大户型，3-4人
  } else {
    avgPeople = 4.0; // 超大户型，4人以上
  }
  
  return avgPeople;
};

// 计算平均户均人数（多个小区的平均值）
const calculateAvgPeoplePerHousehold = () => {
  const prices = communitiesData.value
    .map(c => c.basic_info?.avg_price_sqm)
    .filter(p => p !== undefined && p !== null);
  
  if (prices.length === 0) return null;
  
  // 计算每个小区的户均人数，然后取平均值
  const householdSizes = prices
    .map(price => estimateHouseholdSize(price))
    .filter(size => size !== null);
  
  if (householdSizes.length === 0) return null;
  
  const avgSize = householdSizes.reduce((sum, size) => sum + size, 0) / householdSizes.length;
  return Math.round(avgSize * 10) / 10; // 保留一位小数
};

// 计算置信度
const overallConfidence = computed(() => {
  if (communitiesData.value.length === 0) return 0;
  
  let totalScore = 0;
  communitiesData.value.forEach(community => {
    let score = 0;
    const basicInfo = community.basic_info || {};
    
    // 住户数权重 40%
    if (basicInfo.households) score += 0.4;
    
    // 房龄权重 25%
    if (basicInfo.building_age !== undefined) score += 0.25;
    
    // 价格权重 20%
    if (basicInfo.avg_price_sqm !== undefined) score += 0.2;
    
    // 学校信息权重 15%
    if (community.schools && community.schools.length > 0) score += 0.15;
    
    // 核心数据齐全加分
    if (basicInfo.households && basicInfo.building_age !== undefined && basicInfo.avg_price_sqm !== undefined) {
      score += 0.1;
    }
    
    totalScore += Math.min(score, 1.0);
  });
  
  return Math.round((totalScore / communitiesData.value.length) * 100);
});

// 置信度等级
const confidenceLevel = computed(() => {
  const score = overallConfidence.value;
  if (score >= 80) return locale.value === 'zh' ? 'High' : 'High';
  if (score >= 50) return locale.value === 'zh' ? 'Medium' : 'Medium';
  return locale.value === 'zh' ? 'Low' : 'Low';
});

// 置信度颜色
const confidenceColor = computed(() => {
  const score = overallConfidence.value;
  if (score >= 80) return '#67C23A';
  if (score >= 50) return '#E6A23C';
  return '#F56C6C';
});

// 警告信息
const warnings = computed(() => {
  const warningsList = [];
  
  communitiesData.value.forEach((community, index) => {
    const basicInfo = community.basic_info || {};
    const communityName = community.name || `${locale.value === 'zh' ? '小区' : 'Community'} ${index + 1}`;
    
    if (!basicInfo.households) {
      warningsList.push(
        locale.value === 'zh' 
          ? `${communityName}: 缺少住户数数据，无法准确计算总人口`
          : `${communityName}: Missing households data, cannot accurately calculate total population`
      );
    }
    
    if (basicInfo.building_age === undefined) {
      warningsList.push(
        locale.value === 'zh'
          ? `${communityName}: 缺少房龄数据，年龄分布可能不够准确`
          : `${communityName}: Missing building age data, age distribution may be inaccurate`
      );
    }
    
    if (basicInfo.avg_price_sqm === undefined) {
      warningsList.push(
        locale.value === 'zh'
          ? `${communityName}: 缺少价格数据，户均人数估算可能不够准确`
          : `${communityName}: Missing price data, household size estimate may be inaccurate`
      );
    }
  });
  
  return warningsList;
});

// 是否可以开始分析
const canAnalyze = computed(() => {
  return communitiesData.value.length > 0 && 
         communitiesData.value.every(c => c.basic_info?.households > 0);
});

// 从要素提取基础信息
const extractBasicInfo = (feature) => {
  const props = feature.properties || {};
  
  // 计算位置（Point 或多边形中心点）
  let location = null;
  if (feature.geometry?.type === 'Point') {
    location = { lng: feature.geometry.coordinates[0], lat: feature.geometry.coordinates[1] };
  } else if (feature.geometry?.type === 'Polygon') {
    try {
      const center = turf.centroid(feature.geometry);
      const [lng, lat] = center.geometry.coordinates;
      location = { lng, lat };
    } catch (err) {
      console.warn('计算中心点失败:', err);
    }
  }
  
  // 处理入住率：如果大于1，认为是百分比形式（0-100），需要转换为小数（0-1）
  let occupancyRate = null;
  if (props.occupancyRate !== undefined && props.occupancyRate !== null) {
    occupancyRate = props.occupancyRate > 1 ? props.occupancyRate / 100 : props.occupancyRate;
    // 确保值在合理范围内（0-1）
    occupancyRate = Math.max(0, Math.min(1, occupancyRate));
  }
  
  return {
    households: props.numberOfHouseholds || null,
    building_age: props.buildingAge !== undefined ? props.buildingAge : null,
    avg_price_sqm: props.housingPrices !== undefined ? props.housingPrices : null,
    total_area_sqm: props.total_area_sqm || null,
    occupancyRate: occupancyRate,
    location: location
  };
};

// 进入学校选择模式
const enterSchoolSelectionMode = (index) => {
  if (!props.map) return;
  
  schoolSelectionMode.value = index;
  
  // 添加地图点击事件
  mapClickHandler.value = handleMapClickForSchool;
  props.map.on('click', mapClickHandler.value);
  
  // 修改鼠标样式
  props.map.getCanvas().style.cursor = 'pointer';
  
  ElMessage.info(locale.value === 'zh' ? '请在地图上点击学校进行添加' : 'Please click on schools on the map to add');
};

// 退出学校选择模式
const exitSchoolSelectionMode = () => {
  if (!props.map) return;
  
  schoolSelectionMode.value = null;
  
  // 移除地图点击事件
  if (mapClickHandler.value) {
    props.map.off('click', mapClickHandler.value);
    mapClickHandler.value = null;
  }
  
  // 恢复鼠标样式
  props.map.getCanvas().style.cursor = '';
};

// 处理地图点击（选择学校）
const handleMapClickForSchool = (e) => {
  // 🟢 只有在学校选择模式下才处理点击，否则允许事件继续传播以查看要素详情
  if (schoolSelectionMode.value === null || !props.map) {
    // 不在学校选择模式下，不处理事件，允许原有的事件处理器继续工作
    return;
  }
  
  const features = props.map.queryRenderedFeatures(e.point, {
    layers: ['market-points', 'market-polygons']
  });
  
  if (features.length === 0) {
    // 没有点击到要素，允许事件继续传播
    return;
  }
  
  const feature = features[0];
  
  // 验证：只允许选择学校类型
  if (feature.properties.category !== 'school') {
    ElMessage.warning(locale.value === 'zh' ? '请选择学校类型' : 'Please select school type');
    // 🟢 点击的不是学校，不阻止事件传播，允许查看该要素的详情
    return;
  }
  
  // 检查是否已添加
  const community = communitiesData.value[schoolSelectionMode.value];
  const existingSchools = community.schools || [];
  const isAlreadyAdded = existingSchools.some(s => 
    s.school_id === feature.properties.id || s.name === feature.properties.name
  );
  
  if (isAlreadyAdded) {
    ElMessage.warning(locale.value === 'zh' ? '该学校已添加' : 'This school has already been added');
    return;
  }
  
  // 计算距离（如果小区有位置信息）
  let distanceMeters = 0;
  if (community.basic_info?.location && feature.geometry?.type === 'Point') {
    try {
      const [schoolLng, schoolLat] = feature.geometry.coordinates;
      const { lng, lat } = community.basic_info.location;
      distanceMeters = Math.round(
        turf.distance([lng, lat], [schoolLng, schoolLat], { units: 'meters' })
      );
    } catch (err) {
      console.warn('计算距离失败:', err);
    }
  }
  
  // 添加学校
  const school = {
    school_id: feature.properties.id || feature.properties.name,
    name: feature.properties.name || 'Unknown School',
    type: feature.properties.school_type || 'primary', // primary/middle/high
    student_capacity: feature.properties.student_capacity || 0,
    distance_meters: distanceMeters,
    is_key_school: feature.properties.is_key_school || false
  };
  
  if (!community.schools) {
    community.schools = [];
  }
  community.schools.push(school);
  
  ElMessage.success(locale.value === 'zh' ? '学校已添加' : 'School added');
  
  // 自动退出选择模式
  exitSchoolSelectionMode();
};

// 从小区移除学校
const removeSchoolFromCommunity = (communityIndex, schoolIndex) => {
  if (communitiesData.value[communityIndex]?.schools) {
    communitiesData.value[communityIndex].schools.splice(schoolIndex, 1);
    ElMessage.success(locale.value === 'zh' ? '学校已移除' : 'School removed');
  }
};

// 清空小区的所有学校
const clearSchools = (index) => {
  if (communitiesData.value[index]) {
    communitiesData.value[index].schools = [];
    ElMessage.success(locale.value === 'zh' ? '学校列表已清空' : 'Schools cleared');
  }
};

// 加载小区数据
const loadCommunitiesData = async () => {
  isLoading.value = true;
  communitiesData.value = [];
  
  try {
    // 从选中的要素提取数据
    communitiesData.value = props.selectedCommunities.map((feature) => {
      const basicInfo = extractBasicInfo(feature);
      
      return {
        community_id: feature.properties?.id || feature.id,
        name: feature.properties?.name || 'Unknown',
        basic_info: basicInfo,
        schools: [] // 初始为空数组，由用户手动输入
      };
    });
    
    // 自动计算户均人数（如果有价格数据）
    const autoCalculatedSize = calculateAvgPeoplePerHousehold();
    if (autoCalculatedSize !== null && parameters.value.avgPeoplePerHousehold === null) {
      parameters.value.avgPeoplePerHousehold = autoCalculatedSize;
    }
    
    // 同步入住率：从小区数据中提取并同步到参数
    // 如果有多个小区，计算平均值；如果只有一个小区，直接使用该小区的入住率
    const occupancyRates = communitiesData.value
      .map(c => c.basic_info?.occupancyRate)
      .filter(r => r !== null && r !== undefined);
    
    if (occupancyRates.length > 0) {
      // 计算平均入住率
      const avgOccupancyRate = occupancyRates.reduce((sum, rate) => sum + rate, 0) / occupancyRates.length;
      // 同步到参数（保留两位小数）
      // 注意：这里始终同步，因为选择不同的小区时，入住率应该更新
      // 用户仍然可以手动调整滑块来覆盖这个值
      parameters.value.occupancyRate = Math.round(avgOccupancyRate * 100) / 100;
    } else {
      // 如果所有小区都没有入住率数据，保持默认值或当前值
      // 如果当前是默认值，则保持默认值；否则保持用户手动设置的值
      if (parameters.value.occupancyRate === 0.85 || 
          parameters.value.occupancyRate === props.initialParameters?.occupancyRate) {
        parameters.value.occupancyRate = 0.85; // 保持默认值
      }
    }
  } catch (err) {
    console.error('加载小区数据失败:', err);
    ElMessage.error(locale.value === 'zh' ? '加载数据失败' : 'Failed to load data');
  } finally {
    isLoading.value = false;
  }
};

// 开始分析
const handleAnalyze = async () => {
  if (!canAnalyze.value) {
    ElMessage.warning(locale.value === 'zh' ? '请确保所有小区都有住户数数据' : 'Please ensure all communities have households data');
    return;
  }
  
  isAnalyzing.value = true;
  
  try {
    // 准备分析数据
    const analysisData = communitiesData.value.map(community => {
      const data = {
        community_id: community.community_id,
        basic_info: community.basic_info,
        schools: community.schools || [],
        manual_overrides: {
          occupancy_rate: parameters.value.occupancyRate,
          avg_people_per_household: parameters.value.avgPeoplePerHousehold || undefined,
          // 如果父组件传入了年龄分布调整，则使用它
          age_distribution_adjustment: parameters.value.age_distribution_adjustment || undefined
        }
      };
      
      // 调试日志
      console.log(`[前端] 准备分析数据 - 小区 ${community.name}:`, {
        community_id: data.community_id,
        households: data.basic_info.households,
        schools_count: data.schools.length,
        schools: data.schools
      });
      
      return data;
    });
    
    emit('analyze', {
      communities: analysisData,
      parameters: parameters.value
    });
  } catch (err) {
    console.error('准备分析数据失败:', err);
    ElMessage.error(locale.value === 'zh' ? '准备分析数据失败' : 'Failed to prepare analysis data');
  } finally {
    isAnalyzing.value = false;
  }
};

// 返回上一步
const handleBack = () => {
  emit('back');
};

// 监听选中小区变化
watch(() => props.selectedCommunities, () => {
  if (props.selectedCommunities.length > 0) {
    loadCommunitiesData();
  }
}, { immediate: true });

onMounted(() => {
  if (props.selectedCommunities.length > 0) {
    loadCommunitiesData();
  }
});

// 组件卸载时清理
onUnmounted(() => {
  exitSchoolSelectionMode();
});
</script>

<style scoped>
.data-confirm-panel {
  position: absolute;
  top: 160px;
  left: 20px;
  width: 400px;
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

.section-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: #409EFF;
  margin-bottom: 15px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(64, 158, 255, 0.2);
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px 20px;
  color: rgba(255, 255, 255, 0.7);
}

.communities-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.community-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 12px;
  transition: all 0.3s;
}

.community-card:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(64, 158, 255, 0.5);
}

.community-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.community-index {
  color: #409EFF;
  font-weight: bold;
  font-size: 0.9rem;
}

.community-name {
  color: #fff;
  font-weight: 600;
  font-size: 0.95rem;
}

.community-data {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.data-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
}

.data-label {
  color: rgba(255, 255, 255, 0.6);
}

.data-value {
  color: #fff;
  font-weight: 500;
}

.data-value.missing {
  color: #E6A23C;
}

.confidence-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.confidence-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 15px;
}

.confidence-label {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.85rem;
}

.confidence-level {
  color: #fff;
  font-weight: 600;
  font-size: 0.9rem;
  text-align: right;
}

.warnings {
  margin-top: 10px;
}

.parameters-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.parameter-item {
  margin-bottom: 20px;
}

.parameter-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.9rem;
}

.parameter-value {
  color: #409EFF;
  font-weight: 600;
}

.parameter-hint {
  margin-top: 5px;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
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

/* 学校控制区域 */
.school-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.school-count {
  color: #fff;
  font-weight: 500;
  font-size: 0.85rem;
}

/* 学校列表（迷你版） */
.school-list-mini {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.school-item-mini {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 4px;
  font-size: 0.8rem;
}

.school-name {
  color: rgba(255, 255, 255, 0.8);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 学校选择提示 */
.school-selection-hint {
  margin-top: 8px;
}
</style>

