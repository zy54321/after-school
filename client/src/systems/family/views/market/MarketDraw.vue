<template>
  <div class="market-draw">
    <!-- 面包屑 -->
    <nav class="breadcrumb">
      <router-link to="/family/market">市场</router-link>
      <span class="separator">/</span>
      <span class="current">幸运抽奖</span>
    </nav>

    <header class="page-header">
      <h1>
        <span class="header-icon">🎰</span>
        幸运抽奖
      </h1>
      <p>试试你的运气，赢取稀有奖励</p>
    </header>

    <!-- 奖池列表 -->
    <div class="pools-grid" v-if="pools.length > 0">
      <div v-for="pool in pools" :key="pool.id" class="pool-card" :class="pool.status">
        <div class="pool-header">
          <div class="pool-icon">🎰</div>
          <div class="pool-info">
            <h3>{{ pool.name }}</h3>
            <p>{{ pool.description }}</p>
          </div>
        </div>

        <div class="pool-stats">
          <div class="stat-item">
            <span class="stat-label">抽奖次数</span>
            <span class="stat-value">{{ pool.draw_count || 0 }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">保底计数</span>
            <span class="stat-value">{{ pool.pity_count || 0 }} / {{ pool.pity_threshold || 10 }}</span>
          </div>
        </div>

        <div class="prizes-preview">
          <div class="prize-item" v-for="(prize, idx) in pool.prizes?.slice(0, 4)" :key="idx">
            <span class="prize-icon">{{ getPrizeIcon(prize.type) }}</span>
            <span class="prize-name">{{ prize.name }}</span>
          </div>
          <div v-if="pool.prizes?.length > 4" class="more-prizes">
            +{{ pool.prizes.length - 4 }} 更多奖品
          </div>
        </div>

        <router-link 
          :to="`/family/lottery/${pool.id}`" 
          class="draw-btn"
          :class="{ disabled: pool.status !== 'active' }"
        >
          {{ pool.status === 'active' ? '立即抽奖' : '已关闭' }}
        </router-link>
      </div>
    </div>

    <div class="empty-state" v-else-if="!loading">
      <div class="empty-icon">🎰</div>
      <p>暂无开放的抽奖池</p>
    </div>

    <div class="loading-state" v-if="loading">
      加载中...
    </div>

    <!-- 抽奖券统计 -->
    <section class="ticket-section" v-if="ticketTypes.length > 0">
      <h2>
        <span>🎟️</span>
        抽奖券类型
      </h2>
      <div class="ticket-list">
        <div v-for="ticket in ticketTypes" :key="ticket.id" class="ticket-item">
          <span class="ticket-icon">🎟️</span>
          <div class="ticket-info">
            <div class="ticket-name">{{ ticket.name }}</div>
            <div class="ticket-desc">{{ ticket.description }}</div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const loading = ref(false);
const pools = ref([]);
const ticketTypes = ref([]);

// 加载抽奖概览
const loadDrawOverview = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/v2/draw/overview');
    
    if (res.data?.code === 200) {
      pools.value = res.data.data?.pools || [];
      ticketTypes.value = res.data.data?.ticketTypes || [];
    }
  } catch (err) {
    console.error('加载抽奖概览失败:', err);
  } finally {
    loading.value = false;
  }
};

// 获取奖品图标
const getPrizeIcon = (type) => {
  const icons = {
    points: '💰',
    item: '🎁',
    ticket: '🎟️',
    special: '⭐',
  };
  return icons[type] || '🎁';
};

onMounted(() => {
  loadDrawOverview();
});
</script>

<style scoped>
.market-draw {
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
  margin-bottom: 32px;
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

/* 奖池网格 */
.pools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
  margin-bottom: 48px;
}

.pool-card {
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.1), rgba(255, 149, 0, 0.1));
  border: 1px solid rgba(255, 215, 0, 0.2);
  border-radius: 20px;
  padding: 24px;
  transition: all 0.3s ease;
}

.pool-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 30px rgba(255, 215, 0, 0.2);
}

.pool-card.inactive {
  opacity: 0.6;
  filter: grayscale(0.5);
}

.pool-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.pool-icon {
  font-size: 48px;
}

.pool-info h3 {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 4px;
}

.pool-info p {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
}

.pool-stats {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}

.stat-item {
  flex: 1;
  text-align: center;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
}

.stat-label {
  display: block;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 4px;
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: #ffd700;
}

.prizes-preview {
  margin-bottom: 20px;
}

.prize-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  font-size: 13px;
}

.prize-icon {
  font-size: 16px;
}

.prize-name {
  color: rgba(255, 255, 255, 0.8);
}

.more-prizes {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  padding: 6px 0;
}

.draw-btn {
  display: block;
  text-align: center;
  padding: 14px;
  background: linear-gradient(135deg, #ffd700, #ff9500);
  border-radius: 12px;
  color: #000;
  text-decoration: none;
  font-size: 16px;
  font-weight: 600;
  transition: all 0.3s ease;
}

.draw-btn:hover:not(.disabled) {
  transform: scale(1.02);
  box-shadow: 0 4px 20px rgba(255, 215, 0, 0.4);
}

.draw-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

/* 抽奖券区域 */
.ticket-section {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 20px;
  padding: 24px;
}

.ticket-section h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 20px;
}

.ticket-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.ticket-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
}

.ticket-icon {
  font-size: 32px;
}

.ticket-name {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.ticket-desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
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
