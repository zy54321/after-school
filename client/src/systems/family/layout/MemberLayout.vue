<template>
  <div class="member-layout h-[calc(100vh-120px)] flex flex-col box-border overflow-hidden">

    <div class="member-selector flex-none pt-4 px-4 pb-2">
      <div class="selector-tabs flex gap-2 flex-wrap">
        <router-link v-for="m in members" :key="m.id" :to="`/family/member/${m.id}/wallet`"
          class="selector-tab px-4 py-2 rounded-full border border-white/10 text-gray-400 text-sm transition-all hover:bg-white/5 flex items-center gap-2"
          :class="{ 'bg-gradient-to-r from-blue-600 to-purple-600 text-white border-transparent shadow-lg': m.id === currentMemberId }">
          <span class="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">{{
            m.name?.charAt(0) || '?' }}</span>
          <span>{{ m.name }}</span>
        </router-link>
      </div>
    </div>

    <div
      class="member-container flex-1 flex flex-col min-h-0 mx-4 mb-4 bg-[#1e1e2d] rounded-2xl border border-white/5 overflow-hidden"
      v-if="member">

      <div class="flex-none p-6 pb-0">
        <div class="member-header flex justify-between items-center mb-6">
          <div class="member-info flex items-center gap-4">
            <div
              class="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold shadow-lg border-2 border-white/10">
              {{ member.name?.charAt(0) || '?' }}
            </div>
            <div>
              <h1 class="text-2xl font-bold text-white mb-1">{{ member.name }}</h1>
              <p class="text-sm text-gray-400">{{ member.role || '家庭成员' }}</p>
            </div>
          </div>
          <div
            class="balance-card bg-gradient-to-br from-yellow-400 to-orange-500 text-black px-6 py-3 rounded-xl shadow-lg transform hover:scale-105 transition-transform">
            <div class="text-xs font-bold opacity-80 uppercase tracking-wider">当前积分</div>
            <div class="text-3xl font-black font-mono tracking-tight">{{ balance }}</div>
          </div>
        </div>

        <nav class="asset-nav flex gap-1 border-b border-white/10 pb-4">
          <router-link :to="`/family/member/${currentMemberId}/wallet`" class="nav-item" active-class="active">
            <span>💰</span> 积分流水
          </router-link>
          <router-link :to="`/family/member/${currentMemberId}/inventory`" class="nav-item" active-class="active">
            <span>🎒</span> 我的背包
          </router-link>
          <router-link :to="`/family/member/${currentMemberId}/orders`" class="nav-item" active-class="active">
            <span>📦</span> 订单记录
          </router-link>
          <router-link :to="`/family/member/${currentMemberId}/activity`" class="nav-item" active-class="active">
            <span>📊</span> 活动记录
          </router-link>
        </nav>
      </div>

      <div class="content-area flex-1 overflow-hidden relative mb-5">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" @refresh-balance="loadWallet" class="h-full" />
          </transition>
        </router-view>
      </div>
    </div>

    <div class="loading-state flex-1 flex items-center justify-center text-gray-500" v-else>
      <div class="animate-pulse">加载中...</div>
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

const currentMemberId = computed(() => parseInt(route.params.id));

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

const loadWallet = async () => {
  if (!currentMemberId.value) return;
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
  }
};

watch(() => route.params.id, (newId) => {
  if (newId) loadWallet();
}, { immediate: true });

onMounted(() => {
  loadMembers();
});
</script>

<style scoped>
/* 这里只保留必要的样式，布局样式已移至 Tailwind 类 */
.nav-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.5);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}

.nav-item.active {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-weight: bold;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>