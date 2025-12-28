<template>
  <div class="min-h-screen bg-[#f8f9fa] pb-10 font-sans overflow-x-hidden">

    <div class="bg-gradient-to-r from-orange-500 to-red-500 pt-6 pb-20 px-4 rounded-b-[2.5rem] shadow-lg relative">
      <div class="flex justify-between items-center text-white mb-4">
        <div>
          <h1 class="text-2xl font-bold tracking-wide">本周营养食谱</h1>
          <p class="text-white/80 text-xs mt-1 flex items-center">
            <el-icon class="mr-1">
              <checked />
            </el-icon> 严选食材 · 科学配比 · 透明溯源
          </p>
        </div>
        <div class="bg-white/20 p-2 rounded-full backdrop-blur-sm">
          <el-icon size="24">
            <food />
          </el-icon>
        </div>
      </div>

      <div class="absolute -bottom-12 left-0 right-0 px-3 z-20">
        <div class="bg-white rounded-xl shadow-xl py-2 px-1 max-w-lg mx-auto">
          <div class="flex justify-between items-stretch gap-1">
            <div v-for="(day, index) in weekDates" :key="day.date" @click="currentDate = day.date"
              class="flex-1 flex flex-col items-center justify-center py-2 rounded-lg transition-all duration-200 cursor-pointer select-none min-w-0"
              :class="currentDate === day.date ? 'bg-orange-500 text-white shadow-md transform scale-105 font-bold' : 'text-gray-500 hover:bg-gray-50'">
              <span class="text-[10px] mb-0.5 opacity-90 truncate w-full text-center scale-90">{{ day.weekName }}</span>
              <span class="text-lg leading-none">{{ day.dayNum }}</span>
              <div v-if="currentDate === day.date" class="w-1 h-1 bg-white rounded-full mt-1.5 opacity-80"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="pt-16 px-4 max-w-lg mx-auto" v-loading="loading">

      <div v-if="!currentMenu || isMenuEmpty(currentMenu)" class="text-center py-20 text-gray-400">
        <el-icon size="60" class="mb-4 text-gray-200">
          <dish />
        </el-icon>
        <p class="text-sm">本日暂无供餐安排</p>
      </div>

      <div v-else class="space-y-6 animate-fade-in pb-8">

        <div v-if="currentMenu.meals.lunch.length > 0">
          <div class="flex items-center mb-3">
            <span class="bg-orange-100 text-orange-600 px-2.5 py-1 rounded-lg text-xs font-bold mr-3 shadow-sm">午餐
              Lunch</span>
            <div class="h-[1px] flex-1 bg-orange-100/50"></div>
          </div>
          <div class="grid gap-4">
            <DishCard v-for="dish in currentMenu.meals.lunch" :key="dish.id" :dish="dish" />
          </div>
        </div>

        <div v-if="currentMenu.meals.dinner.length > 0">
          <div class="flex items-center mb-3 mt-4">
            <span class="bg-indigo-100 text-indigo-600 px-2.5 py-1 rounded-lg text-xs font-bold mr-3 shadow-sm">晚餐
              Dinner</span>
            <div class="h-[1px] flex-1 bg-indigo-100/50"></div>
          </div>
          <div class="grid gap-4">
            <DishCard v-for="dish in currentMenu.meals.dinner" :key="dish.id" :dish="dish" />
          </div>
        </div>

        <div v-if="currentMenu.meals.snack.length > 0">
          <div class="flex items-center mb-3 mt-4">
            <span class="bg-green-100 text-green-600 px-2.5 py-1 rounded-lg text-xs font-bold mr-3 shadow-sm">加餐
              Snack</span>
            <div class="h-[1px] flex-1 bg-green-100/50"></div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <DishCard v-for="dish in currentMenu.meals.snack" :key="dish.id" :dish="dish" :mini="true" />
          </div>
        </div>

      </div>

      <div class="text-center text-gray-300 text-[10px] mt-4 mb-8">
        托管班餐饮管理系统 · 每日新鲜送达
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import { Food, Dish, Checked } from '@element-plus/icons-vue';

