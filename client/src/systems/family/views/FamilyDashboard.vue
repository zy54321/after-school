<template>
  <div class="family-dashboard">
    <!-- 头部 -->
    <header class="dashboard-header">
      <div class="header-left">
        <h1>🏠 {{ t('familyDashboard.center') }}</h1>
      </div>
      <div class="header-right">
        <router-link to="/family/market" class="header-btn market">
          🏪 {{ t('family.market') }}
        </router-link>
      </div>
    </header>

    <!-- ========== 上半部分：家庭市场状态 ========== -->
    <section class="market-overview">
      <h2 class="section-title">📊 {{ t('familyDashboard.marketDynamics') }}</h2>
      
      <div class="status-grid">
        <!-- 拍卖进行中 -->
        <router-link to="/family/market/auction" class="status-card auction" :class="{ active: marketStatus.activeAuctions > 0 }">
          <div class="status-icon">🔨</div>
          <div class="status-info">
            <div class="status-label">{{ t('familyDashboard.activeAuctions') }}</div>
            <div class="status-value">{{ marketStatus.activeAuctions }}</div>
          </div>
          <div class="status-badge" v-if="marketStatus.activeAuctions > 0">{{ t('familyDashboard.hot') }}</div>
        </router-link>

        <!-- 神秘商店 -->
        <router-link to="/family/market/mystery" class="status-card mystery" :class="{ active: marketStatus.mysteryOffers > 0 }">
          <div class="status-icon">✨</div>
          <div class="status-info">
            <div class="status-label">{{ t('familyDashboard.todaySpecial') }}</div>
            <div class="status-value">{{ marketStatus.mysteryOffers }} {{ t('familyDashboard.items') }}</div>
          </div>
          <div class="status-countdown" v-if="marketStatus.mysteryExpiresIn">
            {{ marketStatus.mysteryExpiresIn }}
          </div>
        </router-link>

        <!-- 抽奖池 -->
        <router-link to="/family/market/draw" class="status-card draw" :class="{ active: marketStatus.activePools > 0 }">
          <div class="status-icon">🎰</div>
          <div class="status-info">
            <div class="status-label">{{ t('familyDashboard.activePools') }}</div>
            <div class="status-value">{{ marketStatus.activePools }}</div>
          </div>
        </router-link>

        <!-- 悬赏任务 -->
        <router-link to="/family/market/tasks" class="status-card tasks" :class="{ active: marketStatus.openTasks > 0 }">
          <div class="status-icon">📋</div>
          <div class="status-info">
            <div class="status-label">{{ t('familyDashboard.openTasks') }}</div>
            <div class="status-value">{{ marketStatus.openTasks }}</div>
          </div>
          <div class="status-badge bounty" v-if="marketStatus.totalBounty > 0">
            💰 {{ marketStatus.totalBounty }}
          </div>
        </router-link>

        <!-- 待处理提醒 -->
        <router-link to="/family/market/reminders" class="status-card reminders" :class="{ warning: marketStatus.overdueReminders > 0 }">
          <div class="status-icon">🔔</div>
          <div class="status-info">
            <div class="status-label">{{ t('familyDashboard.pendingReminders') }}</div>
            <div class="status-value">{{ marketStatus.pendingReminders }}</div>
          </div>
          <div class="status-badge overdue" v-if="marketStatus.overdueReminders > 0">
            ⚠️ {{ marketStatus.overdueReminders }} {{ t('familyDashboard.overdue') }}
          </div>
        </router-link>

        <!-- 问题关注 -->
        <router-link to="/family/market/issues" class="status-card issues" :class="{ warning: marketStatus.highAttentionIssues > 0 }">
          <div class="status-icon">⚠️</div>
          <div class="status-info">
            <div class="status-label">{{ t('familyDashboard.attentionIssues') }}</div>
            <div class="status-value">{{ marketStatus.activeIssues }}</div>
          </div>
          <div class="status-badge alert" v-if="marketStatus.highAttentionIssues > 0">
            🔥 {{ marketStatus.highAttentionIssues }} {{ t('familyDashboard.highAttention') }}
          </div>
        </router-link>
      </div>
    </section>

    <!-- ========== 下半部分：成员资产卡片 ========== -->
    <section class="members-section">
      <h2 class="section-title">👥 {{ t('familyDashboard.memberAssets') }}</h2>
      
      <div class="members-grid" v-if="members.length > 0">
        <div 
          v-for="member in members" 
          :key="member.id" 
          class="member-card"
          @click="goToMemberAssets(member.id)"
        >
          <div class="member-header">
            <div class="member-avatar">
              {{ member.name?.charAt(0) || '?' }}
            </div>
            <div class="member-name">{{ member.name }}</div>
          </div>

          <div class="member-stats">
            <div class="stat-item balance">
              <span class="stat-icon">💰</span>
              <div class="stat-content">
                <span class="stat-value">{{ member.balance || 0 }}</span>
                <span class="stat-label">{{ t('familyDashboard.points') }}</span>
              </div>
            </div>
            <div class="stat-item inventory">
              <span class="stat-icon">🎒</span>
              <div class="stat-content">
                <span class="stat-value">{{ member.inventoryCount || 0 }}</span>
                <span class="stat-label">{{ t('familyDashboard.inventory') }}</span>
              </div>
            </div>
            <div class="stat-item orders">
              <span class="stat-icon">📦</span>
              <div class="stat-content">
                <span class="stat-value">{{ member.recentOrders || 0 }}</span>
                <span class="stat-label">{{ t('familyDashboard.recentOrders') }}</span>
              </div>
            </div>
          </div>

          <!-- 最近活动预览 -->
          <div class="member-activity" v-if="member.lastActivity">
            <span class="activity-time">{{ formatTime(member.lastActivity.time) }}</span>
            <span class="activity-text">{{ member.lastActivity.description }}</span>
          </div>

          <div class="member-footer">
            <span class="view-detail">{{ t('familyDashboard.viewDetails') }}</span>
          </div>
        </div>
      </div>

      <div class="empty-members" v-else-if="!loading">
        <p>{{ t('familyDashboard.noMembers') }}</p>
        <button class="add-member-btn" @click="openAddMember">{{ t('familyDashboard.addMember') }}</button>
      </div>
    </section>

    <!-- 加载状态 -->
    <div class="loading-overlay" v-if="loading">
      <div class="loading-spinner"></div>
      <p>{{ t('familyDashboard.loading') }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import axios from 'axios';

const { t, locale } = useI18n();

const router = useRouter();

const loading = ref(true);
const members = ref([]);

const marketStatus = reactive({
  // 拍卖
  activeAuctions: 0,
  // 神秘商店
  mysteryOffers: 0,
  mysteryExpiresIn: '',
  // 抽奖
  activePools: 0,
  // 任务
  openTasks: 0,
  totalBounty: 0,
  // 提醒
  pendingReminders: 0,
  overdueReminders: 0,
  // 问题
  activeIssues: 0,
  highAttentionIssues: 0,
});

let countdownTimer = null;
let mysteryExpiresAt = null;

// 加载市场状态
const loadMarketStatus = async () => {
  try {
    // 并行请求各个市场状态
    const [auctionRes, mysteryRes, drawRes, taskRes, reminderRes, issueRes] = await Promise.allSettled([
      axios.get('/api/v2/auction/overview'),
      axios.get('/api/v2/mystery-shop'),
      axios.get('/api/v2/draw/overview'),
      axios.get('/api/v2/tasks/market'),
      axios.get('/api/v2/reminders'),
      axios.get('/api/v2/issues'),
    ]);

    // 拍卖状态
    if (auctionRes.status === 'fulfilled' && auctionRes.value.data?.code === 200) {
      const sessions = auctionRes.value.data.data?.sessions || [];
      marketStatus.activeAuctions = sessions.filter(s => s.status === 'active').length;
    }

    // 神秘商店状态
    if (mysteryRes.status === 'fulfilled' && mysteryRes.value.data?.code === 200) {
      const data = mysteryRes.value.data.data;
      marketStatus.mysteryOffers = data?.offers?.length || 0;
      if (data?.rotation?.expires_at) {
        mysteryExpiresAt = new Date(data.rotation.expires_at);
        updateMysteryCountdown();
      }
    }

    // 抽奖池状态
    if (drawRes.status === 'fulfilled' && drawRes.value.data?.code === 200) {
      const pools = drawRes.value.data.data?.pools || [];
      marketStatus.activePools = pools.filter(p => p.status === 'active').length;
    }

    // 任务状态
    if (taskRes.status === 'fulfilled' && taskRes.value.data?.code === 200) {
      const data = taskRes.value.data.data;
      marketStatus.openTasks = data?.stats?.open || 0;
      marketStatus.totalBounty = data?.tasks
        ?.filter(t => t.status === 'open')
        ?.reduce((sum, t) => sum + (t.bounty_points || 0), 0) || 0;
    }

    // 提醒状态
    if (reminderRes.status === 'fulfilled' && reminderRes.value.data?.code === 200) {
      const events = reminderRes.value.data.data?.events || [];
      marketStatus.pendingReminders = events.filter(e => e.status === 'pending').length;
      marketStatus.overdueReminders = events.filter(e => 
        e.status === 'pending' && new Date(e.fire_at) < new Date()
      ).length;
    }

    // 问题状态
    if (issueRes.status === 'fulfilled' && issueRes.value.data?.code === 200) {
      const issues = issueRes.value.data.data?.issues || [];
      marketStatus.activeIssues = issues.filter(i => i.status === 'active').length;
      marketStatus.highAttentionIssues = issues.filter(i => 
        i.status === 'active' && (i.attention_score || 0) >= 80
      ).length;
    }
  } catch (err) {
    console.error('加载市场状态失败:', err);
  }
};

// 加载成员列表及资产快照
const loadMembers = async () => {
  try {
    const res = await axios.get('/api/v2/family/members');
    if (res.data?.code === 200) {
      const rawMembers = res.data.data?.members || [];
      
      // 为每个成员加载资产快照
      const memberPromises = rawMembers.map(async (member) => {
        try {
          const [balanceRes, inventoryRes, ordersRes] = await Promise.allSettled([
            axios.get('/api/v2/wallet/balance', { params: { member_id: member.id } }),
            axios.get('/api/v2/inventory', { params: { member_id: member.id, limit: 1 } }),
            axios.get('/api/v2/orders', { params: { member_id: member.id, limit: 5 } }),
          ]);

          return {
            ...member,
            balance: balanceRes.status === 'fulfilled' ? balanceRes.value.data?.data?.balance || 0 : 0,
            inventoryCount: inventoryRes.status === 'fulfilled' ? inventoryRes.value.data?.data?.total || 0 : 0,
            recentOrders: ordersRes.status === 'fulfilled' ? ordersRes.value.data?.data?.total || 0 : 0,
            lastActivity: ordersRes.status === 'fulfilled' && ordersRes.value.data?.data?.orders?.length > 0
              ? {
                  time: ordersRes.value.data.data.orders[0].created_at,
                  description: ordersRes.value.data.data.orders[0].sku_name || '订单',
                }
              : null,
          };
        } catch (e) {
          return { ...member, balance: 0, inventoryCount: 0, recentOrders: 0 };
        }
      });

      members.value = await Promise.all(memberPromises);
    }
  } catch (err) {
    console.error('加载成员失败:', err);
    // 降级方案：使用旧接口
    try {
      const fallbackRes = await axios.get('/api/family/init');
      if (fallbackRes.data?.code === 200) {
        members.value = (fallbackRes.data.data?.members || []).map(m => ({
          ...m,
          balance: 0,
          inventoryCount: 0,
          recentOrders: 0,
        }));
      }
    } catch (e) {
      console.error('降级加载也失败:', e);
    }
  }
};

// 更新神秘商店倒计时
const updateMysteryCountdown = () => {
  if (!mysteryExpiresAt) {
    marketStatus.mysteryExpiresIn = '';
    return;
  }

  const now = new Date();
  const diff = mysteryExpiresAt - now;

  if (diff <= 0) {
    marketStatus.mysteryExpiresIn = '已过期';
    return;
  }

  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);

  if (hours > 0) {
    marketStatus.mysteryExpiresIn = `${hours}h ${minutes}m`;
  } else {
    marketStatus.mysteryExpiresIn = `${minutes}m`;
  }
};

