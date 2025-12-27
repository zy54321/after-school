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
            <el-input v-model="menu.menu_content" placeholder="输入今日菜谱（如：土豆牛腩、清炒时蔬）" class="flex-1">
              <template #prepend>今日菜谱</template>
            </el-input>
          </div>
          <el-input v-model="menu.evidence_photo_url" placeholder="粘贴山姆小票或成品图 URL (支持 OSS/图床链接)" size="small">
            <template #prepend>证据图 URL</template>
          </el-input>
        </div>
      </div>
    </el-card>

    <div v-if="students.length === 0" class="text-center py-10 text-gray-400">
      暂无在读学生，请先去“学生档案”录入并激活。
    </div>

    <el-row :gutter="15">
      <el-col :xs="24" :sm="12" :md="8" :lg="6" v-for="stu in students" :key="stu.id" class="mb-4">
        <el-card :body-style="{ padding: '0px' }" :class="['student-card', getCardBorderClass(stu)]" shadow="hover">
          <div class="p-3 border-b flex justify-between items-start bg-gray-50 relative overflow-hidden">
            <div>
              <div class="font-bold text-lg text-gray-800 flex items-center">
                {{ stu.name }}
                <el-tooltip v-if="stu.habit_goals && stu.habit_goals.length" content="有特训目标" placement="top">
                  <span class="ml-1 text-xs cursor-help">🎯</span>
                </el-tooltip>
              </div>
              <div class="text-xs text-gray-500 mt-1">
                {{ stu.grade || '未知' }}年级
                <span v-if="stu.habit_goals && stu.habit_goals.length" class="text-blue-500 ml-1">
                  | 训: {{ stu.habit_goals[0] }}...
                </span>
              </div>
            </div>

            <el-tooltip v-if="stu.allergies" :content="'⚠️ 严重过敏源: ' + stu.allergies" placement="top">
              <div class="bg-red-100 text-red-600 text-xs px-2 py-1 rounded font-bold animate-pulse">
                🚫 {{ stu.allergies }}
              </div>
            </el-tooltip>
          </div>

          <div class="action-grid grid grid-cols-3 divide-x divide-gray-100 select-none">

            <div class="action-item p-3 text-center cursor-pointer hover:bg-red-50 transition active:bg-red-100"
              @click="stu.distraction_count++">
              <div class="text-2xl mb-1 relative inline-block">
                ⚡️
                <span v-if="stu.distraction_count > 0"
                  class="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] px-1 rounded-full">
                  -{{ stu.distraction_count * 5 }}m
                </span>
              </div>
              <div class="text-xs text-gray-500">
                专注 <span :class="stu.distraction_count > 0 ? 'text-red-500 font-bold' : ''">
                  {{ stu.distraction_count > 0 ? '异常' : '100%' }}
                </span>
              </div>
            </div>

            <div class="action-item p-3 text-center cursor-pointer hover:bg-yellow-50 transition active:bg-yellow-100"
              @click="toggleMeal(stu)">
              <div class="text-2xl mb-1">{{ getMealIcon(stu.meal_status) }}</div>
              <div class="text-xs text-gray-500">{{ getMealText(stu.meal_status) }}</div>
            </div>

            <div class="action-item p-3 text-center cursor-pointer hover:bg-blue-50 transition active:bg-blue-100"
              @click="openHomework(stu)">
              <div class="text-2xl mb-1">{{ getHomeworkIcon(stu.homework_rating) }}</div>
              <div class="text-xs text-gray-500">
                作业 <span :class="stu.homework_rating === 'C' ? 'text-red-500 font-bold' : ''">{{ stu.homework_rating
                  }}</span>
              </div>
            </div>

          </div>
        </el-card>
      </el-col>
    </el-row>

    <div class="fixed-footer flex justify-between items-center">
      <div class="text-sm text-gray-500">
        已就位学生: <span class="font-bold text-gray-800">{{ students.length }}</span> 人
        <span class="mx-2">|</span>
        今日总时长: <span class="font-bold text-blue-600">{{ formatTime(timer) }}</span>
      </div>
      <el-button type="primary" size="large" @click="saveAll" :loading="saving" :icon="Check" round
        class="px-8 shadow-lg shadow-blue-500/30">
        🚀 一键生成今日日报
      </el-button>
    </div>

    <el-dialog v-model="hwDialog.visible" title="作业评分录入" width="360px" center destroy-on-close>
      <div class="text-center" v-if="hwDialog.student">
        <h3 class="mb-4 font-bold text-gray-700">{{ hwDialog.student.name }} 的作业情况</h3>

        <el-radio-group v-model="hwDialog.rating" size="large" class="mb-6">
          <el-radio-button label="A">
            <span class="px-2">优 ⭐</span>
          </el-radio-button>
          <el-radio-button label="B">
            <span class="px-2">良 🙂</span>
          </el-radio-button>
          <el-radio-button label="C">
            <span class="px-2 text-red-500 font-bold">差 ❌</span>
          </el-radio-button>
        </el-radio-group>

        <el-divider content-position="center">问题标签 (自动生成评语)</el-divider>

        <el-checkbox-group v-model="hwDialog.tags" class="flex flex-col gap-2 items-start pl-8">
          <el-checkbox label="粗心计算" />
          <el-checkbox label="字迹潦草" />
          <el-checkbox label="审题不清" />
          <el-checkbox label="拖拉磨蹭" />
          <el-checkbox label="错题未订正" />
        </el-checkbox-group>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="hwDialog.visible = false">取消</el-button>
          <el-button type="primary" @click="confirmHomework">确定保存</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import axios from 'axios';
