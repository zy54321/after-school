<template>
  <div class="report-container min-h-screen bg-gray-50 pb-10" v-loading="loading">

    <div
      class="header-card bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-b-[2rem] shadow-xl mb-6 relative overflow-hidden">
      <div class="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-10 -mt-10"></div>
      <div class="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-5 rounded-full -ml-10 -mb-10"></div>

      <div v-if="report" class="relative z-10 flex justify-between items-start">
        <div>
          <div class="text-blue-100 text-sm mb-1 font-mono opacity-80">{{ formatDate(report.report_date) }}</div>
          <div class="text-3xl font-bold mb-2 flex items-center tracking-wide">
            {{ report.student_name }}
            <span class="text-xs bg-white/20 px-2 py-0.5 rounded-full ml-3 font-normal border border-white/10">{{
              report.grade || '学员' }}</span>
          </div>
          <div class="text-blue-100 text-sm bg-blue-800/30 inline-block px-3 py-1 rounded-lg backdrop-blur-sm">
            🎯 今日特训: {{ report.habit_goals ? report.habit_goals.join(' & ') : '全面发展' }}
          </div>
        </div>
        <div
          class="bg-white/10 backdrop-blur-md rounded-2xl p-3 text-center min-w-[80px] border border-white/20 shadow-lg">
          <div class="text-xs text-blue-100 mb-1">综合评分</div>
          <div class="text-3xl font-bold font-mono">{{ getOverallScore(report) }}</div>
        </div>
      </div>
    </div>

    <!-- 预警信息卡片 -->
    <div v-if="report && report.alerts && report.alerts.length > 0" class="px-4 mb-6">
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 border-b border-amber-100">
          <div class="font-bold text-amber-800 flex items-center">
            <el-icon class="mr-2 text-amber-500 bg-amber-100 p-1 rounded">
              <Warning />
            </el-icon>
            今日提醒
          </div>
        </div>
        <div class="p-4 space-y-3">
          <div v-for="(alert, idx) in report.alerts" :key="idx" 
            :class="getAlertCardClass(alert.level)"
            class="rounded-lg p-3 border-l-4">
            <div class="flex items-start">
              <div class="flex-shrink-0 mr-3">
                <el-icon :class="getAlertIconClass(alert.level)" class="text-xl">
                  <component :is="getAlertIcon(alert.level)" />
                </el-icon>
              </div>
              <div class="flex-1">
                <div class="font-semibold text-sm mb-1">{{ alert.title }}</div>
                <div class="text-xs text-gray-600 mb-2">{{ alert.description }}</div>
                <div class="text-xs text-gray-700 bg-white/50 rounded px-2 py-1.5 border border-gray-200">
                  💡 {{ alert.suggestion }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="report" class="px-4 space-y-6">

      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 relative overflow-hidden">
        <div class="font-bold text-gray-800 mb-2 flex items-center">
          <el-icon class="mr-2 text-indigo-500 bg-indigo-50 p-1 rounded">
            <DataAnalysis />
          </el-icon>
          今日能力模型
        </div>
        <div ref="radarChartRef" class="w-full h-[250px]"></div>
      </div>

      <div v-if="report.history && report.history.length > 1"
        class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div class="font-bold text-gray-800 mb-2 flex items-center">
          <el-icon class="mr-2 text-blue-500 bg-blue-50 p-1 rounded">
            <TrendCharts />
          </el-icon>
          专注力成长曲线 (7天)
        </div>
        <div ref="lineChartRef" class="w-full h-[220px]"></div>
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden">
        <div class="bg-orange-50/50 px-4 py-3 flex justify-between items-center border-b border-orange-100">
          <div class="font-bold text-orange-800 flex items-center">
            <el-icon class="mr-2 text-orange-500 bg-orange-100 p-1 rounded">
              <Food />
            </el-icon>
            营养与膳食
          </div>
          <div class="text-xs font-bold px-2 py-1 rounded text-orange-600 bg-orange-100">
            {{ getMealStatusText(report.meal_status) }}
          </div>
        </div>

        <div class="p-4">
          <div v-if="report.menu_content" class="space-y-3 mb-4">
            <div v-for="(item, idx) in parseMenu(report.menu_content)" :key="idx" class="flex items-start">
              <span
                class="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded mr-2 mt-0.5 whitespace-nowrap font-bold">
                {{ item.type }}
              </span>
              <span class="text-sm text-gray-600 leading-relaxed">{{ item.content }}</span>
            </div>
          </div>
          <div v-else
            class="text-gray-400 text-sm text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-200">
            今日菜谱数据同步中...
          </div>

          <div v-if="report.evidence_photo_url" class="mt-2 flex justify-center">
            <div
              class="bg-white p-2 pb-8 rounded shadow-md border border-gray-200 rotate-1 transform hover:rotate-0 transition duration-500 relative max-w-[280px]">
              <div class="absolute top-[-10px] left-[50%] ml-[-20px] w-10 h-10 bg-gray-100 rounded-full opacity-50 z-0">
              </div>
              <el-image :src="report.evidence_photo_url" :preview-src-list="[report.evidence_photo_url]"
                class="w-full h-40 object-cover rounded bg-gray-100 block relative z-10" fit="cover">
                <template #error>
                  <div class="flex items-center justify-center h-full text-xs text-gray-400">图片失效</div>
                </template>
              </el-image>
              <div class="text-center text-gray-400 text-[10px] mt-3 font-mono tracking-widest">2025 DAILY MENU</div>
            </div>
          </div>

          <div v-if="report.sourcing_data && report.sourcing_data.length > 0"
            class="mt-5 pt-4 border-t border-gray-100">
            <div class="text-xs text-gray-400 mb-2 flex items-center">
              <el-icon class="mr-1">
                <ShoppingCart />
              </el-icon> 食材来源追溯 (只选大牌 严控品质)
            </div>
            <div class="flex flex-wrap gap-2">
              <span v-for="(item, idx) in report.sourcing_data" :key="idx"
                class="inline-flex items-center bg-gray-50 text-gray-600 text-xs px-2 py-1 rounded border border-gray-100">
                <span class="font-medium mr-1.5">{{ item.name }}</span>
                <span :class="getSourceBadgeClass(item.source)"
                  class="text-[10px] px-1 py-0.5 rounded transform scale-90 origin-left">
                  {{ item.source }}
                </span>
              </span>
            </div>
          </div>

        </div>
      </div>

      <!-- 关联分析模块 -->
      <div v-if="report.correlations" class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div class="mb-3">
          <div class="font-bold text-gray-800 mb-1 flex items-center">
            <el-icon class="mr-2 text-purple-500 bg-purple-50 p-1 rounded">
              <DataAnalysis />
            </el-icon>
            数据关联分析
          </div>
          <div class="text-xs text-gray-500 ml-8">
            基于个人表现数据，分析不同指标之间的关联性
            <span v-if="hasValidCorrelations(report.correlations)" class="text-purple-500">
              （需要至少3天数据）
            </span>
          </div>
        </div>
        
        <!-- 数据不足提示 -->
        <div v-if="!hasValidCorrelations(report.correlations)" 
          class="text-center py-8 text-gray-400">
          <el-icon class="text-4xl mb-2 text-gray-300">
            <InfoFilled />
          </el-icon>
          <div class="text-sm mb-1 font-medium text-gray-500">数据积累中</div>
          <div class="text-xs text-gray-400 px-4">
            {{ getCorrelationMessage(report.correlations) }}
          </div>
        </div>
        
        <!-- 专注时长与作业质量 -->
        <div v-if="report.correlations.focus_homework?.hasEnoughData" class="mb-6">
          <div class="flex items-center justify-between mb-2">
            <div class="text-sm font-semibold text-gray-700">专注时长与作业质量的关系</div>
            <div class="text-xs text-gray-400">
              样本量: {{ report.correlations.focus_homework.dataCount }}天
              <span v-if="report.correlations.focus_homework.correlation" class="ml-2">
                相关系数: {{ report.correlations.focus_homework.correlation > 0 ? '+' : '' }}{{ report.correlations.focus_homework.correlation }}
              </span>
            </div>
          </div>
          <div ref="focusHomeworkChartRef" class="w-full h-[240px] mb-3"></div>
          <div class="text-xs text-gray-500 mb-2 px-1">
            <span class="font-semibold">图表说明：</span>
            横轴表示专注时长范围，纵轴表示该范围内作业评级的数量分布。柱状图高度越高，表示该专注时长范围下的作业评级数量越多。
          </div>
          <div class="text-xs text-gray-600 bg-gray-50 rounded p-3 border border-gray-100">
            <div class="font-semibold mb-1">📊 分析洞察：</div>
            <div class="mb-2">{{ report.correlations.focus_homework.insight }}</div>
            <div class="text-gray-700 leading-relaxed mb-2">{{ report.correlations.focus_homework.explanation }}</div>
            <div class="text-gray-500 italic mt-2 pt-2 border-t border-gray-200">
              <span class="text-[10px]">注：本分析基于最近{{ report.correlations.focus_homework.dataCount }}天的个人数据，旨在发现数据趋势，仅供参考。相关性不等于因果性。</span>
            </div>
          </div>
        </div>

        <!-- 走神次数与作业质量 -->
        <div v-if="report.correlations.distraction_homework?.hasEnoughData">
          <div class="flex items-center justify-between mb-2">
            <div class="text-sm font-semibold text-gray-700">走神次数与作业质量的关系</div>
            <div class="text-xs text-gray-400">
              样本量: {{ report.correlations.distraction_homework.dataCount }}天
              <span v-if="report.correlations.distraction_homework.correlation" class="ml-2">
                相关系数: {{ report.correlations.distraction_homework.correlation > 0 ? '+' : '' }}{{ report.correlations.distraction_homework.correlation }}
              </span>
            </div>
          </div>
          <div ref="distractionHomeworkChartRef" class="w-full h-[240px] mb-3"></div>
          <div class="text-xs text-gray-500 mb-2 px-1">
            <span class="font-semibold">图表说明：</span>
            横轴表示走神次数范围，纵轴表示该范围内作业评级的数量分布。柱状图高度越高，表示该走神次数范围下的作业评级数量越多。
          </div>
          <div class="text-xs text-gray-600 bg-gray-50 rounded p-3 border border-gray-100">
            <div class="font-semibold mb-1">📊 分析洞察：</div>
            <div class="mb-2">{{ report.correlations.distraction_homework.insight }}</div>
            <div class="text-gray-700 leading-relaxed mb-2">{{ report.correlations.distraction_homework.explanation }}</div>
            <div class="text-gray-500 italic mt-2 pt-2 border-t border-gray-200">
              <span class="text-[10px]">注：本分析基于最近{{ report.correlations.distraction_homework.dataCount }}天的个人数据，旨在发现数据趋势，仅供参考。相关性不等于因果性。</span>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div class="font-bold text-gray-800 mb-3 flex items-center">
          <el-icon class="mr-2 text-green-500 bg-green-50 p-1 rounded">
            <ChatDotRound />
          </el-icon>
          老师寄语
        </div>
        <div class="relative">
          <span class="absolute -top-2 -left-2 text-4xl text-gray-100 font-serif">"</span>
          <div class="text-gray-600 text-sm leading-7 px-2 relative z-10 indent-2">
            {{ report.teacher_comment }}
          </div>
          <span class="absolute -bottom-4 -right-2 text-4xl text-gray-100 font-serif">"</span>
        </div>
      </div>

    </div>

    <div v-if="!loading && !report" class="flex flex-col items-center justify-center h-[80vh] text-gray-400">
      <div class="bg-gray-100 p-6 rounded-full mb-4">
        <el-icon class="text-4xl text-gray-300">
          <DocumentDelete />
        </el-icon>
      </div>
      <p class="text-sm">报告未找到或链接已失效</p>
    </div>

    <div class="text-center text-gray-300 text-[10px] mt-8 pb-4 font-mono">
      POWERED BY AFTER-SCHOOL SYSTEM
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';
import * as echarts from 'echarts';
import { Food, ChatDotRound, TrendCharts, DocumentDelete, DataAnalysis, ShoppingCart, Warning, InfoFilled, CircleClose } from '@element-plus/icons-vue';

const route = useRoute();
const loading = ref(true);
const report = ref(null);

const radarChartRef = ref(null);
const lineChartRef = ref(null);
const focusHomeworkChartRef = ref(null);
const distractionHomeworkChartRef = ref(null);

const formatDate = (str) => {
  if (!str) return '';
  const d = new Date(str);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
};
const formatDateShort = (str) => {
  const d = new Date(str);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};
const getMealStatusText = (status) => ({ finished: '光盘行动 🌟', leftovers: '少量剩菜', little: '挑食/少吃' }[status] || status);

const getOverallScore = (r) => {
  let score = 80;
  if (r.homework_rating === 'A') score += 10;
  if (r.habit_rating === 'A') score += 5;
  if (r.distraction_count === 0) score += 5;
  else score -= (r.distraction_count * 2);
  return Math.min(100, Math.max(60, score));
};

const parseMenu = (content) => {
  if (!content) return [];
  const regex = /【(.*?)】([^【]+)/g;
  const result = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    result.push({ type: match[1], content: match[2].trim() });
  }
  return result.length ? result : [{ type: '今日菜单', content: content }];
};

