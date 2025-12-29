<template>
  <div class="h-[calc(100vh-110px)] flex flex-col p-4 bg-gray-50">

    <el-card shadow="hover" class="mb-4 flex-shrink-0 border-none">
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
            end-placeholder="结束日期" :shortcuts="shortcuts" size="default" style="width: 260px" @change="handleDateChange"
            :clearable="false" />
          <el-button type="primary" :icon="Search" @click="fetchList" :loading="loading">
            生成清单
          </el-button>
        </div>
      </div>
    </el-card>

    <div class="flex-1 overflow-y-auto pr-2">
      <div v-if="!loading && (!list || list.length === 0)"
        class="flex flex-col items-center justify-center py-20 text-gray-400 h-full">
        <el-icon size="60" class="mb-4 text-gray-200">
          <SoldOut />
        </el-icon>
        <p>该日期范围内暂无食谱数据</p>
        <p class="text-xs mt-2 text-gray-400">请先在“食谱排期”中安排餐食</p>
      </div>

      <div v-else v-loading="loading" class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 items-start pb-4">
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
              <div class="font-mono font-bold text-lg">¥{{ group.totalCost.toFixed(2) }}</div>
            </div>
          </div>

          <el-table :data="group.items" size="small" :show-header="true" stripe>
            <el-table-column prop="name" label="品名">
              <template #default="{ row }">
                <span class="font-medium text-gray-700">{{ row.name }}</span>
                <span class="ml-1 text-[10px] text-gray-400 border border-gray-200 px-1 rounded">{{ row.category
                  }}</span>
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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { Search, ShoppingCart, SoldOut } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

const loading = ref(false);
const list = ref([]);

// ⭐ 新增：获取本周范围 (周一到周日)
const getCurrentWeekRange = () => {
  const today = new Date();
  const day = today.getDay() || 7; // 周日是0，改为7
  const monday = new Date(today);
  monday.setDate(today.getDate() - day + 1); // 推算回周一

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6); // 推算到周日
  return [monday, sunday];
};

// 获取下周范围
const getNextWeekRange = () => {
  const today = new Date();
  const day = today.getDay() || 7;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + (8 - day));

  const nextSunday = new Date(nextMonday);
  nextSunday.setDate(nextMonday.getDate() + 6);
  return [nextMonday, nextSunday];
};

// ⭐ 修改：默认选中本周
const dateRange = ref(getCurrentWeekRange());

// ⭐ 修改：调整快捷选项顺序，本周在前
const shortcuts = [
  { text: '本周 (周一至周日)', value: getCurrentWeekRange },
  { text: '下周 (周一至周日)', value: getNextWeekRange },
  {
    text: '明天', value: () => {
      const start = new Date();
      start.setDate(start.getDate() + 1);
      return [start, start];
    }
  }
];

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
        // 静默处理，或者只显示空状态图，不弹提示打扰用户
      }
    }
  } catch (err) {
    ElMessage.error('获取清单失败');
  } finally {
    loading.value = false;
  }
};

const handleDateChange = () => {
  // 日期变化后自动刷新
  fetchList();
};

const copyGroupText = async (group) => {
  let text = `📅 采购单 [${group.source}]\n`;
  text += `----------------\n`;
  group.items.forEach((item, index) => {
    text += `${index + 1}. ${item.name}：${item.total_quantity} ${item.unit}\n`;
  });
  text += `----------------\n`;
  text += `💰 预计成本：¥${group.totalCost.toFixed(2)}`;

  try {
    await navigator.clipboard.writeText(text);
    ElMessage.success(`已复制 ${group.source} 采购单`);
  } catch (err) {
    ElMessage.error('复制失败，请手动复制');
  }
};

onMounted(() => {
  fetchList();
});
</script>