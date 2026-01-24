<template>
  <div class="market-tasks">
    <!-- 面包屑 -->
    <nav class="breadcrumb">
      <router-link to="/family/market">市场</router-link>
      <span class="separator">/</span>
      <span class="current">悬赏任务</span>
    </nav>

    <header class="page-header">
      <h1>
        <span class="header-icon">📋</span>
        悬赏任务
      </h1>
      <p>完成任务，赚取积分</p>
    </header>

    <!-- 统计卡片 -->
    <div class="stats-row" v-if="stats">
      <div class="stat-card">
        <div class="stat-value">{{ stats.open }}</div>
        <div class="stat-label">待领取</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.claimed }}</div>
        <div class="stat-label">进行中</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.submitted }}</div>
        <div class="stat-label">待审核</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.approved }}</div>
        <div class="stat-label">已完成</div>
      </div>
    </div>

    <!-- 任务筛选 -->
    <div class="filter-tabs">
      <button 
        v-for="tab in statusTabs" 
        :key="tab.value"
        class="filter-tab"
        :class="{ active: filter.status === tab.value }"
        @click="filter.status = tab.value; loadTasks()"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- 任务列表 -->
    <div class="tasks-list" v-if="tasks.length > 0">
      <div v-for="task in tasks" :key="task.id" class="task-card" :class="task.status">
        <router-link :to="`/family/tasks/${task.id}`" class="task-link">
          <div class="task-header">
            <h3>{{ task.title }}</h3>
            <div class="task-bounty">
              <span class="bounty-icon">💰</span>
              <span class="bounty-value">{{ task.bounty_points }}</span>
              <span class="bounty-unit">积分</span>
            </div>
          </div>

          <p class="task-description">{{ task.description }}</p>

          <div class="task-meta">
            <span class="meta-item" v-if="task.due_at">
              <span class="meta-icon">⏰</span>
              截止: {{ formatTime(task.due_at) }}
            </span>
            <span class="meta-item" v-if="task.publisher_name">
              <span class="meta-icon">👤</span>
              发布: {{ task.publisher_name }}
            </span>
          </div>
        </router-link>

        <div class="task-footer">
          <span class="task-status" :class="task.status">
            {{ getStatusLabel(task.status) }}
          </span>
          <button 
            v-if="task.status === 'open'"
            class="claim-btn"
            @click.stop="openClaimModal(task)"
          >
            领取任务
          </button>
          <router-link 
            v-else-if="task.status === 'claimed'"
            :to="`/family/tasks/${task.id}`"
            class="submit-btn"
            @click.stop
          >
            提交任务
          </router-link>
        </div>
      </div>
    </div>

    <div class="empty-state" v-else-if="!loading">
      <div class="empty-icon">📋</div>
      <p>暂无任务</p>
    </div>

    <div class="loading-state" v-if="loading">
      加载中...
    </div>

    <!-- 统一成员选择器 -->
    <MemberSelector
      v-model:visible="showMemberSelector"
      title="选择领取成员"
      :action-description="selectedTask ? `领取任务「${selectedTask.title}」\n赏金：${selectedTask.bounty_points} 积分` : ''"
      action-icon="📋"
      confirm-text="确认领取"
      :loading="claiming"
      @confirm="handleMemberConfirm"
      @cancel="closeMemberSelector"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import MemberSelector from '../../components/MemberSelector.vue';

const loading = ref(false);
const tasks = ref([]);
const stats = ref(null);

const showMemberSelector = ref(false);
const selectedTask = ref(null);
const claiming = ref(false);

const filter = ref({
  status: '',
});

const statusTabs = [
  { label: '全部', value: '' },
  { label: '待领取', value: 'open' },
  { label: '进行中', value: 'claimed' },
  { label: '待审核', value: 'submitted' },
  { label: '已完成', value: 'approved' },
];

// 加载任务
const loadTasks = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/v2/tasks', {
      params: { status: filter.value.status || undefined }
    });
    
    if (res.data?.code === 200) {
      tasks.value = res.data.data?.tasks || [];
    }
  } catch (err) {
    console.error('加载任务失败:', err);
  } finally {
    loading.value = false;
  }
};

// 加载统计
const loadStats = async () => {
  try {
    const res = await axios.get('/api/v2/tasks/market');
    
    if (res.data?.code === 200) {
      stats.value = res.data.data?.stats || {};
    }
  } catch (err) {
    console.error('加载任务统计失败:', err);
  }
};

// 格式化时间
const formatTime = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// 获取状态标签
const getStatusLabel = (status) => {
  const labels = {
    open: '待领取',
    claimed: '进行中',
    submitted: '待审核',
    approved: '已完成',
    rejected: '已拒绝',
    cancelled: '已取消',
    expired: '已过期',
  };
  return labels[status] || status;
};

// 打开领取弹窗
const openClaimModal = (task) => {
  selectedTask.value = task;
  showMemberSelector.value = true;
};

