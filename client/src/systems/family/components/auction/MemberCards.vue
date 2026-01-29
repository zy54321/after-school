<template>
  <div class="member-cards">
    <h4 class="cards-title">选择出价成员</h4>
    <div class="cards-grid">
      <div
        v-for="member in members"
        :key="member.id"
        class="member-card"
        :class="{ selected: selectedMemberId === member.id }"
        @click="handleSelect(member.id)"
      >
        <div class="member-avatar">{{ member.name?.charAt(0) || '?' }}</div>
        <div class="member-info">
          <div class="member-name">{{ member.name }}</div>
          <div class="member-balance">
            <span class="balance-icon">💰</span>
            <span class="balance-value">{{ member.available || 0 }}</span>
            <span class="balance-unit">可用</span>
          </div>
          <div class="member-total" v-if="member.wallet_balance !== undefined">
            <span class="total-label">总余额:</span>
            <span class="total-value">{{ member.wallet_balance || 0 }}</span>
            <span class="total-locked" v-if="member.locked_total > 0">
              (冻结: {{ member.locked_total }})
            </span>
          </div>
        </div>
        <div class="member-check" v-if="selectedMemberId === member.id">✓</div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  members: {
    type: Array,
    default: () => [],
  },
  selectedMemberId: {
    type: Number,
    default: null,
  },
});

const emit = defineEmits(['select']);

const handleSelect = (memberId) => {
  emit('select', memberId);
};
</script>

<style scoped>
.member-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cards-title {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
  font-weight: 500;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}

.member-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
}

.member-card:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
}

.member-card.selected {
  border-color: rgba(79, 172, 254, 0.5);
  background: rgba(79, 172, 254, 0.1);
}

.member-avatar {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #4facfe, #00f2fe);
  border-radius: 50%;
  font-size: 20px;
  font-weight: 700;
  color: #fff;
}

.member-info {
  text-align: center;
  width: 100%;
}

.member-name {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 4px;
}

.member-balance {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}

.balance-icon {
  font-size: 14px;
}

.balance-value {
  font-weight: 600;
  color: #4facfe;
}

.balance-unit {
  font-size: 11px;
}

.member-total {
  margin-top: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.total-label {
  font-size: 10px;
}

.total-value {
  font-weight: 500;
}

.total-locked {
  color: rgba(255, 193, 7, 0.7);
}

.member-check {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #4facfe, #00f2fe);
  border-radius: 50%;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
}
</style>