// 格式化时间
const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  return date.toLocaleDateString(locale.value === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' });
};

// 跳转到成员资产页
const goToMemberAssets = (memberId) => {
  router.push(`/family/member/${memberId}/wallet`);
};

// 打开添加成员
const openAddMember = () => {
  // 可以跳转到设置页或显示弹窗
  router.push('/family/settings');
};

// 初始化
onMounted(async () => {
  loading.value = true;
  await Promise.all([
    loadMarketStatus(),
    loadMembers(),
  ]);
  loading.value = false;

  // 启动倒计时更新
  countdownTimer = setInterval(updateMysteryCountdown, 60000);
});

onUnmounted(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer);
  }
});
</script>

<style scoped>
.family-dashboard {
  min-height: 100vh;
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  color: #fff;
  padding: 20px;
  font-family: 'Segoe UI', 'SF Pro Display', -apple-system, sans-serif;
}

/* 头部 */
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 28px;
}

.dashboard-header h1 {
  font-size: 28px;
  font-weight: 700;
  margin: 0;
}

.header-btn {
  padding: 10px 20px;
  border-radius: 12px;
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.3s ease;
}

.header-btn.market {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
}

.header-btn.market:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

/* 区块标题 */
.section-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 16px;
  color: rgba(255, 255, 255, 0.9);
}