// 关闭成员选择器
const closeMemberSelector = () => {
  showMemberSelector.value = false;
  selectedTask.value = null;
};

// 成员确认后执行领取
const handleMemberConfirm = async ({ memberId }) => {
  if (!selectedTask.value) return;
  
  claiming.value = true;
  try {
    const res = await axios.post(`/api/v2/tasks/${selectedTask.value.id}/claim`, {
      member_id: memberId,
    });
    
    if (res.data?.code === 200) {
      alert('领取成功！');
      showMemberSelector.value = false;
      selectedTask.value = null;
      loadTasks();
      loadStats();
    }
  } catch (err) {
    alert(err.response?.data?.msg || '领取失败');
  } finally {
    claiming.value = false;
  }
};

onMounted(() => {
  loadTasks();
  loadStats();
});
</script>

<style scoped>
.market-tasks {
  color: #fff;
}

.breadcrumb {
  margin-bottom: 24px;
  font-size: 14px;
}

.breadcrumb a {
  color: rgba(255, 255, 255, 0.6);
  text-decoration: none;
}

.breadcrumb a:hover {
  color: #fff;
}

.breadcrumb .separator {
  margin: 0 8px;
  color: rgba(255, 255, 255, 0.4);
}

.breadcrumb .current {
  color: #fff;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 8px;
}

.header-icon {
  font-size: 32px;
}

.page-header p {
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
}

/* 统计卡片 */
.stats-row {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.stat-card {
  flex: 1;
  min-width: 100px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  text-align: center;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #38ef7d;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}

/* 筛选标签 */
.filter-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.filter-tab {
  padding: 10px 18px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.filter-tab:hover {
  background: rgba(255, 255, 255, 0.1);
}

.filter-tab.active {
  background: linear-gradient(135deg, #11998e, #38ef7d);
  color: #fff;
  border-color: transparent;
}

/* 任务列表 */
.tasks-list {
  display: grid;
  gap: 16px;
}

.task-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 20px;
  transition: all 0.3s ease;
}

.task-card:hover {
  background: rgba(255, 255, 255, 0.08);
}

.task-link {
  display: block;
  text-decoration: none;
  color: inherit;
  margin-bottom: 16px;
}

.task-card.open {
  border-left: 4px solid #38ef7d;
}

.task-card.claimed {
  border-left: 4px solid #4facfe;
}

.task-card.submitted {
  border-left: 4px solid #ffc107;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.task-header h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.task-bounty {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: linear-gradient(135deg, rgba(17, 153, 142, 0.2), rgba(56, 239, 125, 0.2));
  border-radius: 20px;
}

.bounty-icon {
  font-size: 14px;
}

.bounty-value {
  font-size: 16px;
  font-weight: 700;
  color: #38ef7d;
}

.bounty-unit {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.task-description {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  margin: 0 0 16px;
  line-height: 1.5;
}

.task-meta {
  display: flex;
  gap: 20px;
  margin-bottom: 16px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}

.meta-icon {
  font-size: 14px;
}

.task-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.task-status {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 12px;
}

.task-status.open {
  background: rgba(56, 239, 125, 0.2);
  color: #38ef7d;
}

.task-status.claimed {
  background: rgba(79, 172, 254, 0.2);
  color: #4facfe;
}

.task-status.submitted {
  background: rgba(255, 193, 7, 0.2);
  color: #ffc107;
}

.task-status.approved {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
}

.claim-btn {
  padding: 8px 20px;
  background: linear-gradient(135deg, #11998e, #38ef7d);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.claim-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 15px rgba(56, 239, 125, 0.4);
}

.submit-btn {
  display: inline-block;
  padding: 8px 20px;
  background: linear-gradient(135deg, #4facfe, #00f2fe);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.3s ease;
}

.submit-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 15px rgba(79, 172, 254, 0.4);
}

/* 空状态 & 加载 */
.empty-state, .loading-state {
  text-align: center;
  padding: 60px 20px;
  color: rgba(255, 255, 255, 0.5);
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

/* 弹窗 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #1a1a2e;
  border-radius: 20px;
  width: 90%;
  max-width: 450px;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-header h3 {
  font-size: 18px;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 24px;
  cursor: pointer;
}

.modal-body {
  padding: 24px;
}

.task-preview {
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  margin-bottom: 20px;
}

.task-preview h4 {
  font-size: 16px;
  margin: 0 0 8px;
}

.task-preview p {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  margin: 0 0 12px;
}

.preview-bounty {
  font-size: 14px;
}

.preview-bounty strong {
  color: #38ef7d;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 8px;
}

.form-select {
  width: 100%;
  padding: 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
}

.form-select option {
  background: #1a1a2e;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.cancel-btn {
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
}

.confirm-btn {
  padding: 10px 24px;
  background: linear-gradient(135deg, #11998e, #38ef7d);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.confirm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
