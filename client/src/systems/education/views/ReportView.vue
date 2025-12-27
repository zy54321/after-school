<template>
  <div class="report-h5 min-h-screen bg-[#f5f7fa] pb-10 font-sans" v-loading="loading">

    <div v-if="report" class="max-w-md mx-auto relative overflow-hidden bg-white min-h-screen shadow-2xl">

      <div class="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-6 pb-12 relative">
        <div class="flex justify-between items-start z-10 relative">
          <div>
            <div class="text-blue-100 text-sm tracking-widest uppercase mb-1">Daily Report</div>
            <h1 class="text-3xl font-bold">{{ report.student_name }}</h1>
            <div class="opacity-80 text-sm mt-1">{{ formatDate(report.report_date) }} · 特训成长日报</div>
          </div>
          <div class="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
            <span class="text-2xl font-bold">{{ getDailyScore() }}</span>
            <span class="text-xs ml-1">分</span>
          </div>
        </div>
        <div
          class="absolute top-0 right-0 w-48 h-48 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2">
        </div>
      </div>

      <div class="px-4 -mt-8 relative z-10">
        <div class="bg-white rounded-2xl shadow-xl p-4">
          <div class="text-center text-gray-500 text-xs mb-2">今日五维能力模型</div>
          <div ref="radarChartRef" class="w-full h-[220px]"></div>
        </div>
      </div>

      <div class="px-4 mt-4">
        <div class="bg-white rounded-2xl shadow-sm p-4 border border-gray-100">
          <div class="flex justify-between items-center mb-2">
            <h3 class="font-bold text-gray-800 flex items-center">
              <span class="w-1 h-4 bg-blue-500 rounded-full mr-2"></span>
              专注力成长曲线
            </h3>
            <span class="text-xs text-gray-400">近7天趋势</span>
          </div>
          <div class="flex items-baseline mb-2">
            <span class="text-2xl font-bold text-blue-600 font-mono">{{ report.focus_minutes }}</span>
            <span class="text-xs text-gray-500 ml-1">分钟 (今日有效时长)</span>
          </div>
          <div ref="lineChartRef" class="w-full h-[180px]"></div>
        </div>
      </div>

      <div class="px-4 mt-4 grid grid-cols-2 gap-3">
        <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div class="text-gray-400 text-xs mb-1">作业评级</div>
          <div class="text-2xl mb-1">{{ getHwIcon(report.homework_rating) }}</div>
          <div v-if="report.homework_tags?.length" class="flex flex-wrap gap-1">
            <span v-for="tag in report.homework_tags" :key="tag"
              class="bg-red-50 text-red-500 text-[10px] px-1.5 py-0.5 rounded">
              {{ tag }}
            </span>
          </div>
          <div v-else class="text-[10px] text-green-500">质量优秀，无扣分项</div>
        </div>

        <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div class="text-gray-400 text-xs mb-1">饮食情况</div>
          <div class="text-xl font-bold text-gray-800 mb-1 flex items-center">
            {{ getMealText(report.meal_status) }}
          </div>
          <div class="text-[10px] text-gray-500 truncate">{{ report.menu_content || '标准营养餐' }}</div>
          <div v-if="report.evidence_photo_url" class="mt-2">
            <el-image :src="report.evidence_photo_url" class="w-full h-12 rounded bg-gray-100" fit="cover"
              :preview-src-list="[report.evidence_photo_url]" hide-on-click-modal>
              <template #error>
                <div class="w-full h-full flex items-center justify-center bg-gray-50 text-xs text-gray-300">无图</div>
              </template>
            </el-image>
          </div>
        </div>
      </div>

      <div class="px-4 mt-4 mb-8">
        <div
          class="bg-gradient-to-r from-blue-50 to-white rounded-2xl p-5 border border-blue-100 shadow-sm relative overflow-hidden">
          <div class="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
          <div class="font-bold text-blue-800 mb-2 text-sm flex items-center">
            👨‍🏫 老师点评
          </div>
          <p class="text-sm text-gray-700 leading-relaxed text-justify opacity-90">
            {{ report.teacher_comment }}
          </p>
        </div>
      </div>

      <div class="text-center text-[10px] text-gray-300 pb-10">
        POWERED BY 理工爸爸特训系统
      </div>

    </div>

    <div v-else-if="!loading" class="flex flex-col items-center justify-center min-h-screen text-gray-400">
      <div class="text-6xl mb-4">📭</div>
      <p>链接失效或暂无数据</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';
import * as echarts from 'echarts'; // 引入 ECharts

const route = useRoute();
const loading = ref(true);
const report = ref(null);

const radarChartRef = ref(null);
const lineChartRef = ref(null);

const formatDate = (str) => {
  const date = new Date(str);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
};

