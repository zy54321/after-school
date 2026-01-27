<template>
  <div class="member-orders-view h-full flex flex-col">
    <div class="mb-4 flex justify-between items-center">
      <h2 class="font-bold text-lg">我的订单</h2>
      <select v-model="filter.status" @change="loadOrders"
        class="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm text-white">
        <option value="">全部状态</option>
        <option value="paid">已支付</option>
        <option value="pending">待处理</option>
        <option value="refunded">已退款</option>
      </select>
    </div>

    <div class="orders-list space-y-3 overflow-y-auto pb-4" v-if="orders.length > 0">
      <div v-for="order in orders" :key="order.id" class="bg-white/5 rounded-xl border border-white/5 overflow-hidden">
        <div class="px-4 py-2 bg-white/5 flex justify-between items-center text-xs text-gray-400">
          <span>订单 #{{ order.id }}</span>
          <span class="px-2 py-0.5 rounded" :class="{
            'bg-green-500/20 text-green-400': order.status === 'paid' || order.status === 'fulfilled',
            'bg-yellow-500/20 text-yellow-400': order.status === 'pending',
            'bg-red-500/20 text-red-400': order.status === 'refunded'
          }">{{ getStatusLabel(order.status) }}</span>
        </div>
        <div class="p-4 flex items-center gap-4">
          <div class="text-3xl">{{ order.sku_icon || '🎁' }}</div>
          <div class="flex-1">
            <div class="font-bold">{{ order.sku_name }}</div>
            <div class="text-xs text-gray-500">数量: {{ order.quantity }}</div>
          </div>
          <div class="font-bold text-red-400">-{{ order.cost }} 分</div>
        </div>
        <div class="px-4 py-2 border-t border-white/5 text-xs text-gray-500 text-right">
          {{ formatTime(order.created_at) }}
        </div>
      </div>
    </div>

    <div class="empty-state py-20 text-center text-gray-500" v-else-if="!loading">
      <div class="text-5xl mb-4">📦</div>
      <p>暂无订单</p>
    </div>
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
  } finally {
    loading.value = false;
  }
};

const formatTime = (t) => new Date(t).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const getStatusLabel = (s) => ({ pending: '待处理', paid: '已支付', fulfilled: '已完成', refunded: '已退款' }[s] || s);

watch(() => route.params.id, (newId) => {
  if (newId) loadOrders();
}, { immediate: true });
</script>