<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import dayjs from 'dayjs';
import { ArrowLeft, Refresh, Coin } from '@element-plus/icons-vue';

const router = useRouter();

// ========== 状态 ==========
const loading = ref(false);
const spinning = ref(false);
const members = ref([]);
const currentMemberId = ref(null);

// 抽奖池数据
const pools = ref([]);
const selectedPool = ref(null);
const poolDetail = ref(null);

// 抽奖结果
const showResult = ref(false);
const spinResult = ref(null);

// 历史记录
const history = ref([]);
const showHistory = ref(false);

// 转盘状态
const wheelRotation = ref(0);
const isWheelSpinning = ref(false);

// ========== 计算属性 ==========
const currentMember = computed(() => {
  return members.value.find((m) => m.id === currentMemberId.value);
});

const memberBalance = computed(() => {
  return currentMember.value?.balance || 0;
});

const canSpin = computed(() => {
  if (!selectedPool.value) return false;
  if (selectedPool.value.entry_ticket_type_id && selectedPool.value.memberTicketCount < selectedPool.value.tickets_per_draw) {
    return false;
  }
  return true;
});

// ========== API 调用 ==========
const loadMembers = async () => {
  try {
    const res = await axios.get('/api/family/init');
    if (res.data.code === 200) {
      members.value = res.data.data.members || [];
      if (members.value.length > 0 && !currentMemberId.value) {
        currentMemberId.value = members.value[0].id;
      }
    }
  } catch (err) {
    console.error('加载成员失败:', err);
  }
};

const loadMemberBalance = async () => {
  if (!currentMemberId.value) return;
  try {
    const res = await axios.get('/api/family/member-dashboard', {
      params: { memberId: currentMemberId.value },
    });
    if (res.data.code === 200) {
      const member = members.value.find((m) => m.id === currentMemberId.value);
      if (member) {
        member.balance = res.data.data.totalPoints || 0;
      }
    }
  } catch (err) {
    console.error('加载余额失败:', err);
  }
};

const loadPools = async () => {
  if (!currentMemberId.value) return;
  loading.value = true;
  try {
    const res = await axios.get('/api/v2/draw/pools', {
      params: { member_id: currentMemberId.value },
    });
    if (res.data.code === 200) {
      pools.value = res.data.data.pools || [];
      if (pools.value.length > 0 && !selectedPool.value) {
        selectPool(pools.value[0]);
      }
    }
  } catch (err) {
    ElMessage.error('加载抽奖池失败');
    console.error(err);
  } finally {
    loading.value = false;
  }
};

const selectPool = async (pool) => {
  selectedPool.value = pool;
  loading.value = true;
  try {
    const res = await axios.get(`/api/v2/draw/pools/${pool.id}`);
    if (res.data.code === 200) {
      poolDetail.value = res.data.data;
    }
  } catch (err) {
    console.error('加载抽奖池详情失败:', err);
  } finally {
    loading.value = false;
  }
};

const doSpin = async () => {
  if (!canSpin.value || spinning.value) return;

  spinning.value = true;
  isWheelSpinning.value = true;
  showResult.value = false;

  // 先启动转盘动画
  const spins = 5 + Math.random() * 3; // 5-8 圈
  wheelRotation.value += 360 * spins;

  try {
    const res = await axios.post('/api/v2/draw/spin', {
      pool_id: selectedPool.value.id,
      member_id: currentMemberId.value,
    });

    // 等待动画完成
    await new Promise((resolve) => setTimeout(resolve, 3000));

    if (res.data.code === 200) {
      spinResult.value = res.data.data;
      showResult.value = true;
      
      // 刷新数据
      await loadPools();
      await loadMemberBalance();
      await loadHistory();
    } else {
      ElMessage.error(res.data.msg);
    }
  } catch (err) {
    ElMessage.error(err.response?.data?.msg || '抽奖失败');
  } finally {
    spinning.value = false;
    isWheelSpinning.value = false;
  }
};

const loadHistory = async () => {
  if (!currentMemberId.value) return;
  try {
    const res = await axios.get('/api/v2/draw/history', {
      params: { member_id: currentMemberId.value, limit: 20 },
    });
    if (res.data.code === 200) {
      history.value = res.data.data.history || [];
    }
  } catch (err) {
    console.error('加载历史记录失败:', err);
  }
};

const goBack = () => {
  router.push('/family/dashboard');
};

// ========== 辅助函数 ==========
const getPrizeColor = (index, total) => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  ];
  return colors[index % colors.length];
};

const getResultTypeLabel = (type) => {
  const map = {
    points: '积分',
    ticket: '抽奖券',
    sku: '道具',
    empty: '未中奖',
  };
  return map[type] || type;
};

// ========== 生命周期 ==========
onMounted(async () => {
  await loadMembers();
  await loadMemberBalance();
  await loadPools();
  await loadHistory();
});

watch(currentMemberId, async () => {
  selectedPool.value = null;
  poolDetail.value = null;
  await loadMemberBalance();
  await loadPools();
  await loadHistory();
});
</script>

