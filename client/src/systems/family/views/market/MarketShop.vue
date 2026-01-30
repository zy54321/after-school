<template>
  <div class="market-shop">
    <!-- 面包屑 -->
    <nav class="breadcrumb">
      <router-link to="/family/market">市场</router-link>
      <span class="separator">/</span>
      <span class="current">奖励商城</span>
    </nav>

    <header class="page-header">
      <h1>
        <span class="header-icon">🛍️</span>
        奖励商城
      </h1>
      <p>用积分兑换你想要的奖励</p>
    </header>

    <!-- 商品分类 -->
    <div class="category-tabs">
      <button 
        v-for="cat in categories" 
        :key="cat.value"
        class="category-tab"
        :class="{ active: filter.type === cat.value }"
        @click="filter.type = cat.value; loadCatalog()"
      >
        <span class="cat-icon">{{ cat.icon }}</span>
        <span>{{ cat.label }}</span>
      </button>
    </div>

    <!-- 商品网格 -->
    <div class="shop-grid" v-if="catalog.length > 0">
      <div v-for="item in catalog" :key="item.id" class="shop-item">
        <div class="item-image">
          <span class="item-icon">{{ item.icon || '🎁' }}</span>
        </div>
        <div class="item-info">
          <div class="item-name">{{ item.name }}</div>
          <div class="item-desc">{{ item.description }}</div>
        </div>
        <div class="item-footer">
          <div class="item-price">
            <span class="price-value">{{ item.lowestPrice || item.base_cost }}</span>
            <span class="price-unit">积分</span>
          </div>
          <button class="buy-btn" @click="openPurchaseModal(item)">兑换</button>
        </div>
      </div>
    </div>

    <div class="empty-state" v-else-if="!loading">
      <div class="empty-icon">🏪</div>
      <p>暂无商品</p>
    </div>

    <div class="loading-state" v-if="loading">
      加载中...
    </div>

    <!-- 统一成员选择器 -->
    <MemberSelector
      v-model:visible="showMemberSelector"
      title="选择兑换成员"
      :action-description="selectedItem ? `兑换「${selectedItem.name}」` : ''"
      action-icon="🛍️"
      confirm-text="确认兑换"
      :required-balance="selectedOfferCost"
      :require-balance="true"
      :loading="purchasing"
      @confirm="handleMemberConfirm"
      @cancel="closeMemberSelector"
    />

    <!-- Offer 选择弹窗（多个 offer 时显示）-->
    <div class="modal-overlay" v-if="showOfferModal" @click.self="closeOfferModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>选择兑换方式</h3>
          <button class="close-btn" @click="closeOfferModal">×</button>
        </div>
        <div class="modal-body" v-if="selectedItem">
          <div class="selected-item">
            <span class="item-icon">{{ selectedItem.icon || '🎁' }}</span>
            <div class="item-details">
              <div class="item-name">{{ selectedItem.name }}</div>
            </div>
          </div>
          
          <div class="form-group">
            <label>选择价格方案</label>
            <div class="offer-list">
              <div 
                v-for="offer in selectedItem.offers" 
                :key="offer.id"
                class="offer-option"
                :class="{ selected: purchaseForm.offerId === offer.id }"
                @click="purchaseForm.offerId = offer.id"
              >
                <div class="offer-cost">{{ offer.cost }} 积分</div>
                <div class="offer-type">{{ getOfferTypeLabel(offer.offer_type) }}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="cancel-btn" @click="closeOfferModal">取消</button>
          <button 
            class="confirm-btn" 
            @click="proceedToMemberSelect"
            :disabled="!purchaseForm.offerId"
          >
            下一步：选择成员
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import MemberSelector from '../../components/MemberSelector.vue';

const loading = ref(false);
const catalog = ref([]);
const selectedItem = ref(null);
const purchasing = ref(false);

// 弹窗状态
const showOfferModal = ref(false);
const showMemberSelector = ref(false);

const filter = ref({
  type: '',
});

const purchaseForm = ref({
  memberId: null,
  offerId: null,
});

const categories = [
  { label: '全部', value: '', icon: '📦' },
  { label: '物品', value: 'item', icon: '🎁' },
  { label: '权限', value: 'permission', icon: '🔓' },
  { label: '服务', value: 'service', icon: '💼' },
  { label: '抽奖券', value: 'ticket', icon: '🎟️' },
];

// 计算选中的 offer 价格
const selectedOfferCost = computed(() => {
  if (!selectedItem.value || !purchaseForm.value.offerId) {
    return selectedItem.value?.lowestPrice || selectedItem.value?.base_cost || 0;
  }
  const offer = selectedItem.value.offers?.find(o => o.id === purchaseForm.value.offerId);
  return offer?.cost || 0;
});

