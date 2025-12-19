<template>
  <div class="results-panel glass-panel">
    <div class="panel-header">
      <h3>{{ locale === 'zh' ? '步骤 3/3: 查看结果与调整' : 'Step 3/3: View Results & Adjust' }}</h3>
    </div>

    <div class="panel-content">
      <!-- 分析的小区列表 -->
      <div class="communities-section" v-if="communityNames.length > 0">
        <div class="section-title">{{ locale === 'zh' ? '分析小区' : 'Analyzed Communities' }}</div>
        <div class="communities-list">
          <el-tag 
            v-for="(name, index) in communityNames" 
            :key="index"
            class="community-tag"
            effect="dark"
            :color="getTagColor(index)"
          >
            {{ name }}
          </el-tag>
        </div>
      </div>

      <!-- 汇总信息 -->
      <div class="summary-section">
        <div class="summary-item">
          <div class="summary-label">{{ locale === 'zh' ? '总人口' : 'Total Population' }}</div>
          <div class="summary-value">{{ formatNumber(aggregatedResult.total_population) }}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">{{ locale === 'zh' ? '置信度' : 'Confidence' }}</div>
          <div class="summary-value">
            <el-progress 
              :percentage="aggregatedConfidence" 
              :color="confidenceColor"
              :stroke-width="10"
              :show-text="true"
            />
          </div>
        </div>
      </div>

      <!-- 人口金字塔图 -->
      <div class="chart-section">
        <div class="section-title">{{ locale === 'zh' ? '人口年龄结构' : 'Age Distribution' }}</div>
        <div ref="pyramidChartContainer" class="chart-container"></div>
      </div>

      <!-- 数据表格 -->
      <div class="table-section">
        <div class="section-title">{{ locale === 'zh' ? '详细数据' : 'Detailed Data' }}</div>
        <el-table 
          :data="ageDistributionTable" 
          stripe
          border
          size="small"
          style="width: 100%"
        >
          <el-table-column 
            prop="ageGroup" 
            :label="locale === 'zh' ? '年龄组' : 'Age Group'"
            width="100"
          />
          <el-table-column 
            prop="count" 
            :label="locale === 'zh' ? '人数' : 'Count'"
            width="100"
            align="right"
          >
            <template #default="{ row }">
              {{ formatNumber(row.count) }}
            </template>
          </el-table-column>
          <el-table-column 
            prop="percentage" 
            :label="locale === 'zh' ? '占比' : 'Percentage'"
            width="100"
            align="right"
          >
            <template #default="{ row }">
              {{ row.percentage }}%
            </template>
          </el-table-column>
          <el-table-column 
            prop="confidence" 
            :label="locale === 'zh' ? '置信度' : 'Confidence'"
            width="120"
            align="right"
          >
            <template #default="{ row }">
              <el-progress 
                :percentage="row.confidence" 
                :stroke-width="6"
                :show-text="false"
              />
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 使用的参数信息（只读显示） -->
      <div class="parameters-info-section">
        <div class="section-title">{{ locale === 'zh' ? '分析参数' : 'Analysis Parameters' }}</div>
        <div class="parameter-info-list">
          <div class="parameter-info-item">
            <span class="info-label">{{ locale === 'zh' ? '入住率' : 'Occupancy Rate' }}:</span>
            <span class="info-value">{{ Math.round(parameters.occupancyRate * 100) }}%</span>
          </div>
          <div class="parameter-info-item">
            <span class="info-label">{{ locale === 'zh' ? '户均人数' : 'Avg People per Household' }}:</span>
            <span class="info-value">
              {{ parameters.avgPeoplePerHousehold !== null && parameters.avgPeoplePerHousehold !== undefined 
                ? parameters.avgPeoplePerHousehold.toFixed(1) + (locale === 'zh' ? ' 人/户' : ' people/household')
                : (locale === 'zh' ? '自动估算' : 'Auto estimated') }}
            </span>
          </div>
        </div>
        <div class="parameter-hint">
          {{ locale === 'zh' ? '如需调整参数，请返回上一步修改' : 'To adjust parameters, please go back to the previous step' }}
        </div>
      </div>
    </div>

    <div class="panel-actions">
      <el-button @click="handleBack">
        {{ locale === 'zh' ? '上一步' : 'Previous' }}
      </el-button>
      <el-button 
        type="primary"
        @click="handleComplete"
      >
        {{ locale === 'zh' ? '完成' : 'Complete' }}
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import * as echarts from 'echarts';