// 货源标签样式
const getSourceBadgeClass = (source) => {
  if (['盒马鲜生', '山姆', '麦德龙'].includes(source)) return 'bg-blue-100 text-blue-600';
  if (['叮咚买菜', '朴朴'].includes(source)) return 'bg-green-100 text-green-600';
  return 'bg-gray-200 text-gray-500';
};

// 预警相关函数
const getAlertCardClass = (level) => {
  const map = {
    light: 'bg-blue-50 border-blue-300',
    medium: 'bg-amber-50 border-amber-400',
    severe: 'bg-red-50 border-red-500',
  };
  return map[level] || map.light;
};

const getAlertIconClass = (level) => {
  const map = {
    light: 'text-blue-500',
    medium: 'text-amber-500',
    severe: 'text-red-500',
  };
  return map[level] || map.light;
};

const getAlertIcon = (level) => {
  const map = {
    light: InfoFilled,
    medium: Warning,
    severe: CircleClose,
  };
  return map[level] || InfoFilled;
};

// 检查是否有有效的关联分析数据
const hasValidCorrelations = (correlations) => {
  if (!correlations) return false;
  return (
    (correlations.focus_homework?.hasEnoughData) ||
    (correlations.distraction_homework?.hasEnoughData)
  );
};

// 获取关联分析数据不足的提示信息
const getCorrelationMessage = (correlations) => {
  if (!correlations) return '暂无数据分析';
  
  const focusData = correlations.focus_homework;
  const distractionData = correlations.distraction_homework;
  
  if (focusData && !focusData.hasEnoughData && distractionData && !distractionData.hasEnoughData) {
    const dataCount = focusData?.dataCount || distractionData?.dataCount || 0;
    if (dataCount === 0) {
      return '今天是第一天，数据积累中，请继续关注后续表现';
    } else if (dataCount < 3) {
      return `目前有${dataCount}天数据，需要至少3天数据才能进行分析。继续加油，数据会越来越丰富！`;
    }
  }
  
  if (focusData && !focusData.hasEnoughData) {
    return focusData.message || '专注时长与作业质量的数据不足，无法进行分析';
  }
  
  if (distractionData && !distractionData.hasEnoughData) {
    return distractionData.message || '走神次数与作业质量的数据不足，无法进行分析';
  }
  
  return '数据积累中，请继续关注后续表现';
};

