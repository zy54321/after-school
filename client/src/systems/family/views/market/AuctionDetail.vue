<template>
  <div class="auction-detail">
    <!-- 面包屑 -->
    <nav class="breadcrumb">
      <router-link to="/family/market">市场</router-link>
      <span class="separator">/</span>
      <router-link to="/family/market/auction">拍卖大厅</router-link>
      <span class="separator">/</span>
      <span class="current">{{ session?.name || '加载中...' }}</span>
    </nav>

    <div v-if="session" class="session-detail">
      <header class="detail-header">
        <div class="header-info">
          <h1>{{ session.name }}</h1>
          <span class="session-status" :class="session.status">
            {{ getStatusLabel(session.status) }}
          </span>
        </div>
        <div class="session-timer" v-if="session.status === 'active'">
          <span class="timer-label">剩余时间</span>
          <span class="timer-value">{{ countdown }}</span>
        </div>
      </header>

      <!-- 拍品列表 -->
      <div class="lots-section">
        <h2>🎯 拍品列表</h2>
        <div class="lots-grid">
          <div 
            v-for="lot in lots" 
            :key="lot.id" 
            class="lot-card"
            :class="{ active: session.status === 'active' }"
          >
            <div class="lot-image">
              <span class="lot-icon">{{ lot.sku_icon || '🎁' }}</span>
            </div>
            <div class="lot-info">
              <div class="lot-name">{{ lot.sku_name }}</div>
              <div class="lot-desc">{{ lot.description }}</div>
            </div>
            <div class="lot-pricing">
              <div class="price-row">
                <span class="price-label">起拍价</span>
                <span class="price-value start">{{ lot.start_price }}</span>
              </div>
              <div class="price-row current">
                <span class="price-label">当前最高</span>
                <span class="price-value">{{ lot.current_bid || lot.start_price }}</span>
              </div>
              <div class="bid-count">{{ lot.bid_count || 0 }} 人出价</div>
            </div>
            <button 
              v-if="session.status === 'active'"
              class="bid-btn"
              @click="openBidModal(lot)"
            >
              出价竞拍
            </button>
            <div v-else class="lot-ended">
              {{ lot.winner_name ? `由 ${lot.winner_name} 得标` : '未结算' }}
            </div>
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

    <!-- 出价弹窗 -->
    <div class="modal-overlay" v-if="showBidModal" @click.self="closeBidModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>竞拍出价</h3>
          <button class="close-btn" @click="closeBidModal">×</button>
        </div>
        <div class="modal-body" v-if="selectedLot">
          <div class="lot-preview">
            <span class="preview-icon">{{ selectedLot.sku_icon || '🎁' }}</span>
            <div class="preview-info">
              <div class="preview-name">{{ selectedLot.sku_name }}</div>
              <div class="preview-price">当前最高: {{ selectedLot.current_bid || selectedLot.start_price }} 积分</div>
            </div>
          </div>

          <div class="form-group">
            <label>出价金额（必须高于当前最高价）</label>
            <input 
              type="number" 
              v-model.number="bidForm.points" 
              class="form-input"
              :min="(selectedLot.current_bid || selectedLot.start_price) + 1"
            />
          </div>

          <button class="select-member-btn" @click="proceedToMemberSelect">
            选择出价成员 →
          </button>
        </div>
      </div>
    </div>

    <!-- 统一成员选择器 -->
    <MemberSelector
      v-model:visible="showMemberSelector"
      title="选择出价成员"
      :action-description="selectedLot ? `竞拍「${selectedLot.sku_name}」\n出价：${bidForm.points} 积分` : ''"
      action-icon="🔨"
      confirm-text="确认出价"
      :required-balance="bidForm.points"
      :require-balance="true"
      :loading="bidding"
      @confirm="handleMemberConfirm"
      @cancel="closeMemberSelector"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';
import MemberSelector from '../../components/MemberSelector.vue';

const route = useRoute();

const loading = ref(false);
const session = ref(null);
const lots = ref([]);
const countdown = ref('--:--:--');
let countdownTimer = null;

// 出价流程
const showBidModal = ref(false);
const showMemberSelector = ref(false);
const selectedLot = ref(null);
const bidding = ref(false);
const bidForm = ref({
  points: 0,
});

// 加载场次详情
const loadSession = async () => {
  const sessionId = route.params.id;
  if (!sessionId) return;
  
  loading.value = true;
  try {
    const res = await axios.get(`/api/v2/auction/sessions/${sessionId}`);
    
    if (res.data?.code === 200) {
      session.value = res.data.data?.session;
      lots.value = res.data.data?.lots || [];
    }
  } catch (err) {
    console.error('加载拍卖详情失败:', err);
  } finally {
    loading.value = false;
  }
};

