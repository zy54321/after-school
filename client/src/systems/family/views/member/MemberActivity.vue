<template>
  <div class="member-activity-view h-full overflow-y-auto pr-1">
    <div class="flex flex-col gap-6 pb-4">

      <section class="bg-white/5 rounded-xl p-4 border border-white/5">
        <h2 class="text-base font-bold mb-4 flex items-center gap-2 text-blue-300">
          <span>🔨</span> 拍卖记录
        </h2>
        <div class="space-y-2" v-if="auctionBids.length > 0">
          <div v-for="bid in auctionBids" :key="bid.id"
            class="flex justify-between items-center text-sm p-2 bg-white/5 rounded">
            <div>
              <div class="text-gray-200">竞拍「{{ bid.lot_name || '拍品' }}」</div>
              <div class="text-xs text-gray-500">{{ formatTime(bid.created_at) }}</div>
            </div>
            <div class="text-right">
              <div class="font-bold text-yellow-400">{{ bid.bid_points }} 分</div>
              <div class="text-xs" :class="bid.is_winner ? 'text-green-400' : 'text-gray-500'">
                {{ bid.is_winner ? '🏆 中标' : '被超越' }}
              </div>
            </div>
          </div>
        </div>
        <div v-else class="text-center py-4 text-xs text-gray-500">暂无记录</div>
      </section>

      <section class="bg-white/5 rounded-xl p-4 border border-white/5">
        <h2 class="text-base font-bold mb-4 flex items-center gap-2 text-purple-300">
          <span>🎰</span> 抽奖记录
        </h2>
        <div class="space-y-2" v-if="drawLogs.length > 0">
          <div v-for="log in drawLogs" :key="log.id"
            class="flex justify-between items-center text-sm p-2 bg-white/5 rounded">
            <div>
              <div class="text-gray-200">抽中「{{ log.result_name }}」</div>
              <div class="text-xs text-gray-500">{{ log.pool_name }}</div>
            </div>
            <div class="text-xs text-gray-400">{{ formatTime(log.created_at) }}</div>
          </div>
        </div>
        <div v-else class="text-center py-4 text-xs text-gray-500">暂无记录</div>
      </section>

      <section class="bg-white/5 rounded-xl p-4 border border-white/5">
        <h2 class="text-base font-bold mb-4 flex items-center gap-2 text-green-300">
          <span>📋</span> 任务记录
        </h2>
        <div class="space-y-2" v-if="taskClaims.length > 0">
          <div v-for="claim in taskClaims" :key="claim.id"
            class="flex justify-between items-center text-sm p-2 bg-white/5 rounded">
            <div>
              <div class="text-gray-200">{{ claim.task_title }}</div>
              <div class="text-xs text-gray-500">{{ formatTime(claim.claimed_at) }}</div>
            </div>
            <div class="text-right">
              <div class="text-green-400 font-bold">+{{ claim.bounty_points }}</div>
              <div class="text-xs px-1.5 rounded bg-white/10 inline-block mt-1">{{ claim.status }}</div>
            </div>
          </div>
        </div>
        <div v-else class="text-center py-4 text-xs text-gray-500">暂无记录</div>
      </section>

    </div>
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
      axios.get('/api/v2/auction/bids', { params: { member_id: currentMemberId.value, limit: 5 } }).catch(() => ({ data: { data: { bids: [] } } })),
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

const formatTime = (t) => new Date(t).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit' });

watch(() => route.params.id, (newId) => {
  if (newId) loadActivity();
}, { immediate: true });
</script>