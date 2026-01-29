<template>
  <div class="auction-session">
    <!-- 面包屑 -->
    <nav class="breadcrumb">
      <router-link to="/family/market">市场</router-link>
      <span class="separator">/</span>
      <router-link to="/family/market/auction">拍卖大厅</router-link>
      <span class="separator">/</span>
      <span class="current">{{ session?.title || '加载中...' }}</span>
    </nav>

    <div v-if="session" class="session-container">
      <!-- 会场头部 -->
      <header class="session-header">
        <div class="header-info">
          <h1>{{ session.title }}</h1>
          <span class="session-status" :class="session.status">
            {{ getStatusLabel(session.status) }}
          </span>
        </div>
        <div class="header-actions" v-if="session.status === 'active' && currentLot">
          <button 
            class="close-lot-btn"
            @click="handleCloseLot"
            :disabled="closingLot"
          >
            {{ closingLot ? '成交中...' : '成交拍品' }}
          </button>
          <button 
            class="undo-bid-btn"
            @click="handleUndoLastBid"
            :disabled="undoingBid || !currentLot.bids || currentLot.bids.length === 0"
          >
            {{ undoingBid ? '撤销中...' : '撤销最后出价' }}
          </button>
        </div>
      </header>

      <!-- 主要内容区域 -->
      <div class="session-main">
        <!-- 左侧：拍品列表 -->
        <div class="session-left">
          <LotList 
            :lots="lots" 
            :current-lot-id="currentLot?.id"
          />
        </div>

        <!-- 右侧：当前拍品详情 -->
        <div class="session-right">
          <div v-if="currentLot" class="current-lot-section">
            <!-- 当前拍品信息 -->
            <div class="lot-detail-card">
              <div class="lot-image">
                <span class="lot-icon">{{ currentLot.sku_icon || '🎁' }}</span>
              </div>
              <div class="lot-detail-info">
                <h2 class="lot-name">{{ currentLot.title || currentLot.sku_name }}</h2>
                <p class="lot-description" v-if="currentLot.description">
                  {{ currentLot.description }}
                </p>
                <div class="lot-pricing">
                  <div class="price-row">
                    <span class="price-label">起拍价</span>
                    <span class="price-value start">{{ currentLot.reserve_price || currentLot.start_price || 0 }} 积分</span>
                  </div>
                  <div class="price-row current" v-if="currentLot.status === 'open'">
                    <span class="price-label">当前最高</span>
                    <span class="price-value">{{ currentLot.current_highest_bid || currentLot.reserve_price || currentLot.start_price || 0 }} 积分</span>
                    <span v-if="currentLot.leading_bidder" class="leading-bidder">
                      （{{ currentLot.leading_bidder.name }}）
                    </span>
                  </div>
                  <div class="price-row" v-if="currentLot.status === 'sold'">
                    <span class="price-label">成交价</span>
                    <span class="price-value sold">{{ currentLot.current_highest_bid || 0 }} 积分</span>
                  </div>
                  <div class="price-row" v-if="currentLot.bid_count > 0">
                    <span class="price-label">出价次数</span>
                    <span class="price-value">{{ currentLot.bid_count }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 出价面板（仅当拍品状态为 open 时显示） -->
            <BidPanel
              v-if="currentLot.status === 'open' && session.status === 'active'"
              :members="membersWithAvailable"
              :current-highest-bid="currentLot.current_highest_bid || 0"
              :leading-bidder="currentLot.leading_bidder"
              :min-bid="(currentLot.current_highest_bid || currentLot.reserve_price || currentLot.start_price || 0) + 1"
              :bidding="bidding"
              :current-lot-id="currentLot.id"
              @bid="handleBid"
              @member-select="handleMemberSelect"
            />

            <!-- 出价历史 -->
            <BidHistory 
              :bids="recentBidsForCurrentLot" 
              :members="members"
            />
          </div>

          <div v-else class="no-current-lot">
            <div class="empty-icon">🎁</div>
            <p>暂无当前拍品</p>
          </div>
        </div>
      </div>
    </div>

    <div class="loading-state" v-else-if="loading">
      加载中...
    </div>

    <div class="empty-state" v-else>
      <p>拍卖场次不存在</p>
      <router-link to="/family/market/auction" class="back-btn">返回拍卖大厅</router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';
import { ElMessage, ElMessageBox } from 'element-plus';
import LotList from '../../components/auction/LotList.vue';
import BidPanel from '../../components/auction/BidPanel.vue';
import BidHistory from '../../components/auction/BidHistory.vue';

const route = useRoute();

const loading = ref(false);
const session = ref(null);
const lots = ref([]);
const currentLot = ref(null);
const members = ref([]);
const recentBids = ref([]);
const bidding = ref(false);
const closingLot = ref(false);
const undoingBid = ref(false);

let pollTimer = null;
const POLL_INTERVAL = 4000; // 4秒轮询

// 计算成员的可用积分（wallet_balance - locked_total）
const membersWithAvailable = computed(() => {
  return members.value.map(m => ({
    ...m,
    available: (m.wallet_balance || 0) - (m.locked_total || 0),
  }));
});

// 获取当前拍品的出价历史
const recentBidsForCurrentLot = computed(() => {
  if (!currentLot.value) return [];
  return recentBids.value.filter(b => b.lot_id === currentLot.value.id);
});

// 加载会场详情
const loadSessionOverview = async () => {
  const sessionId = route.params.id;
  if (!sessionId) return;
  
  loading.value = true;
  try {
    const res = await axios.get(`/api/v2/auction/sessions/${sessionId}/overview`);
    
    // 兼容后端字段名（避免字段名不匹配导致空数据）
    const overview = res?.data?.data ?? res?.data ?? {};
    
    session.value = overview.session ?? null;
    lots.value = overview.lots ?? [];
    
    // 设置当前拍品（取第一个 open 状态的，或第一个）
    currentLot.value = overview.lots?.find(l => l.status === 'open') || overview.lots?.[0] || null;
    
    // 使用 overview API 返回的 members（包含 wallet_balance 和 locked_total）
    members.value = (overview.members ?? []).map(m => ({
      id: m.id,
      name: m.name,
      wallet_balance: m.wallet_balance || 0,
      locked_total: m.locked_total || 0,
    }));
    
    // 保存最近的出价记录（兼容多种字段名）
    recentBids.value = overview.recent_bids ?? overview.recentBids ?? overview.recent_bids ?? [];
  } catch (err) {
    console.error('加载会场详情失败:', err);
    ElMessage.error(err.response?.data?.msg || '加载会场详情失败');
    // 防御性赋值：避免接口失败时抛错导致页面挂
    recentBids.value = [];
  } finally {
    loading.value = false;
  }
};

// 开始轮询
const startPolling = () => {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    if (session.value?.status === 'active') {
      loadSessionOverview();
    }
  }, POLL_INTERVAL);
};

