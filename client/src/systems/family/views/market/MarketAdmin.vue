<template>
  <div class="market-admin h-[calc(100vh-85px)] flex flex-col overflow-hidden bg-[#151520]">
    <nav class="breadcrumb flex-none p-4 bg-[#1a1a2e]">
      <router-link to="/family/market">市场</router-link>
      <span class="separator">/</span>
      <span class="current">市场管理</span>
    </nav>

    <header
      class="page-header flex-none px-6 py-5 bg-[#1a1a2e] border-b border-white/10 flex justify-between items-center shadow-md z-10">
      <div class="header-left">
        <h1 class="text-xl font-bold flex items-center gap-2 text-white">
          <span class="text-2xl">🏪</span> 商品管理
        </h1>
        <p class="text-sm text-gray-400 mt-1">管理 SKU 与 Offer (一键发布模式)</p>
      </div>

      <div class="flex items-center gap-3">
        <router-link to="/family/market/admin/draw" class="quick-btn">🎰 抽奖管理</router-link>
        <router-link to="/family/market/admin/auction" class="quick-btn">🔨 拍卖管理</router-link>

        <div class="h-6 w-px bg-white/10 mx-1"></div>

        <button class="modern-btn primary-blue" @click="openModal()">
          <span class="text-lg leading-none mr-1">+</span> 发布新商品
        </button>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto p-6 custom-scroll">
      <!-- 商品类型筛选 -->
      <div class="category-tabs mb-6">
        <button 
          v-for="cat in categories" 
          :key="cat.value"
          class="category-tab"
          :class="{ active: filterType === cat.value }"
          @click="filterType = cat.value"
        >
          <span class="cat-icon">{{ cat.icon }}</span>
          <span>{{ cat.label }}</span>
        </button>
      </div>

      <div v-if="loading" class="text-center py-20 text-gray-500">加载中...</div>

      <div v-else-if="filteredOffers.length === 0"
        class="flex flex-col items-center justify-center h-full text-gray-500 opacity-60">
        <span class="text-6xl mb-4">🛒</span>
        <p>还没有{{ filterType === 'all' ? '上架任何' : (categories.find(c => c.value === filterType)?.label?.split('(')[0] || '') }}商品，快去发布一个吧！</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <div v-for="item in filteredOffers" :key="item.id"
          class="group relative bg-[#1e1e2d] rounded-2xl border border-white/5 hover:border-white/10 overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1">

          <div class="absolute top-3 right-3 z-10">
            <span v-if="!item.is_active"
              class="px-2 py-1 bg-red-500/20 text-red-300 text-xs rounded-md font-bold border border-red-500/20">已下架</span>
            <span v-else-if="item.quantity <= 0"
              class="px-2 py-1 bg-gray-500/20 text-gray-400 text-xs rounded-md font-bold border border-gray-500/20">售罄</span>
            <span v-else
              class="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded-md font-bold border border-green-500/20">销售中</span>
          </div>

          <div class="p-5">
            <div class="flex items-start gap-4 mb-4">
              <div
                class="w-14 h-14 rounded-2xl bg-[#2a2a3e] flex items-center justify-center text-3xl shadow-inner flex-shrink-0">
                {{ item.sku_icon || '🎁' }}
              </div>
              <div class="min-w-0 flex-1 pt-1">
                <h3 class="font-bold text-lg text-white truncate">{{ item.sku_name }}</h3>
                <div class="text-xs text-gray-400 mt-1 truncate">{{ item.sku_description || '暂无描述' }}</div>
              </div>
            </div>

            <div class="flex items-end justify-between border-t border-white/5 pt-4">
              <div>
                <div class="text-xs text-gray-500 mb-0.5">价格</div>
                <div class="text-xl font-bold text-yellow-400 font-mono">{{ item.cost }} <span
                    class="text-xs text-gray-500">积分</span></div>
              </div>
              <div class="text-right">
                <div class="text-xs text-gray-500 mb-0.5">库存</div>
                <div class="text-sm font-bold text-white">{{ item.quantity > 99 ? '99+' : item.quantity }}</div>
              </div>
            </div>

            <div v-if="item.limit_type && item.limit_type !== 'unlimited'" class="mt-3 flex gap-2">
              <span class="text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20">
                {{ getLimitLabel(item.limit_type, item.limit_max) }}
              </span>
            </div>

            <div class="mt-2 pt-2 border-t border-white/5">
              <div class="text-[10px] text-gray-500">
                <span v-if="item.source === 'system'">系统默认</span>
                <span v-else-if="item.source === 'overridden'">
                  {{ item.is_active ? '已覆盖(自定义)' : '已覆盖(禁用)' }}
                </span>
                <span v-else-if="item.source === 'family'">自定义商品</span>
              </div>
            </div>
          </div>

          <div
            class="absolute inset-0 bg-black/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <button v-if="item.source === 'family'" @click="openModal(item)" class="action-icon-btn" title="编辑">
              ✏️
            </button>
            <button v-if="(item.source === 'system' || item.source === 'overridden') && item.is_active" 
              @click="disableDefaultOffer(item)" 
              class="action-icon-btn action-icon-btn-danger" 
              title="下架">
              🚫
            </button>
            <button v-if="(item.source === 'system' || item.source === 'overridden') && !item.is_active" 
              @click="enableDefaultOffer(item)" 
              class="action-icon-btn action-icon-btn-success" 
              title="恢复">
              ✅
            </button>
            <button v-if="item.source === 'family'" @click="toggleStatus(item)" class="action-icon-btn"
              :class="item.is_active ? 'action-icon-btn-danger' : 'action-icon-btn-success'"
              :title="item.is_active ? '下架' : '上架'">
              {{ item.is_active ? '🚫' : '✅' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-overlay fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
      v-if="showModal" @click.self="closeModal">
      <div
        class="bg-[#1e1e2d] border border-white/10 rounded-2xl w-[90%] max-w-[500px] shadow-2xl overflow-hidden animate-scale-up">

        <div class="px-6 py-4 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
          <h3 class="text-lg font-bold text-white">{{ form.id ? '✏️ 编辑商品' : '✨ 发布新商品' }}</h3>
          <button @click="closeModal" class="modal-close-btn">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scroll">

          <div class="space-y-3">
            <div class="text-xs font-bold text-gray-500 uppercase tracking-wider">📦 基本信息</div>
            <div class="grid grid-cols-5 gap-3">
              <div class="col-span-4">
                <label class="block text-xs text-gray-400 mb-1">商品名称</label>
                <input v-model="form.name"
                  class="w-[calc(100%-20px)] bg-[#252538] border border-white/10 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none"
                  placeholder="如：看电视1小时" />
              </div>
              <div>
                <label class="block text-xs text-gray-400 mb-1">图标</label>
                <input v-model="form.icon"
                  class="w-[calc(100%-20px)] bg-[#252538] border border-white/10 rounded-lg p-2.5 text-center text-white focus:border-blue-500 outline-none"
                  placeholder="📺" />
              </div>
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1">描述 (可选)</label>
              <textarea v-model="form.description" rows="2"
                class="w-[calc(100%-20px)] bg-[#252538] border border-white/10 rounded-lg p-2.5 text-white text-sm focus:border-blue-500 outline-none resize-none"
                placeholder="简短描述这个奖励..."></textarea>
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1">权重 (0-100)</label>
              <input type="number" v-model.number="form.weight_score" min="0" max="100"
                class="w-[calc(100%-20px)] bg-[#252538] border border-white/10 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none"
                placeholder="0" />
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1">商品类型</label>
              <select v-model="form.type"
                class="w-[calc(100%-20px)] bg-[#252538] border border-white/10 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none appearance-none">
                <option value="item">物品 (Item)</option>
                <option value="permission">权限 (Permission)</option>
                <option value="ticket">抽奖券 (Ticket)</option>
              </select>
            </div>
            <!-- Permission 类型专用字段 -->
            <div v-if="form.type === 'permission'" class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs text-gray-400 mb-1">持续时间（分钟）</label>
                <input type="number" v-model.number="form.duration_minutes" min="1"
                  class="w-[calc(100%-20px)] bg-[#252538] border border-white/10 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none"
                  placeholder="如：30" />
              </div>
              <div>
                <label class="block text-xs text-gray-400 mb-1">使用次数</label>
                <input type="number" v-model.number="form.uses" min="1"
                  class="w-[calc(100%-20px)] bg-[#252538] border border-white/10 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none"
                  placeholder="如：1" />
              </div>
              <div class="col-span-2 text-xs text-gray-500">
                ⚠️ 权限商品必须填写“持续时间”或“使用次数”至少一个
              </div>
            </div>
          </div>

          <div class="space-y-3 pt-2 border-t border-white/5">
            <div class="text-xs font-bold text-gray-500 uppercase tracking-wider">💰 售卖规则</div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs text-gray-400 mb-1">价格 (积分)</label>
                <input type="number" v-model.number="form.cost"
                  class="w-[calc(100%-20px)] bg-[#252538] border border-white/10 rounded-lg p-2.5 text-white font-mono font-bold focus:border-yellow-500 outline-none" />
              </div>
              <div>
                <label class="block text-xs text-gray-400 mb-1">库存数量</label>
                <input type="number" v-model.number="form.quantity"
                  class="w-[calc(100%-20px)] bg-[#252538] border border-white/10 rounded-lg p-2.5 text-white font-mono focus:border-blue-500 outline-none" />
              </div>
            </div>
          </div>

          <div class="space-y-3 pt-2 border-t border-white/5">
            <div class="text-xs font-bold text-gray-500 uppercase tracking-wider">⛔️ 限制规则</div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs text-gray-400 mb-1">限购周期</label>
                <select v-model="form.limit_type"
                  class="w-[calc(100%-20px)] bg-[#252538] border border-white/10 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none appearance-none">
                  <option value="unlimited">无限制</option>
                  <option value="daily">每天 (Daily)</option>
                  <option value="weekly">每周 (Weekly)</option>
                  <option value="monthly">每月 (Monthly)</option>
                </select>
              </div>
              <div v-if="form.limit_type !== 'unlimited'">
                <label class="block text-xs text-gray-400 mb-1">限购次数</label>
                <input type="number" v-model.number="form.limit_max"
                  class="w-[calc(100%-20px)] bg-[#252538] border border-white/10 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none" />
              </div>
            </div>
          </div>

        </div>

        <div class="p-4 border-t border-white/5 bg-[#1a1a2e] flex gap-3">
          <button @click="closeModal" class="modern-btn neutral flex-1">
            取消
          </button>
          <button @click="submit" :disabled="submitting" class="modern-btn primary-blue flex-[2]">
            <span v-if="submitting" class="flex items-center justify-center gap-2">
              <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              保存中...
            </span>
            <span v-else>确认保存</span>
          </button>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import { ElMessage, ElMessageBox } from 'element-plus';

const loading = ref(false);
const submitting = ref(false);
const products = ref([]);
const showModal = ref(false);
const filterType = ref('all'); // 筛选类型：all/item/permission/ticket

// 统一表单：合并了 SKU 和 Offer 的字段
const form = ref({
  id: null, // Offer ID
  name: '', // SKU Name
  icon: '🎁', // SKU Icon
  description: '', // SKU Desc
  type: 'item', // SKU Type: item/permission/ticket
  weight_score: 0, // SKU Weight Score (0-100)
  duration_minutes: null, // Permission: 持续时间（分钟）
  uses: null, // Permission: 使用次数
  cost: 100, // Offer Cost
  quantity: 999, // Offer Qty
  limit_type: 'unlimited', // SKU Limit
  limit_max: 1, // SKU Limit Max
  is_active: true
});

// 商品类型分类配置（与奖励商城一致）
const categories = computed(() => {
  // 归一化类型：service -> permission
  const itemCount = products.value.filter(p => {
    const type = p.sku_type === 'service' ? 'permission' : (p.sku_type || p.type || 'item');
    return type === 'item';
  }).length;
  const permissionCount = products.value.filter(p => {
    const type = p.sku_type === 'service' ? 'permission' : (p.sku_type || p.type || 'item');
    return type === 'permission';
  }).length;
  const ticketCount = products.value.filter(p => {
    const type = p.sku_type === 'service' ? 'permission' : (p.sku_type || p.type || 'item');
    return type === 'ticket';
  }).length;
  
  return [
    { label: '全部', value: 'all', icon: '📦' },
    { label: `物品(${itemCount})`, value: 'item', icon: '🎁' },
    { label: `权限(${permissionCount})`, value: 'permission', icon: '🔓' },
    { label: `抽奖券(${ticketCount})`, value: 'ticket', icon: '🎟️' },
  ];
});

// 筛选后的商品列表
const filteredOffers = computed(() => {
  if (filterType.value === 'all') {
    return products.value;
  }
  // 归一化类型：service -> permission
  return products.value.filter(item => {
    const itemType = item.sku_type === 'service' ? 'permission' : (item.sku_type || item.type);
    return itemType === filterType.value;
  });
});

const loadProducts = async () => {
  loading.value = true;
  try {
    // 使用 admin 接口获取家庭的所有 Offer
    const res = await axios.get('/api/v2/admin/offers');
    if (res.data?.code === 200) {
      products.value = res.data.data?.offers || [];
    }
  } catch (err) {
    ElMessage.error('加载商品失败');
  } finally {
    loading.value = false;
  }
};

const openModal = (item = null) => {
  if (item) {
    // 编辑模式：回填数据
    // 若编辑回填遇到 sku_type==='service'，强制映射为 'permission'
    let skuType = item.sku_type || 'item';
    if (skuType === 'service') {
      skuType = 'permission';
    }
    form.value = {
      id: item.id,
      name: item.sku_name,
      // 如果后端没返回 icon，这里会是 undefined，前端模板里有 fallback
      icon: item.sku_icon || '🎁',
      description: item.sku_description || '',
      type: skuType,
      weight_score: item.sku_weight_score ?? 0,
      duration_minutes: item.sku_duration_minutes || null,
      uses: item.sku_uses || null,
      cost: item.cost,
      quantity: item.quantity,
      limit_type: item.limit_type || 'unlimited',
      limit_max: item.limit_max || 1,
      is_active: item.is_active
    };
  } else {
    // 新建模式：重置
    form.value = {
      id: null,
      name: '',
      icon: '🎁',
      description: '',
      type: 'item', // 默认值
      weight_score: 0,
      duration_minutes: null,
      uses: null,
      cost: 100,
      quantity: 999,
      limit_type: 'unlimited',
      limit_max: 1,
      is_active: true
    };
  }
  showModal.value = true;
};

const closeModal = () => showModal.value = false;

const submit = async () => {
  if (!form.value.name) return ElMessage.warning('请输入商品名称');
  if (form.value.cost < 0) return ElMessage.warning('价格不能为负');
  if (form.value.weight_score < 0 || form.value.weight_score > 100) {
    return ElMessage.warning('权重必须在 0-100 之间');
  }
  
  // Permission 类型校验：必须包含 duration_minutes 或 uses 至少一个
  if (form.value.type === 'permission') {
    if ((!form.value.duration_minutes || form.value.duration_minutes <= 0) 
        && (!form.value.uses || form.value.uses <= 0)) {
      return ElMessage.warning('权限商品必须填写“持续时间”或“使用次数”至少一个');
    }
  }

  submitting.value = true;
  try {
    if (form.value.id) {
      // 🟢 更新：调用一键更新接口
      await axios.put(`/api/v2/admin/quick-update/${form.value.id}`, form.value);
      ElMessage.success('更新成功');
    } else {
      // 🟢 新增：调用一键发布接口
      await axios.post('/api/v2/admin/quick-publish', form.value);
      ElMessage.success('发布成功');
    }
    closeModal();
    loadProducts();
  } catch (err) {
    ElMessage.error(err.response?.data?.msg || '操作失败');
  } finally {
    submitting.value = false;
  }
};

const toggleStatus = async (item) => {
  try {
    // 简单更新状态，复用 quick-update 接口
    const newStatus = !item.is_active;
    // 若遇到 service 类型，强制映射为 permission
    let skuType = item.sku_type || 'item';
    if (skuType === 'service') {
      skuType = 'permission';
    }
    await axios.put(`/api/v2/admin/quick-update/${item.id}`, {
      ...item, // 补全字段
      name: item.sku_name,
      icon: item.sku_icon,
      type: skuType, // 必须传，否则后端可能写回默认类型
      cost: item.cost,
      quantity: item.quantity,
      limit_type: item.limit_type,
      limit_max: item.limit_max,
      // 上下架/快捷更新时补齐 duration_minutes 与 uses：从当前行 item 上读取并带上（即使不修改也带上），避免后端收到缺失字段
      duration_minutes: item.sku_duration_minutes || null,
      uses: item.sku_uses || null,
      is_active: newStatus
    });
    item.is_active = newStatus; // 乐观更新
    ElMessage.success(newStatus ? '已上架' : '已下架');
  } catch (err) {
    ElMessage.error('操作失败');
    loadProducts(); // 失败还原
  }
};

const disableDefaultOffer = async (item) => {
  try {
    await ElMessageBox.confirm('确定要下架这个系统默认商品吗？下架后该商品将不会在商城中显示。', '确认下架', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    });
    await axios.post(`/api/v2/admin/offers/${item.id}/disable_default`);
    ElMessage.success('已下架');
    loadProducts();
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err.response?.data?.msg || '下架失败');
    }
  }
};