// --- 子组件：菜品卡片 ---
import { defineComponent, h } from 'vue';
const DishCard = defineComponent({
  props: ['dish', 'mini'],
  setup(props) {
    const getSourceColor = (s) => {
      if (s.includes('盒马') || s.includes('山姆')) return 'bg-blue-50 text-blue-600 border-blue-100';
      if (s.includes('叮咚') || s.includes('朴朴')) return 'bg-green-50 text-green-600 border-green-100';
      return 'bg-gray-50 text-gray-500 border-gray-100';
    };

    return () => h('div', { class: `bg-white rounded-xl shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] border border-gray-50 overflow-hidden flex ${props.mini ? 'flex-col' : 'flex-row'}` }, [
      // 图片区
      h('div', { class: `relative ${props.mini ? 'h-28 w-full' : 'w-[120px] shrink-0'} bg-gray-100` }, [
        h('img', {
          src: props.dish.photo_url || 'https://via.placeholder.com/300x200?text=Delicious',
          class: 'w-full h-full object-cover',
          loading: 'lazy'
        })
      ]),
      // 内容区
      h('div', { class: 'p-3 flex-1 flex flex-col justify-center min-w-0' }, [
        h('h3', { class: 'font-bold text-gray-800 text-sm mb-1.5 line-clamp-1 leading-tight' }, props.dish.dish_name),
        // 标签
        props.dish.tags && props.dish.tags.length ?
          h('div', { class: 'flex flex-wrap gap-1 mb-2' }, props.dish.tags.slice(0, 2).map(tag =>
            h('span', { class: 'text-[10px] px-1.5 py-0.5 bg-orange-50 text-orange-500 rounded' }, tag)
          )) : null,
        // 溯源
        h('div', { class: 'mt-auto pt-1' }, [
          !props.mini ? h('div', { class: 'text-[10px] text-gray-400 mb-1 flex items-center' }, [
            h('span', '🛒 严选食材:')
          ]) : null,
          h('div', { class: 'flex flex-wrap gap-1' },
            props.dish.ingredients.slice(0, 3).map(ing =>
              h('span', { class: `text-[10px] px-1.5 py-0.5 rounded border ${getSourceColor(ing.source)} flex items-center max-w-full` }, [
                h('span', { class: 'truncate' }, ing.name),
                h('span', { class: 'opacity-60 ml-1 scale-90 shrink-0' }, ing.source.slice(0, 2))
              ])
            )
          )
        ])
      ])
    ]);
  }
});

// ----------------------------
// 逻辑
// ----------------------------
const loading = ref(false);
const weekDates = ref([]);
const currentDate = ref('');
const menuData = ref({});

const initWeek = () => {
  const today = new Date();
  const day = today.getDay() || 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - day + 1);

  const days = [];
  const weekNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    days.push({
      date: dateStr,
      weekName: weekNames[i],
      dayNum: d.getDate()
    });
  }
  weekDates.value = days;
  const todayStr = today.toISOString().split('T')[0];
  const found = days.find(d => d.date === todayStr);
  currentDate.value = found ? found.date : days[0].date;
};

const currentMenu = computed(() => menuData.value[currentDate.value]);

const isMenuEmpty = (menu) => {
  if (!menu) return true;
  return menu.meals.lunch.length === 0 && menu.meals.dinner.length === 0 && menu.meals.snack.length === 0;
};

const fetchMenu = async () => {
  loading.value = true;
  const start = weekDates.value[0].date;
  const end = weekDates.value[6].date;
  try {
    const res = await axios.get(`/api/catering/public/weekly-menu?start_date=${start}&end_date=${end}`);
    if (res.data.code === 200) {
      const map = {};
      res.data.data.forEach(item => { map[item.date] = item; });
      menuData.value = map;
    }
  } catch (err) { console.error('Fetch menu failed'); }
  finally { loading.value = false; }
};

onMounted(() => {
  initWeek();
  fetchMenu();
});
</script>

<style scoped>
/* 淡入动画 */
.animate-fade-in {
  animation: fadeIn 0.4s ease-out forwards;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>