const initRadarChart = () => {
  if (!radarChartRef.value) return;
  const chart = echarts.init(radarChartRef.value);

  const r = report.value;
  // ⭐ 调试：请在浏览器控制台查看 focus_minutes 的值
  console.log('Report Data for Radar:', r);

  // ⭐ 修复：加强数值转换
  const focusMin = parseInt(r.focus_minutes) || 0;

  const scores = [
    // 假设 240分钟（4小时）为满分。如果您的标准不同，可在此调整分母
    Math.min(100, (focusMin / 240) * 100),
    r.homework_rating === 'A' ? 95 : (r.homework_rating === 'B' ? 80 : 60),
    r.habit_rating === 'A' ? 95 : (r.habit_rating === 'B' ? 80 : 60),
    r.discipline_rating === 'A' ? 95 : (r.discipline_rating === 'B' ? 80 : 60),
    Math.max(60, 100 - (Number(r.distraction_count || 0) * 10))
  ];

  const option = {
    radar: {
      indicator: [
        { name: '专注时长', max: 100 },
        { name: '作业质量', max: 100 },
        { name: '行为习惯', max: 100 },
        { name: '课堂纪律', max: 100 },
        { name: '抗干扰', max: 100 }
      ],
      shape: 'circle',
      splitNumber: 4,
      axisName: { color: '#666', fontSize: 10 },
      splitArea: { areaStyle: { color: ['#fff', '#f5f7fa'] } }
    },
    series: [{
      type: 'radar',
      data: [{
        value: scores,
        name: '能力模型',
        symbol: 'none',
        itemStyle: { color: '#4f46e5' },
        areaStyle: { color: 'rgba(79, 70, 229, 0.2)' }
      }]
    }]
  };
  chart.setOption(option);
};

