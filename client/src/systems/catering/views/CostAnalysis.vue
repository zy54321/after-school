<template>
  <div class="p-4 bg-gray-50 min-h-screen">
    <div
      class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row justify-between items-center">
      <div>
        <h2 class="text-xl font-bold text-gray-800 flex items-center">
          <span class="bg-yellow-100 text-yellow-600 p-1.5 rounded-lg mr-3"><el-icon>
              <Money />
            </el-icon></span>
          成本控制仪表盘
        </h2>
        <p class="text-xs text-gray-500 mt-1 ml-11">实时监控人均伙食成本，杜绝浪费与超支</p>
      </div>

      <div class="flex items-center gap-3 mt-4 md:mt-0">
        <el-radio-group v-model="period" size="default" @change="handlePeriodChange">
          <el-radio-button label="week">本周</el-radio-button>
          <el-radio-button label="month">本月</el-radio-button>
        </el-radio-group>
        <el-button type="primary" :icon="Refresh" circle @click="fetchData" />
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
      <div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white shadow-lg shadow-blue-200">
        <div class="text-blue-100 text-xs mb-1">本期食材总投入</div>
        <div class="text-3xl font-bold font-mono">¥{{ summary.totalCost }}</div>
        <div class="mt-4 text-xs bg-white/20 inline-block px-2 py-1 rounded">
          共供餐 {{ summary.totalStudents }} 人次
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
        <div v-if="summary.avgCost > 25" class="mt-2 text-xs text-red-500 flex items-center font-bold">
          <el-icon class="mr-1">
            <Warning />
          </el-icon> 超出预算 (建议 ¥20以内)
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
          <span v-if="summary.avgCost > 25">近期肉类采购偏多，建议下周增加根茎类蔬菜比例，或寻找更优货源。</span>
          <span v-else>当前膳食搭配合理，既保证了营养又控制了成本，继续保持！</span>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <div class="font-bold text-gray-700 mb-4 flex items-center">
          <el-icon class="mr-2 text-blue-500">
            <TrendCharts />
          </el-icon>
          成本波动趋势 ({{ period === 'week' ? '近7天' : '近30天' }})
        </div>
        <div ref="chartRef" class="w-full h-[300px]"></div>
      </div>

      <div
        class="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
        <div class="bg-orange-50 p-4 rounded-full mb-4">
          <el-icon size="40" class="text-orange-400">
            <PieChart />
          </el-icon>
        </div>
        <h3 class="font-bold text-gray-700">更多分析即将上线</h3>
        <p class="text-xs text-gray-400 mt-2 px-8">未来将支持按“肉/菜/粮油”分类分析成本结构，帮您精准砍价。</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick } from 'vue';
import axios from 'axios';
import * as echarts from 'echarts';
import { Money, Refresh, Wallet, Warning, CircleCheck, TrendCharts, PieChart } from '@element-plus/icons-vue';

const period = ref('week');
const chartRef = ref(null);
const loading = ref(false);

const summary = reactive({
  totalCost: 0,
  totalStudents: 0,
  avgCost: 0
});

// 获取日期范围
const getDateRange = () => {
  const end = new Date();
  const start = new Date();
  if (period.value === 'week') {
    start.setDate(end.getDate() - 7);
  } else {
    start.setDate(end.getDate() - 30);
  }
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
};

// 初始化图表
const initChart = (data) => {
  if (!chartRef.value) return;

  // 销毁旧实例防止数据残留
  const existingChart = echarts.getInstanceByDom(chartRef.value);
  if (existingChart) existingChart.dispose();

  const chart = echarts.init(chartRef.value);

  const dates = data.map(i => i.date.slice(5)); // 只显示 MM-DD
  const costs = data.map(i => i.avg_cost);
  const totals = data.map(i => i.total_cost);

  const option = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['人均成本', '总成本'], top: 0 }, // 图例置顶
    // ⭐ 优化2：调整 grid 底部边距，防止文字重叠
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%', // 增加底部空间
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: dates,
      // ⭐ 优化3：防止30天数据时标签拥挤
      axisLabel: {
        interval: 'auto',
        rotate: 0
      }
    },
    yAxis: [
      { type: 'value', name: '人均 (¥)', position: 'left' },
      { type: 'value', name: '总计 (¥)', position: 'right', splitLine: { show: false } }
    ],
    series: [
      {
        name: '人均成本',
        type: 'line',
        yAxisIndex: 0,
        data: costs,
        smooth: true,
        itemStyle: { color: '#10b981' },
        areaStyle: { color: 'rgba(16, 185, 129, 0.1)' },
        markLine: {
          data: [{ yAxis: 20, name: '预算线' }],
          lineStyle: { color: '#f59e0b', type: 'dashed' },
          label: { position: 'insideEndTop', formatter: '预算 ¥20' }
        }
      },
      {
        name: '总成本',
        type: 'bar',
        yAxisIndex: 1,
        data: totals,
        itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 20
      }
    ]
  };
  chart.setOption(option);
};

const fetchData = async () => {
  loading.value = true;
  const { start, end } = getDateRange();
  try {
    const res = await axios.get(`/api/catering/cost-analysis?start_date=${start}&end_date=${end}`);
    if (res.data.code === 200) {
      const data = res.data.data;

      // 计算汇总数据
      let tCost = 0;
      let tStu = 0;
      data.forEach(d => {
        tCost += d.total_cost;
        tStu += d.student_count;
      });

      summary.totalCost = tCost.toFixed(0);
      summary.totalStudents = tStu;
      summary.avgCost = tStu > 0 ? (tCost / tStu).toFixed(1) : 0;

      // 渲染图表
      nextTick(() => initChart(data));
    }
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
};

const handlePeriodChange = () => {
  fetchData();
};

onMounted(() => {
  fetchData();
  window.addEventListener('resize', () => {
    const chart = echarts.getInstanceByDom(chartRef.value);
    chart && chart.resize();
  });
});
</script>