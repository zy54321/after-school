<template>
  <div class="member-wallet-view h-full flex flex-col p-6 pt-4 box-border">
    <section
      class="wallet-section flex-1 flex flex-col min-h-0 bg-[#151520] rounded-2xl border border-white/5 overflow-hidden">

      <div class="flex justify-between items-center p-3 border-b border-white/5 bg-[#1a1a2e] flex-none">
        <h2 class="text-base font-bold flex items-center gap-2 text-white">
          <span>🧾</span> 活动记录
        </h2>
        <div class="text-xs text-gray-500">最近5条</div>
      </div>

      <div class="flex-1 overflow-y-auto custom-scroll p-3">
        <!-- 拍卖记录 -->
        <div class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 ml-1 flex items-center gap-2">
          🔨 拍卖记录
        </div>
        <div v-if="auctionBids.length > 0" class="mb-6">
          <div v-for="bid in auctionBids" :key="bid.id"
            class="log-item mb-1.5 flex items-center gap-3 px-3 py-2.5 bg-[#252538] rounded-xl border border-white/5 group relative overflow-hidden transition-all hover:bg-[#2a2a40] hover:border-white/10 hover:shadow-md">

            <div class="log-icon w-8 h-8 rounded-full flex-none flex items-center justify-center text-sm shadow-inner bg-white/5 text-gray-200">
              🔨
            </div>

            <div class="log-content flex-1 min-w-0 flex flex-col justify-center">
              <div class="text-[14px] font-bold text-gray-100 truncate pr-2 leading-tight">竞拍「{{ bid.lot_name || '拍品' }}」</div>
              <div class="flex gap-2 mt-0.5 items-center">
                <span class="text-[10px] text-gray-500 font-mono">{{ formatTime(bid.created_at) }}</span>
                <span class="text-[9px] px-1.5 py-0 rounded-full bg-white/5 text-gray-400 border border-white/5"
                  :class="bid.is_winner ? 'text-green-400' : ''">
                  {{ bid.is_winner ? '🏆 中标' : '被超越' }}
                </span>
              </div>
            </div>

            <div class="flex flex-col items-end gap-1 flex-none justify-center">
              <div class="font-bold text-base tabular-nums tracking-tight leading-none text-yellow-400">
                {{ bid.bid_points }} 分
              </div>
            </div>
          </div>
        </div>
        <div v-else class="text-center py-4 text-xs text-gray-500 mb-6">暂无记录</div>

        <!-- 抽奖记录 -->
        <div class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 ml-1 flex items-center gap-2">
          🎰 抽奖记录
        </div>
        <div v-if="drawLogs.length > 0" class="mb-6">
          <div v-for="log in drawLogs" :key="log.id"
            class="log-item mb-1.5 flex items-center gap-3 px-3 py-2.5 bg-[#252538] rounded-xl border border-white/5 group relative overflow-hidden transition-all hover:bg-[#2a2a40] hover:border-white/10 hover:shadow-md">

            <div class="log-icon w-8 h-8 rounded-full flex-none flex items-center justify-center text-sm shadow-inner bg-white/5 text-gray-200">
              🎰
            </div>

            <div class="log-content flex-1 min-w-0 flex flex-col justify-center">
              <div class="text-[14px] font-bold text-gray-100 truncate pr-2 leading-tight">抽中「{{ log.result_name }}」</div>
              <div class="flex gap-2 mt-0.5 items-center">
                <span class="text-[10px] text-gray-500 font-mono">{{ formatTime(log.created_at) }}</span>
                <span class="text-[9px] px-1.5 py-0 rounded-full bg-white/5 text-gray-400 border border-white/5">
                  {{ log.pool_name }}
                </span>
              </div>
            </div>

            <div class="flex flex-col items-end gap-1 flex-none justify-center">
              <div class="text-xs text-gray-400">已抽中</div>
            </div>
          </div>
        </div>
        <div v-else class="text-center py-4 text-xs text-gray-500 mb-6">暂无记录</div>

        <!-- 任务记录 -->
        <div class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 ml-1 flex items-center gap-2">
          📋 任务记录
        </div>
        <div v-if="taskClaims.length > 0" class="mb-6">
          <div v-for="claim in taskClaims" :key="claim.id"
            class="log-item mb-1.5 flex items-center gap-3 px-3 py-2.5 bg-[#252538] rounded-xl border border-white/5 group relative overflow-hidden transition-all hover:bg-[#2a2a40] hover:border-white/10 hover:shadow-md">

            <div class="log-icon w-8 h-8 rounded-full flex-none flex items-center justify-center text-sm shadow-inner bg-white/5 text-gray-200">
              📋
            </div>

            <div class="log-content flex-1 min-w-0 flex flex-col justify-center">
              <div class="text-[14px] font-bold text-gray-100 truncate pr-2 leading-tight">{{ claim.task_title }}</div>
              <div class="flex gap-2 mt-0.5 items-center">
                <span class="text-[10px] text-gray-500 font-mono">{{ formatTime(claim.claimed_at) }}</span>
                <span class="text-[9px] px-1.5 py-0 rounded-full bg-white/5 text-gray-400 border border-white/5">
                  {{ claim.status }}
                </span>
              </div>
            </div>

            <div class="flex flex-col items-end gap-1 flex-none justify-center">
              <div class="font-bold text-base tabular-nums tracking-tight leading-none text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
                +{{ claim.bounty_points }}
              </div>
            </div>
          </div>
        </div>
        <div v-else class="text-center py-4 text-xs text-gray-500 mb-6">暂无记录</div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';

const route = useRoute();
const auctionBids = ref([]);
const drawLogs = ref([]);
const taskClaims = ref([]);
const currentMemberId = computed(() => parseInt(route.params.id));

const loadActivity = async () => {
  if (!currentMemberId.value) return;
  try {
    const [bidsRes, drawsRes, tasksRes] = await Promise.all([
      axios.get('/api/v2/auction/bids', { params: { member_id: currentMemberId.value, limit: 5 } }),
      axios.get('/api/v2/draw/logs', { params: { member_id: currentMemberId.value, limit: 5 } }).catch(() => ({ data: { data: { logs: [] } } })),
      axios.get('/api/v2/tasks/claims', { params: { member_id: currentMemberId.value, limit: 5 } }).catch(() => ({ data: { data: { claims: [] } } })),
    ]);
    auctionBids.value = bidsRes.data?.data?.bids || [];
    drawLogs.value = drawsRes.data?.data?.logs || [];
    taskClaims.value = tasksRes.data?.data?.claims || [];
  } catch (err) {
    console.error(err);
  }
};

const formatTime = (t) => {
  if (!t) return '';
  return new Date(t).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

watch(() => route.params.id, (newId) => {
  if (newId) loadActivity();
}, { immediate: true });
</script>

<style scoped>
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