const initLineChart = () => {
  if (!lineChartRef.value || !report.value.history) return;
  const chart = echarts.init(lineChartRef.value);

  // 确保历史数据按日期排序（升序）
  const sortedHistory = [...report.value.history].sort((a, b) => {
    const dateA = new Date(a.report_date);
    const dateB = new Date(b.report_date);
    return dateA - dateB;
  });

  const dates = sortedHistory.map(h => formatDateShort(h.report_date));
  const values = sortedHistory.map(h => Number(h.focus_minutes || 0));
  
  // 调试信息
  console.log('专注力成长曲线数据:', {
    dates,
    values,
    rawHistory: report.value.history,
    currentFocus: report.value.focus_minutes
  });

  const option = {
    grid: { top: 20, right: 10, bottom: 20, left: 30, containLabel: true },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: '#ddd' } },
      axisLabel: { color: '#999', fontSize: 10 }
    },
    yAxis: {
      type: 'value',
      max: 240,
      splitLine: { lineStyle: { type: 'dashed', color: '#eee' } }
    },
    series: [{
      data: values,
      type: 'line',
      smooth: true,
      symbolSize: 6,
      itemStyle: { color: '#0ea5e9', borderWidth: 2 },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(14, 165, 233, 0.3)' },
          { offset: 1, color: 'rgba(14, 165, 233, 0)' }
        ])
      }
    }]
  };
  chart.setOption(option);
};

