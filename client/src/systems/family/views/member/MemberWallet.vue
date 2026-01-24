<template>
  <div class="member-wallet">
    <!-- 成员选择器 -->
    <div class="member-selector">
      <div class="selector-tabs">
        <router-link 
          v-for="m in members" 
          :key="m.id"
          :to="`/family/member/${m.id}/wallet`"
          class="selector-tab"
          :class="{ active: m.id === currentMemberId }"
        >
          <span class="tab-avatar">{{ m.name?.charAt(0) || '?' }}</span>
          <span class="tab-name">{{ m.name }}</span>
        </router-link>
      </div>
    </div>

    <!-- 钱包概览 -->
    <div class="wallet-overview" v-if="member">
      <div class="member-header">
        <div class="member-info">
          <div class="member-avatar-large">{{ member.name?.charAt(0) || '?' }}</div>
          <div class="member-details">
            <h1>{{ member.name }} 的钱包</h1>
            <p class="member-role">{{ member.role || '家庭成员' }}</p>
          </div>
        </div>
        <div class="balance-card">
          <div class="balance-label">当前积分</div>
          <div class="balance-value">{{ balance }}</div>
        </div>
      </div>

      <div class="wallet-actions">
        <button class="action-btn add" @click="openAdjustModal('add')">+ 加分</button>
        <button class="action-btn deduct" @click="openAdjustModal('deduct')">- 扣分</button>
      </div>

      <!-- 资产导航 -->
      <nav class="asset-nav">
        <router-link :to="`/family/member/${currentMemberId}/wallet`" class="asset-nav-item" exact-active-class="active">
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
        <router-link :to="`/family/member/${currentMemberId}/activity`" class="asset-nav-item" active-class="active">
          <span class="nav-icon">📊</span>
          <span>活动记录</span>
        </router-link>
      </nav>

      <!-- 积分流水 -->
      <section class="wallet-section">
        <h2>
          <span>📜</span>
          积分流水
        </h2>
        
        <div class="filter-bar">
          <select v-model="filter.reasonCode" @change="loadLogs" class="filter-select">
            <option value="">全部类型</option>
            <option value="reward">兑换</option>
            <option value="bounty">悬赏</option>
            <option value="auction">拍卖</option>
            <option value="lottery">抽奖</option>
            <option value="grant">发放</option>
            <option value="refund">退款</option>
          </select>
        </div>

        <div class="logs-list" v-if="logs.length > 0">
          <div v-for="log in logs" :key="log.id" class="log-item">
            <div class="log-icon" :class="log.points_change > 0 ? 'income' : 'expense'">
              {{ log.points_change > 0 ? '↗️' : '↘️' }}
            </div>
            <div class="log-content">
              <div class="log-desc">{{ log.description }}</div>
              <div class="log-meta">
                <span class="log-time">{{ formatTime(log.created_at) }}</span>
                <span class="log-reason">{{ getReasonLabel(log.reason_code) }}</span>
              </div>
            </div>
            <div class="log-amount" :class="log.points_change > 0 ? 'income' : 'expense'">
              {{ log.points_change > 0 ? '+' : '' }}{{ log.points_change }}
            </div>
          </div>
        </div>

        <div class="empty-state" v-else>
          <p>暂无积分流水</p>
        </div>

        <button v-if="hasMore" @click="loadMore" class="load-more-btn" :disabled="loading">
          {{ loading ? '加载中...' : '加载更多' }}
        </button>
      </section>
    </div>

    <div class="loading-state" v-else-if="loading">
      加载中...
    </div>

    <!-- 加扣分弹窗 -->
    <div class="modal-overlay" v-if="showAdjustModal" @click.self="closeAdjustModal">
      <div class="modal-content">
        <h3>{{ adjustForm.type === 'add' ? '加分' : '扣分' }}</h3>
        <div class="form-group">
          <label>积分值</label>
          <input type="number" v-model.number="adjustForm.points" min="1" />
        </div>
        <div class="form-group">
          <label>原因（可选）</label>
          <input v-model="adjustForm.reason" placeholder="例如：表现优秀" />
        </div>
        <div class="modal-actions">
          <button class="cancel-btn" @click="closeAdjustModal">取消</button>
          <button class="confirm-btn" @click="submitAdjust" :disabled="adjusting">
            {{ adjusting ? '提交中...' : '确认' }}
          </button>
        </div>
      </div>
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
const balance = ref(0);
const logs = ref([]);
const loading = ref(false);
const showAdjustModal = ref(false);
const adjusting = ref(false);

const adjustForm = ref({
  type: 'add',
  points: 1,
  reason: '',
});
const hasMore = ref(true);

