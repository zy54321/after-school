<template>
  <div class="workflow-container p-4" v-loading="loading">
    <el-card shadow="hover" class="mb-4 control-bar">
      <div class="flex justify-between items-center flex-wrap gap-4">
        <div class="timer-section text-center min-w-[150px]">
          <div class="text-gray-500 text-sm mb-1">班级专注计时</div>
          <div class="text-4xl font-mono font-bold text-blue-600 mb-2 tracking-wider">
            {{ formatTime(timer) }}
          </div>
          <el-button-group>
            <el-button :type="isRunning ? 'warning' : 'primary'" size="small" @click="toggleTimer"
              :icon="isRunning ? VideoPause : VideoPlay">
              {{ isRunning ? '暂停' : '开始' }}
            </el-button>
            <el-button size="small" @click="resetTimer" :icon="Refresh">重置</el-button>
          </el-button-group>
        </div>

        <div class="menu-section flex-1 border-l pl-8 border-gray-200">
          <div class="text-sm font-bold text-gray-700 mb-2 flex items-center">
            🍽️ 今日菜单 & 留样证据
            <el-tag size="small" type="info" class="ml-2">家长日报必显</el-tag>
          </div>
          <div class="flex gap-2 mb-2">
            <el-input v-model="menu.menu_content" placeholder="自动同步今日食谱..." class="flex-1" readonly>
              <template #prepend>今日菜谱</template>
            </el-input>
          </div>
          <el-input v-model="menu.evidence_photo_url" placeholder="粘贴图片URL" size="small">
            <template #prepend>证据图 URL</template>
          </el-input>
        </div>
      </div>
    </el-card>

    <el-row :gutter="15">
      <el-col :xs="24" :sm="12" :md="8" :lg="6" v-for="stu in students" :key="stu.id" class="mb-4">
        <el-card :body-style="{ padding: '0px' }" :class="['student-card', getCardBorderClass(stu)]" shadow="hover">
          <div class="p-3 border-b flex justify-between items-start bg-gray-50 relative overflow-hidden h-[72px]">
            <div>
              <div class="font-bold text-lg text-gray-800 flex items-center">
                {{ stu.name }}
                <el-tooltip v-if="stu.habit_goals && stu.habit_goals.length"
                  :content="'特训: ' + stu.habit_goals.join(',')" placement="top">
                  <span class="ml-1 text-xs cursor-help text-blue-500">🎯</span>
                </el-tooltip>
              </div>
              <div class="text-xs text-gray-500 mt-1">
                {{ stu.grade || '未知' }} |
                <span :class="getScoreColor(240 - stu.distraction_count * 5)">
                  {{ 240 - stu.distraction_count * 5 }}m
                </span>
              </div>
            </div>
            <el-tooltip v-if="stu.allergies" :content="'⚠️ 过敏: ' + stu.allergies" placement="top">
              <div class="bg-red-100 text-red-600 text-xs px-2 py-1 rounded font-bold animate-pulse cursor-help">
                🚫 {{ stu.allergies }}
              </div>
            </el-tooltip>
          </div>

          <div class="bg-white">
            <div class="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
              <div class="action-item p-2 text-center cursor-pointer hover:bg-red-50 transition"
                @click="stu.distraction_count++">
                <div class="text-xl mb-1 relative inline-block">
                  ⚡️
                  <span v-if="stu.distraction_count > 0"
                    class="absolute -top-1 -right-2 bg-red-500 text-white text-[9px] px-1 rounded-full">
                    -{{ stu.distraction_count * 5 }}
                  </span>
                </div>
                <div class="text-xs text-gray-500">走神</div>
              </div>

              <div class="action-item p-2 text-center cursor-pointer hover:bg-yellow-50 transition"
                @click="toggleMeal(stu)">
                <div class="text-xl mb-1">{{ getMealIcon(stu.meal_status) }}</div>
                <div class="text-xs text-gray-500">{{ getMealText(stu.meal_status) }}</div>
              </div>

              <div class="action-item p-2 text-center cursor-pointer hover:bg-blue-50 transition"
                @click="openHomework(stu)">
                <div class="text-xl mb-1">{{ getRatingIcon(stu.homework_rating) }}</div>
                <div class="text-xs text-gray-500">作业 {{ stu.homework_rating }}</div>
              </div>
            </div>

            <div class="grid grid-cols-2 divide-x divide-gray-100">
              <div class="action-item p-2 text-center cursor-pointer hover:bg-purple-50 transition"
                @click="toggleRating(stu, 'discipline_rating')">
                <div class="text-xl mb-1">{{ getRatingIcon(stu.discipline_rating) }}</div>
                <div class="text-xs text-gray-500">纪律 {{ stu.discipline_rating }}</div>
              </div>

              <div class="action-item p-2 text-center cursor-pointer hover:bg-green-50 transition"
                @click="toggleRating(stu, 'habit_rating')">
                <div class="text-xl mb-1">{{ getRatingIcon(stu.habit_rating) }}</div>
                <div class="text-xs text-gray-500">习惯 {{ stu.habit_rating }}</div>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <div class="fixed-footer flex justify-between items-center">
      <div class="text-sm text-gray-500">
        学生: <span class="font-bold text-gray-800">{{ students.length }}</span> 人
        <span class="mx-2">|</span>
        时长: <span class="font-bold text-blue-600">{{ formatTime(timer) }}</span>
      </div>
      <el-button type="primary" size="large" @click="saveAll" :loading="saving" :icon="Check" round
        class="px-8 shadow-lg shadow-blue-500/30">
        🚀 一键生成今日日报
      </el-button>
    </div>

    <el-dialog v-model="hwDialog.visible" title="作业评分" width="360px" center destroy-on-close>
      <div class="text-center" v-if="hwDialog.student">
        <h3 class="mb-4 font-bold text-gray-700">{{ hwDialog.student.name }} 的作业情况</h3>
        <el-radio-group v-model="hwDialog.rating" size="large" class="mb-6">
          <el-radio-button label="A"><span class="px-2">优 ⭐</span></el-radio-button>
          <el-radio-button label="B"><span class="px-2">良 🙂</span></el-radio-button>
          <el-radio-button label="C"><span class="px-2 text-red-500 font-bold">差 ❌</span></el-radio-button>
        </el-radio-group>
        <el-divider>问题标签</el-divider>
        <el-checkbox-group v-model="hwDialog.tags" class="flex flex-col gap-2 items-start pl-8">
          <el-checkbox label="粗心计算" />
          <el-checkbox label="字迹潦草" />
          <el-checkbox label="审题不清" />
          <el-checkbox label="拖拉磨蹭" />
        </el-checkbox-group>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="hwDialog.visible = false">取消</el-button>
          <el-button type="primary" @click="confirmHomework">确定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import axios from 'axios';
