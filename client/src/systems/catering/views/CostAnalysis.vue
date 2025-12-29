<template>
  <div class="h-[calc(100vh-110px)] flex flex-col p-4 bg-gray-50">

    <div
      class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex-shrink-0 flex flex-col md:flex-row justify-between items-center">
      <div>
        <h2 class="text-xl font-bold text-gray-800 flex items-center">
          <span class="bg-yellow-100 text-yellow-600 p-1.5 rounded-lg mr-3">
            <el-icon>
              <Money />
            </el-icon>
          </span>
          成本控制仪表盘
        </h2>
        <p class="text-xs text-gray-500 mt-1 ml-11">实时监控与预算未来伙食成本</p>
      </div>

      <div class="flex items-center gap-3 mt-4 md:mt-0">
        <span class="text-sm text-gray-500 font-medium">统计周期：</span>
        <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始日期"
          end-placeholder="结束日期" :shortcuts="shortcuts" size="default" style="width: 260px" @change="fetchData"
          :clearable="false" />
        <el-button type="primary" :icon="Refresh" circle @click="fetchData" />
      </div>
    </div>

    <div class="flex-1 overflow-y-auto pr-2 pb-4">

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white shadow-lg shadow-blue-200">
          <div class="text-blue-100 text-xs mb-1">
            {{ isFuture ? '预计' : '本期' }}食材总投入
          </div>
          <div class="text-3xl font-bold font-mono">¥{{ summary.totalCost }}</div>
          <div class="mt-4 text-xs bg-white/20 inline-block px-2 py-1 rounded">
            {{ isFuture ? '计划' : '累计' }}供餐 {{ summary.totalStudents }} 人次
          </div>
        </div>

        <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100 relative overflow-hidden group">
          <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <el-icon size="60" color="#10b981">
              <Wallet />
            </el-icon>
          </div>
          <div class="text-gray-500 text-xs mb-1">平均每人每天伙食费</div>
          <div class="text-4xl font-bold text-gray-800 font-mono">
            <span class="text-base text-gray-400">¥</span>{{ summary.avgCost }}
          </div>
          <div v-if="summary.avgCost > 15" class="mt-2 text-xs text-red-500 flex items-center font-bold">
            <el-icon class="mr-1">
              <Warning />
            </el-icon> 超出警告线 (¥15)
          </div>
          <div v-else class="mt-2 text-xs text-green-500 flex items-center font-bold">
            <el-icon class="mr-1">
              <CircleCheck />
            </el-icon> 成本控制良好
          </div>
        </div>

        <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex flex-col justify-center">
          <div class="text-gray-500 text-xs mb-2">💡 运营小贴士</div>
          <div class="text-sm text-gray-600 leading-relaxed">
            <span v-if="summary.totalCost == 0">当前周期内暂无食谱排期，请先前往“食谱排期”安排餐食。</span>
            <span v-else-if="summary.avgCost > 15">人均成本已超过15元红线！建议复盘近期肉类采购量，或寻找更优货源。</span>
            <span v-else>当前膳食搭配合理，既保证了营养又控制了成本，继续保持！</span>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="lg:col-span-2 bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div class="font-bold text-gray-700 mb-4 flex items-center">
            <el-icon class="mr-2 text-blue-500">
              <TrendCharts />
            </el-icon>
            成本波动趋势 ({{ formatDate(dateRange[0]) }} ~ {{ formatDate(dateRange[1]) }})
          </div>
          <div ref="chartRef" class="w-full h-[300px]"></div>
        </div>

        <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <div class="font-bold text-gray-700 mb-4 flex items-center">
            <el-icon class="mr-2 text-orange-500">
              <PieChart />
            </el-icon>
            成本结构分析 (按金额 ¥)
          </div>
          <div ref="pieChartRef" class="w-full h-[300px]"></div>
        </div>

        <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <div class="font-bold text-gray-700 mb-4 flex items-center">
            <el-icon class="mr-2 text-green-500">
              <PieChart />
            </el-icon>
            消耗结构分析 (按数量)
          </div>
          <div ref="qtyPieChartRef" class="w-full h-[300px]"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, nextTick } from 'vue';
import axios from 'axios';
import * as echarts from 'echarts';
import { Money, Refresh, Wallet, Warning, CircleCheck, TrendCharts, PieChart } from '@element-plus/icons-vue';

const chartRef = ref(null);
const pieChartRef = ref(null);
const qtyPieChartRef = ref(null); // ⭐ 新增引用
const loading = ref(false);

const summary = reactive({
  totalCost: 0,
  totalStudents: 0,
  avgCost: 0
});

const isFuture = computed(() => {
  if (!dateRange.value) return false;
  return new Date(dateRange.value[1]) > new Date();
});

const getCurrentWeekRange = () => {
  const today = new Date();
  const day = today.getDay() || 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - day + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return [monday, sunday];
};

const getNextWeekRange = () => {
  const today = new Date();
  const day = today.getDay() || 7;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + (8 - day));
  const nextSunday = new Date(nextMonday);
  nextSunday.setDate(nextMonday.getDate() + 6);
  return [nextMonday, nextSunday];
};

const getCurrentMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return [start, end];
};

const dateRange = ref(getCurrentWeekRange());

const shortcuts = [
  { text: '本周 (周一至周日)', value: getCurrentWeekRange },
  { text: '下周 (周一至周日)', value: getNextWeekRange },
  { text: '本月', value: getCurrentMonthRange },
  {
    text: '近7天',
    value: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 7);
      return [start, end];
    }
  }
];