/* ========== 市场状态区 ========== */
.market-overview {
  margin-bottom: 32px;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 14px;
}

.status-card {
  display: flex;
  flex-direction: column;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  text-decoration: none;
  color: inherit;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.status-card:hover {
  background: rgba(255, 255, 255, 0.08);
  transform: translateY(-2px);
}

.status-card.active {
  border-color: rgba(79, 172, 254, 0.4);
  background: rgba(79, 172, 254, 0.1);
}

.status-card.warning {
  border-color: rgba(255, 107, 107, 0.4);
  background: rgba(255, 107, 107, 0.1);
}

.status-icon {
  font-size: 28px;
  margin-bottom: 10px;
}

.status-info {
  flex: 1;
}

.status-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 4px;
}

.status-value {
  font-size: 22px;
  font-weight: 700;
  color: #fff;
}

.status-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 10px;
  background: rgba(79, 172, 254, 0.3);
  color: #4facfe;
}

.status-badge.bounty {
  background: rgba(255, 215, 0, 0.2);
  color: #ffd700;
}

.status-badge.overdue, .status-badge.alert {
  background: rgba(255, 107, 107, 0.3);
  color: #ff6b6b;
}

.status-countdown {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 8px;
}

/* 不同卡片的颜色主题 */
.status-card.auction.active {
  border-color: rgba(255, 193, 7, 0.4);
  background: rgba(255, 193, 7, 0.1);
}

