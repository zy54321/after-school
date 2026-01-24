<template>
  <div class="market-mystery">
    <!-- 面包屑 -->
    <nav class="breadcrumb">
      <router-link to="/family/market">市场</router-link>
      <span class="separator">/</span>
      <span class="current">神秘商店</span>
    </nav>

    <header class="page-header">
      <div class="header-content">
        <div>
          <h1>
            <span class="header-icon">✨</span>
            神秘商店
          </h1>
          <p>限时折扣，发现惊喜</p>
        </div>
        <button class="refresh-btn" @click="refreshShop" :disabled="refreshing">
          <span class="refresh-icon" :class="{ spinning: refreshing }">🔄</span>
          {{ refreshing ? '刷新中...' : (shopConfig.canFreeRefresh ? '免费刷新' : `刷新 (${shopConfig.refreshCost}积分)`) }}
        </button>
      </div>
    </header>

    <!-- 倒计时 -->
    <div class="countdown-bar" v-if="rotation">
      <span class="countdown-label">本轮商品将在</span>
      <span class="countdown-time">{{ countdown }}</span>
      <span class="countdown-label">后刷新</span>
    </div>

    <!-- 特惠商品 -->
    <div class="mystery-grid" v-if="offers.length > 0">
      <div v-for="offer in offers" :key="offer.id" class="mystery-item">
        <div class="discount-badge">-{{ Math.round((1 - offer.discount_rate) * 100) }}%</div>
        <div class="item-image">
          <span class="item-icon">{{ offer.sku_icon || '🎁' }}</span>
        </div>
        <div class="item-info">
          <div class="item-name">{{ offer.sku_name }}</div>
          <div class="price-row">
            <span class="original-price">{{ offer.original_cost }}</span>
            <span class="current-price">{{ offer.cost }}</span>
            <span class="price-unit">积分</span>
          </div>
          <div class="savings">节省 {{ offer.savings }} 积分</div>
        </div>
        <button class="buy-btn" @click="openPurchaseModal(offer)">立即抢购</button>
      </div>
    </div>

    <div class="empty-state" v-else-if="!loading">
      <div class="empty-icon">✨</div>
      <p>神秘商店暂无商品</p>
      <button class="refresh-btn primary" @click="refreshShop" :disabled="refreshing">
        刷新商店
      </button>
    </div>

    <div class="loading-state" v-if="loading">
      加载中...
    </div>

    <!-- 统一成员选择器 - 购买 -->
    <MemberSelector
      v-model:visible="showMemberSelector"
      title="选择购买成员"
      :action-description="selectedOffer ? `限时特惠：${selectedOffer.sku_name}（${selectedOffer.cost} 积分）` : ''"
      action-icon="✨"
      confirm-text="确认购买"
      :required-balance="selectedOffer?.cost || 0"
      :require-balance="true"
      :loading="purchasing"
      @confirm="handleMemberConfirm"
      @cancel="closeMemberSelector"
    />

    <!-- 统一成员选择器 - 付费刷新 -->
    <MemberSelector
      v-model:visible="showRefreshSelector"
      title="选择付款成员"
      :action-description="`刷新神秘商店（${shopConfig.refreshCost} 积分）`"
      action-icon="🔄"
      confirm-text="确认刷新"
      :required-balance="shopConfig.refreshCost"
      :require-balance="true"
      :loading="refreshing"
      @confirm="handleRefreshConfirm"
      @cancel="closeRefreshSelector"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import axios from 'axios';
import MemberSelector from '../../components/MemberSelector.vue';

const loading = ref(false);
const refreshing = ref(false);
const rotation = ref(null);
const offers = ref([]);
const shopConfig = ref({
  refreshCost: 0,
  canFreeRefresh: true,
});

// 购买流程
const showMemberSelector = ref(false);
const selectedOffer = ref(null);
const purchasing = ref(false);

// 刷新流程
const showRefreshSelector = ref(false);

// 倒计时
const countdown = ref('--:--:--');
let countdownTimer = null;

const updateCountdown = () => {
  if (!rotation.value?.expires_at) {
    countdown.value = '--:--:--';
    return;
  }
  
  const now = new Date();
  const expires = new Date(rotation.value.expires_at);
  const diff = expires - now;
  
  if (diff <= 0) {
    countdown.value = '已过期';
    loadShop();
    return;
  }
  
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  
  countdown.value = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

// 加载商店
const loadShop = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/v2/mystery-shop');
    
    if (res.data?.code === 200) {
      const data = res.data.data;
      rotation.value = data.rotation;
      offers.value = data.offers || [];
      shopConfig.value = {
        refreshCost: data.config?.refreshCost || 0,
        canFreeRefresh: data.config?.canFreeRefresh ?? true,
      };
    }
  } catch (err) {
    console.error('加载神秘商店失败:', err);
  } finally {
    loading.value = false;
  }
};

