<template>
  <div class="report-container min-h-screen bg-gray-50 pb-10" v-loading="loading">

    <div class="header-card bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-6 rounded-b-3xl shadow-lg mb-6">
      <div v-if="report" class="flex justify-between items-start">
        <div>
          <div class="text-blue-100 text-sm mb-1">{{ formatDate(report.report_date) }}</div>
          <div class="text-3xl font-bold mb-1 flex items-center">
            {{ report.student_name }}
            <span class="text-xs bg-white/20 px-2 py-0.5 rounded-full ml-2 font-normal">{{ report.grade || '学员'
              }}</span>
          </div>
          <div class="text-blue-100 text-sm opacity-90">
            今日特训目标: {{ report.habit_goals ? report.habit_goals.join('、') : '全面发展' }}
          </div>
        </div>
        <div class="bg-white/10 backdrop-blur-sm rounded-lg p-2 text-center min-w-[70px]">
          <div class="text-xs text-blue-100 mb-1">综合表现</div>
          <div class="text-2xl font-bold">{{ getOverallScore(report) }}</div>
        </div>
      </div>
    </div>

    <div v-if="report" class="px-4 space-y-5">

      <div class="grid grid-cols-3 gap-3">
        <div
          class="bg-white p-3 rounded-xl shadow-sm border border-gray-100 text-center relative overflow-hidden group">
          <div class="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
          <div class="text-gray-400 text-xs mb-1">专注时长</div>
          <div class="text-xl font-bold text-gray-800">
            {{ report.focus_minutes }}<span class="text-xs font-normal text-gray-400">min</span>
          </div>
          <div class="text-[10px] mt-1" :class="report.distraction_count > 2 ? 'text-orange-500' : 'text-green-500'">
            {{ report.distraction_count === 0 ? '全神贯注' : `走神 ${report.distraction_count} 次` }}
          </div>
        </div>

        <div class="bg-white p-3 rounded-xl shadow-sm border border-gray-100 text-center relative overflow-hidden">
          <div class="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
          <div class="text-gray-400 text-xs mb-1">作业质量</div>
          <div class="text-xl font-bold" :class="getRatingColor(report.homework_rating)">
            {{ report.homework_rating }}
          </div>
          <div class="text-[10px] text-gray-400 mt-1 truncate">
            {{ report.homework_tags && report.homework_tags.length ? report.homework_tags[0] : '书写工整' }}
          </div>
        </div>

        <div class="bg-white p-3 rounded-xl shadow-sm border border-gray-100 text-center relative overflow-hidden">
          <div class="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
          <div class="text-gray-400 text-xs mb-1">行为习惯</div>
          <div class="text-xl font-bold" :class="getRatingColor(report.habit_rating)">
            {{ report.habit_rating || 'A' }}
          </div>
          <div class="text-[10px] text-gray-400 mt-1">
            纪律 {{ report.discipline_rating || 'A' }}
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-orange-100 overflow-hidden">
        <div class="bg-orange-50 px-4 py-3 flex justify-between items-center border-b border-orange-100">
          <div class="font-bold text-orange-800 flex items-center">
            <el-icon class="mr-1 text-orange-500">
              <Food />
            </el-icon> 今日营养膳食
          </div>
          <div class="text-xs text-orange-400">{{ getMealStatusText(report.meal_status) }}</div>
        </div>

        <div class="p-4">
          <div v-if="report.menu_content" class="mb-4 space-y-3">
            <div v-for="(item, idx) in parseMenu(report.menu_content)" :key="idx" class="flex">
              <span class="bg-orange-100 text-orange-600 text-xs px-2 py-0.5 rounded-md mr-2 h-fit whitespace-nowrap">
                {{ item.type }}
              </span>
              <span class="text-sm text-gray-700 leading-relaxed">{{ item.content }}</span>
            </div>
          </div>
          <div v-else class="text-gray-400 text-sm text-center py-2">
            今日菜谱正在上传中...
          </div>

          <div v-if="report.evidence_photo_url" class="mt-3">
            <div
              class="bg-gray-100 p-2 rounded-lg border border-gray-200 inline-block shadow-sm rotate-1 hover:rotate-0 transition-transform duration-300">
              <el-image :src="report.evidence_photo_url" :preview-src-list="[report.evidence_photo_url]"
                class="w-full h-40 object-cover rounded bg-white block" fit="cover">
                <template #error>
                  <div class="w-full h-40 bg-gray-200 flex items-center justify-center text-gray-400 text-xs">
                    图片加载失败
                  </div>
                </template>
              </el-image>
              <div class="text-center text-[10px] text-gray-500 mt-1 font-mono">今日留样 Evidence</div>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div class="font-bold text-gray-800 mb-2 flex items-center">
          <el-icon class="mr-1 text-blue-500">
            <ChatDotRound />
          </el-icon> 老师寄语
        </div>
        <div class="bg-blue-50 text-blue-900 text-sm p-3 rounded-lg leading-relaxed relative">
          <span class="text-3xl text-blue-200 absolute -top-2 -left-1">“</span>
          <span class="relative z-10">{{ report.teacher_comment }}</span>
          <span class="text-3xl text-blue-200 absolute -bottom-4 -right-1">”</span>
        </div>
      </div>

      <div v-if="report.history && report.history.length > 1"
        class="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div class="font-bold text-gray-800 mb-4 flex items-center">
          <el-icon class="mr-1 text-purple-500">
            <TrendCharts />
          </el-icon> 近7天专注力趋势
        </div>
        <div class="h-32 flex items-end justify-between gap-1 px-2">
          <div v-for="(day, idx) in report.history" :key="idx" class="flex flex-col items-center flex-1 group">
            <div class="opacity-0 group-hover:opacity-100 transition text-[10px] text-blue-600 font-bold mb-1">
              {{ day.focus_minutes }}
            </div>
            <div class="w-full max-w-[20px] bg-blue-100 rounded-t-sm hover:bg-blue-400 transition-colors relative"
              :style="{ height: (day.focus_minutes / 240 * 100) + '%' }">
              <div v-if="day.report_date === report.report_date"
                class="absolute top-0 left-0 w-full h-full bg-blue-500 opacity-20 animate-pulse"></div>
            </div>
            <div class="text-[10px] text-gray-400 mt-1 scale-90">{{ formatDateShort(day.report_date) }}</div>
          </div>
        </div>
      </div>

    </div>

    <div v-if="!loading && !report" class="flex flex-col items-center justify-center h-screen text-gray-400">
      <el-icon class="text-6xl mb-4 text-gray-200">
        <DocumentDelete />
      </el-icon>
      <p>报告不存在或链接已失效</p>
    </div>

    <div class="text-center text-gray-300 text-xs mt-8 pb-4">
      托管班管理系统提供技术支持
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';
import { Food, ChatDotRound, TrendCharts, DocumentDelete } from '@element-plus/icons-vue';