const enableDefaultOffer = async (item) => {
  try {
    await axios.post(`/api/v2/admin/offers/${item.id}/enable_default`);
    ElMessage.success('已恢复');
    loadProducts();
  } catch (err) {
    ElMessage.error(err.response?.data?.msg || '恢复失败');
  }
};

const getLimitLabel = (type, max) => {
  const map = { daily: '每日', weekly: '每周', monthly: '每月' };
  return `${map[type] || type}限购 ${max} 次`;
};

onMounted(loadProducts);
</script>

<style scoped>
/* 原有的样式保留，增加新的样式 */
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

.breadcrumb .current {
  color: #fff;
}

/* Quick Btn 样式，用于头部右侧链接 */
.quick-btn {
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  font-size: 12px;
  color: #fff;
  text-decoration: none;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.2s;
}

.quick-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
}

/* 滚动条美化 */
.custom-scroll::-webkit-scrollbar {
  width: 6px;
}

.custom-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.custom-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

@keyframes scale-up {
  from {
    transform: scale(0.95);
    opacity: 0;
  }

  to {
    transform: scale(1);
    opacity: 1;
  }
}

.animate-scale-up {
  animation: scale-up 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

/* 统一按钮样式 */
.modern-btn {
  padding: 10px 20px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  border: 1px solid transparent;
}

.modern-btn:hover {
  transform: translateY(-2px);
  filter: brightness(1.1);
}

.modern-btn:active {
  transform: translateY(0);
}

.modern-btn.primary-blue {
  color: #fff;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border-color: rgba(59, 130, 246, 0.5);
  box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);
}

.modern-btn.neutral {
  color: #9ca3af;
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
}

.modern-btn.neutral:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.2);
}

.modern-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
}

/* 操作图标按钮（卡片hover时显示） */
.action-icon-btn {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(8px);
}

.action-icon-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

.action-icon-btn-danger {
  color: #fca5a5;
}

.action-icon-btn-danger:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.3);
  color: #fee2e2;
}

.action-icon-btn-success {
  color: #86efac;
}

.action-icon-btn-success:hover {
  background: rgba(34, 197, 94, 0.2);
  border-color: rgba(34, 197, 94, 0.3);
  color: #dcfce7;
}

/* 弹窗关闭按钮 */
.modal-close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: #fff;
  transform: scale(1.05);
}

.modal-close-btn:active {
  transform: scale(0.95);
}

/* 分类标签（与奖励商城一致） */
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
</style>