<template>
  <div class="lottery-page">
    <!-- 顶部导航 -->
    <header class="lottery-header">
      <div class="header-left">
        <el-button :icon="ArrowLeft" circle @click="goBack" />
        <h1>🎰 幸运抽奖</h1>
      </div>
      <div class="header-right">
        <el-select
          v-model="currentMemberId"
          placeholder="选择成员"
          style="width: 140px"
        >
          <el-option
            v-for="m in members"
            :key="m.id"
            :label="m.name"
            :value="m.id"
          />
        </el-select>
        <div class="balance-badge" v-if="currentMember">
          <el-icon><Coin /></el-icon>
          <span>{{ memberBalance }}</span>
        </div>
      </div>
    </header>

    <main class="lottery-main" v-loading="loading">
      <!-- 抽奖池选择 -->
      <div class="pool-selector" v-if="pools.length > 0">
        <div
          v-for="pool in pools"
          :key="pool.id"
          class="pool-tab"
          :class="{ active: selectedPool?.id === pool.id }"
          @click="selectPool(pool)"
        >
          <span class="pool-icon">{{ pool.icon }}</span>
          <span class="pool-name">{{ pool.name }}</span>
          <span class="ticket-count" v-if="pool.entry_ticket_type_id">
            {{ pool.memberTicketCount || 0 }} 张券
          </span>
        </div>
      </div>

      <!-- 转盘区域 -->
      <div class="wheel-section" v-if="poolDetail?.version">
        <div class="wheel-container">
          <!-- 转盘 -->
          <div
            class="wheel"
            :style="{
              transform: `rotate(${wheelRotation}deg)`,
              transition: isWheelSpinning ? 'transform 3s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
            }"
          >
            <div
              v-for="(prize, index) in poolDetail.version.prizes"
              :key="prize.id"
              class="wheel-sector"
              :style="{
                transform: `rotate(${(360 / poolDetail.version.prizes.length) * index}deg)`,
                backgroundColor: getPrizeColor(index, poolDetail.version.prizes.length),
              }"
            >
              <div class="sector-content">
                <span class="prize-icon">{{ prize.icon }}</span>
                <span class="prize-name">{{ prize.name }}</span>
              </div>
            </div>
          </div>
          <!-- 指针 -->
          <div class="wheel-pointer">▼</div>
        </div>

        <!-- 抽奖按钮 -->
        <div class="spin-area">
          <button
            class="spin-btn"
            :class="{ disabled: !canSpin, spinning }"
            :disabled="!canSpin || spinning"
            @click="doSpin"
          >
            <span v-if="spinning">抽奖中...</span>
            <span v-else-if="!canSpin">券不足</span>
            <span v-else>立即抽奖</span>
          </button>
          <p class="spin-hint" v-if="selectedPool?.entry_ticket_type_id">
            消耗 {{ selectedPool.tickets_per_draw }} 张 {{ selectedPool.ticket_type_name }}
          </p>
        </div>

        <!-- 保底提示 -->
        <div class="guarantee-info" v-if="poolDetail.version.minGuaranteeCount">
          <span>🎁 {{ poolDetail.version.minGuaranteeCount }} 次保底大奖</span>
        </div>
      </div>

      <!-- 无抽奖池提示 -->
      <div class="empty-state" v-else-if="!loading && pools.length === 0">
        <p>暂无可用的抽奖池</p>
      </div>

      <!-- 历史记录 -->
      <div class="history-section">
        <div class="section-header">
          <h2>🎲 抽奖记录</h2>
          <el-button size="small" :icon="Refresh" @click="loadHistory">刷新</el-button>
        </div>
        <div class="history-list">
          <div
            v-for="log in history"
            :key="log.id"
            class="history-item"
            :class="log.result_type"
          >
            <div class="history-left">
              <span class="history-pool">{{ log.pool_icon }} {{ log.pool_name }}</span>
              <span class="history-time">{{ dayjs(log.created_at).format('MM/DD HH:mm') }}</span>
            </div>
            <div class="history-right">
              <span class="history-prize" :class="{ guarantee: log.is_guarantee }">
                {{ log.result_name }}
                <span v-if="log.is_guarantee" class="guarantee-tag">保底</span>
              </span>
              <span class="history-type">{{ getResultTypeLabel(log.result_type) }}</span>
            </div>
          </div>
          <div v-if="history.length === 0" class="empty-history">
            暂无抽奖记录
          </div>
        </div>
      </div>
    </main>

    <!-- 抽奖结果弹窗 -->
    <div class="result-modal" v-if="showResult" @click="showResult = false">
      <div class="result-content" @click.stop>
        <div class="result-icon">{{ spinResult?.prize?.icon }}</div>
        <h2>{{ spinResult?.isGuarantee ? '🎉 保底触发！' : '恭喜获得' }}</h2>
        <div class="result-prize">{{ spinResult?.prize?.name }}</div>
        <p class="result-type">{{ getResultTypeLabel(spinResult?.prize?.type) }}</p>
        <el-button type="primary" @click="showResult = false">确定</el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lottery-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  color: #fff;
  font-family: 'Segoe UI', 'SF Pro Display', -apple-system, sans-serif;
}

