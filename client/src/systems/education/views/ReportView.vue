<template>
  <div class="report-h5 min-h-screen bg-gray-100 pb-10" v-loading="loading">
    <div v-if="report" class="max-w-md mx-auto bg-white shadow-lg min-h-screen relative overflow-hidden">

      <div class="header-bg p-6 text-white relative bg-blue-600">
        <div class="text-lg opacity-80">特训营 · 每日成长日报</div>
        <div class="text-3xl font-bold mt-2">{{ report.student_name }}</div>
        <div class="text-sm mt-1 opacity-90">{{ formatDate(report.report_date) }}</div>
        <div class="absolute -top-10 -right-10 w-40 h-40 bg-white opacity-10 rounded-full"></div>
      </div>

      <div class="px-4 -mt-8 relative z-10">
        <div class="bg-white rounded-xl shadow-md p-5">
          <div class="flex justify-between items-center border-b pb-3 mb-3">
            <span class="font-bold text-gray-700">⚡️ 专注力表现</span>
            <span class="text-2xl font-mono font-bold"
              :class="report.distraction_count > 0 ? 'text-yellow-500' : 'text-green-500'">
              {{ report.distraction_count > 0 ? '需提升' : '完美' }}
            </span>
          </div>
          <div class="flex justify-around text-center">
            <div>
              <div class="text-xs text-gray-400">有效时长</div>
              <div class="font-bold text-lg text-gray-800">{{ report.focus_minutes }}m</div>
            </div>
            <div>
              <div class="text-xs text-gray-400">走神次数</div>
              <div class="font-bold text-lg text-red-500">{{ report.distraction_count }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="px-4 mt-4">
        <div class="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div class="font-bold text-gray-700 mb-3 flex items-center justify-between">
            <span>📝 作业质量</span>
            <span class="text-xl">{{ getHwIcon(report.homework_rating) }}</span>
          </div>
          <div v-if="report.homework_tags && report.homework_tags.length" class="flex flex-wrap gap-2">
            <span v-for="tag in report.homework_tags" :key="tag"
              class="bg-red-50 text-red-500 text-xs px-2 py-1 rounded">
              {{ tag }}
            </span>
          </div>
          <div v-else class="text-sm text-gray-400">作业完成质量很高。</div>
        </div>
      </div>

      <div class="px-4 mt-4">
        <div class="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div class="font-bold text-gray-700 mb-3">🥣 饮食情况</div>
          <div class="text-sm text-gray-600 mb-2">
            <span class="font-bold">今日菜谱：</span> {{ report.menu_content || '营养配餐' }}
          </div>
          <div class="flex items-center justify-between bg-gray-50 p-3 rounded">
            <span class="text-sm text-gray-500">进食状态</span>
            <span class="font-bold text-sm">{{ getMealText(report.meal_status) }}</span>
          </div>
          <div v-if="report.evidence_photo_url" class="mt-3">
            <div class="text-xs text-gray-400 mb-1">留样证据：</div>
            <img :src="report.evidence_photo_url" class="w-full h-32 object-cover rounded bg-gray-200" />
          </div>
        </div>
      </div>

      <div class="px-4 mt-4 mb-8">
        <div class="bg-blue-50 rounded-xl p-5 border border-blue-100">
          <div class="font-bold text-blue-800 mb-2 text-sm">👨‍🏫 老师寄语</div>
          <p class="text-sm text-blue-900 leading-relaxed">{{ report.teacher_comment }}</p>
        </div>
      </div>

      <div class="text-center text-xs text-gray-300 pb-8">特训营数字化系统生成</div>
    </div>

    <div v-else-if="!loading" class="text-center py-20 text-gray-500">
      <p>暂无数据或链接失效</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';

const route = useRoute();
const loading = ref(true);
const report = ref(null);

const formatDate = (str) => new Date(str).toLocaleDateString();
const getHwIcon = (r) => ({ A: '🌟 优', B: '🙂 良', C: '❌ 差' }[r] || '🌟');
const getMealText = (s) => ({ finished: '光盘 🥣', leftovers: '有剩菜 🌭', little: '挑食 🤢' }[s] || '光盘');

onMounted(async () => {
  const { token } = route.query;
  if (!token) {
    loading.value = false;
    return;
  }
  try {
    // 请求公开接口
    const res = await axios.get(`/api/public/reports/view?token=${token}`);
    if (res.data.code === 200) {
      report.value = res.data.data;
    }
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
});
</script>