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
  usageStats: {
    type: Array,
    default: () => []
  },
  history: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['auction-click', 'context-menu']);

// 过滤出竞拍品
const auctionItems = computed(() => {
  return props.rewards.filter(r => r.type === 'auction');
});

// 检查竞拍品状态（与兑换品相同的逻辑，考虑周期限制）
const checkAuctionStatus = (auction) => {
  if (auction.limit_type === 'unlimited') return { available: true, text: '' };
  
  // 计算周期内的使用次数
  let periodStart = dayjs();
  if (auction.limit_type === 'weekly') {
    periodStart = periodStart.startOf('week').add(1, 'day'); // 周一
  } else if (auction.limit_type === 'monthly') {
    periodStart = periodStart.startOf('month');
  } else if (auction.limit_type === 'daily') {
    periodStart = periodStart.startOf('day');
  }
  
  // 从历史记录中统计周期内的使用次数
  const periodUsage = props.history.filter(log => {
    if (log.reward_id !== auction.id) return false;
    const logTime = dayjs(log.created_at);
    // 检查是否在周期开始时间之后（包括等于）
    return logTime.isAfter(periodStart) || logTime.isSame(periodStart);
  }).length;
  
  const left = auction.limit_max - periodUsage;
  return left <= 0 ? { available: false, text: '完' } : { available: true, text: `剩 ${left}` };
};

const handleAuctionClick = (auction) => {
  emit('auction-click', auction);
};

const handleContextMenu = (e, auction) => {
  emit('context-menu', e, auction, 'auction');
};

let longPressTimer = null;

const handleTouchStart = (e, auction) => {
  longPressTimer = setTimeout(() => {
    emit('context-menu', e.touches[0], auction, 'auction');
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
      v-for="a in auctionItems"
      :key="a.id"
      class="card reward-card auction-card"
      :class="{ disabled: !checkAuctionStatus(a).available }"
      @click="handleAuctionClick(a)"
      @contextmenu="handleContextMenu($event, a)"
      @touchstart="handleTouchStart($event, a)"
      @touchend="handleTouchEnd">
      <div class="r-icon">{{ a.icon || '🔨' }}</div>
      <div class="r-name">{{ a.name }}</div>
      <div v-if="a.description" class="r-description">{{ a.description }}</div>
      <div class="r-cost">起拍: {{ a.cost }}</div>
      <div v-if="a.limit_type !== 'unlimited'" class="limit-badge">{{ checkAuctionStatus(a).text }}</div>
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

.auction-card {
  border: 2px solid #e6a23c;
  background: #fffbf0;
}

.r-icon {
  font-size: 28px;
  margin-bottom: 5px;
}

.r-name {
  font-weight: bold;
  font-size: 0.9rem;
}

.r-description {
  font-size: 0.8rem;
  color: #666;
  margin: 8px 0;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
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

.auction-card.disabled {
  opacity: 0.5;
  filter: grayscale(1);
}
</style>

