<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { ElMessage, ElMessageBox } from 'element-plus';
import dayjs from 'dayjs';
import {
  ArrowLeft,
  Plus,
  Refresh,
  Check,
  Close,
  Timer,
  Coin,
  User,
  Document,
  Trophy,
} from '@element-plus/icons-vue';

const router = useRouter();

// ========== 状态 ==========
const loading = ref(false);
const members = ref([]);
const currentMemberId = ref(null);
const activeTab = ref('market'); // market / my-tasks / pending

// 任务数据
const marketTasks = ref([]);
const myClaims = ref([]);
const pendingSubmissions = ref([]);

// 弹窗
const showPublishModal = ref(false);
const showSubmitModal = ref(false);
const showReviewModal = ref(false);

// 表单
const publishForm = reactive({
  title: '',
  description: '',
  bounty_points: 10,
  due_at: null,
  accept_criteria: '',
});

const submitForm = reactive({
  claimId: null,
  taskTitle: '',
  submission_note: '',
});

const reviewForm = reactive({
  taskId: null,
  taskTitle: '',
  claimerName: '',
  submissionNote: '',
  bountyPoints: 0,
  decision: '',
  comment: '',
  allowReclaim: false,
});

// ========== 计算属性 ==========
const currentMember = computed(() => {
  return members.value.find((m) => m.id === currentMemberId.value);
});

const memberBalance = computed(() => {
  return currentMember.value?.balance || 0;
});

// ========== API 调用 ==========
const loadMembers = async () => {
  try {
    const res = await axios.get('/api/family/init');
    if (res.data.code === 200) {
      members.value = res.data.data.members || [];
      if (members.value.length > 0 && !currentMemberId.value) {
        currentMemberId.value = members.value[0].id;
      }
    }
  } catch (err) {
    console.error('加载成员失败:', err);
  }
};

const loadMemberBalance = async () => {
  if (!currentMemberId.value) return;
  try {
    const res = await axios.get('/api/family/member-dashboard', {
      params: { memberId: currentMemberId.value },
    });
    if (res.data.code === 200) {
      const member = members.value.find((m) => m.id === currentMemberId.value);
      if (member) {
        member.balance = res.data.data.totalPoints || 0;
      }
    }
  } catch (err) {
    console.error('加载余额失败:', err);
  }
};

const loadMarketTasks = async () => {
  if (!currentMemberId.value) return;
  loading.value = true;
  try {
    const res = await axios.get('/api/v2/tasks', {
      params: { member_id: currentMemberId.value },
    });
    if (res.data.code === 200) {
      marketTasks.value = res.data.data.tasks || [];
    }
  } catch (err) {
    ElMessage.error('加载任务市场失败');
    console.error(err);
  } finally {
    loading.value = false;
  }
};

const loadMyClaims = async () => {
  if (!currentMemberId.value) return;
  loading.value = true;
  try {
    const res = await axios.get('/api/v2/tasks/my-claims', {
      params: { member_id: currentMemberId.value },
    });
    if (res.data.code === 200) {
      myClaims.value = res.data.data.claims || [];
    }
  } catch (err) {
    ElMessage.error('加载我的任务失败');
    console.error(err);
  } finally {
    loading.value = false;
  }
};

const loadPendingSubmissions = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/v2/tasks/pending');
    if (res.data.code === 200) {
      pendingSubmissions.value = res.data.data.submissions || [];
    }
  } catch (err) {
    ElMessage.error('加载待审核列表失败');
    console.error(err);
  } finally {
    loading.value = false;
  }
};

const refreshCurrentTab = async () => {
  if (activeTab.value === 'market') {
    await loadMarketTasks();
  } else if (activeTab.value === 'my-tasks') {
    await loadMyClaims();
  } else if (activeTab.value === 'pending') {
    await loadPendingSubmissions();
  }
};

const publishTask = async () => {
  if (!publishForm.title.trim()) {
    return ElMessage.warning('请输入任务标题');
  }
  if (publishForm.bounty_points <= 0) {
    return ElMessage.warning('悬赏积分必须大于0');
  }
  if (publishForm.bounty_points > memberBalance.value) {
    return ElMessage.warning('积分不足');
  }

  loading.value = true;
  try {
    const res = await axios.post('/api/v2/tasks', {
      publisher_member_id: currentMemberId.value,
      title: publishForm.title,
      description: publishForm.description,
      bounty_points: publishForm.bounty_points,
      due_at: publishForm.due_at,
      accept_criteria: publishForm.accept_criteria,
    });
    if (res.data.code === 200) {
      ElMessage.success(res.data.msg);
      showPublishModal.value = false;
      resetPublishForm();
      await loadMemberBalance();
      await refreshCurrentTab();
    } else {
      ElMessage.error(res.data.msg);
    }
  } catch (err) {
    ElMessage.error(err.response?.data?.msg || '发布失败');
  } finally {
    loading.value = false;
  }
};