const getHwIcon = (r) => ({ A: '🌟 优秀', B: '🙂 良好', C: '💣 需改进' }[r] || '🌟');
const getMealText = (s) => ({ finished: '🥣 光盘', leftovers: '🌭 有剩菜', little: '🤢 挑食' }[s] || '光盘');

// 简单计算今日得分 (满分100)
const getDailyScore = () => {
  if (!report.value) return 0;
  let score = 100;
  // 扣分项
  score -= (report.value.distraction_count || 0) * 5; // 走神一次扣5分
  if (report.value.homework_rating === 'B') score -= 10;
  if (report.value.homework_rating === 'C') score -= 20;
  if (report.value.meal_status !== 'finished') score -= 5;
  return Math.max(60, score); // 最低给60分，鼓励为主
};

// 初始化图表
const initCharts = () => {
  if (!report.value) return;

  // --- 1. 雷达图 (五维能力) ---
  const radarChart = echarts.init(radarChartRef.value);
  
  // 辅助函数：将等级(A/B/C)转为分数
  const getScoreFromRating = (r) => ({ A: 100, B: 80, C: 60 }[r] || 90);

  // 计算五维得分
  // 1. 专注力 (真实)
  const focusScore = Math.max(0, 100 - (report.value.distraction_count * 10));
  // 2. 作业 (真实)
  const homeworkScore = getScoreFromRating(report.value.homework_rating);
  // 3. 饮食 (真实)
  const mealScore = report.value.meal_status === 'finished' ? 100 : 70;
  // 4. 纪律 (⭐ 真实)
  const disciplineScore = getScoreFromRating(report.value.discipline_rating);
  // 5. 习惯 (⭐ 真实)
  const habitScore = getScoreFromRating(report.value.habit_rating);

  radarChart.setOption({
    color: ['#3B82F6'],
    radar: {
      indicator: [
        { name: '专注力', max: 100 },
        { name: '作业质量', max: 100 },
        { name: '饮食习惯', max: 100 },
        { name: '行为纪律', max: 100 },
        { name: '生活习惯', max: 100 }
      ],
      radius: '65%',
      splitNumber: 4,
      axisName: { color: '#9CA3AF', fontSize: 10 },
      splitArea: { areaStyle: { color: ['#F3F4F6', '#fff'] } }
    },
    series: [{
      type: 'radar',
      data: [{
        value: [focusScore, homeworkScore, mealScore, disciplineScore, habitScore],
        name: '能力模型',
        areaStyle: { color: 'rgba(59, 130, 246, 0.2)' },
        lineStyle: { width: 2 },
        symbol: 'circle',
        symbolSize: 6
      }]
    }]
  });

  // --- 2. 折线图 (趋势) ---
  const lineChart = echarts.init(lineChartRef.value);
  const historyData = report.value.history || []; // 后端返回的近7天数据

  // 提取日期和数值
  const dates = historyData.map(d => formatDate(d.report_date));
  const values = historyData.map(d => d.focus_minutes);

  lineChart.setOption({
    grid: { top: 30, right: 10, bottom: 20, left: 30 },
    tooltip: {
      trigger: 'axis',
      formatter: '{b}: {c}分钟' // 提示框格式化
    },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#9CA3AF', fontSize: 10 }
    },
    yAxis: {
      type: 'value',
      // 👇👇👇 核心修改：固定纵轴范围 0 ~ 240 👇👇👇
      min: 0,
      max: 240,
      interval: 60, // 每隔 60 分钟画一条线 (0, 60, 120, 180, 240)
      splitLine: { lineStyle: { type: 'dashed', color: '#E5E7EB' } },
      axisLabel: { color: '#9CA3AF', fontSize: 10 }
    },
    series: [{
      data: values,
      type: 'line',
      smooth: true,
      symbol: 'emptyCircle',
      symbolSize: 6,
      itemStyle: { color: '#3B82F6', borderWidth: 2 },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
          { offset: 1, color: 'rgba(59, 130, 246, 0)' }
        ])
      },
      // 增加标线：标出"及格线"(120分钟)和"优秀线"(200分钟)
      markLine: {
        symbol: 'none',
        label: { show: false },
        lineStyle: { type: 'dotted', color: '#9CA3AF', opacity: 0.5 },
        data: [
          { yAxis: 240 }, // 顶格线
        ]
      }
    }]
  });

  // 自适应窗口大小
  window.addEventListener('resize', () => {
    radarChart.resize();
    lineChart.resize();
  });
};

onMounted(async () => {
  const { token } = route.query;
  if (!token) {
    loading.value = false;
    return;
  }
  try {
    const res = await axios.get(`/api/public/reports/view?token=${token}`);
    if (res.data.code === 200) {
      report.value = res.data.data;
      // 等待 DOM 渲染完成后再画图
      nextTick(() => {
        initCharts();
      });
    }
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
/* 隐藏 Element Plus 图片预览时的滚动条 */
:deep(.el-image-viewer__wrapper) {
  z-index: 9999;
}
</style>