<template>
  <div class="member-inventory">
    <!-- 成员选择器 -->
    <div class="member-selector">
      <div class="selector-tabs">
        <router-link 
          v-for="m in members" 
          :key="m.id"
          :to="`/family/member/${m.id}/inventory`"
          class="selector-tab"
          :class="{ active: m.id === currentMemberId }"
        >
          <span class="tab-avatar">{{ m.name?.charAt(0) || '?' }}</span>
          <span class="tab-name">{{ m.name }}</span>
        </router-link>
      </div>
    </div>

    <!-- 背包内容 -->
    <div class="inventory-content" v-if="member">
      <div class="member-header">
        <div class="member-info">
          <div class="member-avatar-large">{{ member.name?.charAt(0) || '?' }}</div>
          <div class="member-details">
            <h1>{{ member.name }} 的背包</h1>
            <p class="item-count">共 {{ items.length }} 件物品</p>
          </div>
        </div>
      </div>

      <!-- 资产导航 -->
      <nav class="asset-nav">
        <router-link :to="`/family/member/${currentMemberId}/wallet`" class="asset-nav-item" active-class="active">
          <span class="nav-icon">💰</span>
          <span>积分流水</span>
        </router-link>
        <router-link :to="`/family/member/${currentMemberId}/inventory`" class="asset-nav-item" exact-active-class="active">
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

      <!-- 筛选器 -->
      <div class="filter-bar">
        <div class="filter-tabs">
          <button 
            v-for="tab in filterTabs" 
            :key="tab.value"
            class="filter-tab"
            :class="{ active: filter.status === tab.value }"
            @click="filter.status = tab.value; loadInventory()"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>

      <!-- 物品网格 -->
      <div class="inventory-grid" v-if="items.length > 0">
        <div 
          v-for="item in items" 
          :key="item.id" 
          class="inventory-item"
          :class="{ used: item.status === 'used', expired: item.status === 'expired' }"
        >
          <div class="item-icon">{{ item.sku_icon || '🎁' }}</div>
          <div class="item-info">
            <div class="item-name">{{ item.sku_name }}</div>
            <div class="item-quantity">x{{ item.quantity }}</div>
          </div>
          <div class="item-status" :class="item.status">
            {{ getStatusLabel(item.status) }}
          </div>
          <button 
            v-if="item.status === 'unused' && item.quantity > 0" 
            class="use-btn"
            @click="useItem(item)"
          >
            使用
          </button>
        </div>
      </div>

      <div class="empty-state" v-else>
        <div class="empty-icon">🎒</div>
        <p>背包空空如也</p>
        <router-link to="/family/market/shop" class="goto-shop-btn">去商城逛逛</router-link>
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
const items = ref([]);
const loading = ref(false);

const filter = ref({
  status: '',
});

const filterTabs = [
  { label: '全部', value: '' },
  { label: '未使用', value: 'unused' },
  { label: '已使用', value: 'used' },
  { label: '已过期', value: 'expired' },
];

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

// 加载背包
const loadInventory = async () => {
  if (!currentMemberId.value) return;
  
  loading.value = true;
  try {
    const res = await axios.get('/api/v2/inventory', {
      params: {
        member_id: currentMemberId.value,
        status: filter.value.status || undefined,
      }
    });
    
    if (res.data?.code === 200) {
      items.value = res.data.data?.items || [];
    }
  } catch (err) {
    console.error('加载背包失败:', err);
  } finally {
    loading.value = false;
  }
};

// 使用物品
const useItem = async (item) => {
  if (!confirm(`确定要使用「${item.sku_name}」吗？`)) return;
  
  try {
    const res = await axios.post('/api/v2/inventory/use', {
      inventory_id: item.id,
      quantity: 1,
    });
    
    if (res.data?.code === 200) {
      alert('使用成功！');
      loadInventory();
    }
  } catch (err) {
    alert(err.response?.data?.msg || '使用失败');
  }
};

// 获取状态标签
const getStatusLabel = (status) => {
  const labels = {
    unused: '可用',
    used: '已用',
    expired: '过期',
  };
  return labels[status] || status;
};

// 监听路由变化
watch(() => route.params.id, () => {
  if (route.params.id) {
    loadMember();
    loadInventory();
  }
}, { immediate: true });

onMounted(() => {
  loadMembers();
});
</script>

<style scoped>
.member-inventory {
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

/* 背包内容 */
.inventory-content {
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

.item-count {
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

.filter-tabs {
  display: flex;
  gap: 8px;
}

.filter-tab {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.filter-tab:hover {
  background: rgba(255, 255, 255, 0.1);
}

.filter-tab.active {
  background: rgba(102, 126, 234, 0.3);
  border-color: rgba(102, 126, 234, 0.5);
  color: #fff;
}

/* 物品网格 */
.inventory-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.inventory-item {
  position: relative;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  transition: all 0.3s ease;
}

.inventory-item:hover {
  background: rgba(255, 255, 255, 0.08);
  transform: translateY(-2px);
}

.inventory-item.used,
.inventory-item.expired {
  opacity: 0.6;
}

.item-icon {
  font-size: 48px;
}

.item-info {
  text-align: center;
}

.item-name {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.item-quantity {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.item-status {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
}

.item-status.unused {
  background: rgba(56, 239, 125, 0.2);
  color: #38ef7d;
}

.item-status.used {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);
}

.item-status.expired {
  background: rgba(255, 77, 77, 0.2);
  color: #ff4d4d;
}

.use-btn {
  width: 100%;
  padding: 8px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.use-btn:hover {
  transform: scale(1.02);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
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

.loading-state {
  text-align: center;
  padding: 40px;
  color: rgba(255, 255, 255, 0.5);
}
</style>
