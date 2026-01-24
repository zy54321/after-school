<template>
  <div class="market-reminders">
    <!-- 面包屑 -->
    <nav class="breadcrumb">
      <router-link to="/family/market">市场</router-link>
      <span class="separator">/</span>
      <span class="current">提醒系统</span>
    </nav>

    <header class="page-header">
      <h1>
        <span class="header-icon">🔔</span>
        提醒系统
      </h1>
      <p>管理家庭提醒和待办事项</p>
    </header>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-card pending">
        <div class="stat-value">{{ stats.pending }}</div>
        <div class="stat-label">待处理</div>
      </div>
      <div class="stat-card overdue">
        <div class="stat-value">{{ stats.overdue }}</div>
        <div class="stat-label">已逾期</div>
      </div>
      <div class="stat-card sent">
        <div class="stat-value">{{ stats.sent }}</div>
        <div class="stat-label">已发送</div>
      </div>
    </div>

    <!-- 筛选器 -->
    <div class="filter-tabs">
      <button 
        v-for="tab in statusTabs" 
        :key="tab.value"
        class="filter-tab"
        :class="{ active: filter.status === tab.value }"
        @click="filter.status = tab.value; loadReminders()"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- 提醒列表 -->
    <div class="reminders-list" v-if="reminders.length > 0">
      <div 
        v-for="reminder in reminders" 
        :key="reminder.id" 
        class="reminder-card"
        :class="reminder.status"
      >
        <div class="reminder-icon">
          {{ getChannelIcon(reminder.channel) }}
        </div>
        <div class="reminder-content">
          <div class="reminder-title">{{ reminder.title || '提醒' }}</div>
          <div class="reminder-meta">
            <span class="meta-item">
              <span class="meta-icon">👤</span>
              {{ reminder.member_name }}
            </span>
            <span class="meta-item">
              <span class="meta-icon">⏰</span>
              {{ formatTime(reminder.fire_at) }}
            </span>
          </div>
        </div>
        <div class="reminder-status" :class="reminder.status">
          {{ getStatusLabel(reminder.status) }}
        </div>
      </div>
    </div>

    <div class="empty-state" v-else-if="!loading">
      <div class="empty-icon">🔔</div>
      <p>暂无提醒</p>
    </div>

    <div class="loading-state" v-if="loading">
      加载中...
    </div>

    <!-- 扫描按钮 -->
    <button class="scan-btn" @click="scanReminders" :disabled="scanning">
      {{ scanning ? '扫描中...' : '手动扫描' }}
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const loading = ref(false);
const scanning = ref(false);
const reminders = ref([]);
const stats = ref({
  pending: 0,
  overdue: 0,
  sent: 0,
});

const filter = ref({
  status: '',
});

const statusTabs = [
  { label: '全部', value: '' },
  { label: '待处理', value: 'pending' },
  { label: '已发送', value: 'sent' },
];

// 加载提醒列表
const loadReminders = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/v2/reminders', {
      params: { status: filter.value.status || undefined }
    });
    
    if (res.data?.code === 200) {
      reminders.value = res.data.data?.reminders || [];
      
      // 计算统计
      const all = res.data.data?.reminders || [];
      const now = new Date();
      
      stats.value = {
        pending: all.filter(r => r.status === 'pending').length,
        overdue: all.filter(r => r.status === 'pending' && new Date(r.fire_at) < now).length,
        sent: all.filter(r => r.status === 'sent').length,
      };
    }
  } catch (err) {
    console.error('加载提醒失败:', err);
  } finally {
    loading.value = false;
  }
};

// 扫描提醒
const scanReminders = async () => {
  scanning.value = true;
  try {
    const res = await axios.post('/api/v2/reminders/scan');
    
    if (res.data?.code === 200) {
      const count = res.data.data?.processedCount || 0;
      alert(`扫描完成，处理了 ${count} 个提醒`);
      loadReminders();
    }
  } catch (err) {
    alert(err.response?.data?.msg || '扫描失败');
  } finally {
    scanning.value = false;
  }
};

// 格式化时间
const formatTime = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  
  // 已过期
  if (diff > 0) {
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  }
  
  // 未来
  const futureDiff = Math.abs(diff);
  if (futureDiff < 3600000) return `${Math.floor(futureDiff / 60000)} 分钟后`;
  if (futureDiff < 86400000) return `${Math.floor(futureDiff / 3600000)} 小时后`;
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// 获取渠道图标
const getChannelIcon = (channel) => {
  const icons = {
    app: '📱',
    email: '📧',
    sms: '💬',
  };
  return icons[channel] || '🔔';
};

// 获取状态标签
const getStatusLabel = (status) => {
  const labels = {
    pending: '待处理',
    sent: '已发送',
    cancelled: '已取消',
  };
  return labels[status] || status;
};

onMounted(() => {
  loadReminders();
});
</script>

<style scoped>
.market-reminders {
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
}

.stat-card {
  flex: 1;
  padding: 20px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  text-align: center;
}

.stat-card.pending {
  border-color: rgba(106, 17, 203, 0.3);
}

.stat-card.overdue {
  border-color: rgba(255, 77, 77, 0.3);
}

.stat-card.sent {
  border-color: rgba(56, 239, 125, 0.3);
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 8px;
}

.stat-card.pending .stat-value {
  color: #6a11cb;
}

.stat-card.overdue .stat-value {
  color: #ff4d4d;
}

.stat-card.sent .stat-value {
  color: #38ef7d;
}

.stat-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
}

/* 筛选标签 */
.filter-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
}

.filter-tab {
  padding: 10px 20px;
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
  background: linear-gradient(135deg, #6a11cb, #2575fc);
  color: #fff;
  border-color: transparent;
}

/* 提醒列表 */
.reminders-list {
  display: grid;
  gap: 12px;
  margin-bottom: 24px;
}

.reminder-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  transition: all 0.3s ease;
}

.reminder-card:hover {
  background: rgba(255, 255, 255, 0.08);
}

.reminder-card.pending {
  border-left: 3px solid #6a11cb;
}

.reminder-card.sent {
  opacity: 0.7;
}

.reminder-icon {
  font-size: 32px;
}

.reminder-content {
  flex: 1;
}

.reminder-title {
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 6px;
}

.reminder-meta {
  display: flex;
  gap: 16px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.meta-icon {
  font-size: 12px;
}

.reminder-status {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 12px;
}

.reminder-status.pending {
  background: rgba(106, 17, 203, 0.2);
  color: #9d6fff;
}

.reminder-status.sent {
  background: rgba(56, 239, 125, 0.2);
  color: #38ef7d;
}

/* 扫描按钮 */
.scan-btn {
  display: block;
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #6a11cb, #2575fc);
  border: none;
  border-radius: 12px;
  color: #fff;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.scan-btn:hover:not(:disabled) {
  box-shadow: 0 4px 20px rgba(106, 17, 203, 0.4);
}

.scan-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
</style>
