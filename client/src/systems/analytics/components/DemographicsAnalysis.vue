<template>
  <div class="demographics-analysis-mode">
    <!-- 顶部导航栏 -->
    <div class="analysis-header glass-panel">
      <el-button circle plain :icon="Back" class="back-btn" @click="handleExit" />
      <span class="analysis-title">{{ locale === 'zh' ? '人口构成分析' : 'Demographics Analysis' }}</span>
    </div>

    <!-- 步骤指示器 -->
    <div class="step-indicator glass-panel">
      <div 
        v-for="(step, index) in steps" 
        :key="index"
        :class="['step-item', { active: currentStep === index + 1, completed: currentStep > index + 1 }]"
      >
        <div class="step-number">{{ index + 1 }}</div>
        <div class="step-label">{{ step }}</div>
      </div>
    </div>

    <!-- Step 1: 选择小区 -->
    <SelectCommunitiesPanel 
      v-if="currentStep === 1"
      :map="map"
      :selectedCommunities="selectedCommunities"
      @update:selectedCommunities="handleCommunitySelect"
      @complete="handleSelectComplete"
      @cancel="handleCancel"
    />

    <!-- Step 2: 数据确认 -->
    <DataConfirmPanel 
      v-if="currentStep === 2"
      :selectedCommunities="selectedCommunities"
      :map="map"
      :initialParameters="analysisParameters"
      @analyze="handleStartAnalysis"
      @back="handleBackToStep1"
    />

    <!-- Step 3: 结果展示 -->
    <ResultsPanel 
      v-if="currentStep === 3 && analysisResult"
      :analysisResult="analysisResult"
      :parameters="analysisParameters"
      :selectedCommunities="selectedCommunities"
      @back="handleBackToStep2"
      @complete="handleExit"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Back } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import axios from 'axios';
import SelectCommunitiesPanel from './SelectCommunitiesPanel.vue';
import DataConfirmPanel from './DataConfirmPanel.vue';
import ResultsPanel from './ResultsPanel.vue';

const props = defineProps({
  map: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['exit']);

const { locale } = useI18n();

// 步骤定义
const steps = computed(() => {
  return locale.value === 'zh' 
    ? ['选择小区', '确认数据', '查看结果']
    : ['Select Communities', 'Confirm Data', 'View Results'];
});

// 当前步骤
const currentStep = ref(1);

// 选中的小区列表
const selectedCommunities = ref([]);

// 分析参数
const analysisParameters = ref({
  occupancyRate: 0.85,
  avgPeoplePerHousehold: null
});

// 分析结果
const analysisResult = ref(null);

// 处理小区选择（使用 v-model 模式）
const handleCommunitySelect = (communities) => {
  selectedCommunities.value = communities;
};

// 完成选择，进入下一步
const handleSelectComplete = () => {
  if (selectedCommunities.value.length === 0) {
    return;
  }
  currentStep.value = 2;
};

// 返回 Step 1
const handleBackToStep1 = () => {
  currentStep.value = 1;
};

// 返回 Step 2
const handleBackToStep2 = () => {
  currentStep.value = 2;
};

// 开始分析
const handleStartAnalysis = async (data) => {
  // 保存参数
  analysisParameters.value = data.parameters;
  
  // 显示加载状态
  const loadingMessage = ElMessage({
    message: locale.value === 'zh' ? '正在分析中，请稍候...' : 'Analyzing, please wait...',
    type: 'info',
    duration: 0, // 不自动关闭
    showClose: false
  });
  
  try {
    // 调用后端批量计算API
    const response = await axios.post('/api/analytics/demographics/batch', {
      communities: data.communities
    });
    
    if (response.data.code === 200) {
      // 保存分析结果
      analysisResult.value = response.data.data;
      
      // 进入 Step 3（结果展示）
      currentStep.value = 3;
      
      loadingMessage.close();
      ElMessage.success(locale.value === 'zh' ? '分析完成' : 'Analysis completed');
    } else {
      throw new Error(response.data.msg || '分析失败');
    }
  } catch (error) {
    console.error('分析失败:', error);
    loadingMessage.close();
    
    const errorMsg = error.response?.data?.msg || error.message || 
      (locale.value === 'zh' ? '分析失败，请稍后重试' : 'Analysis failed, please try again');
    ElMessage.error(errorMsg);
  }
};



// 取消操作
const handleCancel = () => {
  handleExit();
};

// 退出分析模式
const handleExit = () => {
  currentStep.value = 1;
  selectedCommunities.value = [];
  analysisResult.value = null;
  emit('exit');
};
</script>

<style scoped>
.demographics-analysis-mode {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  pointer-events: none;
}

.glass-panel {
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(56, 189, 248, 0.3);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  border-radius: 8px;
  pointer-events: auto;
}

.analysis-header {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 12px 24px;
  z-index: 1001;
}

.back-btn {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.3);
}

.back-btn:hover {
  border-color: #409EFF;
  background-color: rgba(64, 158, 255, 0.1);
}

.analysis-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: #fff;
  letter-spacing: 1px;
}

.step-indicator {
  position: absolute;
  top: 90px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 30px;
  padding: 15px 30px;
  z-index: 1001;
}

.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  opacity: 0.5;
  transition: opacity 0.3s;
}

.step-item.active {
  opacity: 1;
}

.step-item.completed {
  opacity: 0.8;
}

.step-number {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: bold;
  font-size: 0.9rem;
  transition: all 0.3s;
}

.step-item.active .step-number {
  background: #409EFF;
  border-color: #409EFF;
  box-shadow: 0 0 10px rgba(64, 158, 255, 0.5);
}

.step-item.completed .step-number {
  background: #67C23A;
  border-color: #67C23A;
}

.step-label {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.8);
  white-space: nowrap;
}

.step-item.active .step-label {
  color: #fff;
  font-weight: 600;
}

.step-panel {
  position: absolute;
  top: 160px;
  left: 20px;
  width: 320px;
  padding: 20px;
  max-height: calc(100vh - 200px);
  overflow-y: auto;
}

.step-content {
  color: #fff;
}

.step-content h3 {
  margin: 0 0 15px 0;
  font-size: 1rem;
  color: #409EFF;
}

.step-content p {
  margin: 0;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.9rem;
}
</style>

