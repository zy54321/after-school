<template>
  <div class="market-auction">
    <!-- 面包屑 -->
    <nav class="breadcrumb">
      <router-link to="/family/market">市场</router-link>
      <span class="separator">/</span>
      <span class="current">拍卖大厅</span>
    </nav>

    <header class="page-header">
      <h1>
        <span class="header-icon">🔨</span>
        拍卖大厅
      </h1>
      <p>竞拍稀有奖励，价高者得</p>
    </header>

    <!-- 统计卡片 -->
    <div class="stats-row" v-if="stats">
      <div class="stat-card">
        <div class="stat-value">{{ stats.active }}</div>
        <div class="stat-label">进行中</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.pending }}</div>
        <div class="stat-label">待开始</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.settled }}</div>
        <div class="stat-label">已结束</div>
      </div>
    </div>

    <!-- 场次筛选 -->
    <div class="filter-tabs">
      <button 
        v-for="tab in statusTabs" 
        :key="tab.value"
        class="filter-tab"
        :class="{ active: filter.status === tab.value }"
        @click="filter.status = tab.value; loadSessions()"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- 场次列表 -->
    <div class="sessions-list" v-if="sessions.length > 0">
      <div 
        v-for="session in sessions" 
        :key="session.id" 
        class="session-card"
        :class="session.status"
      >
        <div class="session-header">
          <h3>{{ session.title }}</h3>
          <span class="session-status" :class="session.status">
            {{ getStatusLabel(session.status) }}
          </span>
        </div>
        
        <div class="session-time">
          <span v-if="session.status === 'scheduled'">
            🕐 开始于 {{ formatTime(session.scheduled_at) }}
          </span>
          <span v-else-if="session.status === 'active'">
            🔥 进行中
          </span>
          <span v-else-if="session.status === 'ended'">
            ✓ 已结束
          </span>
          <span v-else>
            草稿
          </span>
        </div>

        <div class="lots-preview">
          <div v-for="lot in session.lots?.slice(0, 3)" :key="lot.id" class="lot-preview">
            <span class="lot-icon">{{ lot.sku_icon || '🎁' }}</span>
            <span class="lot-name">{{ lot.sku_name }}</span>
            <span class="lot-price">{{ lot.current_bid || lot.start_price }} 积分</span>
          </div>
          <div v-if="session.lots?.length > 3" class="more-lots">
            +{{ session.lots.length - 3 }} 件更多
          </div>
        </div>

        <router-link :to="`/family/auction/${session.id}`" class="enter-btn">
          {{ session.status === 'active' ? '进入竞拍' : '查看详情' }}
        </router-link>
      </div>
    </div>

    <div class="empty-state" v-else-if="!loading">
      <div class="empty-icon">🔨</div>
      <p>暂无拍卖场次</p>
    </div>

    <div class="loading-state" v-if="loading">
      加载中...
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const loading = ref(false);
const sessions = ref([]);
const stats = ref(null);

const filter = ref({
  status: '',
});

const statusTabs = [
  { label: '全部', value: '' },
  { label: '草稿', value: 'draft' },
  { label: '已排期', value: 'scheduled' },
  { label: '进行中', value: 'active' },
  { label: '已结束', value: 'ended' },
];

// 加载拍卖场次
const loadSessions = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/v2/auction/sessions', {
      params: { status: filter.value.status || undefined }
    });
    
    if (res.data?.code === 200) {
      sessions.value = res.data.data?.sessions || [];
    }
  } catch (err) {
    console.error('加载拍卖场次失败:', err);
  } finally {
    loading.value = false;
  }
};

// 加载统计
const loadStats = async () => {
  try {
    const res = await axios.get('/api/v2/auction/overview');
    
    if (res.data?.code === 200) {
      stats.value = res.data.data?.stats || {
        active: 0,
        pending: 0,
        settled: 0,
      };
    }
  } catch (err) {
    console.error('加载拍卖统计失败:', err);
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

// 格式化剩余时间
// 获取状态标签
const getStatusLabel = (status) => {
  const labels = {
    draft: '草稿',
    scheduled: '已排期',
    active: '竞拍中',
    ended: '已结束',
    cancelled: '已取消',
  };
  return labels[status] || status;
};

onMounted(() => {
  loadSessions();
  loadStats();
});
</script>

<style scoped>
.market-auction {
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

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: #4facfe;
  margin-bottom: 8px;
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
  background: linear-gradient(135deg, #4facfe, #00f2fe);
  color: #fff;
  border-color: transparent;
}

/* 场次列表 */
.sessions-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 20px;
}

.session-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 20px;
  transition: all 0.3s ease;
}

.session-card:hover {
  background: rgba(255, 255, 255, 0.08);
  transform: translateY(-2px);
}

.session-card.active {
  border-color: rgba(79, 172, 254, 0.5);
}

.session-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.session-header h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.session-status {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 12px;
}

.session-status.pending {
  background: rgba(255, 193, 7, 0.2);
  color: #ffc107;
}

.session-status.active {
  background: rgba(79, 172, 254, 0.2);
  color: #4facfe;
}

.session-status.settled {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);
}

.session-time {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 16px;
}

.lots-preview {
  margin-bottom: 16px;
}

.lot-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.lot-preview:last-child {
  border-bottom: none;
}

.lot-icon {
  font-size: 20px;
}

.lot-name {
  flex: 1;
  font-size: 14px;
}

.lot-price {
  font-size: 14px;
  font-weight: 600;
  color: #4facfe;
}

.more-lots {
  text-align: center;
  padding: 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}

.enter-btn {
  display: block;
  text-align: center;
  padding: 12px;
  background: linear-gradient(135deg, #4facfe, #00f2fe);
  border-radius: 10px;
  color: #fff;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.enter-btn:hover {
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
</style>