// 初始化专注时长与作业质量图表
const initFocusHomeworkChart = () => {
  if (!focusHomeworkChartRef.value || !report.value?.correlations?.focus_homework?.hasEnoughData) return;
  const chart = echarts.init(focusHomeworkChartRef.value);
  const data = report.value.correlations.focus_homework;

  // 准备分组柱状图数据
  const ranges = data.groupedData.map(g => g.range);
  const aData = data.groupedData.map(g => g.A);
  const bData = data.groupedData.map(g => g.B);
  const cData = data.groupedData.map(g => g.C);

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        let result = `<div style="font-weight: bold; margin-bottom: 5px;">${params[0].axisValue}</div>`;
        params.forEach(param => {
          const group = data.groupedData[param.dataIndex];
          const total = group.total;
          const percentage = total > 0 ? ((param.value / total) * 100).toFixed(0) : 0;
          result += `<div style="margin: 3px 0;">
            <span style="display: inline-block; width: 10px; height: 10px; background: ${param.color}; margin-right: 5px;"></span>
            ${param.seriesName}: ${param.value}次 (${percentage}%)
          </div>`;
        });
        const group = data.groupedData[params[0].dataIndex];
        result += `<div style="margin-top: 5px; padding-top: 5px; border-top: 1px solid #eee; font-size: 11px; color: #999;">总计: ${group.total}次</div>`;
        return result;
      }
    },
    legend: {
      data: ['A级', 'B级', 'C级'],
      top: 10,
      textStyle: { fontSize: 11 },
      itemGap: 15
    },
    grid: { top: 45, right: 15, bottom: 35, left: 55, containLabel: true },
    xAxis: {
      type: 'category',
      data: ranges,
      name: '专注时长范围',
      nameLocation: 'middle',
      nameGap: 25,
      nameTextStyle: { fontSize: 11, fontWeight: 'bold', color: '#666' },
      axisLabel: { fontSize: 10, rotate: 0, color: '#666' },
      axisLine: { lineStyle: { color: '#ddd' } }
    },
    yAxis: {
      type: 'value',
      name: '作业评级次数',
      nameLocation: 'middle',
      nameGap: 40,
      nameTextStyle: { fontSize: 11, fontWeight: 'bold', color: '#666' },
      axisLabel: { fontSize: 10, color: '#666' },
      axisLine: { lineStyle: { color: '#ddd' } },
      splitLine: { lineStyle: { type: 'dashed', color: '#eee' } }
    },
    series: [
      {
        name: 'A级',
        type: 'bar',
        stack: 'total',
        data: aData,
        itemStyle: { color: '#10b981' }
      },
      {
        name: 'B级',
        type: 'bar',
        stack: 'total',
        data: bData,
        itemStyle: { color: '#f59e0b' }
      },
      {
        name: 'C级',
        type: 'bar',
        stack: 'total',
        data: cData,
        itemStyle: { color: '#ef4444' }
      }
    ]
  };
  chart.setOption(option);
};

