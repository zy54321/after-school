<template>
  <div class="market-admin h-[calc(100vh-64px)] flex flex-col overflow-hidden">
    <nav class="breadcrumb flex-none p-4 bg-[#1a1a2e]">
      <router-link to="/family/market">市场</router-link>
      <span class="separator">/</span>
      <span class="current">市场管理</span>
    </nav>

    <header
      class="page-header flex-none px-4 pb-4 bg-[#1a1a2e] border-b border-white/10 flex justify-between items-center">
      <div class="header-left">
        <h1 class="text-xl font-bold flex items-center gap-2">
          <span class="header-icon">🧩</span> 市场管理
        </h1>
        <p class="text-sm text-gray-400 m-0">管理 SKU 与 Offer</p>
      </div>
      <div class="flex gap-2">
        <router-link to="/family/market/admin/draw" class="quick-btn">🎰 抽奖管理</router-link>
        <router-link to="/family/market/admin/auction" class="quick-btn">🔨 拍卖管理</router-link>
      </div>
    </header>

    <div class="flex flex-1 overflow-hidden p-4 gap-4">

      <div class="flex flex-col w-2/5 bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <div class="p-3 border-b border-white/10 flex justify-between items-center bg-white/5">
          <h2 class="text-lg font-bold m-0">📦 SKU 库</h2>
          <button class="primary-btn text-xs px-2 py-1" @click="openSkuModal()">+ 新建</button>
        </div>

        <div class="flex-1 overflow-y-auto p-2 space-y-2">
          <div v-if="skus.length === 0" class="text-center text-gray-500 py-4">暂无 SKU</div>
          <div v-for="sku in skus" :key="sku.id"
            class="p-3 rounded bg-white/5 hover:bg-white/10 border border-transparent hover:border-blue-500/50 transition-all cursor-pointer group"
            @click="openSkuModal(sku)">
            <div class="flex justify-between items-start mb-1">
              <span class="font-bold text-sm">{{ sku.name }}</span>
              <span class="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">{{ sku.type }}</span>
            </div>
            <div class="text-xs text-gray-400 flex justify-between items-center">
              <span>💰 基价: {{ sku.base_cost }}</span>
              <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button class="text-blue-300 hover:text-blue-200" @click.stop="openSkuModal(sku)">编辑</button>
                <button class="text-red-300 hover:text-red-200" @click.stop="deactivateSku(sku)">停用</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex flex-col w-3/5 bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <div class="p-3 border-b border-white/10 flex justify-between items-center bg-white/5">
          <h2 class="text-lg font-bold m-0">🏷️ 上架商品 (Offers)</h2>
          <button class="primary-btn text-xs px-2 py-1" @click="openOfferModal()">+ 新建</button>
        </div>

        <div class="flex-1 overflow-y-auto p-2 space-y-2">
          <div v-if="offers.length === 0" class="text-center text-gray-500 py-4">暂无 Offer</div>
          <div v-for="offer in offers" :key="offer.id"
            class="p-3 rounded bg-white/5 border border-white/10 flex items-center justify-between hover:bg-white/10 transition-colors">
            <div class="flex-1 min-w-0 mr-4">
              <div class="font-bold text-base truncate">{{ offer.sku_name }}</div>
              <div class="text-xs text-gray-400 mt-1">
                有效期: {{ formatDateRange(offer.valid_from, offer.valid_until) }}
              </div>
            </div>
            <div class="text-right mr-4 flex-shrink-0">
              <div class="text-lg font-bold text-yellow-400">{{ offer.cost }} <span
                  class="text-xs text-gray-500">分</span></div>
              <div class="text-xs text-gray-400">数量: {{ offer.quantity }}</div>
            </div>
            <div class="flex gap-2 flex-shrink-0">
              <button class="text-blue-300 p-1 hover:bg-white/10 rounded" @click="openOfferModal(offer)">✏️</button>
              <button class="text-red-300 p-1 hover:bg-white/10 rounded" @click="deactivateOffer(offer)">🚫</button>
            </div>
          </div>
        </div>
      </div>

    </div>

    <div class="modal-overlay" v-if="showSkuModal" @click.self="closeSkuModal">
      <div class="modal-content">
        <h3>{{ skuForm.id ? '编辑 SKU' : '新建 SKU' }}</h3>
        <div class="form-group">
          <label>名称</label>
          <input v-model="skuForm.name" />
        </div>
        <div class="form-group">
          <label>描述</label>
          <textarea v-model="skuForm.description" rows="2"></textarea>
        </div>
        <div class="form-group">
          <label>图标</label>
          <input v-model="skuForm.icon" placeholder="🎁" />
        </div>
        <div class="form-group">
          <label>类型</label>
          <select v-model="skuForm.type">
            <option value="reward">reward</option>
            <option value="auction">auction</option>
            <option value="ticket">ticket</option>
            <option value="item">item</option>
            <option value="permission">permission</option>
            <option value="service">service</option>
          </select>
        </div>
        <div class="form-group">
          <label>来源类型</label>
          <select v-model="skuForm.source_type">
            <option value="custom">custom</option>
            <option value="item">item</option>
            <option value="permission">permission</option>
            <option value="service">service</option>
            <option value="ticket_type">ticket_type</option>
          </select>
        </div>
        <div class="form-group" v-if="skuForm.source_type === 'ticket_type' || skuForm.type === 'ticket'">
          <label>关联抽奖券类型</label>
          <select v-model.number="skuForm.ticket_type_id">
            <option :value="null">无</option>
            <option v-for="t in ticketTypes" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>基础价格</label>
          <input type="number" v-model.number="skuForm.base_cost" />
        </div>
        <div class="form-group">
          <label>限制类型</label>
          <select v-model="skuForm.limit_type">
            <option value="unlimited">unlimited</option>
            <option value="daily">daily</option>
            <option value="weekly">weekly</option>
            <option value="monthly">monthly</option>
          </select>
        </div>
        <div class="form-group">
          <label>限制次数</label>
          <input type="number" v-model.number="skuForm.limit_max" />
        </div>
        <div class="form-group">
          <label>目标成员（ID逗号分隔，可选）</label>
          <input v-model="skuForm.target_members_text" placeholder="1,2,3" />
        </div>
        <div class="form-group">
          <label>状态</label>
          <select v-model="skuForm.is_active">
            <option :value="true">启用</option>
            <option :value="false">停用</option>
          </select>
        </div>
        <div class="modal-actions">
          <button class="cancel-btn" @click="closeSkuModal">取消</button>
          <button class="confirm-btn" @click="submitSku" :disabled="saving">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" v-if="showOfferModal" @click.self="closeOfferModal">
      <div class="modal-content">
        <h3>{{ offerForm.id ? '编辑 Offer' : '新建 Offer' }}</h3>
        <div class="form-group">
          <label>SKU</label>
          <select v-model.number="offerForm.sku_id">
            <option v-for="sku in allSkus" :key="sku.id" :value="sku.id">
              {{ sku.name }} ({{ sku.type }})
            </option>
          </select>
        </div>
        <div class="form-group">
          <label>价格</label>
          <input type="number" v-model.number="offerForm.cost" />
        </div>
        <div class="form-group">
          <label>数量</label>
          <input type="number" v-model.number="offerForm.quantity" />
        </div>
        <div class="form-group">
          <label>生效时间</label>
          <input type="datetime-local" v-model="offerForm.valid_from" />
        </div>
        <div class="form-group">
          <label>失效时间</label>
          <input type="datetime-local" v-model="offerForm.valid_until" />
        </div>
        <div class="form-group">
          <label>状态</label>
          <select v-model="offerForm.is_active">
            <option :value="true">启用</option>
            <option :value="false">停用</option>
          </select>
        </div>
        <div class="modal-actions">
          <button class="cancel-btn" @click="closeOfferModal">取消</button>
          <button class="confirm-btn" @click="submitOffer" :disabled="saving">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const loading = ref(false);