// ⭐ 修正处：同时引入 ElMessage 和 ElMessageBox
import { ElMessage, ElMessageBox } from 'element-plus';
import { VideoPlay, VideoPause, Refresh, Check } from '@element-plus/icons-vue';

// ---------------------------------------------------------
// 状态定义
// ---------------------------------------------------------
const loading = ref(false);
const saving = ref(false);
const students = ref([]);
const menu = ref({ menu_content: '', evidence_photo_url: '' });

// 计时器状态
const timer = ref(0);
const isRunning = ref(false);
let intervalId = null;

// 作业弹窗状态
const hwDialog = ref({
  visible: false,
  student: null,
  rating: 'A',
  tags: []
});

// ---------------------------------------------------------
// 核心逻辑：计时器
// ---------------------------------------------------------
const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const toggleTimer = () => {
  if (isRunning.value) {
    clearInterval(intervalId);
  } else {
    intervalId = setInterval(() => timer.value++, 1000);
  }
  isRunning.value = !isRunning.value;
};

const resetTimer = () => {
  clearInterval(intervalId);
  isRunning.value = false;
  timer.value = 0;
};

// ---------------------------------------------------------
// 核心逻辑：卡片交互
// ---------------------------------------------------------
const getCardBorderClass = (stu) => {
  // 红色边框：有走神 或 作业差
  if (stu.distraction_count > 0 || stu.homework_rating === 'C') return 'border-l-4 border-red-500';
  // 黄色边框：剩菜 或 作业良
  if (stu.meal_status !== 'finished' || stu.homework_rating === 'B') return 'border-l-4 border-yellow-400';
  // 绿色边框：完美
  return 'border-l-4 border-green-500';
};

// 吃饭状态机
const getMealIcon = (status) => ({
  finished: '🥣', leftovers: '🌭', little: '🤢'
}[status] || '🥣');

const getMealText = (status) => ({
  finished: '光盘', leftovers: '剩菜', little: '挑食'
}[status] || '光盘');

const toggleMeal = (stu) => {
  const states = ['finished', 'leftovers', 'little'];
  const idx = states.indexOf(stu.meal_status || 'finished');
  stu.meal_status = states[(idx + 1) % 3];
};

// 作业状态展示
const getHomeworkIcon = (rating) => ({
  A: '🌟', B: '📝', C: '💣'
}[rating] || '🌟');

// 打开作业评分弹窗
const openHomework = (stu) => {
  hwDialog.value.student = stu;
  // 回填当前状态
  hwDialog.value.rating = stu.homework_rating || 'A';
  hwDialog.value.tags = stu.homework_tags ? [...stu.homework_tags] : [];
  hwDialog.value.visible = true;
};