const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// 折线图
const initChart = (data) => {
  if (!chartRef.value) return;
  const existingChart = echarts.getInstanceByDom(chartRef.value);
  if (existingChart) existingChart.dispose();

  const chart = echarts.init(chartRef.value);
  const dates = data.map(i => i.date.slice(5));
  const costs = data.map(i => i.avg_cost);
  const totals = data.map(i => i.total_cost);

  const option = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['人均成本', '总成本'], top: 0 },
    grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
    xAxis: { type: 'category', data: dates, axisLabel: { interval: 'auto', rotate: 0 } },
    yAxis: [
      { type: 'value', name: '人均 (¥)', position: 'left', max: 25 },
      { type: 'value', name: '总计 (¥)', position: 'right', splitLine: { show: false } }
    ],
    series: [
      {
        name: '人均成本', type: 'line', yAxisIndex: 0, data: costs, smooth: true,
        itemStyle: { color: '#10b981' }, areaStyle: { color: 'rgba(16, 185, 129, 0.1)' },
        markLine: {
          data: [{ yAxis: 15, name: '警告线' }],
          lineStyle: { color: '#ef4444', type: 'dashed' },
          label: { position: 'insideEndTop', formatter: '警告 ¥15', color: '#ef4444' }
        }
      },
      {
        name: '总成本', type: 'bar', yAxisIndex: 1, data: totals,
        itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] }, barMaxWidth: 20
      }
    ]
  };
  chart.setOption(option);
};

// 成本结构饼图
const initPieChart = (data) => {
  if (!pieChartRef.value) return;
  const existingChart = echarts.getInstanceByDom(pieChartRef.value);
  if (existingChart) existingChart.dispose();

  const chart = echarts.init(pieChartRef.value);

  let total = 0;
  if (data && data.length > 0) {
    total = data.reduce((sum, item) => sum + item.value, 0).toFixed(2);
  }

  const option = {
    tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
    legend: { bottom: '0%', left: 'center' },
    title: {
      text: '总支出',
      subtext: `¥${total}`,
      left: 'center', top: 'center',
      textStyle: { fontSize: 14, color: '#9ca3af' },
      subtextStyle: { fontSize: 20, fontWeight: 'bold', color: '#374151' }
    },
    series: [
      {
        name: '成本结构', type: 'pie', radius: ['50%', '70%'], avoidLabelOverlap: true,
        itemStyle: { borderRadius: 5, borderColor: '#fff', borderWidth: 2 },
        label: { show: true, formatter: '{b}\n¥{c}', fontSize: 12 },
        labelLine: { show: true },
        data: data.length > 0 ? data : [{ value: 0, name: '暂无数据' }]
      }
    ]
  };
  chart.setOption(option);
};

// ⭐ 新增：消耗数量饼图
const initQtyPieChart = (data) => {
  if (!qtyPieChartRef.value) return;
  const existingChart = echarts.getInstanceByDom(qtyPieChartRef.value);
  if (existingChart) existingChart.dispose();

  const chart = echarts.init(qtyPieChartRef.value);

  let total = 0;
  if (data && data.length > 0) {
    total = data.reduce((sum, item) => sum + item.value, 0).toFixed(1);
  }

  const option = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: '0%', left: 'center' },
    title: {
      text: '总消耗',
      subtext: `${total}`,
      left: 'center', top: 'center',
      textStyle: { fontSize: 14, color: '#9ca3af' },
      subtextStyle: { fontSize: 20, fontWeight: 'bold', color: '#10b981' }
    },
    series: [
      {
        name: '消耗结构', type: 'pie', radius: ['50%', '70%'], avoidLabelOverlap: true,
        itemStyle: { borderRadius: 5, borderColor: '#fff', borderWidth: 2 },
        // 这里的单位混杂，所以只显示数值
        label: { show: true, formatter: '{b}\n{c}', fontSize: 12 },
        labelLine: { show: true },
        data: data.length > 0 ? data : [{ value: 0, name: '暂无数据' }]
      }
    ]
  };
  chart.setOption(option);
};

const fetchData = async () => {
  if (!dateRange.value) return;
  loading.value = true;

  const format = (d) => {
    const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return z.toISOString().split('T')[0];
  };

  const start = format(dateRange.value[0]);
  const end = format(dateRange.value[1]);

  try {
    const res = await axios.get(`/api/catering/cost-analysis?start_date=${start}&end_date=${end}`);
    if (res.data.code === 200) {
      // 获取 cost 和 qty 数据
      const { trend, structure, structureQty } = res.data.data;

      let tCost = 0;
      let tStu = 0;
      trend.forEach(d => {
        tCost += d.total_cost;
        tStu += d.student_count;
      });

      summary.totalCost = tCost.toFixed(2);
      summary.totalStudents = tStu;
      summary.avgCost = tStu > 0 ? (tCost / tStu).toFixed(2) : 0;

      nextTick(() => {
        initChart(trend);
        initPieChart(structure);
        initQtyPieChart(structureQty); // ⭐ 渲染新图
      });
    }
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchData();
  window.addEventListener('resize', () => {
    const c1 = echarts.getInstanceByDom(chartRef.value);
    const c2 = echarts.getInstanceByDom(pieChartRef.value);
    const c3 = echarts.getInstanceByDom(qtyPieChartRef.value); // ⭐ Resize
    if (c1) c1.resize();
    if (c2) c2.resize();
    if (c3) c3.resize();
  });
});
</script>