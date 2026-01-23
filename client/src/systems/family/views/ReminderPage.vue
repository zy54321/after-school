<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Bell, Timer, Refresh, Plus, Check, Close, ArrowLeft, Warning, Clock, User } from '@element-plus/icons-vue';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const router = useRouter();
const goBack = () => router.push('/family');

// === 状态定义 ===
const loading = ref(false);
const activeTab = ref('pending');
const reminders = ref([]);
const overdueReminders = ref([]);
const stats = reactive({
  pending_count: 0,
  sent_count: 0,
  read_count: 0,
  overdue_count: 0,
});

// 创建提醒对话框
const showCreateDialog = ref(false);
const createForm = reactive({
  memberId: null,
  title: '',
  message: '',
  fireAt: '',
  channel: 'app',
});

// 成员列表
const members = ref([]);

// === 计算属性 ===
const pendingReminders = computed(() => 
  reminders.value.filter(r => r.status === 'pending' || r.status === 'sent')
);

const historyReminders = computed(() => 
  reminders.value.filter(r => r.status === 'read' || r.status === 'delivered')
);

// === API 调用 ===
const fetchReminders = async () => {
  try {
    loading.value = true;
    const [remindersRes, overdueRes, statsRes] = await Promise.all([
      axios.get('/api/v2/reminders', { withCredentials: true }),
      axios.get('/api/v2/reminders/overdue', { withCredentials: true }),
      axios.get('/api/v2/reminders/stats', { withCredentials: true }),
    ]);
    
    reminders.value = remindersRes.data.data || [];
    overdueReminders.value = overdueRes.data.data || [];
    Object.assign(stats, statsRes.data.data || {});
  } catch (err) {
    console.error('获取提醒失败:', err);
    ElMessage.error('获取提醒数据失败');
  } finally {
    loading.value = false;
  }
};

const fetchMembers = async () => {
  try {
    const res = await axios.get('/api/family/members', { withCredentials: true });
    members.value = res.data.data || [];
  } catch (err) {
    console.error('获取成员失败:', err);
  }
};

// 扫描并发送提醒
const scanReminders = async () => {
  try {
    loading.value = true;
    const res = await axios.post('/api/v2/reminders/scan', {}, { withCredentials: true });
    const { scanned, sent, failed } = res.data.data;
    ElMessage.success(`扫描完成: 扫描 ${scanned} 条, 发送 ${sent} 条, 失败 ${failed} 条`);
    await fetchReminders();
  } catch (err) {
    console.error('扫描失败:', err);
    ElMessage.error('扫描提醒失败');
  } finally {
    loading.value = false;
  }
};

// 标记为已读
const markAsRead = async (id) => {
  try {
    await axios.patch(`/api/v2/reminders/${id}/read`, {}, { withCredentials: true });
    ElMessage.success('已标记为已读');
    await fetchReminders();
  } catch (err) {
    console.error('标记失败:', err);
    ElMessage.error('操作失败');
  }
};

// 取消提醒
const cancelReminder = async (id) => {
  try {
    await ElMessageBox.confirm('确定要取消这条提醒吗？', '确认取消');
    await axios.delete(`/api/v2/reminders/${id}`, { withCredentials: true });
    ElMessage.success('提醒已取消');
    await fetchReminders();
  } catch (err) {
    if (err !== 'cancel') {
      console.error('取消失败:', err);
      ElMessage.error('操作失败');
    }
  }
};

// 创建提醒
const createReminder = async () => {
  if (!createForm.title || !createForm.fireAt) {
    ElMessage.warning('请填写标题和触发时间');
    return;
  }
  
  try {
    await axios.post('/api/v2/reminders', createForm, { withCredentials: true });
    ElMessage.success('提醒创建成功');
    showCreateDialog.value = false;
    resetCreateForm();
    await fetchReminders();
  } catch (err) {
    console.error('创建失败:', err);
    ElMessage.error('创建提醒失败');
  }
};

const resetCreateForm = () => {
  createForm.memberId = null;
  createForm.title = '';
  createForm.message = '';
  createForm.fireAt = '';
  createForm.channel = 'app';
};

// 格式化时间
const formatTime = (time) => {
  if (!time) return '-';
  return dayjs(time).format('MM-DD HH:mm');
};

const formatRelativeTime = (time) => {
  if (!time) return '-';
  return dayjs(time).fromNow();
};