.status-card.mystery.active {
  border-color: rgba(147, 51, 234, 0.4);
  background: rgba(147, 51, 234, 0.1);
}

.status-card.draw.active {
  border-color: rgba(255, 215, 0, 0.4);
  background: rgba(255, 215, 0, 0.1);
}

.status-card.tasks.active {
  border-color: rgba(46, 204, 113, 0.4);
  background: rgba(46, 204, 113, 0.1);
}

/* ========== 成员资产区 ========== */
.members-section {
  margin-bottom: 32px;
}

.members-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.member-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.member-card:hover {
  background: rgba(255, 255, 255, 0.08);
  transform: translateY(-4px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
}

.member-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 18px;
}

.member-avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 600;
  color: #fff;
  flex-shrink: 0;
}

.member-name {
  font-size: 20px;
  font-weight: 600;
}

.member-stats {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.stat-item {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
}

.stat-icon {
  font-size: 20px;
}

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
}

.stat-item.balance .stat-value {
  color: #ffd700;
}

.stat-item.inventory .stat-value {
  color: #4facfe;
}

.stat-item.orders .stat-value {
  color: #2ecc71;
}

.stat-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.member-activity {
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
  margin-bottom: 14px;
  display: flex;
  gap: 10px;
  font-size: 13px;
}

.activity-time {
  color: rgba(255, 255, 255, 0.4);
  flex-shrink: 0;
}

.activity-text {
  color: rgba(255, 255, 255, 0.7);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-footer {
  text-align: right;
}

.view-detail {
  font-size: 13px;
  color: rgba(79, 172, 254, 0.8);
  transition: color 0.3s;
}

.member-card:hover .view-detail {
  color: #4facfe;
}

/* 空状态 */
.empty-members {
  text-align: center;
  padding: 48px 20px;
  color: rgba(255, 255, 255, 0.5);
}

.add-member-btn {
  margin-top: 16px;
  padding: 12px 24px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border: none;
  border-radius: 12px;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
}

.add-member-btn:hover {
  transform: scale(1.05);
}

/* 加载状态 */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(26, 26, 46, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(255, 255, 255, 0.2);
  border-top-color: #4facfe;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 响应式 */
@media (max-width: 768px) {
  .family-dashboard {
    padding: 16px;
  }

  .dashboard-header h1 {
    font-size: 22px;
  }

  .status-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .status-card {
    padding: 14px;
  }

  .status-icon {
    font-size: 24px;
  }

  .status-value {
    font-size: 18px;
  }

  .members-grid {
    grid-template-columns: 1fr;
  }

  .member-stats {
    flex-wrap: wrap;
  }

  .stat-item {
    flex: 1 1 45%;
  }
}
</style>
