<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import dayjs from 'dayjs';
import { ArrowLeft, Refresh } from '@element-plus/icons-vue';
import MemberSelector from '../components/MemberSelector.vue';

const router = useRouter();
const route = useRoute();

// ========== 状态 ==========
const loading = ref(false);
const spinning = ref(false);
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

// 成员选择器状态
const showMemberSelector = ref(false);

// ========== 计算属性 ==========
const canSpin = computed(() => {
  if (!selectedPool.value) return false;
  if (!poolDetail.value?.version || (poolDetail.value?.version?.prizes || []).length === 0) {
    return false;
  }
  // 不再在这里检查成员是否有券，因为成员可能还没选择
  return true;
});

const wheelSectors = computed(() => {
  const prizes = poolDetail.value?.version?.prizes || [];
  if (prizes.length === 0) return [];

  // 1. 计算总权重
  const totalWeight = prizes.reduce((sum, p) => sum + (p.weight || 1), 0);
  
  // 2. 计算每个奖品的角度
  const MIN_ANGLE = 15; // 最小扇区角度，防止看不见
  let availableAngle = 360;
  let rawSlices = prizes.map((p, index) => {
    const weight = p.weight || 1;
    // 理论角度
    const rawAngle = totalWeight > 0 ? (weight / totalWeight) * 360 : (360 / prizes.length);
    return { ...p, rawAngle, index, isSmall: rawAngle < MIN_ANGLE };
  });

  // 3. 调整角度 (简单的保底逻辑：如果小于MIN_ANGLE，强制设为MIN_ANGLE，然后压缩其他扇区)
  // 为了简化，这里使用一种“加权+保底”的混合算法
  const smallCount = rawSlices.filter(s => s.isSmall).length;
  const largeSlices = rawSlices.filter(s => !s.isSmall);
  
  // 给小扇区分配固定角度
  const reservedAngle = smallCount * MIN_ANGLE;
  
  // 剩余角度按权重分配给大扇区
  const remainingAngle = 360 - reservedAngle;
  const largeTotalWeight = largeSlices.reduce((sum, p) => sum + (p.weight || 1), 0);

  let currentStart = 0;
  const sectors = rawSlices.map((item) => {
    let finalAngle;
    if (item.isSmall) {
      finalAngle = MIN_ANGLE;
    } else {
      finalAngle = (item.weight / largeTotalWeight) * remainingAngle;
    }

    const angleMid = currentStart + finalAngle / 2;
    const sector = {
      key: `${item.id || item.index}-${item.index}`,
      prize: item,
      angleStart: currentStart,
      angleSpan: finalAngle,
      angleMid: angleMid, 
    };
    currentStart += finalAngle;
    return sector;
  });

  return sectors;
});

const wheelBackground = computed(() => {
  const sectors = wheelSectors.value;
  if (sectors.length === 0) {
    return 'conic-gradient(#2f2f3a 0deg 360deg)';
  }

  const parts = [];
  sectors.forEach((sector, index) => {
    const color = getPrizeColor(index, sectors.length);
    parts.push(`${color} ${sector.angleStart}deg ${sector.angleStart + sector.angleSpan}deg`);
  });
  
  return `conic-gradient(from 0deg, ${parts.join(', ')})`;
});