// 停止轮询
const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
};

// 处理出价
const handleBid = async ({ memberId, bidPoints }) => {
  if (!currentLot.value) return;
  
  bidding.value = true;
  try {
    const res = await axios.post(`/api/v2/auction/lots/${currentLot.value.id}/bids`, {
      member_id: memberId,
      bid_points: bidPoints,
    });
    
    if (res.data?.code === 200) {
      ElMessage.success('出价成功！');
      // 立即刷新数据（不等轮询）
      await loadSessionOverview();
    }
  } catch (err) {
    ElMessage.error(err.response?.data?.msg || '出价失败');
  } finally {
    bidding.value = false;
  }
};

// 处理成员选择（BidPanel 内部使用，这里可以留空或做额外处理）
const handleMemberSelect = (memberId) => {
  // 可以在这里做一些额外处理，比如记录选中的成员
};

// 处理成交拍品
const handleCloseLot = async () => {
  if (!currentLot.value) return;
  
  try {
    await ElMessageBox.confirm(
      `确认成交当前拍品「${currentLot.value.sku_name}」？`,
      '确认成交',
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );
    
    closingLot.value = true;
    try {
      const res = await axios.post(`/api/v2/auction/lots/${currentLot.value.id}/close`);
      
      if (res.data?.code === 200) {
        ElMessage.success(res.data.msg || '拍品已成交');
        // 立即刷新数据（不等轮询）
        await loadSessionOverview();
      }
    } catch (err) {
      ElMessage.error(err.response?.data?.msg || '成交失败');
    } finally {
      closingLot.value = false;
    }
  } catch {
    // 用户取消
  }
};