import { ElMessage, ElMessageBox } from 'element-plus';
import { VideoPlay, VideoPause, Refresh, Check } from '@element-plus/icons-vue';

const loading = ref(false);
const saving = ref(false);
const students = ref([]);
const menu = ref({ menu_content: '', evidence_photo_url: '' });

// 计时器
const timer = ref(0);
const isRunning = ref(false);
let intervalId = null;

// 弹窗
const hwDialog = ref({ visible: false, student: null, rating: 'A', tags: [] });

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const toggleTimer = () => {
  if (isRunning.value) clearInterval(intervalId);
  else intervalId = setInterval(() => timer.value++, 1000);
  isRunning.value = !isRunning.value;
};

const resetTimer = () => {
  clearInterval(intervalId);
  isRunning.value = false;
  timer.value = 0;
};

// --- 卡片逻辑 ---
const getCardBorderClass = (stu) => {
  if (stu.distraction_count > 0 || stu.homework_rating === 'C' || stu.discipline_rating === 'C') return 'border-l-4 border-red-500';
  if (stu.meal_status !== 'finished' || stu.homework_rating === 'B' || stu.habit_rating === 'B') return 'border-l-4 border-yellow-400';
  return 'border-l-4 border-green-500';
};
const getScoreColor = (score) => score >= 240 ? 'text-green-600 font-bold' : (score >= 200 ? 'text-blue-600' : 'text-red-500 font-bold');

