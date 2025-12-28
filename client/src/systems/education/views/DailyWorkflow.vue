<template>
  <div class="p-4" v-loading="loading">
    <div
      class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6 flex justify-between items-center sticky top-0 z-20 backdrop-blur-md bg-white/90">
      <div class="flex items-center gap-4 flex-1">
        <h2 class="text-xl font-bold flex items-center text-gray-800">
          <span class="mr-2 text-2xl">⚡</span> 特训工作台
        </h2>
        <el-date-picker v-model="currentDate" type="date" placeholder="选择日期" :disabled-date="(d) => d > new Date()"
          @change="fetchData" class="!w-40 shadow-sm" />
        <el-input v-model="menu.menu_content" placeholder="今日菜谱 (自动同步中...)" class="flex-1 max-w-xl shadow-sm">
          <template #prepend>🍱 今日菜谱</template>
        </el-input>
      </div>

      <div class="flex gap-3 items-center">
        <el-upload action="/api/catering/upload" :show-file-list="false" :on-success="handleUploadSuccess"
          :before-upload="beforeUpload" name="file" class="flex items-center">
          <el-button :icon="Camera" size="large" :type="menu.evidence_photo_url ? 'success' : 'info'" plain
            class="!rounded-xl">
            {{ menu.evidence_photo_url ? '照片已上传' : '上传留样' }}
          </el-button>
        </el-upload>

        <el-button type="primary" size="large" @click="handleSaveAll"
          class="!rounded-xl shadow-blue-200 shadow-lg font-bold">
          🚀 一键生成日报
        </el-button>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      <div v-for="student in students" :key="student.id"
        class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative group">

        <div
          class="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-4 flex justify-between items-center relative overflow-hidden">
          <div class="absolute -right-4 -top-4 w-20 h-20 bg-white/10 rounded-full blur-xl"></div>

          <div>
            <div class="text-white font-bold text-lg tracking-wide">{{ student.name }}</div>
            <div class="text-slate-300 text-xs mt-0.5 bg-slate-600/50 inline-block px-2 py-0.5 rounded">{{ student.grade
              }}
            </div>
          </div>

          <div v-if="student.token"
            class="bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-xs px-2 py-1 rounded rotate-2 backdrop-blur-sm font-bold shadow-inner">
            ✅ 已生成
          </div>
          <div v-else class="text-slate-500 text-xs bg-slate-900/50 px-2 py-1 rounded border border-slate-600">
            ⏳ 待生成
          </div>
        </div>

        <div class="p-4 grid grid-cols-2 gap-3">
          <div
            class="bg-blue-50 rounded-xl p-2 flex flex-col justify-center items-center relative overflow-hidden border border-blue-100">
            <el-icon class="absolute top-1 right-1 text-blue-200 text-3xl">
              <Timer />
            </el-icon>
            <div class="text-xs text-blue-500 font-bold z-10 mb-1">专注时长</div>
            <div class="flex items-baseline z-10 w-full px-1">
              <el-input-number v-model="student.focus_minutes" :min="0" :step="10" controls-position="right"
                class="!w-full enhanced-input-number" size="large" />
            </div>
            <div class="text-[10px] text-blue-400 mt-1">分钟</div>
          </div>

          <div
            class="bg-orange-50 rounded-xl p-2 flex flex-col justify-center items-center relative overflow-hidden border border-orange-100">
            <el-icon class="absolute top-1 right-1 text-orange-200 text-3xl">
              <WarnTriangleFilled />
            </el-icon>
            <div class="text-xs text-orange-500 font-bold z-10 mb-1">走神次数</div>
            <div class="flex items-baseline z-10 w-full px-1">
              <el-input-number v-model="student.distraction_count" :min="0" controls-position="right"
                class="!w-full enhanced-input-number" size="large" />
            </div>
            <div class="text-[10px] text-orange-400 mt-1">次</div>
          </div>
        </div>

        <div class="px-5 pb-5 space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <div class="text-xs text-gray-400 mb-1.5 flex items-center"><el-icon class="mr-1">
                  <Notebook />
                </el-icon>作业评级</div>
              <el-select v-model="student.homework_rating" size="large" class="w-full">
                <el-option label="A 🌟 优秀" value="A" />
                <el-option label="B 👍 良好" value="B" />
                <el-option label="C 🔨 待改进" value="C" />
              </el-select>
            </div>
            <div>
              <div class="text-xs text-gray-400 mb-1.5 flex items-center"><el-icon class="mr-1">
                  <Trophy />
                </el-icon>行为习惯</div>
              <el-select v-model="student.habit_rating" size="large" class="w-full">
                <el-option label="A 🌟 模范" value="A" />
                <el-option label="B 👍 遵守" value="B" />
                <el-option label="C 🔔 提醒" value="C" />
              </el-select>
            </div>
          </div>

          <div class="bg-gray-50 p-2 rounded-lg border border-gray-100">
            <div class="text-xs text-gray-400 mb-2 flex items-center justify-between">
              <span><el-icon class="mr-1 relative top-0.5">
                  <Food />
                </el-icon>用餐情况</span>
              <span class="text-[10px] text-gray-300">点击切换</span>
            </div>
            <el-radio-group v-model="student.meal_status" size="default" class="w-full flex">
              <el-radio-button label="finished" class="flex-1 text-center">🥣 光盘</el-radio-button>
              <el-radio-button label="leftovers" class="flex-1 text-center">🥡 剩菜</el-radio-button>
              <el-radio-button label="little" class="flex-1 text-center">🤐 挑食</el-radio-button>
            </el-radio-group>
          </div>

          <div>
            <div class="text-xs text-gray-400 mb-1.5">存在问题 (可多选)</div>
            <el-select v-model="student.homework_tags" multiple placeholder="无明显问题..." size="large" style="width:100%"
              class="custom-tag-select">
              <el-option label="✍️ 书写潦草" value="书写潦草" />
              <el-option label="🧮 计算粗心" value="计算粗心" />
              <el-option label="🐌 拖拉磨蹭" value="拖拉磨蹭" />
              <el-option label="❌ 错题未改" value="错题未改" />
              <el-option label="📖 阅读不专心" value="阅读不专心" />
            </el-select>
          </div>

        </div>
      </div>
    </div>

    <el-dialog v-model="resultVisible" title="🎉 日报生成成功" width="600px" class="rounded-2xl">
      <div class="bg-green-50 text-green-700 p-3 rounded-lg mb-4 text-sm flex items-center">
        <el-icon class="mr-2 text-lg">
          <CircleCheckFilled />
        </el-icon>
        所有日报已保存至云端，家长链接已更新。
      </div>
      <div class="max-h-[400px] overflow-y-auto border border-gray-100 rounded-xl bg-gray-50">
        <div v-for="item in generatedLinks" :key="item.student_id"
          class="flex justify-between items-center bg-white p-4 border-b border-gray-100 last:border-0 hover:bg-blue-50 transition group">
          <div class="flex flex-col overflow-hidden mr-4">
            <span class="font-bold text-gray-800 text-base mb-1">{{ item.name }}</span>
            <a :href="getReportUrl(item.token)" target="_blank"
              class="text-xs text-blue-500 truncate hover:underline block w-full bg-blue-50 px-2 py-1 rounded">
              {{ getReportUrl(item.token) }}
            </a>
          </div>

          <el-button type="primary" plain :icon="CopyDocument" @click="copyToClipboard(getReportUrl(item.token))"
            class="!rounded-lg">
            复制
          </el-button>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-center pt-2">
          <el-button type="primary" size="large" @click="resultVisible = false"
            class="!rounded-xl px-10">完成工作</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import {
  Camera, CopyDocument, Timer, WarnTriangleFilled,
  Notebook, Trophy, Food, CircleCheckFilled
} from '@element-plus/icons-vue';