// 刷新商店
const refreshShop = async () => {
  if (!shopConfig.value.canFreeRefresh) {
    // 付费刷新需要选择成员
    showRefreshSelector.value = true;
    return;
  }
  
  // 免费刷新直接执行
  await doRefresh(null, true);
};

// 执行刷新
const doRefresh = async (memberId, isFree) => {
  refreshing.value = true;
  try {
    const res = await axios.post('/api/v2/mystery-shop/refresh', {
      member_id: memberId || undefined,
      is_free: isFree,
    });
    
    if (res.data?.code === 200) {
      await loadShop();
      showRefreshSelector.value = false;
    }
  } catch (err) {
    alert(err.response?.data?.msg || '刷新失败');
  } finally {
    refreshing.value = false;
  }
};

// 付费刷新成员确认
const handleRefreshConfirm = async ({ memberId }) => {
  await doRefresh(memberId, false);
};

// 关闭刷新选择器
const closeRefreshSelector = () => {
  showRefreshSelector.value = false;
};

// 打开购买弹窗
const openPurchaseModal = (offer) => {
  selectedOffer.value = offer;
  showMemberSelector.value = true;
};

// 关闭成员选择器
const closeMemberSelector = () => {
  showMemberSelector.value = false;
  selectedOffer.value = null;
};

// 成员确认后执行购买
const handleMemberConfirm = async ({ memberId }) => {
  if (!selectedOffer.value) return;
  
  purchasing.value = true;
  try {
    const res = await axios.post('/api/v2/orders', {
      member_id: memberId,
      offer_id: selectedOffer.value.id,
      quantity: 1,
      idempotency_key: `mystery_${selectedOffer.value.id}_${memberId}_${Date.now()}`,
    });
    
    if (res.data?.code === 200) {
      alert('购买成功！');
      showMemberSelector.value = false;
      selectedOffer.value = null;
      loadShop();
    }
  } catch (err) {
    alert(err.response?.data?.msg || '购买失败');
  } finally {
    purchasing.value = false;
  }
};

onMounted(() => {
  loadShop();
  countdownTimer = setInterval(updateCountdown, 1000);
});

onUnmounted(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer);
  }
});
</script>

<style scoped>
.market-mystery {
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

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 16px;
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

.refresh-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: linear-gradient(135deg, #f093fb, #f5576c);
  border: none;
  border-radius: 12px;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.refresh-btn:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 4px 20px rgba(240, 147, 251, 0.4);
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.refresh-icon {
  font-size: 18px;
}

.refresh-icon.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 倒计时 */
.countdown-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  margin-bottom: 24px;
}

.countdown-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
}

.countdown-time {
  font-size: 18px;
  font-weight: 600;
  color: #f5576c;
  font-family: monospace;
}

/* 商品网格 */
.mystery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 20px;
}

.mystery-item {
  position: relative;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: all 0.3s ease;
}

.mystery-item:hover {
  background: rgba(255, 255, 255, 0.08);
  transform: translateY(-4px);
}

.discount-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  padding: 6px 12px;
  background: linear-gradient(135deg, #f5576c, #f093fb);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 700;
  color: #fff;
}

.item-image {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.item-image .item-icon {
  font-size: 56px;
}

.item-info {
  text-align: center;
  margin-bottom: 16px;
}

.item-name {
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 8px;
}

.price-row {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 8px;
}

.original-price {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.4);
  text-decoration: line-through;
}

.current-price {
  font-size: 22px;
  font-weight: 700;
  color: #f5576c;
}

.price-unit {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.savings {
  font-size: 12px;
  color: #38ef7d;
  margin-top: 4px;
}

.buy-btn {
  width: 100%;
  padding: 10px;
  background: linear-gradient(135deg, #f093fb, #f5576c);
  border: none;
  border-radius: 10px;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.buy-btn:hover {
  box-shadow: 0 4px 15px rgba(240, 147, 251, 0.4);
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

.empty-state .refresh-btn.primary {
  margin-top: 20px;
}

/* 弹窗 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
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

.selected-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  margin-bottom: 20px;
}

.selected-item .item-icon {
  font-size: 40px;
}

.selected-item .item-name {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 4px;
}

.selected-item .item-price .original {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.4);
  text-decoration: line-through;
  margin-right: 8px;
}

.selected-item .item-price .discounted {
  font-size: 16px;
  font-weight: 600;
  color: #f5576c;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 8px;
}

.form-select {
  width: 100%;
  padding: 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
}

.form-select option {
  background: #1a1a2e;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.cancel-btn {
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
}

.confirm-btn {
  padding: 10px 24px;
  background: linear-gradient(135deg, #f093fb, #f5576c);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.confirm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
