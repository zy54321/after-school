<template>
  <div class="bid-history">
    <h3 class="history-title">
      <span>📋</span>
      出价记录
      <span class="bid-count" v-if="bidsWithNames.length > 0">({{ bidsWithNames.length }})</span>
    </h3>
    
    <div class="history-list" v-if="bidsWithNames.length > 0">
      <div 
        v-for="(bid, index) in bidsWithNames" 
        :key="bid.id || `${bid.lot_id}_${bid.bidder_id}_${bid.created_at}`"
        class="bid-item"
        :class="{ 'is-top': index === 0 }"
      >
        <div class="bid-rank">{{ index + 1 }}</div>
        <div class="bid-info">
          <div class="bidder-name">{{ bid.bidder_name || '未知' }}</div>
          <div class="bid-time">{{ formatTime(bid.created_at) }}</div>
        </div>
        <div class="bid-amount">{{ bid.bid_points }} 积分</div>
      </div>
    </div>
    
    <div class="empty-history" v-else>
      <div class="empty-icon">📋</div>
      <p>暂无出价记录</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  bids: {
    type: Array,
    default: () => [],
  },
  members: {
    type: Array,
    default: () => [],
  },
});

// 将出价记录与成员名称关联
const bidsWithNames = computed(() => {
  return props.bids.map(bid => {
    const member = props.members.find(m => m.id === bid.bidder_id);
    return {
      ...bid,
      bidder_name: member?.name || `成员${bid.bidder_id}`,
    };
  }).sort((a, b) => {
    // 按出价金额降序，时间降序
    if (b.bid_points !== a.bid_points) {
      return b.bid_points - a.bid_points;
    }
    return new Date(b.created_at) - new Date(a.created_at);
  });
});

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (seconds < 60) {
    return '刚刚';
  } else if (minutes < 60) {
    return `${minutes} 分钟前`;
  } else if (hours < 24) {
    return `${hours} 小时前`;
  } else {
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
};
</script>

<style scoped>
.bid-history {
  padding: 20px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
}

.history-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 16px;
  color: #fff;
}

.bid-count {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  font-weight: normal;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
}

.bid-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  transition: all 0.3s ease;
}

.bid-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.bid-item.is-top {
  border-color: rgba(79, 172, 254, 0.3);
  background: rgba(79, 172, 254, 0.1);
}

.bid-rank {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  flex-shrink: 0;
}

.bid-item.is-top .bid-rank {
  background: linear-gradient(135deg, #4facfe, #00f2fe);
  color: #fff;
}

.bid-info {
  flex: 1;
  min-width: 0;
}

.bidder-name {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 4px;
}

.bid-time {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.bid-amount {
  font-size: 16px;
  font-weight: 700;
  color: #4facfe;
  flex-shrink: 0;
}

.empty-history {
  text-align: center;
  padding: 40px 20px;
  color: rgba(255, 255, 255, 0.5);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.empty-history p {
  margin: 0;
  font-size: 14px;
}
</style>