const filter = ref({
  reasonCode: '',
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

// 加载钱包信息
const loadWallet = async () => {
  if (!currentMemberId.value) return;
  
  loading.value = true;
  try {
    const res = await axios.get('/api/v2/wallet', {
      params: { member_id: currentMemberId.value }
    });
    
    if (res.data?.code === 200) {
      member.value = res.data.data?.member || {};
      balance.value = res.data.data?.balance || 0;
    }
  } catch (err) {
    console.error('加载钱包失败:', err);
  } finally {
    loading.value = false;
  }
};

// 加载积分流水
const loadLogs = async (reset = true) => {
  if (!currentMemberId.value) return;
  
  if (reset) {
    pagination.value.offset = 0;
    logs.value = [];
    hasMore.value = true;
  }
  
  loading.value = true;
  try {
    const res = await axios.get('/api/v2/wallet/logs', {
      params: {
        member_id: currentMemberId.value,
        limit: pagination.value.limit,
        offset: pagination.value.offset,
        reason_code: filter.value.reasonCode || undefined,
      }
    });
    
    if (res.data?.code === 200) {
      const newLogs = res.data.data?.logs || [];
      logs.value = reset ? newLogs : [...logs.value, ...newLogs];
      hasMore.value = newLogs.length >= pagination.value.limit;
      pagination.value.offset += newLogs.length;
    }
  } catch (err) {
    console.error('加载流水失败:', err);
  } finally {
    loading.value = false;
  }
};

// 加载更多
const loadMore = () => {
  loadLogs(false);
};

// 格式化时间
const formatTime = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
};

// 获取原因标签
const getReasonLabel = (code) => {
  const labels = {
    reward: '兑换',
    bounty: '悬赏',
    auction: '拍卖',
    lottery: '抽奖',
    grant: '发放',
    refund: '退款',
    escrow: '托管',
    mystery_shop: '神秘商店',
    mystery_shop_refresh: '商店刷新',
    manual: '手动调整',
  };
  return labels[code] || code;
};

const openAdjustModal = (type) => {
  adjustForm.value = {
    type,
    points: 1,
    reason: '',
  };
  showAdjustModal.value = true;
};

const closeAdjustModal = () => {
  showAdjustModal.value = false;
  adjusting.value = false;
};

const submitAdjust = async () => {
  if (!currentMemberId.value) return;
  if (!adjustForm.value.points || adjustForm.value.points <= 0) {
    alert('请输入有效积分值');
    return;
  }

  adjusting.value = true;
  try {
    const delta = adjustForm.value.type === 'add'
      ? adjustForm.value.points
      : -adjustForm.value.points;
    const title = adjustForm.value.reason || (delta > 0 ? '手动加分' : '手动扣分');
    const res = await axios.post('/api/family/action', {
      memberId: currentMemberId.value,
      points: delta,
      customTitle: title,
      reasonCode: 'manual',
    });
    if (res.data?.code === 200) {
      closeAdjustModal();
      await loadWallet();
      await loadLogs();
    }
  } catch (err) {
    alert(err.response?.data?.msg || '操作失败');
  } finally {
    adjusting.value = false;
  }
};

// 监听路由变化
watch(() => route.params.id, () => {
  if (route.params.id) {
    loadWallet();
    loadLogs();
  }
}, { immediate: true });

onMounted(() => {
  loadMembers();
});
</script>

<style scoped>
.member-wallet {
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

.selector-tab.active .tab-avatar {
  background: rgba(255, 255, 255, 0.3);
}

.tab-name {
  font-size: 14px;
}

/* 钱包概览 */
.wallet-overview {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 20px;
  padding: 24px;
}

.member-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 20px;
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

.member-role {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
  margin: 0;
}

.balance-card {
  background: linear-gradient(135deg, #ffd700, #ff9500);
  padding: 16px 32px;
  border-radius: 16px;
  text-align: center;
}

.wallet-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.action-btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-weight: 600;
}

.action-btn.add {
  background: linear-gradient(135deg, #38ef7d, #11998e);
  color: #fff;
}

.action-btn.deduct {
  background: linear-gradient(135deg, #ff6b6b, #ee5253);
  color: #fff;
}

.balance-label {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.6);
  margin-bottom: 4px;
}

.balance-value {
  font-size: 32px;
  font-weight: 700;
  color: #000;
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

.nav-icon {
  font-size: 16px;
}

/* 流水列表 */
.wallet-section {
  margin-top: 24px;
}

.wallet-section h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 16px;
}

.filter-bar {
  margin-bottom: 16px;
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

.logs-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.log-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  transition: background 0.3s ease;
}

.log-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.log-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.log-icon.income {
  background: rgba(56, 239, 125, 0.2);
}

.log-icon.expense {
  background: rgba(255, 77, 77, 0.2);
}

.log-content {
  flex: 1;
}

.log-desc {
  font-size: 14px;
  margin-bottom: 4px;
}

.log-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.log-reason {
  padding: 2px 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

.log-amount {
  font-size: 16px;
  font-weight: 600;
}

.log-amount.income {
  color: #38ef7d;
}

.log-amount.expense {
  color: #ff4d4d;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: rgba(255, 255, 255, 0.5);
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

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: #1a1a2e;
  padding: 24px;
  border-radius: 16px;
  width: 90%;
  max-width: 420px;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
}

.form-group input {
  width: 100%;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}

.modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.cancel-btn,
.confirm-btn {
  flex: 1;
  padding: 10px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
}

.cancel-btn {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.confirm-btn {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  font-weight: 600;
}
</style>