// 处理撤销最后出价
const handleUndoLastBid = async () => {
  if (!currentLot.value) return;
  
  try {
    await ElMessageBox.confirm(
      '确认撤销最后一次出价？',
      '确认撤销',
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );
    
    undoingBid.value = true;
    try {
      const res = await axios.post(`/api/v2/auction/lots/${currentLot.value.id}/undo-last-bid`);
      
      if (res.data?.code === 200) {
        ElMessage.success(res.data.msg || '已撤销最后一次出价');
        // 立即刷新数据（不等轮询）
        await loadSessionOverview();
      }
    } catch (err) {
      ElMessage.error(err.response?.data?.msg || '撤销失败');
    } finally {
      undoingBid.value = false;
    }
  } catch {
    // 用户取消
  }
};

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

// 监听路由变化
watch(() => route.params.id, () => {
  stopPolling();
  loadSessionOverview().then(() => {
    if (session.value?.status === 'active') {
      startPolling();
    }
  });
});

// 监听 session 状态变化，自动开始/停止轮询
watch(() => session.value?.status, (newStatus) => {
  if (newStatus === 'active') {
    startPolling();
  } else {
    stopPolling();
  }
});

onMounted(() => {
  loadSessionOverview().then(() => {
    if (session.value?.status === 'active') {
      startPolling();
    }
  });
});

onUnmounted(() => {
  stopPolling();
});
</script>

<style scoped>
.auction-session {
  color: #fff;
  min-height: calc(100vh - 70px);
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

.session-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.session-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
}

.header-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-info h1 {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
}

.session-status {
  padding: 6px 12px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
}

.session-status.active {
  background: rgba(79, 172, 254, 0.2);
  color: #4facfe;
}

.session-status.scheduled {
  background: rgba(255, 193, 7, 0.2);
  color: #ffc107;
}

.session-status.ended {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);
}

.header-actions {
  display: flex;
  gap: 12px;
}

.close-lot-btn,
.undo-bid-btn {
  padding: 10px 20px;
  background: rgba(79, 172, 254, 0.2);
  border: 1px solid rgba(79, 172, 254, 0.3);
  border-radius: 10px;
  color: #4facfe;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.close-lot-btn:hover:not(:disabled),
.undo-bid-btn:hover:not(:disabled) {
  background: rgba(79, 172, 254, 0.3);
  border-color: rgba(79, 172, 254, 0.5);
}

.close-lot-btn:disabled,
.undo-bid-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.session-main {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 24px;
}

.session-left {
  display: flex;
  flex-direction: column;
}

.session-right {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.current-lot-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.lot-detail-card {
  display: flex;
  gap: 20px;
  padding: 24px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
}

.lot-image {
  flex-shrink: 0;
}

.lot-icon {
  font-size: 64px;
  display: block;
}

.lot-detail-info {
  flex: 1;
}

.lot-name {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 12px;
  color: #fff;
}

.lot-description {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  margin: 0 0 16px;
  line-height: 1.6;
}

.lot-pricing {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.price-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.price-row:last-child {
  border-bottom: none;
}

.price-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
}

.price-value {
  font-size: 18px;
  font-weight: 700;
  color: #4facfe;
}

.price-value.start {
  color: rgba(255, 255, 255, 0.7);
}

.price-value.sold {
  color: #4caf50;
}

.price-row.current .price-value {
  font-size: 24px;
}

.no-current-lot {
  text-align: center;
  padding: 60px 20px;
  color: rgba(255, 255, 255, 0.5);
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: rgba(255, 255, 255, 0.5);
}

.back-btn {
  display: inline-block;
  margin-top: 16px;
  padding: 10px 20px;
  background: rgba(79, 172, 254, 0.2);
  border: 1px solid rgba(79, 172, 254, 0.3);
  border-radius: 10px;
  color: #4facfe;
  text-decoration: none;
  transition: all 0.3s ease;
}

.back-btn:hover {
  background: rgba(79, 172, 254, 0.3);
  border-color: rgba(79, 172, 254, 0.5);
}
</style>