const loading = ref(false);
const currentDate = ref(new Date());
const resultVisible = ref(false);
const generatedLinks = ref([]);

// 核心数据
const menu = reactive({ menu_content: '', evidence_photo_url: '' });
const students = ref([]);

const getReportUrl = (token) => `${window.location.origin}/report/view?token=${token}`;

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    ElMessage.success({ message: '🔗 链接已复制', type: 'success' });
  } catch (err) {
    ElMessage.error('复制失败');
  }
};

const fetchData = async () => {
  loading.value = true;
  try {
    const dateStr = new Date(currentDate.value.getTime() + 8 * 3600 * 1000).toISOString().split('T')[0];
    const res = await axios.get(`/api/reports/workflow?date=${dateStr}`);
    if (res.data.code === 200) {
      const data = res.data.data;
      menu.menu_content = data.menu.menu_content;
      menu.evidence_photo_url = data.menu.evidence_photo_url;

      students.value = data.students.map(s => ({
        ...s,
        focus_minutes: s.focus_minutes !== null ? s.focus_minutes : 0,
        distraction_count: s.distraction_count !== null ? s.distraction_count : 0,
        homework_rating: s.homework_rating || 'A',
        habit_rating: s.habit_rating || 'A',
        meal_status: s.meal_status || 'finished',
        homework_tags: s.homework_tags || [],
      }));
    }
  } catch (err) {
    ElMessage.error('数据加载失败');
  } finally {
    loading.value = false;
  }
};