// 确认作业评分
const confirmHomework = () => {
  if (hwDialog.value.student) {
    hwDialog.value.student.homework_rating = hwDialog.value.rating;
    hwDialog.value.student.homework_tags = hwDialog.value.tags;
  }
  hwDialog.value.visible = false;
};

// ---------------------------------------------------------
// API 交互
// ---------------------------------------------------------
const fetchData = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/reports/workflow');
    if (res.data.code === 200) {
      // 数据适配：防止后端返回 null
      students.value = res.data.data.students.map(s => ({
        ...s,
        distraction_count: s.distraction_count || 0,
        meal_status: s.meal_status || 'finished',
        homework_rating: s.homework_rating || 'A',
        homework_tags: s.homework_tags || []
      }));
      // 如果今日已有菜单记录，则回填
      if (res.data.data.menu) {
        menu.value = res.data.data.menu;
      }
    } else {
      ElMessage.error(res.data.msg || '数据加载失败');
    }
  } catch (err) {
    console.error(err);
    ElMessage.error('无法连接特训服务器');
  } finally {
    loading.value = false;
  }
};

const saveAll = async () => {
  saving.value = true;
  const today = new Date().toISOString().split('T')[0];

  // 1. 构造提交数据
  const payload = {
    date: today,
    menu: menu.value,
    students: students.value.map(s => ({
      id: s.id,
      name: s.name, // 传名字，方便后端返回时带上
      focus_minutes: 240 - (s.distraction_count * 5),
      distraction_count: s.distraction_count,
      meal_status: s.meal_status,
      homework_rating: s.homework_rating,
      homework_tags: s.homework_tags
    }))
  };

  try {
    const res = await axios.post('/api/reports/workflow', payload);

    if (res.data.code === 200) {
      ElMessage.success('日报生成成功！');

      // 2. 获取生成的链接列表
      const links = res.data.data; // [{ name, token, ... }]
      const baseUrl = window.location.origin + '/report/view?token=';

      // 3. 构造一段方便复制的文本 (HTML格式)
      let msgHtml = '<div style="text-align: left; max-height: 300px; overflow-y: auto;">';
      msgHtml += '<p class="mb-2 text-gray-500">请复制下方链接发送给家长：</p>';

      links.forEach(l => {
        const fullLink = baseUrl + l.token;
        msgHtml += `
          <div style="margin-bottom: 10px; border-bottom: 1px dashed #eee; padding-bottom: 5px;">
            <div style="font-weight: bold;">${l.name}</div>
            <div style="font-size: 12px; color: #409EFF; word-break: break-all; user-select: text;">
              ${fullLink}
            </div>
          </div>
        `;
      });
      msgHtml += '</div>';

      // 4. 使用高级弹窗展示
      ElMessageBox.alert(msgHtml, '🚀 日报链接已生成', {
        dangerouslyUseHTMLString: true, // 允许渲染 HTML
        confirmButtonText: '关闭',
        customStyle: { maxWidth: '500px' }
      });

    } else {
      ElMessage.error(res.data.msg || '保存失败');
    }
  } catch (err) {
    console.error(err);
    ElMessage.error('保存失败，请检查网络');
  } finally {
    saving.value = false;
  }
};

// 生命周期
onMounted(() => {
  fetchData();
});

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId);
});
</script>

<style scoped>
.workflow-container {
  /* 底部留出空间，防止内容被底部固定栏遮挡 */
  padding-bottom: 90px;
}

.student-card {
  transition: all 0.2s;
}

.student-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* 底部固定栏样式 */
.fixed-footer {
  position: fixed;
  bottom: 0;
  right: 0;

  /* 关键：避开左侧 200px 菜单栏 */
  left: 200px;

  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(5px);
  padding: 15px 40px;
  border-top: 1px solid #eee;
  z-index: 50;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.05);
}

/* 移动端适配 */
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

/* 自定义网格分割线 */
.divide-x>div:not(:last-child) {
  border-right-width: 1px;
}
</style>