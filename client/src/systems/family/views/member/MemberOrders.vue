<template>
  <div class="member-wallet-view h-full flex flex-col p-6 pt-4 box-border">
    <section
      class="wallet-section flex-1 flex flex-col min-h-0 bg-[#151520] rounded-2xl border border-white/5 overflow-hidden">

      <div class="flex justify-between items-center p-3 border-b border-white/5 bg-[#1a1a2e] flex-none">
        <h2 class="text-base font-bold flex items-center gap-2 text-white">
          <span>📦</span> 订单记录
        </h2>
        <div class="relative">
          <select v-model="filter.status" @change="loadOrders"
            class="filter-select appearance-none pl-3 pr-8 py-1 bg-[#252538] border border-white/10 rounded-lg text-xs text-gray-300 focus:border-blue-500 focus:outline-none transition-colors cursor-pointer hover:bg-[#2a2a40]">
            <option value="">全部状态</option>
            <option value="paid">已支付</option>
            <option value="pending">待处理</option>
            <option value="refunded">已退款</option>
          </select>
          <div class="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 text-xs">▼</div>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto custom-scroll p-3">
        <div class="text-center py-10 text-gray-500" v-if="loading">加载中...</div>

        <div v-if="!loading && orders.length > 0">
          <div v-for="order in orders" :key="order.id"
            class="log-item mb-1.5 flex items-center gap-3 px-3 py-2.5 bg-[#252538] rounded-xl border border-white/5 group relative overflow-hidden transition-all hover:bg-[#2a2a40] hover:border-white/10 hover:shadow-md">

            <div class="log-icon w-8 h-8 rounded-full flex-none flex items-center justify-center text-sm shadow-inner bg-white/5 text-gray-200">
              {{ order.sku_icon || '🎁' }}
            </div>

            <div class="log-content flex-1 min-w-0 flex flex-col justify-center">
              <div class="text-[14px] font-bold text-gray-100 truncate pr-2 leading-tight">{{ order.sku_name }}</div>
              <div class="flex gap-2 mt-0.5 items-center">
                <span class="text-[10px] text-gray-500 font-mono">订单 #{{ order.id }} · 数量 x{{ order.quantity }}</span>
                <span class="text-[10px] text-gray-500 font-mono">{{ formatTime(order.created_at) }}</span>
                <span class="text-[9px] px-1.5 py-0 rounded-full bg-white/5 text-gray-400 border border-white/5">
                  {{ getStatusLabel(order.status) }}
                </span>
              </div>
            </div>

            <div class="flex flex-col items-end gap-1 flex-none justify-center">
              <div class="font-bold text-base tabular-nums tracking-tight leading-none text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-rose-500">
                -{{ order.cost }}
              </div>
            </div>
          </div>
        </div>

        <div class="h-full flex flex-col items-center justify-center text-gray-500 pb-10" v-else-if="!loading && orders.length === 0">
          <div class="text-4xl mb-3 opacity-30">📦</div>
          <div class="text-sm">暂无订单</div>
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
const orders = ref([]);
const loading = ref(false);
const filter = ref({ status: '' });
const currentMemberId = computed(() => parseInt(route.params.id));

const loadOrders = async () => {
  if (!currentMemberId.value) return;
  loading.value = true;
  try {
    const res = await axios.get('/api/v2/orders', {
      params: { member_id: currentMemberId.value, status: filter.value.status || undefined }
    });
    if (res.data?.code === 200) {
      orders.value = res.data.data?.orders || [];
    }
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
};

const formatTime = (t) => new Date(t).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const getStatusLabel = (s) => {
  const statusMap = { 
    pending: '待处理', 
    paid: '已支付', 
    fulfilled: '已完成', 
    refunded: '已退款' 
  };
  return statusMap[s] || s;
};

watch(() => route.params.id, (newId) => {
  if (newId) loadOrders();
}, { immediate: true });
</script>

<style scoped>
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
