<template>
  <div class="p-4">
    <el-card shadow="hover" class="mb-4">
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

          <el-button type="success" icon="List" @click="calculateShoppingList" :disabled="menuList.length === 0">
            采购清单
          </el-button>
        </div>
      </div>
    </el-card>

    <div class="grid grid-cols-7 gap-2 mb-4 min-w-[800px] overflow-x-auto">
      <div v-for="(date, index) in weekDates" :key="index" class="text-center p-2 rounded-t-lg font-bold"
        :class="isToday(date) ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'">
        {{ getWeekDayName(index) }}
        <div class="text-xs font-normal opacity-80">{{ formatDate(date) }}</div>
      </div>

      <div v-for="(date, colIndex) in weekDates" :key="'col-' + colIndex" class="flex flex-col gap-2">
        <div v-for="type in ['lunch', 'dinner', 'snack']" :key="type"
          class="bg-white border border-gray-200 rounded-lg p-2 min-h-[120px] shadow-sm hover:shadow-md transition relative group">

          <div class="text-xs font-bold text-gray-400 mb-2 uppercase flex justify-between">
            {{ getMealTypeName(type) }}
            <el-button type="primary" link icon="Plus" size="small" class="opacity-0 group-hover:opacity-100 transition"
              @click="openAddDialog(date, type)" />
          </div>

          <div v-for="item in getMenuItems(date, type)" :key="item.id"
            class="bg-blue-50 rounded p-2 mb-1 border border-blue-100 relative group/item cursor-pointer hover:bg-blue-100">
            <div class="text-sm font-bold text-blue-800 truncate">{{ item.dish_name }}</div>
            <div v-if="item.has_allergen" class="text-[10px] text-red-500 font-bold mt-1 flex items-center">
              ⚠️ 含{{ item.allergens }}
            </div>
            <div class="absolute -top-1 -right-1 hidden group-hover/item:block">
              <el-icon class="bg-red-500 text-white rounded-full p-0.5 cursor-pointer" @click.stop="handleRemove(item)">
                <Close />
              </el-icon>
            </div>
          </div>

          <div v-if="getMenuItems(date, type).length === 0"
            class="h-full flex items-center justify-center text-gray-200 text-2xl cursor-pointer hover:text-gray-300"
            @click="openAddDialog(date, type)">
            +
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

    <el-dialog v-model="shoppingListVisible" title="本周采购清单" width="600px">
      <el-alert type="info" show-icon :closable="false" class="mb-4">
        系统已根据本周食谱自动汇总所需食材总量。
      </el-alert>
      <el-table :data="shoppingList" stripe height="400" border>
        <el-table-column prop="category" label="分类" width="100" />
        <el-table-column prop="name" label="食材" min-width="120">
          <template #default="{ row }">
            <span :class="row.allergen_type !== '无' ? 'text-red-600 font-bold' : ''">
              {{ row.name }}
              <span v-if="row.allergen_type !== '无'" class="text-xs bg-red-100 px-1 rounded ml-1">
                {{ row.allergen_type }}
              </span>
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="totalQuantity" label="需采购总量" width="150" align="center">
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
        <el-button type="primary" size="large" @click="copyLink" class="w-full font-bold">
          复制链接
        </el-button>
        <div class="text-xs text-gray-400 mt-3">
          提示：该链接无需登录，可直接发到家长群。
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { ArrowLeft, ArrowRight, Plus, Close, List, Share } from '@element-plus/icons-vue';

// ---------------------------
// 状态定义
// ---------------------------
const currentStartDate = ref(new Date());
const menuList = ref([]);
const dishLibrary = ref([]);
const dialogVisible = ref(false);
const shoppingListVisible = ref(false);
const shoppingList = ref([]);

// 分享相关
const shareDialogVisible = ref(false);
const publicLink = ref('');

const form = ref({ dateStr: '', type: '', dish_id: null });

// ---------------------------
// 日历逻辑
// ---------------------------
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
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
const resetToToday = () => {
  currentStartDate.value = new Date();
  fetchMenus();
};

// ---------------------------
// 核心业务逻辑
// ---------------------------
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

const getMenuItems = (date, type) => {
  const dStr = formatDate(date);
  return menuList.value.filter(m => m.plan_date.startsWith(dStr) && m.meal_type === type);
};

const openAddDialog = (date, type) => {
  form.value = { dateStr: formatDate(date), type, dish_id: null };
  if (dishLibrary.value.length === 0) fetchDishes();
  dialogVisible.value = true;
};

const confirmAdd = async () => {
  if (!form.value.dish_id) return ElMessage.warning('请选择菜品');
  try {
    const payload = {
      plan_date: form.value.dateStr,
      meal_type: form.value.type,
      dish_id: form.value.dish_id
    };
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

const calculateShoppingList = async () => {
  if (dishLibrary.value.length === 0) await fetchDishes();
  const summary = {};
  menuList.value.forEach(menuItem => {
    const fullDish = dishLibrary.value.find(d => d.id === menuItem.dish_id);
    if (fullDish && fullDish.ingredients) {
      fullDish.ingredients.forEach(ing => {
        if (!summary[ing.ingredient_id]) {
          summary[ing.ingredient_id] = {
            name: ing.name, category: '默认', unit: ing.unit,
            allergen_type: ing.allergen_type, totalQuantity: 0
          };
        }
        summary[ing.ingredient_id].totalQuantity += Number(ing.quantity);
      });
    }
  });
  shoppingList.value = Object.values(summary).map(item => ({
    ...item, totalQuantity: parseFloat(item.totalQuantity.toFixed(2))
  })).sort((a, b) => a.allergen_type === '无' ? 1 : -1);

  if (shoppingList.value.length === 0) ElMessage.info('暂无配方数据');
  else shoppingListVisible.value = true;
};

// ⭐ 分享逻辑
const openShareDialog = () => {
  publicLink.value = `${window.location.origin}/weekly-menu`;
  shareDialogVisible.value = true;
};

const copyLink = async () => {
  try {
    await navigator.clipboard.writeText(publicLink.value);
    ElMessage.success('链接已复制，可发给家长');
    shareDialogVisible.value = false;
  } catch (err) {
    ElMessage.error('复制失败，请手动复制');
  }
};

onMounted(() => {
  fetchMenus();
  fetchDishes();
});
</script>