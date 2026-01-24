<template>
  <div class="market-home">
    <header class="market-header">
      <h1 class="market-title">
        <span class="title-icon">🏪</span>
        家庭市场
      </h1>
      <p class="market-subtitle">全家共享的奖励商城、拍卖、抽奖和任务系统</p>
    </header>

    <div class="market-grid">
      <!-- 商城入口 -->
      <router-link to="/family/market/shop" class="market-card shop">
        <div class="card-icon">🛍️</div>
        <div class="card-content">
          <h3>奖励商城</h3>
          <p>用积分兑换奖励</p>
        </div>
        <div class="card-stats" v-if="stats.skuCount">
          <span class="stat">{{ stats.skuCount }} 件商品</span>
        </div>
      </router-link>

      <!-- 神秘商店入口 -->
      <router-link to="/family/market/mystery" class="market-card mystery">
        <div class="card-icon">✨</div>
        <div class="card-content">
          <h3>神秘商店</h3>
          <p>限时折扣，每日刷新</p>
        </div>
        <div class="card-stats" v-if="stats.mysteryOfferCount">
          <span class="stat">{{ stats.mysteryOfferCount }} 件特惠</span>
        </div>
        <div class="card-badge" v-if="stats.canFreeRefresh">免费刷新</div>
      </router-link>

      <!-- 拍卖入口 -->
      <router-link to="/family/market/auction" class="market-card auction">
        <div class="card-icon">🔨</div>
        <div class="card-content">
          <h3>拍卖大厅</h3>
          <p>竞拍稀有奖励</p>
        </div>
        <div class="card-stats" v-if="stats.activeSessions">
          <span class="stat">{{ stats.activeSessions }} 场进行中</span>
        </div>
      </router-link>

      <!-- 抽奖入口 -->
      <router-link to="/family/market/draw" class="market-card draw">
        <div class="card-icon">🎰</div>
        <div class="card-content">
          <h3>幸运抽奖</h3>
          <p>试试你的手气</p>
        </div>
        <div class="card-stats" v-if="stats.activePools">
          <span class="stat">{{ stats.activePools }} 个奖池</span>
        </div>
      </router-link>

      <!-- 任务入口 -->
      <router-link to="/family/market/tasks" class="market-card tasks">
        <div class="card-icon">📋</div>
        <div class="card-content">
          <h3>悬赏任务</h3>
          <p>完成任务赚积分</p>
        </div>
        <div class="card-stats" v-if="stats.openTasks">
          <span class="stat">{{ stats.openTasks }} 个待领取</span>
        </div>
      </router-link>

      <!-- 问题关注入口 -->
      <router-link to="/family/market/issues" class="market-card issues">
        <div class="card-icon">⚠️</div>
        <div class="card-content">
          <h3>问题关注</h3>
          <p>追踪和改进</p>
        </div>
        <div class="card-stats" v-if="stats.activeIssues">
          <span class="stat">{{ stats.activeIssues }} 个关注中</span>
        </div>
      </router-link>

      <!-- 提醒入口 -->
      <router-link to="/family/market/reminders" class="market-card reminders">
        <div class="card-icon">🔔</div>
        <div class="card-content">
          <h3>提醒系统</h3>
          <p>重要事项提醒</p>
        </div>
        <div class="card-stats" v-if="stats.pendingReminders">
          <span class="stat">{{ stats.pendingReminders }} 个待处理</span>
        </div>
      </router-link>
    </div>

    <!-- 成员快捷入口 -->
    <section class="member-quick-access">
      <h2>
        <span>👨‍👩‍👧‍👦</span>
        成员资产
      </h2>
      <div class="member-list">
        <router-link 
          v-for="member in members" 
          :key="member.id"
          :to="`/family/member/${member.id}/wallet`"
          class="member-card"
        >
          <div class="member-avatar">{{ member.name?.charAt(0) || '?' }}</div>
          <div class="member-info">
            <div class="member-name">{{ member.name }}</div>
            <div class="member-balance">{{ member.balance || 0 }} 积分</div>
          </div>
        </router-link>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const stats = ref({
  skuCount: 0,
  mysteryOfferCount: 0,
  canFreeRefresh: false,
  activeSessions: 0,
  activePools: 0,
  openTasks: 0,
  activeIssues: 0,
  pendingReminders: 0,
});