// 获取状态标签
const getStatusTag = (status) => {
  const map = {
    pending: { type: 'warning', text: '待发送' },
    sent: { type: 'primary', text: '已发送' },
    delivered: { type: 'success', text: '已送达' },
    read: { type: 'info', text: '已读' },
    failed: { type: 'danger', text: '失败' },
    cancelled: { type: 'info', text: '已取消' },
  };
  return map[status] || { type: 'info', text: status };
};

// 获取渠道图标
const getChannelIcon = (channel) => {
  const map = {
    app: '📱',
    push: '🔔',
    email: '📧',
    sms: '💬',
    wechat: '💚',
  };
  return map[channel] || '📢';
};

// 获取目标类型标签
const getTargetTypeLabel = (type) => {
  const map = {
    task: '任务',
    issue: '问题',
    auction: '拍卖',
    lottery: '抽奖',
    points: '积分',
    custom: '自定义',
  };
  return map[type] || type;
};

onMounted(() => {
  fetchReminders();
  fetchMembers();
});
</script>

<template>
  <div class="reminder-page">
    <!-- 顶部导航 -->
    <div class="page-header">
      <el-button :icon="ArrowLeft" circle @click="goBack" />
      <h2>🔔 提醒中心</h2>
      <div class="header-actions">
        <el-button type="primary" :icon="Refresh" :loading="loading" @click="scanReminders">
          扫描发送
        </el-button>
        <el-button type="success" :icon="Plus" @click="showCreateDialog = true">
          新建提醒
        </el-button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-card pending">
        <div class="stat-icon">⏳</div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.pending_count || 0 }}</div>
          <div class="stat-label">待发送</div>
        </div>
      </div>
      <div class="stat-card overdue">
        <div class="stat-icon">⚠️</div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.overdue_count || 0 }}</div>
          <div class="stat-label">已逾期</div>
        </div>
      </div>
      <div class="stat-card sent">
        <div class="stat-icon">✅</div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.sent_count || 0 }}</div>
          <div class="stat-label">已发送</div>
        </div>
      </div>
      <div class="stat-card read">
        <div class="stat-icon">👁️</div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.read_count || 0 }}</div>
          <div class="stat-label">已读</div>
        </div>
      </div>
    </div>

    <!-- 标签页 -->
    <el-tabs v-model="activeTab" class="reminder-tabs">
      <!-- 待办提醒 -->
      <el-tab-pane label="待办提醒" name="pending">
        <div v-if="pendingReminders.length === 0" class="empty-state">
          <div class="empty-icon">🎉</div>
          <p>暂无待办提醒</p>
        </div>
        <div v-else class="reminder-list">
          <div v-for="item in pendingReminders" :key="item.id" class="reminder-card">
            <div class="reminder-header">
              <span class="channel-icon">{{ getChannelIcon(item.channel) }}</span>
              <span class="reminder-title">{{ item.title }}</span>
              <el-tag :type="getStatusTag(item.status).type" size="small">
                {{ getStatusTag(item.status).text }}
              </el-tag>
            </div>
            <div class="reminder-body">
              <p class="reminder-message">{{ item.message || '(无内容)' }}</p>
              <div class="reminder-meta">
                <span v-if="item.member_name" class="meta-item">
                  <el-icon><User /></el-icon> {{ item.member_name }}
                </span>
                <span class="meta-item">
                  <el-icon><Clock /></el-icon> {{ formatTime(item.fire_at) }}
                </span>
                <span class="meta-item target-type">
                  {{ getTargetTypeLabel(item.target_type) }}
                </span>
              </div>
            </div>
            <div class="reminder-actions">
              <el-button size="small" type="success" :icon="Check" @click="markAsRead(item.id)">
                标记已读
              </el-button>
              <el-button size="small" type="danger" :icon="Close" @click="cancelReminder(item.id)">
                取消
              </el-button>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- 逾期清单 -->
      <el-tab-pane label="逾期清单" name="overdue">
        <div v-if="overdueReminders.length === 0" class="empty-state">
          <div class="empty-icon">✨</div>
          <p>没有逾期提醒</p>
        </div>
        <div v-else class="reminder-list overdue-list">
          <div v-for="item in overdueReminders" :key="item.id" class="reminder-card overdue">
            <div class="reminder-header">
              <span class="channel-icon">⚠️</span>
              <span class="reminder-title">{{ item.title }}</span>
              <span class="overdue-time">逾期 {{ formatRelativeTime(item.fire_at) }}</span>
            </div>
            <div class="reminder-body">
              <p class="reminder-message">{{ item.message || '(无内容)' }}</p>
              <div class="reminder-meta">
                <span v-if="item.member_name" class="meta-item">
                  <el-icon><User /></el-icon> {{ item.member_name }}
                </span>
                <span class="meta-item">
                  <el-icon><Clock /></el-icon> {{ formatTime(item.fire_at) }}
                </span>
              </div>
            </div>
            <div class="reminder-actions">
              <el-button size="small" type="primary" @click="markAsRead(item.id)">
                确认处理
              </el-button>
              <el-button size="small" @click="cancelReminder(item.id)">
                忽略
              </el-button>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- 历史记录 -->
      <el-tab-pane label="历史记录" name="history">
        <div v-if="historyReminders.length === 0" class="empty-state">
          <div class="empty-icon">📭</div>
          <p>暂无历史记录</p>
        </div>
        <div v-else class="reminder-list">
          <div v-for="item in historyReminders" :key="item.id" class="reminder-card history">
            <div class="reminder-header">
              <span class="channel-icon">{{ getChannelIcon(item.channel) }}</span>
              <span class="reminder-title">{{ item.title }}</span>
              <el-tag :type="getStatusTag(item.status).type" size="small">
                {{ getStatusTag(item.status).text }}
              </el-tag>
            </div>
            <div class="reminder-body">
              <p class="reminder-message">{{ item.message || '(无内容)' }}</p>
              <div class="reminder-meta">
                <span class="meta-item">
                  <el-icon><Clock /></el-icon> {{ formatTime(item.fired_at || item.fire_at) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 创建提醒对话框 -->
    <el-dialog v-model="showCreateDialog" title="创建新提醒" width="500px">
      <el-form :model="createForm" label-width="80px">
        <el-form-item label="目标成员">
          <el-select v-model="createForm.memberId" placeholder="选择成员（可选）" clearable>
            <el-option v-for="m in members" :key="m.id" :label="m.name" :value="m.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="标题" required>
          <el-input v-model="createForm.title" placeholder="提醒标题" maxlength="100" />
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="createForm.message" type="textarea" :rows="3" placeholder="提醒内容" />
        </el-form-item>
        <el-form-item label="触发时间" required>
          <el-date-picker
            v-model="createForm.fireAt"
            type="datetime"
            placeholder="选择时间"
            format="YYYY-MM-DD HH:mm"
            value-format="YYYY-MM-DDTHH:mm:ss"
          />
        </el-form-item>
        <el-form-item label="通知渠道">
          <el-select v-model="createForm.channel">
            <el-option label="📱 应用内" value="app" />
            <el-option label="🔔 推送" value="push" />
            <el-option label="📧 邮件" value="email" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="createReminder">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.reminder-page {
  padding: 20px;
  max-width: 1000px;
  margin: 0 auto;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
  background: rgba(255, 255, 255, 0.95);
  padding: 16px 24px;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.page-header h2 {
  flex: 1;
  margin: 0;
  font-size: 24px;
  color: #333;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  transition: transform 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
}

.stat-icon {
  font-size: 32px;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #333;
}

.stat-label {
  font-size: 13px;
  color: #666;
}

.stat-card.pending { border-left: 4px solid #e6a23c; }
.stat-card.overdue { border-left: 4px solid #f56c6c; }
.stat-card.sent { border-left: 4px solid #67c23a; }
.stat-card.read { border-left: 4px solid #909399; }

.reminder-tabs {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #999;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.reminder-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.reminder-card {
  background: #fafafa;
  border-radius: 12px;
  padding: 16px;
  border: 1px solid #eee;
  transition: all 0.2s;
}

.reminder-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateX(4px);
}

.reminder-card.overdue {
  background: #fff2f0;
  border-color: #ffccc7;
}

.reminder-card.history {
  opacity: 0.8;
}

.reminder-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.channel-icon {
  font-size: 20px;
}

.reminder-title {
  flex: 1;
  font-weight: 600;
  color: #333;
  font-size: 16px;
}

.overdue-time {
  font-size: 12px;
  color: #f56c6c;
  font-weight: 500;
}

.reminder-body {
  margin-bottom: 12px;
}

.reminder-message {
  color: #666;
  font-size: 14px;
  margin: 0 0 8px;
  line-height: 1.5;
}

.reminder-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 12px;
  color: #999;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.target-type {
  background: #f0f0f0;
  padding: 2px 8px;
  border-radius: 4px;
}

.reminder-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .page-header {
    flex-wrap: wrap;
  }
  
  .header-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
