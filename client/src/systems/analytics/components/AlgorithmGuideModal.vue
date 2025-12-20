<template>
  <el-dialog v-model="dialogVisible" :title="dialogTitle" width="680px" class="algorithm-guide-dialog"
    :before-close="handleClose" append-to-body align-center>
    <div class="guide-content">
      <div class="intro-box">
        <el-icon class="icon">
          <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
            <path fill="currentColor"
              d="M512 64a448 448 0 1 1 0 896 448 448 0 0 1 0-896zm0 832a384 384 0 1 0 0-768 384 384 0 0 0 0 768zm48-176a48 48 0 1 1-96 0 48 48 0 0 1 96 0zm-80-432a32 32 0 0 1 32-32h64a32 32 0 0 1 32 32v256a32 32 0 0 1-32 32h-64a32 32 0 0 1-32-32V288z">
            </path>
          </svg>
        </el-icon>
        <p>{{ introText }}</p>
      </div>

      <div class="step-section">
        <div class="section-header">
          <span class="step-num">01</span>
          <h4>{{ t_volumeEstimation }}</h4>
        </div>
        <div class="section-body">
          <p class="concept-desc">{{ t_volumeDesc }}</p>
          <div class="formula-box">
            {{ t_formulaContent }}
          </div>
        </div>
      </div>

      <div class="step-section">
        <div class="section-header">
          <span class="step-num">02</span>
          <h4>{{ t_baseProfiling }}</h4>
        </div>
        <div class="section-body">
          <p class="concept-desc">{{ t_baseDesc }}</p>
          <div class="tags-row">
            <el-tag effect="light" type="info" class="profile-tag">0-6{{ isZh ? '岁 (学龄前)' : '' }} <span
                class="percent">8%</span></el-tag>
            <el-tag effect="light" type="primary" class="profile-tag">7-18{{ isZh ? '岁 (K12人群)' : '' }} <span
                class="percent">12%</span></el-tag>
            <el-tag effect="light" type="success" class="profile-tag">19-35{{ isZh ? '岁 (青年)' : '' }} <span
                class="percent">30%</span></el-tag>
            <el-tag effect="light" type="warning" class="profile-tag">36-59{{ isZh ? '岁 (中坚)' : '' }} <span
                class="percent">35%</span></el-tag>
            <el-tag effect="light" type="danger" class="profile-tag">60+{{ isZh ? '岁 (银发)' : '' }} <span
                class="percent">15%</span></el-tag>
          </div>
        </div>
      </div>

      <div class="step-section">
        <div class="section-header">
          <span class="step-num">03</span>
          <h4>{{ t_dynamicAdjustment }}</h4>
        </div>
        <div class="section-body">
          <ul class="advanced-list">
            <li>
              <div class="list-title">
                <span class="bullet green"></span>
                {{ t_buildingAge }}
              </div>
              <div class="list-content">{{ t_buildingAgeContent }}</div>
            </li>
            <li>
              <div class="list-title">
                <span class="bullet blue"></span>
                {{ t_schoolEffect }}
              </div>
              <div class="list-content">{{ t_schoolEffectContent }}</div>
            </li>
          </ul>
        </div>
      </div>

      <div class="step-section">
        <div class="section-header">
          <span class="step-num">04</span>
          <h4>{{ t_confidenceScore }}</h4>
        </div>
        <div class="section-body">
          <div class="confidence-grid">
            <div class="conf-card high">
              <div class="conf-badge">{{ t_confHighTitle }}</div>
              <div class="conf-desc">{{ t_confHighDesc }}</div>
            </div>
            <div class="conf-card medium">
              <div class="conf-badge">{{ t_confMedTitle }}</div>
              <div class="conf-desc">{{ t_confMedDesc }}</div>
            </div>
          </div>
        </div>
      </div>

      <div style="height: 20px;"></div>
    </div>

    <template #footer>
      <span class="dialog-footer">
        <el-button type="primary" @click="handleClose" class="confirm-btn">{{ t_gotIt }}</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  visible: Boolean
});