const members = ref([]);

// 加载市场统计
const loadMarketStats = async () => {
  try {
    // 并行加载各个模块的概览
    const [catalogRes, mysteryRes, auctionRes, drawRes, tasksRes] = await Promise.all([
      axios.get('/api/v2/catalog').catch(() => ({ data: { data: {} } })),
      axios.get('/api/v2/mystery-shop/overview').catch(() => ({ data: { data: {} } })),
      axios.get('/api/v2/auction/overview').catch(() => ({ data: { data: {} } })),
      axios.get('/api/v2/draw/overview').catch(() => ({ data: { data: {} } })),
      axios.get('/api/v2/tasks/market').catch(() => ({ data: { data: {} } })),
    ]);

    stats.value = {
      skuCount: catalogRes.data?.data?.totalSkus || 0,
      mysteryOfferCount: mysteryRes.data?.data?.offers?.length || 0,
      canFreeRefresh: mysteryRes.data?.data?.config?.canFreeRefresh || false,
      activeSessions: auctionRes.data?.data?.stats?.active || 0,
      activePools: drawRes.data?.data?.activePools || 0,
      openTasks: tasksRes.data?.data?.stats?.open || 0,
      activeIssues: 0,
      pendingReminders: 0,
    };
  } catch (err) {
    console.error('加载市场统计失败:', err);
  }
};

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

onMounted(() => {
  loadMarketStats();
  loadMembers();
});
</script>

<style scoped>
.market-home {
  color: #fff;
}

.market-header {
  text-align: center;
  margin-bottom: 40px;
}

.market-title {
  font-size: 36px;
  font-weight: 700;
  margin: 0 0 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.title-icon {
  font-size: 42px;
}

.market-subtitle {
  color: rgba(255, 255, 255, 0.6);
  font-size: 16px;
  margin: 0;
}

.market-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 48px;
}

.market-card {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 24px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  text-decoration: none;
  color: #fff;
  transition: all 0.3s ease;
  overflow: hidden;
}

.market-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.market-card.shop::before { background: linear-gradient(90deg, #667eea, #764ba2); }
.market-card.mystery::before { background: linear-gradient(90deg, #f093fb, #f5576c); }
.market-card.auction::before { background: linear-gradient(90deg, #4facfe, #00f2fe); }
.market-card.draw::before { background: linear-gradient(90deg, #ffd700, #ff9500); }
.market-card.tasks::before { background: linear-gradient(90deg, #11998e, #38ef7d); }
.market-card.issues::before { background: linear-gradient(90deg, #fc4a1a, #f7b733); }
.market-card.reminders::before { background: linear-gradient(90deg, #6a11cb, #2575fc); }

.market-card:hover {
  transform: translateY(-4px);
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
}

.market-card:hover::before {
  opacity: 1;
}

.card-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.card-content h3 {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 6px;
}

.card-content p {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
}

.card-stats {
  margin-top: auto;
  padding-top: 16px;
}

.card-stats .stat {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.1);
  padding: 4px 10px;
  border-radius: 12px;
}

.card-badge {
  position: absolute;
  top: 16px;
  right: 16px;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 8px;
  background: linear-gradient(135deg, #11998e, #38ef7d);
  color: #fff;
  font-weight: 600;
}

/* 成员快捷入口 */
.member-quick-access {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 20px;
  padding: 24px;
}

.member-quick-access h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 20px;
}

.member-list {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.member-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  text-decoration: none;
  color: #fff;
  transition: all 0.3s ease;
}

.member-card:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.member-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
}

.member-info {
  display: flex;
  flex-direction: column;
}

.member-name {
  font-size: 14px;
  font-weight: 500;
}

.member-balance {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

/* 响应式 */
@media (max-width: 768px) {
  .market-title {
    font-size: 28px;
  }
  
  .market-grid {
    grid-template-columns: 1fr;
  }
}
</style>