const props = defineProps({
  analysisResult: {
    type: Object,
    required: true
  },
  parameters: {
    type: Object,
    required: true
  },
  selectedCommunities: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['back', 'complete']);

const { locale } = useI18n();

// 图表容器
const pyramidChartContainer = ref(null);
let pyramidChart = null;

// 格式化数字
const formatNumber = (num) => {
  if (!num) return '0';
  return num.toLocaleString('zh-CN');
};

// 获取小区名称列表
const communityNames = computed(() => {
  if (!props.selectedCommunities || props.selectedCommunities.length === 0) {
    // 如果没有传递 selectedCommunities，尝试从分析结果中获取
    if (props.analysisResult && props.analysisResult.results) {
      return props.analysisResult.results
        .filter(r => r.success && r.community_id)
        .map(r => {
          // 尝试从 community_id 中提取名称，或者使用默认名称
          const id = r.community_id;
          if (typeof id === 'string' && id.startsWith('community_')) {
            return id.replace('community_', '') + (locale.value === 'zh' ? '号小区' : ' Community');
          }
          return id || (locale.value === 'zh' ? '未知小区' : 'Unknown Community');
        });
    }
    return [];
  }
  
  // 从 selectedCommunities 中提取名称
  return props.selectedCommunities.map(community => {
    if (typeof community === 'object' && community.properties) {
      return community.properties.name || community.properties.id || (locale.value === 'zh' ? '未知小区' : 'Unknown Community');
    }
    if (typeof community === 'object' && community.name) {
      return community.name;
    }
    return (locale.value === 'zh' ? '未知小区' : 'Unknown Community');
  });
});

// 获取标签颜色（循环使用不同颜色）
const getTagColor = (index) => {
  const colors = ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399'];
  return colors[index % colors.length];
};

// 聚合结果（多个小区的汇总）
const aggregatedResult = computed(() => {
  if (!props.analysisResult || !props.analysisResult.results) {
    console.warn('分析结果为空或格式不正确:', props.analysisResult);
    return {
      total_population: 0,
      age_distribution: {}
    };
  }

  const results = props.analysisResult.results.filter(r => r.success);
  if (results.length === 0) {
    console.warn('没有成功的分析结果');
    return {
      total_population: 0,
      age_distribution: {}
    };
  }

  console.log('处理分析结果:', results);

  // 汇总所有小区的数据
  const totalPopulation = results.reduce((sum, r) => {
    // 修复：后端返回的数据结构是 r.demographics，不是 r.result.demographics
    const pop = r.demographics?.total_population || 0;
    return sum + pop;
  }, 0);

  // 汇总年龄分布
  const ageDistribution = {};
  const ageGroups = ['0-6', '7-18', '19-35', '36-59', '60+'];
  
  ageGroups.forEach(group => {
    let totalCount = 0;
    results.forEach(r => {
      // 修复：后端返回的数据结构是 r.demographics.age_distribution
      const dist = r.demographics?.age_distribution || {};
      if (dist[group]) {
        totalCount += dist[group].count || 0;
      }
    });
    ageDistribution[group] = {
      count: totalCount,
      percentage: totalPopulation > 0 ? parseFloat((totalCount / totalPopulation * 100).toFixed(1)) : 0
    };
  });

  console.log('聚合结果:', { totalPopulation, ageDistribution });

  return {
    total_population: totalPopulation,
    age_distribution: ageDistribution
  };
});

// 聚合置信度
const aggregatedConfidence = computed(() => {
  if (!props.analysisResult || !props.analysisResult.results) return 0;
  
  const results = props.analysisResult.results.filter(r => r.success);
  if (results.length === 0) return 0;

  const totalConfidence = results.reduce((sum, r) => {
    // 后端返回的 score 是 0-1 之间的小数，需要转换为百分比
    const score = r.confidence?.score || 0;
    console.log('单个置信度:', score, 'from', r.confidence);
    return sum + score;
  }, 0);

  // 计算平均值并转换为百分比（0-1 -> 0-100）
  const avgConfidence = totalConfidence / results.length;
  const percentage = Math.round(avgConfidence * 100);
  console.log('聚合置信度:', { totalConfidence, resultsLength: results.length, avgConfidence, percentage });
  
  return percentage;
});

// 置信度颜色
const confidenceColor = computed(() => {
  const score = aggregatedConfidence.value;
  if (score >= 80) return '#67C23A';
  if (score >= 50) return '#E6A23C';
  return '#F56C6C';
});

// 年龄分布表格数据
const ageDistributionTable = computed(() => {
  const distribution = aggregatedResult.value.age_distribution || {};
  const ageGroups = ['0-6', '7-18', '19-35', '36-59', '60+'];
  
  return ageGroups.map(group => ({
    ageGroup: group,
    count: distribution[group]?.count || 0,
    percentage: distribution[group]?.percentage || 0,
    confidence: aggregatedConfidence.value
  }));
});

// 初始化人口金字塔图
const initPyramidChart = () => {
  if (!pyramidChartContainer.value) return;

  // 销毁旧图表
  if (pyramidChart) {
    pyramidChart.dispose();
  }

  // 创建新图表
  pyramidChart = echarts.init(pyramidChartContainer.value);

  // 准备数据
  const distribution = aggregatedResult.value.age_distribution || {};
  const ageGroups = ['0-6', '7-18', '19-35', '36-59', '60+'];
  
  const maleData = [];
  const femaleData = [];
  const categories = [];

  ageGroups.forEach(group => {
    const count = distribution[group]?.count || 0;
    // 假设男女比例 1:1（实际应该根据数据计算）
    const maleCount = Math.round(count * 0.5);
    const femaleCount = count - maleCount;
    
    maleData.push(maleCount);
    femaleData.push(femaleCount);
    categories.push(group);
  });

  // 配置选项
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      formatter: (params) => {
        const param = params[0];
        const ageGroup = param.name;
        const male = params.find(p => p.seriesName === (locale.value === 'zh' ? '男性' : 'Male'))?.value || 0;
        const female = params.find(p => p.seriesName === (locale.value === 'zh' ? '女性' : 'Female'))?.value || 0;
        return `${ageGroup}<br/>${locale.value === 'zh' ? '男性' : 'Male'}: ${formatNumber(male)}<br/>${locale.value === 'zh' ? '女性' : 'Female'}: ${formatNumber(female)}<br/>${locale.value === 'zh' ? '总计' : 'Total'}: ${formatNumber(male + female)}`;
      }
    },
    legend: {
      data: [
        locale.value === 'zh' ? '男性' : 'Male',
        locale.value === 'zh' ? '女性' : 'Female'
      ],
      top: 10
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: [
      {
        type: 'value',
        position: 'bottom',
        name: locale.value === 'zh' ? '人数' : 'Population',
        axisLabel: {
          formatter: (value) => formatNumber(value)
        }
      },
      {
        type: 'value',
        position: 'top',
        name: locale.value === 'zh' ? '人数' : 'Population',
        axisLabel: {
          formatter: (value) => formatNumber(value)
        }
      }
    ],
    yAxis: {
      type: 'category',
      data: categories,
      axisLabel: {
        formatter: (value) => value + (locale.value === 'zh' ? '岁' : ' years')
      }
    },
    series: [
      {
        name: locale.value === 'zh' ? '男性' : 'Male',
        type: 'bar',
        stack: 'total',
        xAxisIndex: 0,
        itemStyle: {
          color: '#5470c6'
        },
        data: maleData
      },
      {
        name: locale.value === 'zh' ? '女性' : 'Female',
        type: 'bar',
        stack: 'total',
        xAxisIndex: 1,
        itemStyle: {
          color: '#91cc75'
        },
        data: femaleData
      }
    ]
  };

  pyramidChart.setOption(option);

  // 响应式调整
  window.addEventListener('resize', () => {
    if (pyramidChart) {
      pyramidChart.resize();
    }
  });
};