const emit = defineEmits(['update:visible']);
const { locale } = useI18n();

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val)
});

const handleClose = () => {
  dialogVisible.value = false;
};

// --- 文案部分：商业化与专业化升级 ---

const isZh = computed(() => locale.value === 'zh');

const dialogTitle = computed(() => isZh.value ? '核心算法原理说明 (Algorithm Model)' : 'Core Algorithm Principles');

const introText = computed(() => isZh.value
  ? '本系统内置自主研发的“城市网格化人口推演引擎 (USG-DIE)”。基于 GIS 空间数据与多源异构数据融合技术，通过静态建筑指标精准反演动态人口画像，为校区选址与市场决策提供科学依据。'
  : 'Powered by our proprietary "Urban Spatial Grid Demographic Inference Engine (USG-DIE)". Leveraging GIS spatial data and multi-source fusion, it accurately reconstructs dynamic population profiles from static building metrics for strategic decision-making.');

// Step 1: 居住承载力建模
const t_volumeEstimation = computed(() => isZh.value ? '居住承载力建模 (Capacity Modeling)' : 'Capacity Modeling');
const t_volumeDesc = computed(() => isZh.value
  ? '融合房价与建筑面积双重因子，自动识别“刚需/改善/豪宅”属性，精准匹配家庭结构密度。'
  : 'Integrates price and area factors to identify property attributes (Starter/Upgrade/Luxury) and accurately match family structure density.');
const t_formulaContent = computed(() => isZh.value
  ? '推演公式：区域总人口 = 规划户数 × (户均密度系数 × 户型修正) × 实时入住率'
  : 'Formula: Total Pop = Units × (Density Factor × Type Adjustment) × Real-time Occupancy');

// Step 2: 人口基谱构建
const t_baseProfiling = computed(() => isZh.value ? '人口基谱构建 (Baseline Spectrum)' : 'Baseline Spectrum Construction');
const t_baseDesc = computed(() => isZh.value
  ? '锚定国家统计局最新人口普查数据，构建符合本地区域特征的“标准正态分布模型”，作为算法推演的初始基准。'
  : 'Anchored to the latest census data, constructing a "Standard Normal Distribution Model" aligned with regional characteristics as the initial inference benchmark.');

// Step 3: 时空多维校准
const t_dynamicAdjustment = computed(() => isZh.value ? '时空多维校准 (Spatio-Temporal Calibration)' : 'Spatio-Temporal Calibration');
const t_buildingAge = computed(() => isZh.value ? '生命周期耦合 (Lifecycle Coupling)' : 'Lifecycle Coupling');
const t_buildingAgeContent = computed(() => isZh.value
  ? '基于“社区老化理论”模型，对新房权重向“青年置业”倾斜，老旧社区向“银发与原住民”倾斜，动态还原社区代际更替。'
  : 'Based on "Community Aging Theory", weighting new builds towards "Young Homeowners" and older communities towards "Silver Generation" to model generational shifts.');
const t_schoolEffect = computed(() => isZh.value ? '资源引力场 (Resource Gravity Model)' : 'Resource Gravity Model');
const t_schoolEffectContent = computed(() => isZh.value
  ? '引入“教育资源引力”算法，量化名校对学龄家庭（7-18岁）及陪读家长（36-59岁）的吸附效应，计算距离衰减指数。'
  : 'Implements "Educational Gravity" algorithms to quantify the attraction of top schools on school-age families (7-18) and parents (36-59), calculating distance decay indices.');

// Step 4: 数据置信度评估
const t_confidenceScore = computed(() => isZh.value ? '数据完备度与置信评估 (Data Fidelity)' : 'Data Fidelity Assessment');
const t_confHighTitle = computed(() => isZh.value ? 'High 高置信' : 'High Fidelity');
const t_confHighDesc = computed(() => isZh.value
  ? '四维数据（户数/房龄/房价/POI）完全闭环，结果具备极高参考价值，可直接用于战略决策。'
  : '4D data loop (Units/Age/Price/POI) closed. Highly reliable for strategic decision-making.');