const claimTask = async (task) => {
  try {
    await ElMessageBox.confirm(
      `确定要领取「${task.title}」吗？\n悬赏: ${task.bounty_points} 积分`,
      '领取任务',
      { confirmButtonText: '领取', cancelButtonText: '取消' }
    );
  } catch {
    return;
  }

  loading.value = true;
  try {
    const res = await axios.post(`/api/v2/tasks/${task.id}/claim`, {
      member_id: currentMemberId.value,
    });
    if (res.data.code === 200) {
      ElMessage.success(res.data.msg);
      await refreshCurrentTab();
    } else {
      ElMessage.error(res.data.msg);
    }
  } catch (err) {
    ElMessage.error(err.response?.data?.msg || '领取失败');
  } finally {
    loading.value = false;
  }
};

const openSubmitModal = (claim) => {
  submitForm.claimId = claim.id;
  submitForm.taskTitle = claim.title;
  submitForm.submission_note = '';
  showSubmitModal.value = true;
};

const submitTask = async () => {
  loading.value = true;
  try {
    const res = await axios.post(`/api/v2/tasks/${submitForm.claimId}/submit`, {
      claim_id: submitForm.claimId,
      submission_note: submitForm.submission_note,
    });
    if (res.data.code === 200) {
      ElMessage.success(res.data.msg);
      showSubmitModal.value = false;
      await loadMyClaims();
    } else {
      ElMessage.error(res.data.msg);
    }
  } catch (err) {
    ElMessage.error(err.response?.data?.msg || '提交失败');
  } finally {
    loading.value = false;
  }
};

const openReviewModal = (submission) => {
  reviewForm.taskId = submission.task_id;
  reviewForm.taskTitle = submission.title;
  reviewForm.claimerName = submission.claimer_name;
  reviewForm.submissionNote = submission.submission_note;
  reviewForm.bountyPoints = submission.bounty_points;
  reviewForm.decision = '';
  reviewForm.comment = '';
  reviewForm.allowReclaim = false;
  showReviewModal.value = true;
};

const reviewTask = async () => {
  if (!reviewForm.decision) {
    return ElMessage.warning('请选择审核结果');
  }

  loading.value = true;
  try {
    const res = await axios.post(`/api/v2/tasks/${reviewForm.taskId}/review`, {
      reviewer_member_id: currentMemberId.value,
      decision: reviewForm.decision,
      comment: reviewForm.comment,
      allow_reclaim: reviewForm.allowReclaim,
    });
    if (res.data.code === 200) {
      ElMessage.success(res.data.msg);
      showReviewModal.value = false;
      await loadPendingSubmissions();
      await loadMemberBalance();
    } else {
      ElMessage.error(res.data.msg);
    }
  } catch (err) {
    ElMessage.error(err.response?.data?.msg || '审核失败');
  } finally {
    loading.value = false;
  }
};

const resetPublishForm = () => {
  publishForm.title = '';
  publishForm.description = '';
  publishForm.bounty_points = 10;
  publishForm.due_at = null;
  publishForm.accept_criteria = '';
};

const goBack = () => {
  router.push('/family/dashboard');
};

// ========== 辅助函数 ==========
const getStatusTag = (status) => {
  const map = {
    open: { type: 'success', label: '可领取' },
    claimed: { type: 'warning', label: '进行中' },
    submitted: { type: 'primary', label: '待审核' },
    approved: { type: 'success', label: '已完成' },
    rejected: { type: 'danger', label: '已拒绝' },
    cancelled: { type: 'info', label: '已取消' },
    expired: { type: 'info', label: '已过期' },
    active: { type: 'warning', label: '进行中' },
  };
  return map[status] || { type: 'info', label: status };
};