// 返回上一步
const handleBack = () => {
  emit('back');
};

// 完成
const handleComplete = () => {
  emit('complete');
};

// 监听结果变化，更新图表
watch(() => props.analysisResult, () => {
  nextTick(() => {
    initPyramidChart();
  });
}, { deep: true });

// 监听语言变化，更新图表
watch(() => locale.value, () => {
  nextTick(() => {
    initPyramidChart();
  });
});

onMounted(() => {
  nextTick(() => {
    initPyramidChart();
  });
});

onUnmounted(() => {
  if (pyramidChart) {
    pyramidChart.dispose();
    pyramidChart = null;
  }
  window.removeEventListener('resize', () => {});
});
</script>

<style scoped>
.results-panel {
  position: absolute;
  top: 160px;
  left: 20px;
  width: 500px;
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

/* 汇总信息 */
.summary-section {
  display: flex;
  gap: 15px;
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.summary-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.summary-label {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.85rem;
}

.summary-value {
  color: #fff;
  font-size: 1.2rem;
  font-weight: 600;
}

/* 图表区域 */
.chart-section {
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.chart-container {
  width: 100%;
  height: 300px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 4px;
}

/* 表格区域 */
.table-section {
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.table-section :deep(.el-table) {
  background: transparent;
  color: rgba(255, 255, 255, 0.9);
}

.table-section :deep(.el-table th) {
  background: rgba(255, 255, 255, 0.05) !important;
  color: rgba(255, 255, 255, 0.9) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
}

.table-section :deep(.el-table th .cell) {
  color: rgba(255, 255, 255, 0.9) !important;
}

.table-section :deep(.el-table td) {
  background: rgba(255, 255, 255, 0.02) !important;
  color: rgba(255, 255, 255, 0.8) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
}

.table-section :deep(.el-table td .cell) {
  color: rgba(255, 255, 255, 0.8) !important;
}

.table-section :deep(.el-table--striped .el-table__body tr.el-table__row--striped td) {
  background: rgba(255, 255, 255, 0.05) !important;
}

.table-section :deep(.el-table tr) {
  background: transparent !important;
}

.table-section :deep(.el-table__body tr:hover > td) {
  background: rgba(255, 255, 255, 0.08) !important;
}

/* 参数调整区域 */
.parameters-section {
  margin-top: 20px;
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

.panel-actions {
  padding: 15px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.panel-actions .el-button {
  min-width: 80px;
}

/* 年龄分布调整 */
.age-adjustment-group {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-top: 10px;
}

.age-adjustment-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.age-group-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.85rem;
}

.adjustment-value {
  color: #409EFF;
  font-weight: 600;
  font-size: 0.9rem;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.adjustment-hint {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.75rem;
  font-weight: normal;
}

.parameter-description {
  margin-bottom: 10px;
}

/* 小区列表区域 */
.communities-section {
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.communities-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.community-tag {
  margin: 0;
  font-size: 0.85rem;
  padding: 4px 12px;
  border-radius: 4px;
}

.parameters-info-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.parameter-info-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 10px;
}

.parameter-info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
}

.info-label {
  color: rgba(255, 255, 255, 0.6);
}

.info-value {
  color: #409EFF;
  font-weight: 600;
}

.parameter-hint {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.75rem;
  margin-top: 10px;
  font-style: italic;
}
</style>

