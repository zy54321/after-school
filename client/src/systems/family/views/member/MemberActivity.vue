<template>
  <div class="member-activity">
    <!-- 成员选择器 -->
    <div class="member-selector">
      <div class="selector-tabs">
        <router-link 
          v-for="m in members" 
          :key="m.id"
          :to="`/family/member/${m.id}/activity`"
          class="selector-tab"
          :class="{ active: m.id === currentMemberId }"
        >
          <span class="tab-avatar">{{ m.name?.charAt(0) || '?' }}</span>
          <span class="tab-name">{{ m.name }}</span>
        </router-link>
      </div>
    </div>

    <!-- 活动内容 -->
    <div class="activity-content" v-if="member">
      <div class="member-header">
        <div class="member-info">
          <div class="member-avatar-large">{{ member.name?.charAt(0) || '?' }}</div>
          <div class="member-details">
            <h1>{{ member.name }} 的活动记录</h1>
            <p class="activity-summary">参与了各种家庭活动</p>
          </div>
        </div>
      </div>

      <!-- 资产导航 -->
      <nav class="asset-nav">
        <router-link :to="`/family/member/${currentMemberId}/wallet`" class="asset-nav-item" active-class="active">
          <span class="nav-icon">💰</span>
          <span>积分流水</span>
        </router-link>
        <router-link :to="`/family/member/${currentMemberId}/inventory`" class="asset-nav-item" active-class="active">
          <span class="nav-icon">🎒</span>
          <span>我的背包</span>
        </router-link>
        <router-link :to="`/family/member/${currentMemberId}/orders`" class="asset-nav-item" active-class="active">
          <span class="nav-icon">📦</span>
          <span>订单记录</span>
        </router-link>
        <router-link :to="`/family/member/${currentMemberId}/activity`" class="asset-nav-item" exact-active-class="active">
          <span class="nav-icon">📊</span>
          <span>活动记录</span>
        </router-link>
      </nav>

      <!-- 活动分类 -->
      <div class="activity-sections">
        <!-- 拍卖参与 -->
        <section class="activity-section">
          <h2>
            <span class="section-icon">🔨</span>
            拍卖记录
          </h2>
          <div class="activity-list" v-if="auctionBids.length > 0">
            <div v-for="bid in auctionBids" :key="bid.id" class="activity-item">
              <div class="activity-icon">🔨</div>
              <div class="activity-info">
                <div class="activity-title">竞拍「{{ bid.lot_name || '拍品' }}」</div>
                <div class="activity-meta">
                  <span>出价: {{ bid.bid_points }} 积分</span>
                  <span :class="bid.is_winner ? 'winner' : 'outbid'">
                    {{ bid.is_winner ? '🏆 中标' : '已被超越' }}
                  </span>
                </div>
              </div>
              <div class="activity-time">{{ formatTime(bid.created_at) }}</div>
            </div>
          </div>
          <div class="empty-section" v-else>暂无拍卖记录</div>
        </section>

        <!-- 抽奖记录 -->
        <section class="activity-section">
          <h2>
            <span class="section-icon">🎰</span>
            抽奖记录
          </h2>
          <div class="activity-list" v-if="drawLogs.length > 0">
            <div v-for="log in drawLogs" :key="log.id" class="activity-item">
              <div class="activity-icon">🎰</div>
              <div class="activity-info">
                <div class="activity-title">抽中「{{ log.result_name }}」</div>
                <div class="activity-meta">
                  <span>奖池: {{ log.pool_name }}</span>
                  <span v-if="log.is_guarantee" class="guarantee">保底</span>
                </div>
              </div>
              <div class="activity-time">{{ formatTime(log.created_at) }}</div>
            </div>
          </div>
          <div class="empty-section" v-else>暂无抽奖记录</div>
        </section>

        <!-- 任务记录 -->
        <section class="activity-section">
          <h2>
            <span class="section-icon">📋</span>
            任务记录
          </h2>
          <div class="activity-list" v-if="taskClaims.length > 0">
            <div v-for="claim in taskClaims" :key="claim.id" class="activity-item">
              <div class="activity-icon">📋</div>
              <div class="activity-info">
                <div class="activity-title">{{ claim.task_title }}</div>
                <div class="activity-meta">
                  <span>赏金: {{ claim.bounty_points }} 积分</span>
                  <span :class="'status-' + claim.status">{{ getTaskStatusLabel(claim.status) }}</span>
                </div>
              </div>
              <div class="activity-time">{{ formatTime(claim.claimed_at) }}</div>
            </div>
          </div>
          <div class="empty-section" v-else>暂无任务记录</div>
        </section>
      </div>
    </div>

    <div class="loading-state" v-else-if="loading">
      加载中...
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';

const route = useRoute();