const route = useRoute();
const loading = ref(true);
const report = ref(null);

// 辅助函数
const formatDate = (str) => {
  if (!str) return '';
  const d = new Date(str);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
};

const formatDateShort = (str) => {
  if (!str) return '';
  const d = new Date(str);
  return `${d.getMonth() + 1}.${d.getDate()}`;
};

const getRatingColor = (rating) => {
  if (rating === 'A') return 'text-green-500';
  if (rating === 'B') return 'text-blue-500';
  return 'text-red-500';
};

const getMealStatusText = (status) => {
  const map = { finished: '光盘行动 🌟', leftovers: '有少量剩菜', little: '挑食/吃得少' };
  return map[status] || status;
};

// 综合评分算法 (娱乐性质)
const getOverallScore = (r) => {
  let score = 80;
  if (r.homework_rating === 'A') score += 10;
  if (r.habit_rating === 'A') score += 5;
  if (r.distraction_count === 0) score += 5;
  else score -= (r.distraction_count * 2);
  return Math.min(100, Math.max(60, score));
};

// ⭐ 核心：解析自动生成的菜单字符串
// 格式如 "【午餐】西红柿炒蛋、米饭 【晚餐】炒面"
const parseMenu = (content) => {
  if (!content) return [];
  // 使用正则匹配 【xxx】内容
  const regex = /【(.*?)】([^【]+)/g;
  const result = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    result.push({
      type: match[1], // 午餐/晚餐
      content: match[2].trim() // 具体的菜
    });
  }
  // 如果匹配不到 (可能是旧格式)，直接显示
  if (result.length === 0) {
    return [{ type: '餐单', content: content }];
  }
  return result;
};

onMounted(async () => {
  const token = route.query.token;
  if (!token) {
    loading.value = false;
    return;
  }
  try {
    // 调用公开接口获取数据
    const res = await axios.get(`/api/reports/view?token=${token}`);
    if (res.data.code === 200) {
      report.value = res.data.data;
    }
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.header-card {
  border-bottom-left-radius: 2rem;
  border-bottom-right-radius: 2rem;
}

/* 隐藏滚动条但允许滚动 */
.report-container {
  -webkit-overflow-scrolling: touch;
}
</style>