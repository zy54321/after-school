<template>
  <div class="lot-list">
    <div class="lot-item" v-for="lot in lots" :key="lot.id" :class="{ active: lot.id === currentLotId }">
      <div class="lot-icon">{{ lot.sku_icon || '🎁' }}</div>
      <div class="lot-info">
        <div class="lot-name">{{ lot.sku_name }}</div>
        <div class="lot-meta">
          <span class="lot-status" :class="lot.status">{{ getStatusLabel(lot.status) }}</span>
          <span class="lot-price">起拍: {{ lot.start_price }}</span>
          <span class="lot-current" v-if="lot.current_price">当前: {{ lot.current_price }}</span>
          <span class="lot-bids" v-if="lot.bid_count">({{ lot.bid_count }} 人出价)</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  lots: {
    type: Array,
    default: () => [],
  },
  currentLotId: {
    type: Number,
    default: null,
  },
});

const getStatusLabel = (status) => {
  const labels = {
    pending: '待拍',
    active: '竞拍中',
    sold: '已成交',
    unsold: '流拍',
    cancelled: '已取消',
  };
  return labels[status] || status;
};
</script>

<style scoped>
.lot-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.lot-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  transition: all 0.3s ease;
}

.lot-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.lot-item.active {
  border-color: rgba(79, 172, 254, 0.5);
  background: rgba(79, 172, 254, 0.1);
}

.lot-icon {
  font-size: 32px;
  flex-shrink: 0;
}

.lot-info {
  flex: 1;
  min-width: 0;
}

.lot-name {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 6px;
  color: #fff;
}

.lot-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  flex-wrap: wrap;
}

.lot-status {
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 12px;
}

.lot-status.pending {
  background: rgba(255, 193, 7, 0.2);
  color: #ffc107;
}

.lot-status.active {
  background: rgba(79, 172, 254, 0.2);
  color: #4facfe;
}

.lot-status.sold {
  background: rgba(76, 175, 80, 0.2);
  color: #4caf50;
}

.lot-status.unsold {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);
}

.lot-price {
  color: rgba(255, 255, 255, 0.7);
}

.lot-current {
  color: #4facfe;
  font-weight: 600;
}

.lot-bids {
  color: rgba(255, 255, 255, 0.5);
}
</style>
