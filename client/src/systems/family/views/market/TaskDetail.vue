<template>
  <div class="task-detail">
    <!-- 面包屑 -->
    <nav class="breadcrumb">
      <router-link to="/family/market">市场</router-link>
      <span class="separator">/</span>
      <router-link to="/family/market/tasks">悬赏任务</router-link>
      <span class="separator">/</span>
      <span class="current">{{ task?.title || '加载中...' }}</span>
    </nav>

    <div v-if="task" class="detail-content">
      <!-- 任务头部 -->
      <header class="detail-header">
        <div class="header-info">
          <h1>{{ task.title }}</h1>
          <span class="task-status" :class="task.status">
            {{ getStatusLabel(task.status) }}
          </span>
        </div>
        <div class="bounty-badge">
          <span class="bounty-label">赏金</span>
          <span class="bounty-value">{{ task.bounty_points }}</span>
          <span class="bounty-unit">积分</span>
        </div>
      </header>

      <!-- 任务描述 -->
      <section class="task-description">
        <h2>📝 任务描述</h2>
        <p>{{ task.description }}</p>
      </section>

      <!-- 验收标准 -->
      <section class="accept-criteria" v-if="task.accept_criteria">
        <h2>✅ 验收标准</h2>
        <p>{{ task.accept_criteria }}</p>
      </section>

      <!-- 任务信息 -->
      <section class="task-info">
        <div class="info-item" v-if="task.publisher_name">
          <span class="info-label">发布者</span>
          <span class="info-value">{{ task.publisher_name }}</span>
        </div>
        <div class="info-item" v-if="task.claimer_name">
          <span class="info-label">领取者</span>
          <span class="info-value">{{ task.claimer_name }}</span>
        </div>
        <div class="info-item" v-if="task.due_at">
          <span class="info-label">截止时间</span>
          <span class="info-value">{{ formatTime(task.due_at) }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">创建时间</span>
          <span class="info-value">{{ formatTime(task.created_at) }}</span>
        </div>
      </section>

      <!-- 操作区域 -->
      <section class="actions">
        <!-- 开放任务：可领取 -->
        <button 
          v-if="task.status === 'open'"
          class="action-btn claim"
          @click="openClaimSelector"
        >
          领取任务
        </button>

        <!-- 已领取：可提交 -->
        <div v-else-if="task.status === 'claimed'" class="submit-section">
          <h3>📤 提交任务</h3>
          <textarea 
            v-model="submitForm.note"
            class="submit-textarea"
            placeholder="填写完成说明（可选）"
          ></textarea>
          <button class="action-btn submit" @click="openSubmitSelector">
            提交任务
          </button>
        </div>

        <!-- 已提交：等待审核 -->
        <div v-else-if="task.status === 'submitted'" class="status-section">
          <p class="status-hint">⏳ 任务已提交，等待审核</p>
        </div>

        <!-- 已完成 -->
        <div v-else-if="task.status === 'approved'" class="status-section success">
          <p class="status-hint">✅ 任务已完成！已获得 {{ task.bounty_points }} 积分</p>
        </div>

        <!-- 已拒绝 -->
        <div v-else-if="task.status === 'rejected'" class="status-section failed">
          <p class="status-hint">❌ 任务被拒绝</p>
          <p class="reject-reason" v-if="task.reject_reason">原因：{{ task.reject_reason }}</p>
        </div>
      </section>
    </div>

    <div class="loading-state" v-else-if="loading">
      加载中...
    </div>

    <div class="empty-state" v-else>
      <p>任务不存在</p>
      <router-link to="/family/market/tasks" class="back-btn">返回任务列表</router-link>
    </div>

    <!-- 统一成员选择器 - 领取 -->
    <MemberSelector
      v-model:visible="showClaimSelector"
      title="选择领取成员"
      :action-description="`领取任务「${task?.title}」\n赏金：${task?.bounty_points || 0} 积分`"
      action-icon="📋"
      confirm-text="确认领取"
      :loading="claiming"
      @confirm="handleClaimConfirm"
      @cancel="showClaimSelector = false"
    />

    <!-- 统一成员选择器 - 提交 -->
    <MemberSelector
      v-model:visible="showSubmitSelector"
      title="确认提交成员"
      :action-description="`提交任务「${task?.title}」`"
      action-icon="📤"
      confirm-text="确认提交"
      :loading="submitting"
      :default-member-id="task?.claimer_member_id"
      @confirm="handleSubmitConfirm"
      @cancel="showSubmitSelector = false"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import MemberSelector from '../../components/MemberSelector.vue';

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const task = ref(null);

// 领取流程
const showClaimSelector = ref(false);
const claiming = ref(false);

// 提交流程
const showSubmitSelector = ref(false);
const submitting = ref(false);
const submitForm = ref({
  note: '',
});

// 加载任务详情
const loadTask = async () => {
  const taskId = route.params.id;
  if (!taskId) return;
  
  loading.value = true;
  try {
    const res = await axios.get(`/api/v2/tasks/${taskId}`);
    
    if (res.data?.code === 200) {
      task.value = res.data.data?.task;
    }
  } catch (err) {
    console.error('加载任务详情失败:', err);
  } finally {
    loading.value = false;
  }
};

// 格式化时间
const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
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

// 打开领取选择器
const openClaimSelector = () => {
  showClaimSelector.value = true;
};

// 领取确认
const handleClaimConfirm = async ({ memberId }) => {
  claiming.value = true;
  try {
    const res = await axios.post(`/api/v2/tasks/${task.value.id}/claim`, {
      member_id: memberId,
    });
    
    if (res.data?.code === 200) {
      alert('领取成功！');
      showClaimSelector.value = false;
      loadTask();
    }
  } catch (err) {
    alert(err.response?.data?.msg || '领取失败');
  } finally {
    claiming.value = false;
  }
};

// 打开提交选择器
const openSubmitSelector = () => {
  showSubmitSelector.value = true;
};

// 提交确认
const handleSubmitConfirm = async ({ memberId }) => {
  submitting.value = true;
  try {
    const res = await axios.post(`/api/v2/tasks/${task.value.id}/submit`, {
      member_id: memberId,
      note: submitForm.value.note,
    });
    
    if (res.data?.code === 200) {
      alert('提交成功！等待审核');
      showSubmitSelector.value = false;
      loadTask();
    }
  } catch (err) {
    alert(err.response?.data?.msg || '提交失败');
  } finally {
    submitting.value = false;
  }
};

onMounted(() => {
  loadTask();
});
</script>

<style scoped>
.task-detail {
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

/* 详情头部 */
.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
  flex-wrap: wrap;
  gap: 16px;
}

.header-info h1 {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 12px;
}

.task-status {
  font-size: 14px;
  padding: 6px 14px;
  border-radius: 20px;
}

.task-status.open {
  background: rgba(46, 204, 113, 0.2);
  color: #2ecc71;
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
  background: rgba(46, 204, 113, 0.2);
  color: #2ecc71;
}

.task-status.rejected {
  background: rgba(255, 77, 77, 0.2);
  color: #ff4d4d;
}

.bounty-badge {
  text-align: center;
  padding: 20px 28px;
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 149, 0, 0.1));
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 16px;
}