const saving = ref(false);
const skus = ref([]);
const offers = ref([]);
const allSkus = ref([]);
const ticketTypes = ref([]);

const showSkuModal = ref(false);
const showOfferModal = ref(false);

const skuForm = ref({
  id: null,
  name: '',
  description: '',
  icon: '',
  type: 'reward',
  source_type: 'custom',
  ticket_type_id: null,
  base_cost: 0,
  limit_type: 'unlimited',
  limit_max: 0,
  target_members_text: '',
  is_active: true,
});

const offerForm = ref({
  id: null,
  sku_id: null,
  cost: 0,
  quantity: 1,
  valid_from: '',
  valid_until: '',
  is_active: true,
});

const loadSkus = async () => {
  const res = await axios.get('/api/v2/admin/skus');
  if (res.data?.code === 200) {
    skus.value = res.data.data?.skus || [];
  }
};

const loadOffers = async () => {
  const res = await axios.get('/api/v2/admin/offers');
  if (res.data?.code === 200) {
    offers.value = res.data.data?.offers || [];
  }
};

const loadAllSkus = async () => {
  const res = await axios.get('/api/v2/skus');
  if (res.data?.code === 200) {
    allSkus.value = res.data.data?.skus || [];
  }
};

const loadTicketTypes = async () => {
  const res = await axios.get('/api/v2/draw/overview');
  if (res.data?.code === 200) {
    ticketTypes.value = res.data.data?.ticketTypes || [];
  }
};

