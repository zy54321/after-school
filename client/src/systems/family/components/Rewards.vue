<script setup>
import { computed } from 'vue';
import dayjs from 'dayjs';

const props = defineProps({
  rewards: {
    type: Array,
    required: true,
    default: () => []
  },
  currentMemberId: {
    type: Number,
    default: null
  },
  totalPoints: {
    type: Number,
    default: 0
  },
  usageStats: {
    type: Array,
    default: () => []
  },
  history: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['redeem', 'context-menu']);

// 过滤出普通奖品（非竞拍）
const filteredRewards = computed(() => {
  if (!props.currentMemberId) return [];
  return props.rewards.filter(r => {
    // 只显示 reward 类型或没有 type 的
    if (r.type && r.type !== 'reward') return false;
    // 检查是否对当前成员可见
    if (!r.target_members || r.target_members.length === 0) return true;
    return r.target_members.includes(props.currentMemberId);
  });
});

// 检查奖品状态（考虑周期限制）
const checkRewardStatus = (reward) => {
  if (reward.limit_type === 'unlimited') return { available: true, text: '' };
  
  // 计算周期内的使用次数
  let periodStart = dayjs();
  if (reward.limit_type === 'weekly') {
    periodStart = periodStart.startOf('week').add(1, 'day'); // 周一
  } else if (reward.limit_type === 'monthly') {
    periodStart = periodStart.startOf('month');
  } else if (reward.limit_type === 'daily') {
    periodStart = periodStart.startOf('day');
  }
  
  // 从历史记录中统计周期内的使用次数
  const periodUsage = props.history.filter(log => {
    if (log.reward_id !== reward.id) return false;
    const logTime = dayjs(log.created_at);
    // 检查是否在周期开始时间之后（包括等于）
    return logTime.isAfter(periodStart) || logTime.isSame(periodStart);
  }).length;
  
  const left = reward.limit_max - periodUsage;
  return left <= 0 ? { available: false, text: '完' } : { available: true, text: `剩 ${left}` };
};

const handleRedeem = (reward) => {
  emit('redeem', reward);
};

const handleContextMenu = (e, reward) => {
  emit('context-menu', e, reward, 'reward');
};

let longPressTimer = null;

const handleTouchStart = (e, reward) => {
  longPressTimer = setTimeout(() => {
    emit('context-menu', e.touches[0], reward, 'reward');
  }, 600);
};

const handleTouchEnd = () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
};
</script>

<template>
  <div class="grid shop-grid">
    <div
      v-for="r in filteredRewards"
      :key="r.id"
      class="card reward-card"
      :class="{ disabled: !checkRewardStatus(r).available || totalPoints < r.cost }"
      @click="handleRedeem(r)"
      @contextmenu="handleContextMenu($event, r)"
      @touchstart="handleTouchStart($event, r)"
      @touchend="handleTouchEnd">
      <div class="r-icon">{{ r.icon || '🎁' }}</div>
      <div class="r-name">{{ r.name }}</div>
      <div class="r-cost">💰 {{ r.cost }}</div>
      <div v-if="r.limit_type !== 'unlimited'" class="limit-badge">{{ checkRewardStatus(r).text }}</div>
    </div>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(45%, 1fr));
  gap: 10px;
  padding: 5px;
}

.card {
  background: white;
  border-radius: 12px;
  padding: 15px;
  display: flex;
  align-items: center;
  border: 1px solid #e5e7eb;
  cursor: pointer;
  position: relative;
}

.card:active {
  transform: scale(0.96);
  background: #f5f5f5;
}

.shop-grid .reward-card {
  flex-direction: column;
  text-align: center;
  padding: 15px 10px;
}

.r-icon {
  font-size: 28px;
  margin-bottom: 5px;
}

.r-name {
  font-weight: bold;
  font-size: 0.9rem;
}

.r-cost {
  color: #E6A23C;
  font-weight: bold;
  font-size: 0.9rem;
}

.limit-badge {
  position: absolute;
  top: 0;
  right: 0;
  background: #909399;
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-bottom-left-radius: 8px;
}

.reward-card.disabled {
  opacity: 0.5;
  filter: grayscale(1);
}
</style>