// 加载商品目录
const loadCatalog = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/v2/catalog', {
      params: { type: filter.value.type || undefined }
    });
    
    if (res.data?.code === 200) {
      catalog.value = res.data.data?.skus || [];
    }
  } catch (err) {
    console.error('加载商品失败:', err);
  } finally {
    loading.value = false;
  }
};

// 打开购买流程
const openPurchaseModal = (item) => {
  selectedItem.value = item;
  purchaseForm.value = { memberId: null, offerId: null };
  
  // 如果只有一个 offer，跳过选择直接进入成员选择
  if (item.offers && item.offers.length === 1) {
    purchaseForm.value.offerId = item.offers[0].id;
    showMemberSelector.value = true;
  } else if (item.offers && item.offers.length > 1) {
    // 多个 offer，先选择
    showOfferModal.value = true;
  } else if ((!item.offers || item.offers.length === 0) && item.default_offer_id) {
    // 没有 offers 但有 default_offer_id，使用默认 offer
    purchaseForm.value.offerId = item.default_offer_id;
    showMemberSelector.value = true;
  } else {
    // 没有 offer 且没有 default_offer_id，提示并阻止下单
    alert('该商品未配置价格方案（Offer），请到【市场管理-商品管理】为该商品发布/启用Offer');
    return;
  }
};

// 关闭 Offer 选择弹窗
const closeOfferModal = () => {
  showOfferModal.value = false;
  selectedItem.value = null;
};

// 关闭成员选择器
const closeMemberSelector = () => {
  showMemberSelector.value = false;
  selectedItem.value = null;
  purchaseForm.value = { memberId: null, offerId: null };
};

// 从 Offer 选择进入成员选择
const proceedToMemberSelect = () => {
  if (!purchaseForm.value.offerId) return;
  showOfferModal.value = false;
  showMemberSelector.value = true;
};

// 成员确认后执行购买
const handleMemberConfirm = async ({ memberId }) => {
  purchaseForm.value.memberId = memberId;
  
  purchasing.value = true;
  try {
    const res = await axios.post('/api/v2/orders', {
      buyer_member_id: memberId,
      offer_id: purchaseForm.value.offerId,
      quantity: 1,
      idempotency_key: `buy_${purchaseForm.value.offerId}_${memberId}_${Date.now()}`,
    });
    
    if (res.data?.code === 200) {
      alert('兑换成功！');
      showMemberSelector.value = false;
      selectedItem.value = null;
      purchaseForm.value = { memberId: null, offerId: null };
    }
  } catch (err) {
    alert(err.response?.data?.msg || '兑换失败');
  } finally {
    purchasing.value = false;
  }
};

// 获取 Offer 类型标签
const getOfferTypeLabel = (type) => {
  const labels = {
    normal: '普通',
    mystery_shop: '神秘商店',
    auction: '拍卖',
    promotion: '促销',
  };
  return labels[type] || type;
};

onMounted(() => {
  loadCatalog();
});
</script>

<style scoped>
.market-shop {
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

/* 分类标签 */
.category-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.category-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.category-tab:hover {
  background: rgba(255, 255, 255, 0.1);
}

.category-tab.active {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  border-color: transparent;
}

.cat-icon {
  font-size: 16px;
}

/* 商品网格 */
.shop-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 20px;
}

.shop-item {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  overflow: hidden;
  transition: all 0.3s ease;
}

.shop-item:hover {
  background: rgba(255, 255, 255, 0.08);
  transform: translateY(-4px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
}

.item-image {
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
}

.item-image .item-icon {
  font-size: 56px;
}

.item-info {
  padding: 16px;
}

.item-name {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
}

.item-desc {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.item-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.item-price {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.price-value {
  font-size: 20px;
  font-weight: 700;
  color: #ffd700;
}

.price-unit {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.buy-btn {
  padding: 8px 20px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.buy-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
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
  max-width: 480px;
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

.selected-item .item-price {
  font-size: 14px;
  color: #ffd700;
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

.offer-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.offer-option {
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.offer-option:hover {
  background: rgba(255, 255, 255, 0.1);
}

.offer-option.selected {
  background: rgba(102, 126, 234, 0.2);
  border-color: rgba(102, 126, 234, 0.5);
}

.offer-cost {
  font-size: 14px;
  font-weight: 600;
  color: #ffd700;
}

.offer-type {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
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
  background: linear-gradient(135deg, #667eea, #764ba2);
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
