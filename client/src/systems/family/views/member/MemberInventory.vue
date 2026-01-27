<template>
  <div class="member-inventory-view h-full flex flex-col">
    <div class="filter-bar mb-4 flex-none">
      <div class="flex gap-2">
        <button v-for="tab in filterTabs" :key="tab.value" class="px-4 py-1.5 rounded-lg text-sm transition-all"
          :class="filter.status === tab.value ? 'bg-blue-500/30 text-white font-bold border border-blue-500/50' : 'bg-white/5 text-gray-400 hover:bg-white/10'"
          @click="filter.status = tab.value; loadInventory()">
          {{ tab.label }}
        </button>
      </div>
    </div>

    <div class="inventory-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto pb-4"
      v-if="items.length > 0">
      <div v-for="item in items" :key="item.id"
        class="inventory-item relative bg-white/5 rounded-xl p-4 flex flex-col items-center gap-3 border border-white/5 hover:border-white/20 transition-all"
        :class="{ 'opacity-60': item.status !== 'unused' }">
        <div class="text-4xl">{{ item.sku_icon || '🎁' }}</div>
        <div class="text-center">
          <div class="font-bold text-sm mb-1">{{ item.sku_name }}</div>
          <div class="text-xs text-gray-500">x{{ item.quantity }}</div>
        </div>

        <div class="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded" :class="{
          'bg-green-500/20 text-green-400': item.status === 'unused',
          'bg-white/10 text-gray-500': item.status === 'used',
          'bg-red-500/20 text-red-400': item.status === 'expired'
        }">
          {{ getStatusLabel(item.status) }}
        </div>

        <button v-if="item.status === 'unused' && item.quantity > 0"
          class="w-full py-1.5 bg-blue-600/80 hover:bg-blue-600 rounded text-xs text-white mt-auto"
          @click="useItem(item)">
          使用
        </button>
      </div>
    </div>

    <div class="empty-state py-20 text-center text-gray-500" v-else-if="!loading">
      <div class="text-5xl mb-4">🎒</div>
      <p class="mb-4">背包空空如也</p>
      <router-link to="/family/market/shop"
        class="inline-block px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-white text-sm">去商城逛逛</router-link>
    </div>

    <div class="text-center py-10 text-gray-500" v-if="loading">加载中...</div>
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

const filterTabs = [
  { label: '全部', value: '' },
  { label: '未使用', value: 'unused' },
  { label: '已使用', value: 'used' },
  { label: '已过期', value: 'expired' },
];

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

watch(() => route.params.id, (newId) => {
  if (newId) loadInventory();
}, { immediate: true });
</script>