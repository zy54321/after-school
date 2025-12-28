<template>
  <div class="h-[calc(100vh-110px)] flex flex-col p-4">

    <el-card shadow="hover" class="mb-4 flex-shrink-0">
      <div class="flex flex-col md:flex-row justify-between items-center gap-4">
        <div class="flex items-center gap-4 w-full md:w-auto">
          <div class="text-lg font-bold mr-4 flex items-center whitespace-nowrap">
            <span class="mr-2">📅</span> 食谱排期
          </div>
          <el-button-group class="flex-shrink-0">
            <el-button :icon="ArrowLeft" @click="changeWeek(-1)">上周</el-button>
            <el-button @click="resetToToday">本周</el-button>
            <el-button :icon="ArrowRight" @click="changeWeek(1)">下周</el-button>
          </el-button-group>
          <div class="hidden md:block text-sm font-bold text-gray-600">
            {{ formatDate(weekDates[0]) }} ~ {{ formatDate(weekDates[6]) }}
          </div>
        </div>

        <div class="flex gap-2 w-full md:w-auto justify-end">
          <el-button type="warning" plain icon="Share" @click="openShareDialog">
            分享给家长
          </el-button>
          <el-button type="success" icon="List" @click="calculateWeeklyShoppingList" :disabled="menuList.length === 0">
            本周总采购单
          </el-button>
        </div>
      </div>
    </el-card>

    <div class="flex-1 overflow-x-auto overflow-y-hidden bg-gray-50 rounded-lg border border-gray-200">
      <div class="grid grid-cols-7 min-w-[1000px] h-full grid-rows-[50px_1fr]">

        <div v-for="(date, index) in weekDates" :key="index"
          class="text-center p-2 border-r border-b border-gray-200 font-bold flex flex-col justify-center relative group"
          :class="isToday(date) ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'">
          <div class="flex items-center justify-center gap-1">
            {{ getWeekDayName(index) }}
            <el-tooltip content="查看当日食材需求汇总" placement="top">
              <el-icon class="cursor-pointer hover:scale-125 transition-transform opacity-60 group-hover:opacity-100"
                :class="isToday(date) ? 'text-white' : 'text-orange-500'" @click.stop="showDailyIngredients(date)">
                <Food />
              </el-icon>
            </el-tooltip>
          </div>
          <div class="text-[10px] font-normal opacity-80">{{ formatDate(date) }}</div>
        </div>

        <div v-for="(date, colIndex) in weekDates" :key="'col-' + colIndex"
          class="border-r border-gray-200 p-2 overflow-y-auto flex flex-col gap-3 h-full bg-gray-50/50">

          <div v-for="type in ['lunch', 'dinner', 'snack']" :key="type"
            class="bg-white border border-gray-200 rounded-lg p-2 min-h-[100px] shadow-sm hover:shadow-md transition relative group flex flex-col">

            <div class="text-xs font-bold text-gray-400 mb-2 uppercase flex justify-between items-center">
              {{ getMealTypeName(type) }}
              <el-button type="primary" link icon="Plus" size="small"
                class="opacity-0 group-hover:opacity-100 transition" @click="openAddDialog(date, type)" />
            </div>

            <div class="flex-1 space-y-1">
              <div v-for="item in getMenuItems(date, type)" :key="item.id"
                class="bg-blue-50 rounded p-1.5 border border-blue-100 relative group/item cursor-pointer hover:bg-blue-100">
                <div class="text-sm font-bold text-blue-800 truncate">{{ item.dish_name }}</div>
                <div v-if="item.has_allergen" class="text-[10px] text-red-500 font-bold mt-0.5 flex items-center">
                  ⚠️ 含{{ item.allergens }}
                </div>
                <div class="absolute -top-1 -right-1 hidden group-hover/item:block">
                  <el-icon class="bg-red-500 text-white rounded-full p-0.5 cursor-pointer scale-75"
                    @click.stop="handleRemove(item)">
                    <Close />
                  </el-icon>
                </div>
              </div>
            </div>

            <div v-if="getMenuItems(date, type).length === 0"
              class="flex-1 flex items-center justify-center text-gray-200 text-xl cursor-pointer hover:text-gray-300"
              @click="openAddDialog(date, type)">
              +
            </div>
          </div>
        </div>
      </div>
    </div>

    <el-dialog v-model="dialogVisible" title="选择菜品" width="500px">
      <div class="mb-4 text-sm text-gray-500">
        正在安排：<span class="font-bold text-blue-600">{{ form.dateStr }} {{ getMealTypeName(form.type) }}</span>
      </div>
      <el-select v-model="form.dish_id" placeholder="搜索菜品库..." filterable style="width: 100%" size="large">
        <el-option v-for="dish in dishLibrary" :key="dish.id" :label="dish.name" :value="dish.id">
          <span class="float-left">{{ dish.name }}</span>
          <span class="float-right text-gray-400 text-xs">
            {{ dish.tags && dish.tags.length ? dish.tags.join(',') : '' }}
          </span>
        </el-option>
      </el-select>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmAdd">确定排入</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="shoppingListVisible" :title="shoppingListTitle" width="600px">
      <el-alert type="success" show-icon :closable="false" class="mb-4">
        {{ shoppingListTip }}
      </el-alert>
      <el-table :data="shoppingList" stripe height="400" border>
        <el-table-column prop="category" label="分类" width="100" align="center">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ row.category }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="食材" min-width="120">
          <template #default="{ row }">
            <span :class="row.allergen_type !== '无' ? 'text-red-600 font-bold' : ''">
              {{ row.name }}
              <span v-if="row.allergen_type !== '无'" class="text-xs bg-red-100 px-1 rounded ml-1">{{ row.allergen_type
                }}</span>
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="totalQuantity" label="所需总量" width="150" align="center">
          <template #default="{ row }">
            <span class="text-lg font-bold text-blue-600">{{ row.totalQuantity }}</span>
            <span class="text-xs text-gray-500 ml-1">{{ row.unit }}</span>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button type="primary" @click="shoppingListVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="shareDialogVisible" title="📤 分享食谱给家长" width="400px">
      <div class="text-center p-4">
        <div
          class="bg-gray-50 border border-gray-200 p-3 rounded-lg text-sm text-blue-600 break-all mb-4 font-mono select-all">
          {{ publicLink }}
        </div>
        <el-button type="primary" size="large" @click="copyLink" class="w-full font-bold">复制链接</el-button>
        <div class="text-xs text-gray-400 mt-3">提示：该链接无需登录，可直接发到家长群。</div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { ArrowLeft, ArrowRight, Plus, Close, List, Share, Food } from '@element-plus/icons-vue';