const refresh = async () => {
  loading.value = true;
  try {
    await Promise.all([loadSkus(), loadOffers(), loadAllSkus(), loadTicketTypes()]);
  } finally {
    loading.value = false;
  }
};

const openSkuModal = (sku = null) => {
  if (sku) {
    const linkedTicket = ticketTypes.value.find((t) => t.sku_id === sku.id);
    skuForm.value = {
      id: sku.id,
      name: sku.name,
      description: sku.description || '',
      icon: sku.icon || '',
      type: sku.type || 'reward',
      source_type: sku.source_type || 'custom',
      ticket_type_id: linkedTicket?.id || (sku.source_type === 'ticket_type' ? sku.source_id : null),
      base_cost: sku.base_cost || 0,
      limit_type: sku.limit_type || 'unlimited',
      limit_max: sku.limit_max || 0,
      target_members_text: sku.target_members ? sku.target_members.join(',') : '',
      is_active: sku.is_active !== false,
    };
  } else {
    skuForm.value = {
      id: null,
      name: '',
      description: '',
      icon: '',
      type: 'reward',
      source_type: 'custom',
      ticket_type_id: null,
      base_cost: 0,
      limit_type: 'unlimited',
      limit_max: 0,
      target_members_text: '',
      is_active: true,
    };
  }
  showSkuModal.value = true;
};

const closeSkuModal = () => {
  showSkuModal.value = false;
};

const submitSku = async () => {
  saving.value = true;
  try {
    const resolvedSourceType = skuForm.value.ticket_type_id ? 'ticket_type' : skuForm.value.source_type;
    const payload = {
      name: skuForm.value.name,
      description: skuForm.value.description || undefined,
      icon: skuForm.value.icon || undefined,
      type: skuForm.value.type,
      source_type: resolvedSourceType,
      source_id: resolvedSourceType === 'ticket_type' ? skuForm.value.ticket_type_id : null,
      ticket_type_id: skuForm.value.ticket_type_id || null,
      base_cost: skuForm.value.base_cost,
      limit_type: skuForm.value.limit_type,
      limit_max: skuForm.value.limit_max,
      target_members: skuForm.value.target_members_text
        ? skuForm.value.target_members_text.split(',').map(v => parseInt(v.trim())).filter(Boolean)
        : null,
      is_active: skuForm.value.is_active,
    };

    if (skuForm.value.id) {
      await axios.put(`/api/v2/skus/${skuForm.value.id}`, payload);
    } else {
      await axios.post('/api/v2/skus', payload);
    }
    closeSkuModal();
    await refresh();
  } finally {
    saving.value = false;
  }
};