const getMealIcon = (s) => ({ finished: '🥣', leftovers: '🌭', little: '🤢' }[s] || '🥣');
const getMealText = (s) => ({ finished: '光盘', leftovers: '剩菜', little: '挑食' }[s] || '光盘');
const toggleMeal = (stu) => {
  const states = ['finished', 'leftovers', 'little'];
  stu.meal_status = states[(states.indexOf(stu.meal_status) + 1) % 3];
};

const getRatingIcon = (r) => ({ A: '🌟', B: '🙂', C: '💣' }[r] || '🌟');

// ⭐ 通用评分切换 (用于纪律和习惯)
const toggleRating = (stu, field) => {
  const ratings = ['A', 'B', 'C'];
  // 获取当前值，默认为 A
  const current = stu[field] || 'A';
  // 轮转
  stu[field] = ratings[(ratings.indexOf(current) + 1) % 3];
};

const openHomework = (stu) => {
  hwDialog.value.student = stu;
  hwDialog.value.rating = stu.homework_rating || 'A';
  hwDialog.value.tags = stu.homework_tags ? [...stu.homework_tags] : [];
  hwDialog.value.visible = true;
};
const confirmHomework = () => {
  if (hwDialog.value.student) {
    hwDialog.value.student.homework_rating = hwDialog.value.rating;
    hwDialog.value.student.homework_tags = hwDialog.value.tags;
  }
  hwDialog.value.visible = false;
};

// --- API ---
const fetchData = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/reports/workflow');
    if (res.data.code === 200) {
      students.value = res.data.data.students.map(s => ({
        ...s,
        distraction_count: s.distraction_count || 0,
        meal_status: s.meal_status || 'finished',
        homework_rating: s.homework_rating || 'A',
        // ⭐ 初始化新字段
        discipline_rating: s.discipline_rating || 'A',
        habit_rating: s.habit_rating || 'A',
        homework_tags: s.homework_tags || []
      }));
      if (res.data.data.menu) menu.value = res.data.data.menu;
    }
  } catch (err) { ElMessage.error('加载失败'); }
  finally { loading.value = false; }
};

const saveAll = async () => {
  saving.value = true;
  const today = new Date().toISOString().split('T')[0];
  const payload = {
    date: today,
    menu: menu.value,
    students: students.value.map(s => ({
      id: s.id,
      name: s.name,
      focus_minutes: 240 - (s.distraction_count * 5),
      distraction_count: s.distraction_count,
      meal_status: s.meal_status,
      homework_rating: s.homework_rating,
      homework_tags: s.homework_tags,
      // ⭐ 提交新字段
      discipline_rating: s.discipline_rating,
      habit_rating: s.habit_rating
    }))
  };

  try {
    const res = await axios.post('/api/reports/workflow', payload);
    if (res.data.code === 200) {
      const links = res.data.data;
      const baseUrl = window.location.origin + '/report/view?token=';
      let msgHtml = '<div style="text-align: left; max-height: 300px; overflow-y: auto;">';
      links.forEach(l => {
        msgHtml += `<div style="margin-bottom:10px;border-bottom:1px dashed #eee;padding-bottom:5px;">
          <div style="font-weight:bold;">${l.name}</div>
          <div style="font-size:12px;color:#409EFF;word-break:break-all;">${baseUrl + l.token}</div>
        </div>`;
      });
      msgHtml += '</div>';
      ElMessageBox.alert(msgHtml, '日报已生成', { dangerouslyUseHTMLString: true, customStyle: { maxWidth: '500px' } });
    } else { ElMessage.error(res.data.msg); }
  } catch (err) { ElMessage.error('保存失败'); }
  finally { saving.value = false; }
};

onMounted(fetchData);
onUnmounted(() => { if (intervalId) clearInterval(intervalId); });
</script>

<style scoped>
.workflow-container {
  padding-bottom: 90px;
}

.student-card {
  transition: all 0.2s;
}

.student-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.fixed-footer {
  position: fixed;
  bottom: 0;
  right: 0;
  left: 200px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(5px);
  padding: 15px 40px;
  border-top: 1px solid #eee;
  z-index: 50;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.05);
}

@media (max-width: 768px) {
  .fixed-footer {
    left: 0;
    padding: 15px 20px;
  }

  .menu-section {
    border-left: none;
    padding-left: 0;
    margin-top: 15px;
  }
}
</style>