.bounty-label {
  display: block;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 4px;
}

.bounty-value {
  font-size: 36px;
  font-weight: 700;
  color: #ffd700;
}

.bounty-unit {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  margin-left: 4px;
}

/* 内容区域 */
section {
  margin-bottom: 28px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 16px;
}

section h2 {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 12px;
  color: rgba(255, 255, 255, 0.9);
}

section p {
  margin: 0;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.6;
}

/* 任务信息 */
.task-info {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}

.info-item {
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
}

.info-label {
  display: block;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 4px;
}

.info-value {
  font-size: 14px;
  font-weight: 500;
}

/* 操作区域 */
.actions {
  padding: 24px;
}

.action-btn {
  width: 100%;
  padding: 16px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.action-btn.claim {
  background: linear-gradient(135deg, #2ecc71, #27ae60);
  color: #fff;
}

.action-btn.submit {
  background: linear-gradient(135deg, #4facfe, #00f2fe);
  color: #fff;
}

.action-btn:hover {
  transform: scale(1.02);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
}

/* 提交区域 */
.submit-section h3 {
  font-size: 16px;
  margin: 0 0 16px;
}

.submit-textarea {
  width: 100%;
  min-height: 100px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  color: #fff;
  font-size: 14px;
  resize: vertical;
  margin-bottom: 16px;
}

.submit-textarea:focus {
  outline: none;
  border-color: rgba(79, 172, 254, 0.5);
}

.submit-textarea::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

/* 状态区域 */
.status-section {
  text-align: center;
  padding: 24px;
}

.status-hint {
  font-size: 16px;
  margin: 0;
}

.status-section.success .status-hint {
  color: #2ecc71;
}

.status-section.failed .status-hint {
  color: #ff4d4d;
}

.reject-reason {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 12px;
}

/* 空状态 & 加载 */
.empty-state, .loading-state {
  text-align: center;
  padding: 60px 20px;
  color: rgba(255, 255, 255, 0.5);
}

.back-btn {
  display: inline-block;
  margin-top: 16px;
  padding: 12px 24px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 10px;
  color: #fff;
  text-decoration: none;
}
</style>
