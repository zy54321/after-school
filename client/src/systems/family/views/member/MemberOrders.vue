<template>
  <div class="member-orders">
    <!-- 成员选择器 -->
    <div class="member-selector">
      <div class="selector-tabs">
        <router-link 
          v-for="m in members" 
          :key="m.id"
          :to="`/family/member/${m.id}/orders`"
          class="selector-tab"
          :class="{ active: m.id === currentMemberId }"
        >
          <span class="tab-avatar">{{ m.name?.charAt(0) || '?' }}</span>
          <span class="tab-name">{{ m.name }}</span>
        </router-link>
      </div>
    </div>

    <!-- 订单内容 -->
    <div class="orders-content" v-if="member">
      <div class="member-header">
        <div class="member-info">
          <div class="member-avatar-large">{{ member.name?.charAt(0) || '?' }}</div>
          <div class="member-details">
            <h1>{{ member.name }} 的订单</h1>
            <p class="order-count">共 {{ orders.length }} 笔订单</p>
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
        <router-link :to="`/family/member/${currentMemberId}/orders`" class="asset-nav-item" exact-active-class="active">
          <span class="nav-icon">📦</span>
          <span>订单记录</span>
        </router-link>
        <router-link :to="`/family/member/${currentMemberId}/activity`" class="asset-nav-item" active-class="active">
          <span class="nav-icon">📊</span>
          <span>活动记录</span>
        </router-link>
      </nav>

      <!-- 筛选器 -->
      <div class="filter-bar">
        <select v-model="filter.status" @change="loadOrders" class="filter-select">
          <option value="">全部状态</option>
          <option value="pending">待处理</option>
          <option value="paid">已支付</option>
          <option value="fulfilled">已完成</option>
          <option value="cancelled">已取消</option>
          <option value="refunded">已退款</option>
        </select>
      </div>

      <!-- 订单列表 -->
      <div class="orders-list" v-if="orders.length > 0">
        <div v-for="order in orders" :key="order.id" class="order-card">
          <div class="order-header">
            <span class="order-id">订单 #{{ order.id }}</span>
            <span class="order-status" :class="order.status">{{ getStatusLabel(order.status) }}</span>
          </div>
          <div class="order-body">
            <div class="order-item">
              <span class="item-icon">{{ order.sku_icon || '🎁' }}</span>
              <div class="item-info">
                <div class="item-name">{{ order.sku_name }}</div>
                <div class="item-quantity">数量: {{ order.quantity }}</div>
              </div>
              <div class="item-cost">-{{ order.cost }} 积分</div>
            </div>
          </div>
          <div class="order-footer">
            <span class="order-time">{{ formatTime(order.created_at) }}</span>
          </div>
        </div>
      </div>

      <div class="empty-state" v-else>
        <div class="empty-icon">📦</div>
        <p>暂无订单记录</p>
        <router-link to="/family/market/shop" class="goto-shop-btn">去商城购物</router-link>
      </div>

      <button v-if="hasMore" @click="loadMore" class="load-more-btn" :disabled="loading">
        {{ loading ? '加载中...' : '加载更多' }}
      </button>
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
const orders = ref([]);
const loading = ref(false);
const hasMore = ref(true);

const filter = ref({
  status: '',
});

const pagination = ref({
  offset: 0,
  limit: 20,
});

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

// 加载订单
const loadOrders = async (reset = true) => {
  if (!currentMemberId.value) return;
  
  if (reset) {
    pagination.value.offset = 0;
    orders.value = [];
    hasMore.value = true;
  }
  
  loading.value = true;
  try {
    const res = await axios.get('/api/v2/orders', {
      params: {
        member_id: currentMemberId.value,
        status: filter.value.status || undefined,
        limit: pagination.value.limit,
        offset: pagination.value.offset,
      }
    });
    
    if (res.data?.code === 200) {
      const newOrders = res.data.data?.orders || [];
      orders.value = reset ? newOrders : [...orders.value, ...newOrders];
      hasMore.value = newOrders.length >= pagination.value.limit;
      pagination.value.offset += newOrders.length;
    }
  } catch (err) {
    console.error('加载订单失败:', err);
  } finally {
    loading.value = false;
  }
};

// 加载更多
const loadMore = () => {
  loadOrders(false);
};

// 格式化时间
const formatTime = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// 获取状态标签
const getStatusLabel = (status) => {
  const labels = {
    pending: '待处理',
    paid: '已支付',
    fulfilled: '已完成',
    cancelled: '已取消',
    refunded: '已退款',
  };
  return labels[status] || status;
};

// 监听路由变化
watch(() => route.params.id, () => {
  if (route.params.id) {
    loadMember();
    loadOrders();
  }
}, { immediate: true });

onMounted(() => {
  loadMembers();
});
</script>

<style scoped>
.member-orders {
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

/* 订单内容 */
.orders-content {
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

.order-count {
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

/* 筛选器 */
.filter-bar {
  margin-bottom: 20px;
}

.filter-select {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}

.filter-select option {
  background: #1a1a2e;
}

/* 订单列表 */
.orders-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.order-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  overflow: hidden;
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.order-id {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}

.order-status {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 12px;
}

.order-status.pending {
  background: rgba(255, 193, 7, 0.2);
  color: #ffc107;
}

.order-status.paid,
.order-status.fulfilled {
  background: rgba(56, 239, 125, 0.2);
  color: #38ef7d;
}

.order-status.cancelled,
.order-status.refunded {
  background: rgba(255, 77, 77, 0.2);
  color: #ff4d4d;
}

.order-body {
  padding: 16px;
}

.order-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.item-icon {
  font-size: 32px;
}

.item-info {
  flex: 1;
}

.item-name {
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 4px;
}

.item-quantity {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}

.item-cost {
  font-size: 16px;
  font-weight: 600;
  color: #ff4d4d;
}

.order-footer {
  padding: 12px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.order-time {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.empty-state p {
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 20px;
}

.goto-shop-btn {
  display: inline-block;
  padding: 12px 24px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 12px;
  color: #fff;
  text-decoration: none;
  font-size: 14px;
  transition: all 0.3s ease;
}

.goto-shop-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.load-more-btn {
  width: 100%;
  padding: 12px;
  margin-top: 16px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.load-more-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
}

.load-more-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-state {
  text-align: center;
  padding: 40px;
  color: rgba(255, 255, 255, 0.5);
}
</style>