// 初始化走神次数与作业质量图表
const initDistractionHomeworkChart = () => {
  if (!distractionHomeworkChartRef.value || !report.value?.correlations?.distraction_homework?.hasEnoughData) return;
  const chart = echarts.init(distractionHomeworkChartRef.value);
  const data = report.value.correlations.distraction_homework;

  const ranges = data.groupedData.map(g => g.range);
  const aData = data.groupedData.map(g => g.A);
  const bData = data.groupedData.map(g => g.B);
  const cData = data.groupedData.map(g => g.C);

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        let result = `<div style="font-weight: bold; margin-bottom: 5px;">${params[0].axisValue}</div>`;
        params.forEach(param => {
          const group = data.groupedData[param.dataIndex];
          const total = group.total;
          const percentage = total > 0 ? ((param.value / total) * 100).toFixed(0) : 0;
          result += `<div style="margin: 3px 0;">
            <span style="display: inline-block; width: 10px; height: 10px; background: ${param.color}; margin-right: 5px;"></span>
            ${param.seriesName}: ${param.value}次 (${percentage}%)
          </div>`;
        });
        const group = data.groupedData[params[0].dataIndex];
        result += `<div style="margin-top: 5px; padding-top: 5px; border-top: 1px solid #eee; font-size: 11px; color: #999;">总计: ${group.total}次</div>`;
        return result;
      }
    },
    legend: {
      data: ['A级', 'B级', 'C级'],
      top: 10,
      textStyle: { fontSize: 11 },
      itemGap: 15
    },
    grid: { top: 45, right: 15, bottom: 35, left: 55, containLabel: true },
    xAxis: {
      type: 'category',
      data: ranges,
      name: '走神次数范围',
      nameLocation: 'middle',
      nameGap: 25,
      nameTextStyle: { fontSize: 11, fontWeight: 'bold', color: '#666' },
      axisLabel: { fontSize: 10, color: '#666' },
      axisLine: { lineStyle: { color: '#ddd' } }
    },
    yAxis: {
      type: 'value',
      name: '作业评级次数',
      nameLocation: 'middle',
      nameGap: 40,
      nameTextStyle: { fontSize: 11, fontWeight: 'bold', color: '#666' },
      axisLabel: { fontSize: 10, color: '#666' },
      axisLine: { lineStyle: { color: '#ddd' } },
      splitLine: { lineStyle: { type: 'dashed', color: '#eee' } }
    },
    series: [
      {
        name: 'A级',
        type: 'bar',
        stack: 'total',
        data: aData,
        itemStyle: { color: '#10b981' }
      },
      {
        name: 'B级',
        type: 'bar',
        stack: 'total',
        data: bData,
        itemStyle: { color: '#f59e0b' }
      },
      {
        name: 'C级',
        type: 'bar',
        stack: 'total',
        data: cData,
        itemStyle: { color: '#ef4444' }
      }
    ]
  };
  chart.setOption(option);
};

onMounted(async () => {
  const token = route.query.token;
  if (!token) { loading.value = false; return; }

  try {
    const res = await axios.get(`/api/reports/view?token=${token}`);
    if (res.data.code === 200) {
      report.value = res.data.data;
      nextTick(() => {
        initRadarChart();
        initLineChart();
        // 初始化关联分析图表
        initFocusHomeworkChart();
        initDistractionHomeworkChart();
      });
    }
  } catch (err) { console.error(err); }
  finally { loading.value = false; }
});
</script>

<style scoped>
.header-card {
  box-shadow: 0 10px 30px -10px rgba(37, 99, 235, 0.5);
}
</style>