const t_confMedTitle = computed(() => isZh.value ? 'Medium 中置信' : 'Medium Fidelity');
const t_confMedDesc = computed(() => isZh.value
  ? '缺失部分非核心因子，系统自动启用“缺省值填补机制 (Default Imputation)”，建议结合实地调研。'
  : 'Partial non-core factors missing. "Default Imputation Mechanism" triggered. Field verification recommended.');

const t_gotIt = computed(() => isZh.value ? '确认' : 'Confirm');
</script>

<style scoped>
.guide-content {
  line-height: 1.6;
  color: #606266;
  max-height: 60vh;
  overflow-y: auto;
  padding-right: 12px;
}

/* 滚动条美化 */
.guide-content::-webkit-scrollbar {
  width: 6px;
}

.guide-content::-webkit-scrollbar-thumb {
  background: #dcdfe6;
  border-radius: 3px;
}

.guide-content::-webkit-scrollbar-track {
  background: transparent;
}

/* 顶部介绍卡片 */
.intro-box {
  background: linear-gradient(to right, #ecf5ff, #f0f9eb);
  border-left: 4px solid #409EFF;
  padding: 16px;
  margin-bottom: 24px;
  border-radius: 4px;
  display: flex;
  gap: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
}

.intro-box .icon {
  color: #409EFF;
  font-size: 20px;
  margin-top: 2px;
  flex-shrink: 0;
}

.intro-box p {
  margin: 0;
  font-size: 0.95rem;
  color: #2c3e50;
  font-weight: 500;
  text-align: justify;
}

/* 步骤通用样式 */
.step-section {
  margin-bottom: 24px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 16px;
  background: #fff;
  transition: all 0.3s;
}

.step-section:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border-color: #d9ecff;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  border-bottom: 1px solid #f2f6fc;
  padding-bottom: 10px;
}

.step-num {
  font-size: 1.5rem;
  font-weight: 900;
  color: #e6e8eb;
  line-height: 1;
}

.section-header h4 {
  margin: 0;
  color: #303133;
  font-size: 1.05rem;
  font-weight: 700;
}

.concept-desc {
  font-size: 0.9rem;
  color: #606266;
  margin-bottom: 12px;
  text-align: justify;
}

/* 公式盒子 */
.formula-box {
  background: #f8f9fa;
  padding: 10px 15px;
  border-radius: 6px;
  font-family: Consolas, Monaco, monospace;
  font-size: 0.85rem;
  color: #409EFF;
  border: 1px dashed #d9ecff;
}

/* 标签行 */
.tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.profile-tag {
  font-weight: 500;
  border: none;
}

.profile-tag .percent {
  font-weight: 800;
  margin-left: 4px;
}

/* 高级列表 */
.advanced-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.advanced-list li {
  margin-bottom: 12px;
}

.advanced-list li:last-child {
  margin-bottom: 0;
}

.list-title {
  font-weight: 700;
  color: #303133;
  font-size: 0.95rem;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.bullet {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.bullet.green {
  background: #67C23A;
}

.bullet.blue {
  background: #409EFF;
}

.list-content {
  font-size: 0.9rem;
  color: #606266;
  padding-left: 12px;
  border-left: 2px solid #f2f6fc;
  margin-left: 3px;
  text-align: justify;
}

/* 置信度网格 */
.confidence-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.conf-card {
  padding: 12px;
  border-radius: 6px;
  font-size: 0.85rem;
}

.conf-card.high {
  background: #f0f9eb;
  border: 1px solid #e1f3d8;
}

.conf-card.medium {
  background: #fdf6ec;
  border: 1px solid #faecd8;
}

.conf-badge {
  font-weight: 800;
  margin-bottom: 6px;
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
}

.conf-card.high .conf-badge {
  background: #67C23A;
  color: white;
}

.conf-card.medium .conf-badge {
  background: #E6A23C;
  color: white;
}

.conf-desc {
  color: #606266;
  line-height: 1.4;
  text-align: justify;
}

.confirm-btn {
  padding-left: 30px;
  padding-right: 30px;
  font-weight: 600;
}
</style>