const currentStartDate = ref(new Date());
const menuList = ref([]);
const dishLibrary = ref([]);
const studentCount = ref(0); // ⭐ 新增：学员总数状态

const dialogVisible = ref(false);
const shoppingListVisible = ref(false);
const shoppingList = ref([]);
const shoppingListTitle = ref('');
const shoppingListTip = ref('');
const shareDialogVisible = ref(false);
const publicLink = ref('');
const form = ref({ dateStr: '', type: '', dish_id: null });

// 日期计算
const weekDates = computed(() => {
  const dates = [];
  const start = new Date(currentStartDate.value);
  const day = start.getDay() || 7;
  start.setDate(start.getDate() - day + 1);
  for (let i = 0; i < 7; i++) {
    dates.push(new Date(start));
    start.setDate(start.getDate() + 1);
  }
  return dates;
});

const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const getWeekDayName = (idx) => ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][idx];
const getMealTypeName = (type) => ({ lunch: '午餐', dinner: '晚餐', snack: '加餐' }[type]);
const isToday = (date) => formatDate(date) === formatDate(new Date());

const changeWeek = (offset) => {
  const newDate = new Date(currentStartDate.value);
  newDate.setDate(newDate.getDate() + (offset * 7));
  currentStartDate.value = newDate;
  fetchMenus();
};
const resetToToday = () => { currentStartDate.value = new Date(); fetchMenus(); };

// 数据获取
const fetchMenus = async () => {
  const start = formatDate(weekDates.value[0]);
  const end = formatDate(weekDates.value[6]);
  try {
    const res = await axios.get(`/api/catering/menus?start_date=${start}&end_date=${end}`);
    if (res.data.code === 200) menuList.value = res.data.data;
  } catch (err) { ElMessage.error('加载食谱失败'); }
};

const fetchDishes = async () => {
  try {
    const res = await axios.get('/api/catering/dishes');
    if (res.data.code === 200) dishLibrary.value = res.data.data;
  } catch (err) { console.error(err); }
};