const members = ref([]);
const member = ref(null);
const auctionBids = ref([]);
const drawLogs = ref([]);
const taskClaims = ref([]);
const loading = ref(false);

const currentMemberId = computed(() => parseInt(route.params.id));

// 加载成员列表
const loadMembers = async () => {
  try {
    const res = await axios.get('/api/v2/family/members');
    if (res.data?.code === 200) {
      members.value = res.data.data?.members || [];
    }
  } catch (err) {
    console.error('加载成员列表失败:', err);
  }
};

// 加载成员信息
const loadMember = async () => {
  if (!currentMemberId.value) return;
  
  try {
    const res = await axios.get('/api/v2/wallet', {
      params: { member_id: currentMemberId.value }
    });
    
    if (res.data?.code === 200) {
      member.value = res.data.data?.member || {};
    }
  } catch (err) {
    console.error('加载成员信息失败:', err);
  }
};

// 加载活动记录
const loadActivity = async () => {
  if (!currentMemberId.value) return;
  
  loading.value = true;
  try {
    // 并行加载各种活动记录
    const [bidsRes, drawsRes, tasksRes] = await Promise.all([
      axios.get('/api/v2/auction/bids', {
        params: { member_id: currentMemberId.value, limit: 10 }
      }).catch(() => ({ data: { data: { bids: [] } } })),
      axios.get('/api/v2/draw/logs', {
        params: { member_id: currentMemberId.value, limit: 10 }
      }).catch(() => ({ data: { data: { logs: [] } } })),
      axios.get('/api/v2/tasks/claims', {
        params: { member_id: currentMemberId.value, limit: 10 }
      }).catch(() => ({ data: { data: { claims: [] } } })),
    ]);

    auctionBids.value = bidsRes.data?.data?.bids || [];
    drawLogs.value = drawsRes.data?.data?.logs || [];
    taskClaims.value = tasksRes.data?.data?.claims || [];
  } catch (err) {
    console.error('加载活动记录失败:', err);
  } finally {
    loading.value = false;
  }
};

// 格式化时间
const formatTime = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
  
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
};

// 获取任务状态标签
const getTaskStatusLabel = (status) => {
  const labels = {
    claimed: '进行中',
    submitted: '待审核',
    approved: '已完成',
    rejected: '已拒绝',
    cancelled: '已取消',
  };
  return labels[status] || status;
};

// 监听路由变化
watch(() => route.params.id, () => {
  if (route.params.id) {
    loadMember();
    loadActivity();
  }
}, { immediate: true });

onMounted(() => {
  loadMembers();
});
</script>

<style scoped>
.member-activity {
  color: #fff;
}

/* 成员选择器 */
.member-selector {
  margin-bottom: 24px;
}

.selector-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.selector-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  text-decoration: none;
  color: rgba(255, 255, 255, 0.7);
  transition: all 0.3s ease;
}

.selector-tab:hover {
  background: rgba(255, 255, 255, 0.1);
}

.selector-tab.active {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  border-color: transparent;
}

.tab-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.tab-name {
  font-size: 14px;
}

/* 活动内容 */
.activity-content {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 20px;
  padding: 24px;
}

.member-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.member-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.member-avatar-large {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 600;
}

.member-details h1 {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 4px;
}

.activity-summary {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
  margin: 0;
}

/* 资产导航 */
.asset-nav {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.asset-nav-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  text-decoration: none;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  transition: all 0.3s ease;
}

.asset-nav-item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.asset-nav-item.active {
  background: rgba(102, 126, 234, 0.2);
  border-color: rgba(102, 126, 234, 0.5);
  color: #fff;
}

/* 活动分区 */
.activity-sections {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.activity-section {
  background: rgba(255, 255, 255, 0.02);
  border-radius: 16px;
  padding: 20px;
}

.activity-section h2 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 16px;
}

.section-icon {
  font-size: 20px;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  transition: background 0.3s ease;
}

.activity-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.activity-icon {
  font-size: 24px;
}

.activity-info {
  flex: 1;
}

.activity-title {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.activity-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.activity-meta .winner {
  color: #ffd700;
}

.activity-meta .outbid {
  color: rgba(255, 255, 255, 0.4);
}

.activity-meta .guarantee {
  padding: 2px 6px;
  background: rgba(255, 215, 0, 0.2);
  color: #ffd700;
  border-radius: 4px;
}

.activity-meta .status-claimed {
  color: #4facfe;
}

.activity-meta .status-submitted {
  color: #ffc107;
}

.activity-meta .status-approved {
  color: #38ef7d;
}

.activity-meta .status-rejected {
  color: #ff4d4d;
}

.activity-time {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

.empty-section {
  text-align: center;
  padding: 24px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 14px;
}

.loading-state {
  text-align: center;
  padding: 40px;
  color: rgba(255, 255, 255, 0.5);
}
</style>