/* Header */
.lottery-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-left h1 {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.balance-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: rgba(255, 215, 0, 0.2);
  border-radius: 20px;
  font-weight: 700;
  color: #ffd700;
}

/* Main */
.lottery-main {
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
}

/* Pool Selector */
.pool-selector {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 12px;
  margin-bottom: 24px;
}

.pool-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 20px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s;
  min-width: 100px;
}

.pool-tab:hover {
  background: rgba(255, 255, 255, 0.15);
}

.pool-tab.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.pool-icon {
  font-size: 28px;
  margin-bottom: 4px;
}

.pool-name {
  font-size: 14px;
  font-weight: 600;
}

.ticket-count {
  font-size: 12px;
  opacity: 0.8;
  margin-top: 2px;
}

/* Wheel Section */
.wheel-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 32px;
}

.wheel-container {
  position: relative;
  width: 300px;
  height: 300px;
  margin-bottom: 24px;
}

.wheel {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  position: relative;
  overflow: hidden;
  box-shadow: 0 0 30px rgba(255, 215, 0, 0.3), inset 0 0 20px rgba(0, 0, 0, 0.3);
  border: 4px solid #ffd700;
}

.wheel-sector {
  position: absolute;
  width: 50%;
  height: 50%;
  top: 0;
  right: 0;
  transform-origin: bottom left;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 20px;
  clip-path: polygon(0 0, 100% 0, 100% 100%);
}

.sector-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  transform: rotate(22.5deg);
  text-align: center;
}

.prize-icon {
  font-size: 20px;
}

.prize-name {
  font-size: 10px;
  font-weight: 600;
  color: #fff;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
  max-width: 50px;
  word-break: break-all;
}

.wheel-pointer {
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 32px;
  color: #ffd700;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  z-index: 10;
}

/* Spin Button */
.spin-area {
  text-align: center;
}

.spin-btn {
  padding: 16px 48px;
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  border: none;
  border-radius: 30px;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 6px 20px rgba(240, 147, 251, 0.4);
}

.spin-btn:hover:not(.disabled):not(.spinning) {
  transform: scale(1.05);
  box-shadow: 0 8px 25px rgba(240, 147, 251, 0.5);
}

.spin-btn.disabled {
  background: #666;
  cursor: not-allowed;
  box-shadow: none;
}

.spin-btn.spinning {
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.spin-hint {
  margin-top: 12px;
  font-size: 14px;
  opacity: 0.7;
}

.guarantee-info {
  margin-top: 16px;
  padding: 8px 16px;
  background: rgba(255, 215, 0, 0.2);
  border-radius: 20px;
  font-size: 14px;
  color: #ffd700;
}

/* History Section */
.history-section {
  margin-top: 32px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h2 {
  font-size: 18px;
  margin: 0;
}

.history-list {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  overflow: hidden;
}

.history-item {
  display: flex;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.history-item:last-child {
  border-bottom: none;
}

.history-item.points {
  border-left: 3px solid #ffd700;
}

.history-item.ticket {
  border-left: 3px solid #4ecdc4;
}

.history-item.sku {
  border-left: 3px solid #f093fb;
}

.history-item.empty {
  border-left: 3px solid #666;
  opacity: 0.6;
}

.history-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.history-pool {
  font-size: 14px;
  font-weight: 500;
}

.history-time {
  font-size: 12px;
  opacity: 0.6;
}

.history-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.history-prize {
  font-size: 14px;
  font-weight: 600;
}

.history-prize.guarantee {
  color: #ffd700;
}

.guarantee-tag {
  font-size: 10px;
  padding: 2px 6px;
  background: #ffd700;
  color: #1a1a2e;
  border-radius: 4px;
  margin-left: 6px;
}

.history-type {
  font-size: 12px;
  opacity: 0.6;
}

.empty-history {
  padding: 32px;
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: rgba(255, 255, 255, 0.6);
}

/* Result Modal */
.result-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.3s;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.result-content {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 20px;
  padding: 40px;
  text-align: center;
  border: 2px solid #ffd700;
  box-shadow: 0 0 40px rgba(255, 215, 0, 0.3);
  animation: bounceIn 0.5s;
}

@keyframes bounceIn {
  0% { transform: scale(0.5); opacity: 0; }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); opacity: 1; }
}

.result-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.result-content h2 {
  font-size: 24px;
  margin: 0 0 12px 0;
  color: #ffd700;
}

.result-prize {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 8px;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.result-type {
  font-size: 14px;
  opacity: 0.7;
  margin-bottom: 24px;
}

/* Responsive */
@media (max-width: 768px) {
  .lottery-header {
    flex-direction: column;
    gap: 12px;
    padding: 12px 16px;
  }

  .header-left h1 {
    font-size: 20px;
  }

  .wheel-container {
    width: 260px;
    height: 260px;
  }

  .pool-selector {
    gap: 8px;
  }

  .pool-tab {
    min-width: 80px;
    padding: 10px 14px;
  }
}
</style>