// ========== API 调用 ==========
const loadPools = async (preferredPoolId = null) => {
  loading.value = true;
  try {
    const res = await axios.get('/api/v2/draw/pools');
    if (res.data?.code === 200) {
      pools.value = res.data.data?.pools || [];
      console.log('[lottery] pools loaded', {
        count: pools.value.length,
        preferredPoolId,
      });
      if (pools.value.length > 0) {
        const preferred =
          preferredPoolId && pools.value.find((pool) => pool.id === preferredPoolId);
        if (preferred) {
          selectPool(preferred);
        } else if (!selectedPool.value) {
          selectPool(pools.value[0]);
        }
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
  console.log('[lottery] select pool', { poolId: pool?.id });
  loading.value = true;
  try {
    const res = await axios.get(`/api/v2/draw/pools/${pool.id}`);
    if (res.data.code === 200) {
      poolDetail.value = res.data.data;
      console.log('[lottery] pool detail', {
        hasVersion: !!poolDetail.value?.version,
        prizeCount: poolDetail.value?.version?.prizes?.length || 0,
      });
    }
  } catch (err) {
    console.error('加载抽奖池详情失败:', err);
  } finally {
    loading.value = false;
  }
};

// 点击抽奖按钮
const handleSpinClick = () => {
  console.log('[lottery] spin click', {
    selectedPoolId: selectedPool.value?.id,
    memberSelected: !!currentMemberId.value,
  });
  if (!selectedPool.value || spinning.value) return;
  if (currentMemberId.value) {
    doSpin(currentMemberId.value);
  } else {
    showMemberSelector.value = true;
  }
};

// 成员确认后执行抽奖
const handleMemberConfirm = async ({ memberId }) => {
  currentMemberId.value = memberId;
  showMemberSelector.value = false;
  doSpin(memberId);
};

// 关闭成员选择器
const closeMemberSelector = () => {
  showMemberSelector.value = false;
};

// 执行抽奖
const doSpin = async (memberId) => {
  if (!selectedPool.value || spinning.value) return;

  console.log('[lottery] spin start', {
    poolId: selectedPool.value?.id,
    memberId,
    currentRotation: wheelRotation.value,
  });
  spinning.value = true;
  showResult.value = false;
  isWheelSpinning.value = true;
  wheelRotation.value += 360 * (2 + Math.floor(Math.random() * 2));
  console.log('[lottery] pre-spin rotation set', { wheelRotation: wheelRotation.value });

  try {
    const res = await axios.post('/api/v2/draw/spin', {
      pool_id: selectedPool.value.id,
      member_id: memberId,
    });

    if (res.data.code === 200) {
      spinResult.value = res.data.data;
      const prizeId = spinResult.value?.prize?.id;
      const prizes = poolDetail.value?.version?.prizes || [];
      const targetRotation = getTargetRotation(prizes, prizeId);
      console.log('[lottery] spin result', {
        prizeId,
        prizeName: spinResult.value?.prize?.name,
        prizesCount: prizes.length,
        targetRotation,
      });
      await nextTick();
      wheelRotation.value = targetRotation;
      console.log('[lottery] target rotation set', { wheelRotation: wheelRotation.value });

      await new Promise((resolve) => setTimeout(resolve, 3000));
      showResult.value = true;
      
      await loadPools();
      await loadHistory();
    } else {
      ElMessage.error(res.data.msg);
    }
  } catch (err) {
    ElMessage.error(err.response?.data?.msg || '抽奖失败');
    console.error('[lottery] spin error', err);
  } finally {
    spinning.value = false;
    isWheelSpinning.value = false;
    console.log('[lottery] spin end', { wheelRotation: wheelRotation.value });
  }
};

const loadHistory = async () => {
  if (!currentMemberId.value) return;
  try {
    const res = await axios.get('/api/v2/draw/history', {
      params: { member_id: currentMemberId.value, limit: 20 },
    });
    if (res.data?.code === 200) {
      history.value = res.data.data?.history || [];
    }
  } catch (err) {
    console.error('加载历史记录失败:', err);
  }
};

const goBack = () => {
  router.push('/family/market/draw');
};

// ========== 辅助函数 ==========
const getPrizeColor = (index, total) => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  ];
  return colors[index % colors.length];
};

const getTargetRotation = (prizes, prizeId) => {
  if (!prizes.length) {
    return wheelRotation.value + 360 * (5 + Math.floor(Math.random() * 3));
  }
  const prizeIndex = prizes.findIndex((prize) => prize.id === prizeId);
  const finalIndex = prizeIndex >= 0 ? prizeIndex : Math.floor(Math.random() * prizes.length);
  const angle = 360 / prizes.length;
  const targetAngle = 360 - (finalIndex * angle + angle / 2);
  const spins = 5 + Math.floor(Math.random() * 3);
  return wheelRotation.value + 360 * spins + targetAngle;
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
  console.log('[lottery] page mounted', {
    route: route.fullPath,
    poolId: route.params.poolId,
  });
  const routePoolId = parseInt(route.params.poolId, 10);
  await loadPools(Number.isFinite(routePoolId) ? routePoolId : null);
});

watch(currentMemberId, async () => {
  await loadHistory();
});

watch(
  () => route.params.poolId,
  async (poolId) => {
    const parsedId = parseInt(poolId, 10);
    if (Number.isFinite(parsedId)) {
      await loadPools(parsedId);
    }
  }
);
</script>

<template>
  <div class="lottery-page">
    <!-- 顶部导航 -->
    <header class="lottery-header">
      <div class="header-left">
        <el-button :icon="ArrowLeft" circle @click="goBack" />
        <h1>🎰 幸运抽奖</h1>
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
        </div>
      </div>

      <!-- 转盘区域 -->
      <div class="wheel-section" v-if="poolDetail?.version && (poolDetail.version.prizes || []).length > 0">
        <div class="wheel-container">
          <!-- 转盘 -->
          <div
            class="wheel"
            :style="{
              transform: `rotate(${wheelRotation}deg)`,
              transition: isWheelSpinning ? 'transform 3s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
              background: wheelBackground,
            }"
          >
            <div class="wheel-labels">
              <div
                v-for="sector in wheelSectors"
                :key="sector.key"
                class="wheel-label"
                :style="{ transform: `rotate(${sector.angleMid}deg)` }"
              >
                <div
                  class="label-content"
                  :style="{ transform: `translateY(18px) rotate(${-sector.angleMid}deg)` }"
                >
                  <span class="prize-icon">{{ sector.prize.icon }}</span>
                  <span class="prize-name">{{ sector.prize.name }}</span>
                </div>
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
            @click="handleSpinClick"
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

      <!-- 未配置奖品版本 -->
      <div class="empty-state" v-else-if="!loading && selectedPool">
        <p>该抽奖池尚未配置奖品，请先在“抽奖池管理-配置奖品”中设置。</p>
        <el-button type="primary" @click="router.push('/family/market/admin/draw')">
          去配置奖品
        </el-button>
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

    <!-- 统一成员选择器 -->
    <MemberSelector
      v-model:visible="showMemberSelector"
      title="选择抽奖成员"
      :action-description="selectedPool ? `在「${selectedPool.name}」抽奖` : '选择进行抽奖的成员'"
      action-icon="🎰"
      confirm-text="开始抽奖"
      :loading="spinning"
      @confirm="handleMemberConfirm"
      @cancel="closeMemberSelector"
    />
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
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
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

.wheel-labels {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.wheel-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.label-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 70px;
}

.prize-icon {
  font-size: 20px;
}

.prize-name {
  font-size: 10px;
  font-weight: 600;
  color: #fff;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
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
  background-clip: text;
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