// ⭐ 获取当前在读学生总数
const fetchStudentCount = async () => {
  try {
    const res = await axios.get('/api/students'); // 获取列表
    if (res.data.code === 200) {
      // 过滤出在读/活跃的学生
      const activeStudents = res.data.data.filter(s => s.status === 'active');
      studentCount.value = activeStudents.length;
    }
  } catch (err) {
    console.error('获取学生人数失败', err);
    studentCount.value = 0; // 失败则默认为0，避免计算错误
  }
};

const getMenuItems = (date, type) => {
  const dStr = formatDate(date);
  return menuList.value.filter(m => m.plan_date.startsWith(dStr) && m.meal_type === type);
};

// 操作
const openAddDialog = (date, type) => {
  form.value = { dateStr: formatDate(date), type, dish_id: null };
  if (dishLibrary.value.length === 0) fetchDishes();
  dialogVisible.value = true;
};

const confirmAdd = async () => {
  if (!form.value.dish_id) return ElMessage.warning('请选择菜品');
  try {
    const payload = { plan_date: form.value.dateStr, meal_type: form.value.type, dish_id: form.value.dish_id };
    const res = await axios.post('/api/catering/menus', payload);
    if (res.data.code === 200) {
      ElMessage.success('排入成功');
      dialogVisible.value = false;
      fetchMenus();
    }
  } catch (err) { ElMessage.error('排入失败'); }
};

const handleRemove = async (item) => {
  try {
    await axios.delete(`/api/catering/menus/${item.id}`);
    fetchMenus();
  } catch (err) { ElMessage.error('移除失败'); }
};

// ⭐ 核心计算逻辑：引入学员人数加权
const calculateIngredients = async (targetDate = null) => {
  if (dishLibrary.value.length === 0) await fetchDishes();
  if (studentCount.value === 0) await fetchStudentCount(); // 确保有人数

  const summary = {};
  const currentCount = studentCount.value || 1; // 防止除以0，若无学生暂按1人算（或提示用户）

  const targetMenus = targetDate
    ? menuList.value.filter(m => m.plan_date.startsWith(formatDate(targetDate)))
    : menuList.value;

  if (targetMenus.length === 0) return [];

  targetMenus.forEach(menuItem => {
    const fullDish = dishLibrary.value.find(d => d.id === menuItem.dish_id);
    if (fullDish && fullDish.ingredients) {
      fullDish.ingredients.forEach(ing => {
        if (!summary[ing.ingredient_id]) {
          summary[ing.ingredient_id] = {
            name: ing.name, category: '默认', unit: ing.unit,
            allergen_type: ing.allergen_type, totalQuantity: 0
          };
        }

        // ⭐ 关键修正： (基准量 / 10) * 实际人数
        // 假设 ing.quantity 是 10人份的量
        const quantityPerPerson = Number(ing.quantity) / 10;
        const actualNeed = quantityPerPerson * currentCount;

        summary[ing.ingredient_id].totalQuantity += actualNeed;
      });
    }
  });

  return Object.values(summary).map(item => ({
    ...item, totalQuantity: parseFloat(item.totalQuantity.toFixed(2))
  })).sort((a, b) => a.allergen_type === '无' ? 1 : -1);
};

const calculateWeeklyShoppingList = async () => {
  const list = await calculateIngredients(null);
  if (list.length === 0) return ElMessage.info('本周暂无食谱');
  shoppingList.value = list;
  shoppingListTitle.value = '本周总采购清单';
  // 提示文案动态化
  shoppingListTip.value = `计算基准：当前在读学员 ${studentCount.value} 人。 (公式：基准量/10 * 人数)`;
  shoppingListVisible.value = true;
};

const showDailyIngredients = async (date) => {
  const list = await calculateIngredients(date);
  if (list.length === 0) return ElMessage.info('当天没有安排餐食');
  shoppingList.value = list;
  shoppingListTitle.value = `📅 ${formatDate(date)} 餐饮食材需求`;
  shoppingListTip.value = `今日用餐人数基准：${studentCount.value} 人。请根据实际情况补货。`;
  shoppingListVisible.value = true;
};

const openShareDialog = () => {
  publicLink.value = `${window.location.origin}/weekly-menu`;
  shareDialogVisible.value = true;
};
const copyLink = async () => {
  try { await navigator.clipboard.writeText(publicLink.value); ElMessage.success('已复制'); shareDialogVisible.value = false; }
  catch (err) { ElMessage.error('复制失败'); }
};

onMounted(() => {
  fetchMenus();
  fetchDishes();
  fetchStudentCount(); // 初始化获取人数
});
</script>