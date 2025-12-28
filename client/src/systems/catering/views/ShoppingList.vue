<template>
  <div class="p-4 min-h-screen bg-gray-50">
    <el-card shadow="hover" class="mb-6 border-none">
      <div class="flex flex-col md:flex-row justify-between items-center gap-4">
        <div class="flex items-center">
          <div class="bg-blue-100 p-2 rounded-lg mr-3 text-blue-600">
            <el-icon size="24">
              <ShoppingCart />
            </el-icon>
          </div>
          <div>
            <h2 class="text-xl font-bold text-gray-800">智能采购清单</h2>
            <p class="text-xs text-gray-500 mt-1">根据食谱自动生成，按货源分单</p>
          </div>
        </div>

        <div class="flex items-center gap-3 bg-gray-50 p-2 rounded-lg border border-gray-100">
          <span class="text-sm text-gray-500 font-medium ml-2">选择周期：</span>
          <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始日期"
            end-placeholder="结束日期" :shortcuts="shortcuts" size="default" style="width: 260px"
            @change="handleDateChange" />
          <el-button type="primary" :icon="Search" @click="fetchList" :loading="loading">
            生成清单
          </el-button>
        </div>
      </div>
    </el-card>

    <div v-if="!loading && (!list || list.length === 0)"
      class="flex flex-col items-center justify-center py-20 text-gray-400">
      <el-icon size="60" class="mb-4 text-gray-200">
        <SoldOut />
      </el-icon>
      <p>请选择日期范围生成清单 (确保该日期内已排好食谱)</p>
    </div>

    <div v-else v-loading="loading" class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 items-start">

      <div v-for="group in list" :key="group.source"
        class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
        <div class="px-5 py-4 border-b border-gray-50 flex justify-between items-center"
          :class="getHeaderClass(group.source)">
          <div class="flex items-center font-bold text-lg">
            <span class="mr-2">{{ getSourceIcon(group.source) }}</span>
            {{ group.source }}
          </div>
          <div class="text-right">
            <div class="text-xs opacity-70">预计成本</div>
            <div class="font-mono font-bold text-lg">¥{{ group.totalCost.toFixed(1) }}</div>
          </div>
        </div>

        <el-table :data="group.items" size="small" :show-header="true" stripe>
          <el-table-column prop="name" label="品名">
            <template #default="{ row }">
              <span class="font-medium text-gray-700">{{ row.name }}</span>
              <span class="ml-1 text-[10px] text-gray-400 border border-gray-200 px-1 rounded">{{ row.category }}</span>
            </template>
          </el-table-column>

          <el-table-column prop="total_quantity" label="数量" width="90" align="center">
            <template #default="{ row }">
              <span class="font-bold text-blue-600 text-base">{{ row.total_quantity }}</span>
              <span class="text-xs text-gray-400 scale-90 ml-0.5">{{ row.unit }}</span>
            </template>
          </el-table-column>

          <el-table-column label="状态" width="70" align="center">
            <template #default>
              <div
                class="w-4 h-4 border-2 border-gray-300 rounded mx-auto cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors">
              </div>
            </template>
          </el-table-column>
        </el-table>

        <div
          class="bg-gray-50 px-4 py-2 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
          <span>共 {{ group.items.length }} 项商品</span>
          <el-button link type="primary" size="small" @click="copyGroupText(group)">复制文本</el-button>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { Search, ShoppingCart, SoldOut } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

const loading = ref(false);
const list = ref([]);

// ⭐ 修改逻辑：默认选中下周一到周日 (7天)
const getNextWeekRange = () => {
  const today = new Date();
  const day = today.getDay() || 7; // 获取今天是周几 (1-7)
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + (8 - day)); // 下周一

  const nextSunday = new Date(nextMonday);
  // 从周一往后推6天就是周日 (例如：1号是周一，1+6=7号是周日)
  nextSunday.setDate(nextMonday.getDate() + 6);
  return [nextMonday, nextSunday];
};

const dateRange = ref(getNextWeekRange());

const shortcuts = [
  // ⭐ 修改文案和计算逻辑：覆盖周一至周日
  { text: '下周 (周一至周日)', value: getNextWeekRange },
  {
    text: '本周 (周一至周日)', value: () => {
      const today = new Date();
      const day = today.getDay() || 7;
      const monday = new Date(today.setDate(today.getDate() - day + 1)); // 本周一
      // +6天得到本周日
      const sunday = new Date(new Date(monday).setDate(monday.getDate() + 6));
      return [monday, sunday];
    }
  },
  {
    text: '明天', value: () => {
      const start = new Date();
      start.setDate(start.getDate() + 1);
      return [start, start];
    }
  }
];

// UI 辅助函数
const getSourceIcon = (source) => {
  const map = { '盒马鲜生': '🦛', '山姆': '🛒', '麦德龙': '🟦', '叮咚买菜': '🥬', '朴朴': '🛵' };
  return map[source] || '🏪';
};

const getHeaderClass = (source) => {
  if (source === '盒马鲜生') return 'bg-blue-600 text-white';
  if (source === '叮咚买菜' || source === '朴朴') return 'bg-green-600 text-white';
  if (source === '山姆' || source === '麦德龙') return 'bg-indigo-600 text-white';
  return 'bg-gray-700 text-white';
};

const fetchList = async () => {
  if (!dateRange.value || dateRange.value.length < 2) return;

  loading.value = true;
  try {
    // 转换为 YYYY-MM-DD，注意修正时区
    const format = (d) => {
      const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
      return z.toISOString().split('T')[0];
    };

    const start = format(dateRange.value[0]);
    const end = format(dateRange.value[1]);

    const res = await axios.get(`/api/catering/shopping-list?start_date=${start}&end_date=${end}`);
    if (res.data.code === 200) {
      list.value = res.data.data;
      if (list.value.length === 0) {
        ElMessage.info('该时间段内没有食谱排期数据');
      }
    }
  } catch (err) {
    ElMessage.error('获取清单失败');
  } finally {
    loading.value = false;
  }
};

const handleDateChange = () => {
  // 可选择自动触发 fetchList，或者让用户手动点按钮
  // fetchList();
};

const copyGroupText = async (group) => {
  // 1. 拼接文本
  let text = `📅 采购单 [${group.source}]\n`;
  text += `----------------\n`;
  group.items.forEach((item, index) => {
    text += `${index + 1}. ${item.name}：${item.total_quantity} ${item.unit}\n`;
  });
  text += `----------------\n`;
  text += `💰 预计成本：¥${group.totalCost.toFixed(1)}`;

  // 2. 写入剪贴板
  try {
    await navigator.clipboard.writeText(text);
    ElMessage.success(`已复制 ${group.source} 采购单`);
  } catch (err) {
    ElMessage.error('复制失败，请手动复制');
  }
};

onMounted(() => {
  fetchList(); // 进页面自动查下周
});
</script>