const formatDueAt = (dueAt) => {
  if (!dueAt) return '无期限';
  const due = dayjs(dueAt);
  const now = dayjs();
  if (due.isBefore(now)) return '已过期';
  const diff = due.diff(now, 'day');
  if (diff === 0) return '今天截止';
  if (diff === 1) return '明天截止';
  return `${diff}天后截止`;
};

// ========== 生命周期 ==========
onMounted(async () => {
  await loadMembers();
  await loadMemberBalance();
  await loadMarketTasks();
});

watch(currentMemberId, async () => {
  await loadMemberBalance();
  await refreshCurrentTab();
});

watch(activeTab, async () => {
  await refreshCurrentTab();
});
</script>

<template>
  <div class="bounty-page">
    <!-- 顶部导航 -->
    <header class="bounty-header">
      <div class="header-left">
        <el-button :icon="ArrowLeft" circle @click="goBack" />
        <h1>📋 悬赏任务</h1>
      </div>
      <div class="header-right">
        <el-select
          v-model="currentMemberId"
          placeholder="选择成员"
          style="width: 140px"
        >
          <el-option
            v-for="m in members"
            :key="m.id"
            :label="m.name"
            :value="m.id"
          />
        </el-select>
        <div class="balance-badge" v-if="currentMember">
          <el-icon><Coin /></el-icon>
          <span>{{ memberBalance }}</span>
        </div>
      </div>
    </header>

    <!-- Tab 切换 -->
    <div class="tab-bar">
      <div
        class="tab-item"
        :class="{ active: activeTab === 'market' }"
        @click="activeTab = 'market'"
      >
        🛒 任务市场
      </div>
      <div
        class="tab-item"
        :class="{ active: activeTab === 'my-tasks' }"
        @click="activeTab = 'my-tasks'"
      >
        📝 我的任务
        <span v-if="myClaims.filter(c => c.status === 'active').length" class="badge">
          {{ myClaims.filter(c => c.status === 'active').length }}
        </span>
      </div>
      <div
        class="tab-item"
        :class="{ active: activeTab === 'pending' }"
        @click="activeTab = 'pending'"
      >
        ✅ 待审核
        <span v-if="pendingSubmissions.length" class="badge">
          {{ pendingSubmissions.length }}
        </span>
      </div>
    </div>

    <!-- 主内容 -->
    <main class="bounty-main" v-loading="loading">
      <!-- 任务市场 -->
      <div v-if="activeTab === 'market'" class="market-view">
        <div class="section-header">
          <h2>可领取的任务</h2>
          <div class="actions">
            <el-button :icon="Refresh" @click="loadMarketTasks">刷新</el-button>
            <el-button type="primary" :icon="Plus" @click="showPublishModal = true">
              发布悬赏
            </el-button>
          </div>
        </div>

        <div class="task-list">
          <div
            v-for="task in marketTasks"
            :key="task.id"
            class="task-card"
          >
            <div class="task-header">
              <h3>{{ task.title }}</h3>
              <div class="bounty-amount">
                <el-icon><Trophy /></el-icon>
                {{ task.bounty_points }}
              </div>
            </div>
            <p class="task-desc" v-if="task.description">{{ task.description }}</p>
            <div class="task-meta">
              <span class="publisher">
                <el-icon><User /></el-icon>
                {{ task.publisher_name }}
              </span>
              <span class="due" :class="{ urgent: task.due_at && dayjs(task.due_at).diff(dayjs(), 'day') <= 1 }">
                <el-icon><Timer /></el-icon>
                {{ formatDueAt(task.due_at) }}
              </span>
            </div>
            <el-button type="primary" size="small" class="claim-btn" @click="claimTask(task)">
              领取任务
            </el-button>
          </div>

          <div v-if="marketTasks.length === 0" class="empty-state">
            <p>暂无可领取的任务</p>
            <el-button type="primary" @click="showPublishModal = true">
              发布第一个悬赏
            </el-button>
          </div>
        </div>
      </div>

      <!-- 我的任务 -->
      <div v-if="activeTab === 'my-tasks'" class="my-tasks-view">
        <div class="section-header">
          <h2>我领取的任务</h2>
          <el-button :icon="Refresh" @click="loadMyClaims">刷新</el-button>
        </div>

        <div class="task-list">
          <div
            v-for="claim in myClaims"
            :key="claim.id"
            class="task-card"
            :class="claim.status"
          >
            <div class="task-header">
              <h3>{{ claim.title }}</h3>
              <el-tag :type="getStatusTag(claim.status).type" size="small">
                {{ getStatusTag(claim.status).label }}
              </el-tag>
            </div>
            <div class="task-meta">
              <span class="bounty">
                <el-icon><Trophy /></el-icon>
                {{ claim.bounty_points }} 积分
              </span>
              <span class="due">
                <el-icon><Timer /></el-icon>
                {{ formatDueAt(claim.due_at) }}
              </span>
            </div>
            <div class="task-actions" v-if="claim.status === 'active'">
              <el-button type="success" size="small" @click="openSubmitModal(claim)">
                提交完成
              </el-button>
            </div>
            <div v-if="claim.status === 'submitted'" class="submitted-note">
              <p>📤 已提交，等待审核...</p>
            </div>
            <div v-if="claim.status === 'approved'" class="approved-note">
              <p>🎉 任务完成，已获得奖励！</p>
            </div>
          </div>

          <div v-if="myClaims.length === 0" class="empty-state">
            <p>还没有领取任务</p>
            <el-button @click="activeTab = 'market'">去任务市场看看</el-button>
          </div>
        </div>
      </div>

      <!-- 待审核 -->
      <div v-if="activeTab === 'pending'" class="pending-view">
        <div class="section-header">
          <h2>待审核的提交</h2>
          <el-button :icon="Refresh" @click="loadPendingSubmissions">刷新</el-button>
        </div>

        <div class="task-list">
          <div
            v-for="sub in pendingSubmissions"
            :key="sub.id"
            class="task-card pending"
          >
            <div class="task-header">
              <h3>{{ sub.title }}</h3>
              <div class="bounty-amount">
                <el-icon><Trophy /></el-icon>
                {{ sub.bounty_points }}
              </div>
            </div>
            <div class="submission-info">
              <p><strong>提交者:</strong> {{ sub.claimer_name }}</p>
              <p><strong>提交说明:</strong> {{ sub.submission_note || '无' }}</p>
              <p><strong>提交时间:</strong> {{ dayjs(sub.submitted_at).format('MM/DD HH:mm') }}</p>
            </div>
            <div class="task-actions">
              <el-button type="primary" size="small" @click="openReviewModal(sub)">
                审核
              </el-button>
            </div>
          </div>

          <div v-if="pendingSubmissions.length === 0" class="empty-state">
            <p>暂无待审核的任务</p>
          </div>
        </div>
      </div>
    </main>

    <!-- 发布任务弹窗 -->
    <el-dialog v-model="showPublishModal" title="发布悬赏任务" width="90%" max-width="500px">
      <el-form :model="publishForm" label-position="top">
        <el-form-item label="任务标题" required>
          <el-input v-model="publishForm.title" placeholder="例如：整理书桌" />
        </el-form-item>
        <el-form-item label="任务描述">
          <el-input
            v-model="publishForm.description"
            type="textarea"
            :rows="3"
            placeholder="详细描述任务要求..."
          />
        </el-form-item>
        <el-form-item label="悬赏积分" required>
          <el-input-number
            v-model="publishForm.bounty_points"
            :min="1"
            :max="memberBalance"
            style="width: 100%"
          />
          <div class="form-hint">当前余额: {{ memberBalance }}</div>
        </el-form-item>
        <el-form-item label="截止时间">
          <el-date-picker
            v-model="publishForm.due_at"
            type="datetime"
            placeholder="选择截止时间"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="验收标准">
          <el-input
            v-model="publishForm.accept_criteria"
            type="textarea"
            :rows="2"
            placeholder="描述如何判断任务完成..."
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showPublishModal = false">取消</el-button>
        <el-button type="primary" @click="publishTask" :loading="loading">
          发布 (扣除 {{ publishForm.bounty_points }} 积分)
        </el-button>
      </template>
    </el-dialog>

    <!-- 提交任务弹窗 -->
    <el-dialog v-model="showSubmitModal" title="提交任务" width="90%" max-width="400px">
      <div class="submit-content">
        <h3>{{ submitForm.taskTitle }}</h3>
        <el-form label-position="top">
          <el-form-item label="完成说明">
            <el-input
              v-model="submitForm.submission_note"
              type="textarea"
              :rows="3"
              placeholder="描述你完成任务的情况..."
            />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="showSubmitModal = false">取消</el-button>
        <el-button type="success" @click="submitTask" :loading="loading">
          提交
        </el-button>
      </template>
    </el-dialog>

    <!-- 审核弹窗 -->
    <el-dialog v-model="showReviewModal" title="审核任务" width="90%" max-width="450px">
      <div class="review-content">
        <h3>{{ reviewForm.taskTitle }}</h3>
        <div class="review-info">
          <p><strong>提交者:</strong> {{ reviewForm.claimerName }}</p>
          <p><strong>悬赏积分:</strong> {{ reviewForm.bountyPoints }}</p>
          <p><strong>提交说明:</strong> {{ reviewForm.submissionNote || '无' }}</p>
        </div>
        <el-form label-position="top">
          <el-form-item label="审核结果" required>
            <el-radio-group v-model="reviewForm.decision">
              <el-radio-button label="approved">
                <el-icon><Check /></el-icon> 通过
              </el-radio-button>
              <el-radio-button label="rejected">
                <el-icon><Close /></el-icon> 拒绝
              </el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="审核意见">
            <el-input
              v-model="reviewForm.comment"
              type="textarea"
              :rows="2"
              placeholder="可选：给出审核意见..."
            />
          </el-form-item>
          <el-form-item v-if="reviewForm.decision === 'rejected'">
            <el-checkbox v-model="reviewForm.allowReclaim">
              允许任务重新被领取
            </el-checkbox>
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="showReviewModal = false">取消</el-button>
        <el-button
          :type="reviewForm.decision === 'approved' ? 'success' : 'danger'"
          @click="reviewTask"
          :loading="loading"
          :disabled="!reviewForm.decision"
        >
          {{ reviewForm.decision === 'approved' ? '确认通过' : '确认拒绝' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.bounty-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-family: 'Segoe UI', 'SF Pro Display', -apple-system, sans-serif;
}

/* Header */
.bounty-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-left h1 {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.balance-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  font-weight: 700;
  font-size: 16px;
}

/* Tab Bar */
.tab-bar {
  display: flex;
  background: rgba(255, 255, 255, 0.1);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.tab-item {
  flex: 1;
  padding: 14px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
  font-weight: 500;
}

.tab-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.tab-item.active {
  background: rgba(255, 255, 255, 0.15);
  border-bottom: 3px solid #fff;
}

.tab-item .badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background: #f56c6c;
  border-radius: 10px;
  font-size: 12px;
  margin-left: 6px;
}

/* Main */
.bounty-main {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-header h2 {
  font-size: 20px;
  margin: 0;
}

.actions {
  display: flex;
  gap: 10px;
}

/* Task List */
.task-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.task-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  padding: 20px;
  color: #333;
  transition: all 0.3s;
}

.task-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.task-card.approved {
  border-left: 4px solid #67c23a;
}

.task-card.rejected {
  border-left: 4px solid #f56c6c;
  opacity: 0.7;
}

.task-card.pending {
  border-left: 4px solid #409eff;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.task-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1a1a2e;
}

.bounty-amount {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  border-radius: 20px;
  color: #fff;
  font-weight: 700;
  font-size: 14px;
}

.task-desc {
  margin: 0 0 12px 0;
  color: #666;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.task-meta {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #888;
  margin-bottom: 12px;
}

.task-meta span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.task-meta .urgent {
  color: #f56c6c;
  font-weight: 600;
}

.claim-btn {
  width: 100%;
}

.task-actions {
  margin-top: 12px;
}

.submitted-note,
.approved-note {
  margin-top: 12px;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 8px;
  font-size: 14px;
}

.approved-note {
  background: #f0f9eb;
  color: #67c23a;
}

.submission-info {
  margin: 12px 0;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 8px;
}

.submission-info p {
  margin: 6px 0;
  font-size: 14px;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: rgba(255, 255, 255, 0.8);
}

.empty-state p {
  font-size: 16px;
  margin-bottom: 16px;
}

/* Form */
.form-hint {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.submit-content h3,
.review-content h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
}

.review-info {
  margin-bottom: 16px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 8px;
}

.review-info p {
  margin: 6px 0;
  font-size: 14px;
}

/* Responsive */
@media (max-width: 768px) {
  .bounty-header {
    flex-direction: column;
    gap: 12px;
    padding: 12px 16px;
  }

  .header-left h1 {
    font-size: 20px;
  }

  .bounty-main {
    padding: 16px;
  }

  .section-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .tab-item {
    padding: 12px 8px;
    font-size: 14px;
  }
}
</style>
