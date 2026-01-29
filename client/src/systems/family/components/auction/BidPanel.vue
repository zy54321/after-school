<template>
  <div class="bid-panel">
    <!-- 当前拍品信息 -->
    <div class="lot-info-section">
      <div class="info-row">
        <span class="info-label">当前最高出价</span>
        <span class="info-value">{{ currentHighestBid || 0 }} 积分</span>
      </div>
      <div class="info-row" v-if="leadingBidder">
        <span class="info-label">领先出价者</span>
        <span class="info-value">{{ leadingBidder.name }}</span>
      </div>
    </div>

    <!-- 成员卡片 -->
    <MemberCards 
      :members="members" 
      :selected-member-id="selectedMemberId"
      :current-lot-id="currentLotId"
      @select="handleMemberSelect"
    />

    <!-- 快速加价按钮（辅助） -->
    <div class="quick-bid-buttons" v-if="currentHighestBid > 0 && selectedMemberId">
      <button
        v-for="increment in quickIncrements"
        :key="increment"
        class="quick-bid-btn"
        @click="handleQuickBid(increment)"
        :disabled="bidding"
      >
        +{{ increment }}
      </button>
    </div>

    <!-- 直接输入最终价（主路径） -->
    <div class="custom-bid">
      <label>直接输入最终价</label>
      <div class="bid-input-group">
        <input
          type="number"
          v-model.number="customBid"
          :min="minBid"
          :placeholder="`最低 ${minBid} 积分`"
          class="bid-input"
          :disabled="bidding || !selectedMemberId"
          @keyup.enter="handleSubmitBid"
        />
        <button
          class="bid-submit-btn"
          @click="handleSubmitBid"
          :disabled="bidding || !selectedMemberId || customBid < minBid"
        >
          {{ bidding ? '提交中...' : '提交出价' }}
        </button>
      </div>
      <div class="bid-hint" v-if="selectedMemberId && selectedMember">
        可用积分: <strong>{{ selectedMember.available || 0 }}</strong>
        <span v-if="selectedMember.lotHighestBid" class="lot-highest-bid">
          （该拍品当前最高: {{ selectedMember.lotHighestBid }}）
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import MemberCards from './MemberCards.vue';

const props = defineProps({
  members: {
    type: Array,
    default: () => [],
  },
  currentHighestBid: {
    type: Number,
    default: 0,
  },
  leadingBidder: {
    type: Object,
    default: null,
  },
  minBid: {
    type: Number,
    default: 0,
  },
  bidding: {
    type: Boolean,
    default: false,
  },
  currentLotId: {
    type: Number,
    default: null,
  },
});

const emit = defineEmits(['bid', 'member-select']);

const selectedMemberId = ref(null);
const customBid = ref(0);
const step = 1; // 默认加价步长

const quickIncrements = [5, 10, 20, 50];

// 计算选中成员的可用积分
const selectedMember = computed(() => {
  if (!selectedMemberId.value) return null;
  return props.members.find(m => m.id === selectedMemberId.value);
});

const handleMemberSelect = (memberId) => {
  selectedMemberId.value = memberId;
  // 选中成员后，默认填入 currentHighestBid + step
  if (props.currentHighestBid > 0) {
    customBid.value = props.currentHighestBid + step;
  } else if (props.minBid > 0) {
    customBid.value = props.minBid;
  }
  emit('member-select', memberId);
};

const handleQuickBid = (increment) => {
  if (!selectedMemberId.value) {
    return;
  }
  // 快速加价：当前最高价 + 增量
  const bidAmount = props.currentHighestBid + increment;
  customBid.value = bidAmount;
  // 不自动提交，让用户确认后再提交
};

const handleSubmitBid = () => {
  if (!selectedMemberId.value) {
    ElMessage.warning('请先选择成员');
    return;
  }
  if (customBid.value < props.minBid) {
    ElMessage.warning(`出价必须至少 ${props.minBid} 积分`);
    return;
  }
  
  // 立即禁用按钮（通过 emit 让父组件处理）
  emit('bid', {
    memberId: selectedMemberId.value,
    bidPoints: customBid.value,
  });
};

// 监听当前最高价变化，自动更新输入框默认值
watch(() => props.currentHighestBid, (newPrice) => {
  if (selectedMemberId.value && newPrice > 0) {
    // 如果当前输入值小于新的最低出价，自动更新
    if (customBid.value < newPrice + step) {
      customBid.value = newPrice + step;
    }
  }
}, { immediate: true });
</script>

<style scoped>
.bid-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
}

.quick-bid-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.quick-bid-btn {
  flex: 1;
  min-width: 80px;
  padding: 10px 16px;
  background: rgba(79, 172, 254, 0.2);
  border: 1px solid rgba(79, 172, 254, 0.3);
  border-radius: 10px;
  color: #4facfe;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.quick-bid-btn:hover:not(:disabled) {
  background: rgba(79, 172, 254, 0.3);
  border-color: rgba(79, 172, 254, 0.5);
}

.quick-bid-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.custom-bid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.custom-bid label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
}

.bid-input-group {
  display: flex;
  gap: 8px;
}

.bid-input {
  flex: 1;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: #fff;
  font-size: 16px;
}

.bid-input:focus {
  outline: none;
  border-color: rgba(79, 172, 254, 0.5);
}

.bid-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.bid-submit-btn {
  padding: 12px 24px;
  background: linear-gradient(135deg, #4facfe, #00f2fe);
  border: none;
  border-radius: 10px;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.bid-submit-btn:hover:not(:disabled) {
  box-shadow: 0 4px 15px rgba(79, 172, 254, 0.4);
}

.bid-submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.bid-hint {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}

.bid-hint strong {
  color: #4facfe;
}

.lot-highest-bid {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  margin-left: 8px;
}

.lot-info-section {
  padding: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  margin-bottom: 16px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.info-row:not(:last-child) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.info-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
}

.info-value {
  font-size: 16px;
  font-weight: 600;
  color: #4facfe;
}
</style>