const handleSaveAll = async () => {
  if (!students.value.length) return;
  loading.value = true;
  try {
    const dateStr = new Date(currentDate.value.getTime() + 8 * 3600 * 1000).toISOString().split('T')[0];
    const payload = { date: dateStr, menu: menu, students: students.value };

    const res = await axios.post('/api/reports/workflow', payload);
    if (res.data.code === 200) {
      ElMessage.success('🎉 所有日报已生成！');
      generatedLinks.value = res.data.data;
      resultVisible.value = true;
      fetchData();
    }
  } catch (err) {
    ElMessage.error('保存失败');
  } finally {
    loading.value = false;
  }
};

const beforeUpload = (file) => {
  if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
    ElMessage.error('只能上传 JPG/PNG');
    return false;
  }
  if (file.size / 1024 / 1024 > 5) {
    ElMessage.error('图片不能超过 5MB');
    return false;
  }
  return true;
};

const handleUploadSuccess = (res) => {
  if (res.code === 200) {
    menu.evidence_photo_url = res.url;
    ElMessage.success('上传成功');
  } else {
    ElMessage.error('上传失败');
  }
};

onMounted(fetchData);
</script>

<style scoped>
/* 👇 深度定制输入框样式 */
:deep(.enhanced-input-number .el-input__wrapper) {
  box-shadow: none !important;
  /* 去掉边框 */
  background-color: transparent !important;
  padding-left: 0;
  padding-right: 55px !important;
  /* 给右侧大按钮留出空间 */
}

:deep(.enhanced-input-number .el-input__inner) {
  font-size: 1.8rem;
  /* 增大数字字体 */
  font-weight: 800;
  /* 加粗 */
  text-align: center;
  color: inherit;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

/* 👇 核心：加宽右侧控制按钮 */
:deep(.enhanced-input-number.is-controls-right .el-input-number__decrease),
:deep(.enhanced-input-number.is-controls-right .el-input-number__increase) {
  width: 50px !important;
  /* 强制加宽到 50px */
  background-color: rgba(0, 0, 0, 0.03);
  /* 微微的背景色方便识别 */
  border-left: 1px solid rgba(0, 0, 0, 0.05);
}

/* 按钮里的图标也放大 */
:deep(.enhanced-input-number .el-icon) {
  font-size: 18px;
  font-weight: bold;
}

/* 调整单选按钮样式 */
:deep(.el-radio-button__inner) {
  border: none !important;
  background-color: #f9fafb;
  border-radius: 6px !important;
  margin: 2px;
  font-size: 13px;
  box-shadow: none !important;
  padding: 8px 15px;
  /* 加大点击区域 */
}

:deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  background-color: #3b82f6;
  color: white;
  box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3) !important;
}

/* 修复 tag 样式，让多选标签看起来更协调 */
:deep(.custom-tag-select .el-select__tags) {
  padding-left: 4px;
}
</style>