// 更新倒计时
const updateCountdown = () => {
  if (!session.value?.end_time) {
    countdown.value = '--:--:--';
    return;
  }
  
  const now = new Date();
  const end = new Date(session.value.end_time);
  const diff = end - now;
  
  if (diff <= 0) {
    countdown.value = '已结束';
    loadSession(); // 刷新状态
    return;
  }
  
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  
  countdown.value = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

// 获取状态标签
const getStatusLabel = (status) => {
  const labels = {
    pending: '待开始',
    active: '竞拍中',
    settled: '已结束',
    cancelled: '已取消',
  };
  return labels[status] || status;
};

// 打开出价弹窗
const openBidModal = (lot) => {
  selectedLot.value = lot;
  bidForm.value.points = (lot.current_bid || lot.start_price) + 1;
  showBidModal.value = true;
};

// 关闭出价弹窗
const closeBidModal = () => {
  showBidModal.value = false;
  selectedLot.value = null;
};

// 进入成员选择
const proceedToMemberSelect = () => {
  if (!bidForm.value.points || bidForm.value.points <= (selectedLot.value.current_bid || selectedLot.value.start_price)) {
    alert('出价必须高于当前最高价');
    return;
  }
  showBidModal.value = false;
  showMemberSelector.value = true;
};

// 关闭成员选择器
const closeMemberSelector = () => {
  showMemberSelector.value = false;
};

// 成员确认后执行出价
const handleMemberConfirm = async ({ memberId }) => {
  if (!selectedLot.value) return;
  
  bidding.value = true;
  try {
    const res = await axios.post(`/api/v2/auction/lots/${selectedLot.value.id}/bid`, {
      member_id: memberId,
      bid_points: bidForm.value.points,
    });
    
    if (res.data?.code === 200) {
      alert('出价成功！');
      showMemberSelector.value = false;
      selectedLot.value = null;
      loadSession(); // 刷新数据
    }
  } catch (err) {
    alert(err.response?.data?.msg || '出价失败');
  } finally {
    bidding.value = false;
  }
};

onMounted(() => {
  loadSession();
  countdownTimer = setInterval(updateCountdown, 1000);
});

onUnmounted(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer);
  }
});
</script>

<style scoped>
.auction-detail {
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
  margin: 0 0 8px;
}

.session-status {
  font-size: 14px;
  padding: 6px 14px;
  border-radius: 20px;
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

.session-timer {
  text-align: center;
  padding: 16px 24px;
  background: rgba(79, 172, 254, 0.1);
  border: 1px solid rgba(79, 172, 254, 0.3);
  border-radius: 16px;
}

.timer-label {
  display: block;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 4px;
}

.timer-value {
  font-size: 28px;
  font-weight: 700;
  color: #4facfe;
  font-family: monospace;
}

/* 拍品区域 */
.lots-section h2 {
  font-size: 20px;
  margin: 0 0 20px;
}

.lots-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.lot-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 20px;
  transition: all 0.3s ease;
}

.lot-card:hover {
  background: rgba(255, 255, 255, 0.08);
}

.lot-card.active {
  border-color: rgba(79, 172, 254, 0.3);
}

.lot-image {
  text-align: center;
  margin-bottom: 16px;
}

.lot-icon {
  font-size: 56px;
}

.lot-info {
  margin-bottom: 16px;
}

.lot-name {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
}

.lot-desc {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.4;
}

.lot-pricing {
  margin-bottom: 16px;
}

.price-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.price-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}

.price-value {
  font-size: 16px;
  font-weight: 600;
}

.price-value.start {
  color: rgba(255, 255, 255, 0.6);
}

.price-row.current .price-value {
  color: #4facfe;
  font-size: 20px;
}

.bid-count {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  text-align: right;
}

.bid-btn {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #4facfe, #00f2fe);
  border: none;
  border-radius: 10px;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.bid-btn:hover {
  transform: scale(1.02);
  box-shadow: 0 4px 15px rgba(79, 172, 254, 0.4);
}

.lot-ended {
  text-align: center;
  padding: 12px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
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

/* 出价弹窗 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #1a1a2e;
  border-radius: 20px;
  width: 90%;
  max-width: 400px;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-header h3 {
  font-size: 18px;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 24px;
  cursor: pointer;
}

.modal-body {
  padding: 24px;
}

.lot-preview {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  margin-bottom: 20px;
}

.preview-icon {
  font-size: 40px;
}

.preview-name {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 4px;
}

.preview-price {
  font-size: 14px;
  color: #4facfe;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 8px;
}

.form-input {
  width: 100%;
  padding: 14px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  color: #fff;
  font-size: 18px;
  font-weight: 600;
  text-align: center;
}

.form-input:focus {
  outline: none;
  border-color: rgba(79, 172, 254, 0.5);
}

.select-member-btn {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #4facfe, #00f2fe);
  border: none;
  border-radius: 10px;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.select-member-btn:hover {
  box-shadow: 0 4px 15px rgba(79, 172, 254, 0.4);
}
</style>
