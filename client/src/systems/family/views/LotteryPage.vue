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

// 历史记录（分离为历史记录和当前记录）
const historyRecords = ref([]); // 历史记录（今天之前的）
const currentRecords = ref([]); // 当前记录（今天的）

// 成员统计信息
const memberStats = ref(null);

// Tab 切换状态
const activeTab = ref('today'); // 'today' 或 'history'

// 转盘状态
const wheelRotation = ref(0);
const isWheelSpinning = ref(false);

// 成员选择器状态
const showMemberSelector = ref(false);

// ========== 计算属性 ==========
const canSpin = computed(() => {
  // 基础检查：是否有池子，是否有奖品
  if (!selectedPool.value) return false;
  if (!poolDetail.value?.version || (poolDetail.value?.version?.prizes || []).length === 0) {
    return false;
  }
  // 注意：券余额的检查下沉到 UI 按钮逻辑中，以便显示不同的按钮状态（去购买 vs 抽奖）
  return true;
});

// 计算扇区数据（带权重）
const wheelSectors = computed(() => {
  const prizes = poolDetail.value?.version?.prizes || [];
  if (prizes.length === 0) return [];

  const totalWeight = prizes.reduce((sum, p) => sum + (p.weight || 1), 0);
  const MIN_ANGLE = 15;

  let rawSlices = prizes.map((p, index) => {
    const weight = p.weight || 1;
    const rawAngle = totalWeight > 0 ? (weight / totalWeight) * 360 : (360 / prizes.length);
    return { ...p, rawAngle, index, isSmall: rawAngle < MIN_ANGLE };
  });

  const smallCount = rawSlices.filter(s => s.isSmall).length;
  const largeSlices = rawSlices.filter(s => !s.isSmall);

  const reservedAngle = smallCount * MIN_ANGLE;
  const remainingAngle = 360 - reservedAngle;
  const largeTotalWeight = largeSlices.reduce((sum, p) => sum + (p.weight || 1), 0);

  let currentStart = 0;
  return rawSlices.map((item) => {
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

// 🟢 修复 1：加载列表时传入 member_id 以获取券余额
const loadPools = async (preferredPoolId = null) => {
  loading.value = true;
  try {
    const params = {};
    if (currentMemberId.value) {
      params.member_id = currentMemberId.value;
    }

    const res = await axios.get('/api/v2/draw/pools', { params });
    if (res.data?.code === 200) {
      pools.value = res.data.data?.pools || [];

      // 更新当前选中池子的数据（主要是券余额 memberTicketCount）
      if (selectedPool.value) {
        const updated = pools.value.find(p => p.id === selectedPool.value.id);
        if (updated) selectedPool.value = updated;
      }

      if (pools.value.length > 0) {
        const preferred = preferredPoolId && pools.value.find((pool) => pool.id === preferredPoolId);
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
  selectedPool.value = pool; // 这会包含列表中带回的 memberTicketCount
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

const handleSpinClick = () => {
  if (!selectedPool.value || spinning.value) return;
  
  // 如果没有选择成员，弹出成员选择弹窗
  if (!currentMemberId.value) {
    showMemberSelector.value = true;
    return;
  }
  
  // 如果已经选择了成员，直接执行抽奖
  // 再次校验余额（虽然 UI 已经做了限制）
  if (selectedPool.value.entry_ticket_type_id) {
    const cost = selectedPool.value.tickets_per_draw || 1;
    const balance = selectedPool.value.memberTicketCount || 0;
    if (balance < cost) {
      ElMessage.warning('抽奖券不足，请先去商城兑换');
      return;
    }
  }
  
  doSpin(currentMemberId.value);
};

const handleMemberConfirm = async ({ memberId }) => {
  currentMemberId.value = memberId;
  showMemberSelector.value = false;
  
  // 加载成员统计信息
  await loadMemberStats(memberId);
  
  // 刷新抽奖池数据（获取券余额）
  await loadPools(selectedPool.value?.id);
  
  // 加载抽奖记录
  await loadHistory();
};

const closeMemberSelector = () => {
  showMemberSelector.value = false;
};

const doSpin = async (memberId) => {
  if (!selectedPool.value || spinning.value) return;

  spinning.value = true;
  showResult.value = false;
  isWheelSpinning.value = true;

  // 启动时的随机预转
  wheelRotation.value += 360 * (2 + Math.floor(Math.random() * 2));

  try {
    const res = await axios.post('/api/v2/draw/spin', {
      pool_id: selectedPool.value.id,
      member_id: memberId,
    });

    if (res.data.code === 200) {
      spinResult.value = res.data.data;
      const prizeId = spinResult.value?.prize?.id;
      const prizes = poolDetail.value?.version?.prizes || [];

      // 🟢 修复 2：使用真实权重角度计算目标位置
      const targetRotation = getTargetRotation(prizes, prizeId);

      await nextTick();
      wheelRotation.value = targetRotation;

      // 等待动画结束 (3s)
      await new Promise((resolve) => setTimeout(resolve, 3000));
      showResult.value = true;

      // 刷新数据（扣除券、增加记录）
      await loadPools(selectedPool.value?.id);
      await loadMemberStats(memberId);
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

const loadMemberStats = async (memberId) => {
  if (!memberId || !selectedPool.value) return;
  try {
    const res = await axios.get(`/api/v2/draw/pools/${selectedPool.value.id}/stats`, {
      params: { member_id: memberId },
    });
    if (res.data?.code === 200) {
      memberStats.value = res.data.data;
    }
  } catch (err) {
    console.error('加载成员统计失败:', err);
  }
};

const loadHistory = async () => {
  if (!currentMemberId.value) return;
  try {
    const res = await axios.get('/api/v2/draw/history', {
      params: { member_id: currentMemberId.value, limit: 100 },
    });
    if (res.data?.code === 200) {
      const allRecords = res.data.data?.history || [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // 分离历史记录和当前记录
      currentRecords.value = allRecords.filter(record => {
        const recordDate = new Date(record.created_at);
        return recordDate >= today;
      });
      
      historyRecords.value = allRecords.filter(record => {
        const recordDate = new Date(record.created_at);
        return recordDate < today;
      });
    }
  } catch (err) {
    console.error('加载历史记录失败:', err);
  }
};

const goBack = () => {
  router.push('/family/market/draw');
};

const goToMarket = () => {
  router.push('/family/market');
};

const getPrizeColor = (index, total) => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  ];
  return colors[index % colors.length];
};

// 🟢 核心修复：基于真实扇区角度计算旋转目标
const getTargetRotation = (prizes, prizeId) => {
  // 从计算属性 wheelSectors 中找到对应的扇区数据（包含 angleMid）
  const sector = wheelSectors.value.find((s) => s.prize.id === prizeId);
  // 兜底防止报错
  if (!sector) return wheelRotation.value + 360 * 5;

  const currentRotation = wheelRotation.value;
  // 向上取整到最近的整圈，确保始终顺时针向前旋转
  const baseRotation = Math.ceil(currentRotation / 360) * 360;

  // 计算对齐角度：
  // 指针在顶部(0度)，扇区中心为 sector.angleMid (顺时针角度)
  // 要让扇区中心转到顶部，需要再转 (360 - angleMid) 度
  const alignRotation = 360 - sector.angleMid;

  // 加上额外的旋转圈数 (5圈)
  const spins = 360 * 5;

  return baseRotation + spins + alignRotation;
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

// ========== 生命周期 & 监听 ==========
onMounted(async () => {
  const routePoolId = parseInt(route.params.poolId, 10);
  await loadPools(Number.isFinite(routePoolId) ? routePoolId : null);
});

// 监听成员切换，立刻刷新券余额和统计信息
watch(currentMemberId, async (newId) => {
  if (newId && selectedPool.value) {
    await loadPools(selectedPool.value?.id);
    await loadMemberStats(newId);
    await loadHistory();
  }
});

watch(() => route.params.poolId, async (poolId) => {
  const parsedId = parseInt(poolId, 10);
  if (Number.isFinite(parsedId)) {
    await loadPools(parsedId);
  }
});
</script>

<template>
  <div class="lottery-page">
    <header class="lottery-header">
      <div class="header-left">
        <el-button :icon="ArrowLeft" circle @click="goBack" />
        <h1>🎰 幸运抽奖</h1>
      </div>
    </header>

    <main class="lottery-main" v-loading="loading">
      <div class="lottery-content">
        <!-- 左侧：转盘抽奖区域 -->
        <div class="lottery-left">
          <div class="pool-selector" v-if="pools.length > 0">
            <div v-for="pool in pools" :key="pool.id" class="pool-tab" :class="{ active: selectedPool?.id === pool.id }"
              @click="selectPool(pool)">
              <span class="pool-icon">{{ pool.icon }}</span>
              <span class="pool-name">{{ pool.name }}</span>
            </div>
          </div>

          <div class="wheel-section" v-if="poolDetail?.version && (poolDetail.version.prizes || []).length > 0">
            <div class="wheel-container">
              <div class="wheel" :style="{
                transform: `rotate(${wheelRotation}deg)`,
                transition: isWheelSpinning ? 'transform 3s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
                background: wheelBackground,
              }">
                <div class="wheel-labels">
                  <div v-for="sector in wheelSectors" :key="sector.key" class="wheel-label"
                    :style="{ transform: `rotate(${sector.angleMid}deg)` }">
                    <div class="label-content" :style="{ transform: `translateY(18px) rotate(${-sector.angleMid}deg)` }">
                      <span class="prize-icon">{{ sector.prize.icon }}</span>
                      <span class="prize-name">{{ sector.prize.name }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="wheel-pointer">▼</div>
            </div>

            <div class="spin-area">
              <!-- 成员统计信息 -->
              <div v-if="currentMemberId && memberStats" class="member-stats mb-4 p-4 bg-white/5 rounded-xl border border-white/10">
                <div class="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div class="text-gray-400 mb-1">抽奖券剩余</div>
                    <div class="text-yellow-400 font-bold text-lg">{{ selectedPool.memberTicketCount || 0 }} 张</div>
                  </div>
                  <div>
                    <div class="text-gray-400 mb-1">历史总抽奖次数</div>
                    <div class="text-white font-bold text-lg">{{ memberStats.totalCount || 0 }} 次</div>
                  </div>
                  <div>
                    <div class="text-gray-400 mb-1">当前抽奖次数</div>
                    <div class="text-white font-bold text-lg">{{ memberStats.todayCount || 0 }} 次</div>
                  </div>
                  <div>
                    <div class="text-gray-400 mb-1">当前保底计数</div>
                    <div class="text-orange-400 font-bold text-lg">
                      {{ memberStats.consecutiveCount || 0 }}
                      <span v-if="memberStats.guaranteeThreshold" class="text-xs opacity-70">
                        / {{ memberStats.guaranteeThreshold }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <template v-if="selectedPool?.entry_ticket_type_id">
                <div v-if="!currentMemberId" class="ticket-status mb-3 text-sm text-gray-300 text-center">
                  请先选择抽奖成员
                </div>

                <div v-else-if="(selectedPool.memberTicketCount || 0) < selectedPool.tickets_per_draw"
                  class="flex flex-col items-center gap-2">
                  <button class="spin-btn disabled bg-gray-600 cursor-not-allowed opacity-50" disabled>
                    券不足
                  </button>
                  <button class="text-blue-400 text-sm hover:text-blue-300 underline underline-offset-4 cursor-pointer mt-1"
                    @click="goToMarket">
                    去商城获取 &rarr;
                  </button>
                </div>

                <button v-else class="spin-btn" :class="{ disabled: spinning }" :disabled="spinning"
                  @click="handleSpinClick">
                  <span v-if="spinning">抽奖中...</span>
                  <span v-else>立即抽奖 <span class="text-xs opacity-80">(消耗{{ selectedPool.tickets_per_draw }})</span></span>
                </button>
              </template>

              <button v-else class="spin-btn" :class="{ disabled: spinning }" :disabled="spinning" @click="handleSpinClick">
                <span v-if="spinning">抽奖中...</span>
                <span v-else>{{ currentMemberId ? '立即抽奖' : '选择成员开始抽奖' }}</span>
              </button>
            </div>

            <div class="guarantee-info" v-if="poolDetail.version.minGuaranteeCount">
              <span>🎁 {{ poolDetail.version.minGuaranteeCount }} 次保底大奖</span>
            </div>
          </div>

          <div class="empty-state" v-else-if="!loading && selectedPool">
            <p>该抽奖池尚未配置奖品</p>
          </div>
          <div class="empty-state" v-else-if="!loading && pools.length === 0">
            <p>暂无可用的抽奖池</p>
          </div>
        </div>

        <!-- 右侧：抽奖记录区域 -->
        <div class="lottery-right" v-if="currentMemberId">
          <div class="history-section">
            <div class="section-header">
              <h2>🎲 抽奖记录</h2>
              <el-button size="small" :icon="Refresh" @click="loadHistory">刷新</el-button>
            </div>

            <!-- Tab 标签 -->
            <div class="history-tabs">
              <button 
                class="history-tab" 
                :class="{ active: activeTab === 'today' }"
                @click="activeTab = 'today'"
              >
                📅 今日抽奖记录
                <span v-if="currentRecords.length > 0" class="tab-badge">{{ currentRecords.length }}</span>
              </button>
              <button 
                class="history-tab" 
                :class="{ active: activeTab === 'history' }"
                @click="activeTab = 'history'"
              >
                📚 历史抽奖记录
                <span v-if="historyRecords.length > 0" class="tab-badge">{{ historyRecords.length }}</span>
              </button>
            </div>

            <!-- Tab 内容 -->
            <div class="history-content">
              <!-- 今日抽奖记录 -->
              <div v-show="activeTab === 'today'" class="history-tab-content">
                <div v-if="currentRecords.length > 0" class="history-list">
                  <div v-for="log in currentRecords" :key="log.id" class="history-item" :class="log.result_type">
                    <div class="history-left">
                      <span class="history-pool">{{ log.pool_icon }} {{ log.pool_name }}</span>
                      <span class="history-time">{{ dayjs(log.created_at).format('HH:mm') }}</span>
                    </div>
                    <div class="history-right">
                      <span class="history-prize" :class="{ guarantee: log.is_guarantee }">
                        {{ log.result_name }}
                        <span v-if="log.is_guarantee" class="guarantee-tag">保底</span>
                      </span>
                      <span class="history-type">{{ getResultTypeLabel(log.result_type) }}</span>
                    </div>
                  </div>
                </div>
                <div v-else class="empty-history">
                  今日暂无抽奖记录
                </div>
              </div>

              <!-- 历史抽奖记录 -->
              <div v-show="activeTab === 'history'" class="history-tab-content">
                <div v-if="historyRecords.length > 0" class="history-list">
                  <div v-for="log in historyRecords" :key="log.id" class="history-item" :class="log.result_type">
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
                </div>
                <div v-else class="empty-history">
                  暂无历史抽奖记录
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <div class="result-modal" v-if="showResult" @click="showResult = false">
      <div class="result-content" @click.stop>
        <div class="result-icon">{{ spinResult?.prize?.icon }}</div>
        <h2>{{ spinResult?.isGuarantee ? '🎉 保底触发！' : '恭喜获得' }}</h2>
        <div class="result-prize">{{ spinResult?.prize?.name }}</div>
        <p class="result-type">{{ getResultTypeLabel(spinResult?.prize?.type) }}</p>
        <el-button type="primary" @click="showResult = false">确定</el-button>
      </div>
    </div>

    <MemberSelector v-model:visible="showMemberSelector" title="选择抽奖成员"
      :action-description="selectedPool ? `在「${selectedPool.name}」抽奖` : '选择进行抽奖的成员'" action-icon="🎰"
      confirm-text="开始抽奖" :loading="spinning" @confirm="handleMemberConfirm" @cancel="closeMemberSelector" />
  </div>
</template>

<style scoped>
.lottery-page {
  height: 860px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  background-attachment: fixed;
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
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.lottery-content {
  flex: 1;
  display: flex;
  gap: 24px;
  padding: 20px;
  overflow: hidden;
  min-height: 0;
}

.lottery-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.lottery-right {
  width: 400px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  padding-left: 24px;
  min-height: 0;
}

/* Pool Selector */
.pool-selector {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 12px;
  margin-bottom: 24px;
  flex-shrink: 0;
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

/* Wheel Section */
.wheel-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  width: 100%;
  min-height: 0;
  overflow: hidden;
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

/* Spin Area */
.spin-area {
  text-align: center;
  width: 100%;
  max-width: 300px;
}

.spin-btn {
  width: 100%;
  padding: 16px 0;
  font-size: 18px;
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

  0%,
  100% {
    transform: scale(1);
  }

  50% {
    transform: scale(1.05);
  }
}

.spin-hint {
  margin-top: 12px;
  font-size: 14px;
  opacity: 0.7;
}

.ticket-status {
  background: rgba(0, 0, 0, 0.2);
  padding: 4px 12px;
  border-radius: 12px;
  display: inline-block;
}

.member-stats {
  backdrop-filter: blur(10px);
}

.member-stats .grid {
  display: grid;
}

.history-group {
  margin-bottom: 24px;
}

.history-group-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
  color: rgba(255, 255, 255, 0.9);
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
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.history-content {
  flex: 1 1 0;
  overflow: hidden;
  min-height: 0;
  height: 0;
}

.history-content::-webkit-scrollbar {
  width: 6px;
}

.history-content::-webkit-scrollbar-track {
  background: transparent;
}

.history-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.history-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

.section-header h2 {
  font-size: 18px;
  margin: 0;
}

.history-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.history-tab {
  flex: 1;
  padding: 12px 16px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  position: relative;
}

.history-tab:hover {
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.05);
}

.history-tab.active {
  color: #fff;
  border-bottom-color: #667eea;
  background: rgba(255, 255, 255, 0.05);
}

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: rgba(102, 126, 234, 0.3);
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
}

.history-tab.active .tab-badge {
  background: rgba(102, 126, 234, 0.5);
}

.history-tab-content {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 8px;
}

.history-tab-content::-webkit-scrollbar {
  width: 6px;
}

.history-tab-content::-webkit-scrollbar-track {
  background: transparent;
}

.history-tab-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.history-tab-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
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
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
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
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
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
  0% {
    transform: scale(0.5);
    opacity: 0;
  }

  50% {
    transform: scale(1.05);
  }

  100% {
    transform: scale(1);
    opacity: 1;
  }
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