const deactivateSku = async (sku) => {
  await axios.delete(`/api/v2/skus/${sku.id}`);
  await refresh();
};

const openOfferModal = (offer = null) => {
  if (offer) {
    offerForm.value = {
      id: offer.id,
      sku_id: offer.sku_id,
      cost: offer.cost,
      quantity: offer.quantity,
      valid_from: offer.valid_from ? offer.valid_from.slice(0, 16) : '',
      valid_until: offer.valid_until ? offer.valid_until.slice(0, 16) : '',
      is_active: offer.is_active !== false,
    };
  } else {
    offerForm.value = {
      id: null,
      sku_id: allSkus.value[0]?.id || null,
      cost: 0,
      quantity: 1,
      valid_from: '',
      valid_until: '',
      is_active: true,
    };
  }
  showOfferModal.value = true;
};

const closeOfferModal = () => {
  showOfferModal.value = false;
};

const submitOffer = async () => {
  if (!offerForm.value.sku_id) return;
  saving.value = true;
  try {
    const payload = {
      sku_id: offerForm.value.sku_id,
      cost: offerForm.value.cost,
      quantity: offerForm.value.quantity,
      valid_from: offerForm.value.valid_from || undefined,
      valid_until: offerForm.value.valid_until || undefined,
      is_active: offerForm.value.is_active,
    };

    if (offerForm.value.id) {
      await axios.put(`/api/v2/offers/${offerForm.value.id}`, payload);
    } else {
      await axios.post('/api/v2/offers', payload);
    }
    closeOfferModal();
    await refresh();
  } finally {
    saving.value = false;
  }
};

const deactivateOffer = async (offer) => {
  await axios.delete(`/api/v2/offers/${offer.id}`);
  await refresh();
};

const formatDateRange = (from, until) => {
  const start = from ? new Date(from).toLocaleDateString('zh-CN') : '即时';
  const end = until ? new Date(until).toLocaleDateString('zh-CN') : '永久';
  return `${start} ~ ${end}`;
};

const formatOfferSource = (offer) => {
  const type = offer.offer_type || 'market';
  const map = {
    market: '奖励商城',
    mystery_shop: '神秘商店',
    auction: '拍卖',
    lottery: '抽奖',
  };
  return map[type] || type;
};

onMounted(() => {
  refresh();
});

const formatSourceLabel = (sku) => {
  if (sku.parent_id === 0) {
    return '系统';
  }
  if (sku.source_type === 'ticket_type') {
    const ticket = ticketTypes.value.find((t) => t.id === sku.source_id || t.sku_id === sku.id);
    return ticket ? `ticket_type: ${ticket.name}` : 'ticket_type';
  }
  return sku.source_type || 'custom';
};
</script>

<style scoped>
.market-admin {
  color: #fff;
}

.breadcrumb {
  font-size: 14px;
}

.breadcrumb a {
  color: rgba(255, 255, 255, 0.6);
  text-decoration: none;
}

.breadcrumb .separator {
  margin: 0 8px;
  color: rgba(255, 255, 255, 0.4);
}

.quick-btn {
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  font-size: 12px;
  color: #fff;
  text-decoration: none;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.quick-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.primary-btn {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

/* 弹窗样式复用原有的即可，以下为必须的基础样式 */
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
  max-width: 480px;
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

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 8px;
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

.cancel-btn {
  flex: 1;
  padding: 10px;
  border-radius: 8px;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  cursor: pointer;
}

.confirm-btn {
  flex: 1;
  padding: 10px;
  border-radius: 8px;
  border: none;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}

/* 滚动条美化 */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}
</style>
