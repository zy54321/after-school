<template>
  <div class="member-wallet-view h-full flex flex-col p-6 pt-4 box-border">
    <section
      class="wallet-section flex-1 flex flex-col min-h-0 bg-[#151520] rounded-2xl border border-white/5 overflow-hidden">

      <div class="flex justify-between items-center p-3 border-b border-white/5 bg-[#1a1a2e] flex-none">
        <h2 class="text-base font-bold flex items-center gap-2 text-white">
          <span>🎒</span> 我的背包
        </h2>
        <div class="relative">
          <select v-model="filter.status" @change="loadInventory"
            class="filter-select appearance-none pl-3 pr-8 py-1 bg-[#252538] border border-white/10 rounded-lg text-xs text-gray-300 focus:border-blue-500 focus:outline-none transition-colors cursor-pointer hover:bg-[#2a2a40]">
            <option value="">全部</option>
            <option value="unused">可用</option>
            <option value="used">已用</option>
            <option value="expired">过期</option>
          </select>
          <div class="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 text-xs">▼</div>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto custom-scroll p-3">
        <div class="text-center py-10 text-gray-500" v-if="loading">加载中...</div>

        <div v-if="!loading && items.length > 0">
          <div v-for="item in items" :key="item.id"
            class="log-item mb-1.5 flex items-center gap-3 px-3 py-2.5 bg-[#252538] rounded-xl border border-white/5 group overflow-hidden transition-all hover:bg-[#2a2a40] hover:border-white/10 hover:shadow-md"
            :class="{ 'opacity-60': item.status !== 'unused' }">

            <div class="log-icon w-8 h-8 rounded-full flex-none flex items-center justify-center text-sm shadow-inner bg-white/5 text-gray-200">
              {{ item.sku_icon || '🎁' }}
            </div>

            <div class="log-content flex-1 min-w-0 flex flex-col justify-center">
              <div class="text-[14px] font-bold text-gray-100 truncate pr-2 leading-tight">{{ item.sku_name }}</div>
              <div class="flex gap-2 mt-0.5 items-center">
                <span class="text-[10px] text-gray-500 font-mono">x{{ item.quantity }}</span>
                <span v-if="item.created_at || item.updated_at" class="text-[10px] text-gray-500 font-mono">
                  {{ formatTime(item.updated_at || item.created_at) }}
                </span>
                <span class="text-[9px] px-1.5 py-0 rounded-full bg-white/5 text-gray-400 border border-white/5">
                  {{ getStatusLabel(item.status) }}
                </span>
              </div>
            </div>

            <div class="flex flex-col items-end gap-1 flex-none justify-center">
              <button v-if="item.status === 'unused' && item.quantity > 0"
                class="modern-btn small primary-blue"
                @click="useItem(item)">
                使用
              </button>
            </div>
          </div>
        </div>

        <div class="h-full flex flex-col items-center justify-center text-gray-500 pb-10" v-else-if="!loading && items.length === 0">
          <div class="text-4xl mb-3 opacity-30">🎒</div>
          <div class="text-sm mb-3">背包空空如也</div>
          <router-link to="/family/market/shop"
            class="w-auto px-4 py-2 bg-white/5 border border-white/5 rounded-lg text-xs text-gray-400 hover:bg-white/10 hover:text-white transition-all">
            去商城逛逛
          </router-link>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';

const route = useRoute();
const items = ref([]);
const loading = ref(false);
const filter = ref({ status: '' });

const currentMemberId = computed(() => parseInt(route.params.id));

const loadInventory = async () => {
  if (!currentMemberId.value) return;
  loading.value = true;
  try {
    const res = await axios.get('/api/v2/inventory', {
      params: { member_id: currentMemberId.value, status: filter.value.status || undefined }
    });
    if (res.data?.code === 200) {
      items.value = res.data.data?.items || [];
    }
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
};

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

const getStatusLabel = (s) => ({ unused: '可用', used: '已用', expired: '过期' }[s] || s);

const formatTime = (t) => {
  if (!t) return '';
  return new Date(t).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

watch(() => route.params.id, (newId) => {
  if (newId) loadInventory();
}, { immediate: true });
</script>

<style scoped>
.modern-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  border-radius: 10px;
  border: 1px solid transparent;
  transition: all 0.2s ease;
  cursor: pointer;
  outline: none;
}

.modern-btn:hover {
  transform: translateY(-1px);
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

.modern-btn.small {
  padding: 6px 12px;
  font-size: 12px;
  border-radius: 8px;
}

.filter-select {
  outline: none;
}

.custom-scroll {
  overflow-x: hidden;
}

.custom-scroll::-webkit-scrollbar {
  width: 4px;
}

.custom-scroll::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.02);
}

.custom-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.custom-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
