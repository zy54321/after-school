<template>
  <Teleport to="body">
    <div class="member-selector-overlay" v-if="visible" @click.self="handleCancel">
      <div class="member-selector-modal">
        <div class="modal-header">
          <h3>{{ title || '选择成员' }}</h3>
          <button class="close-btn" @click="handleCancel">×</button>
        </div>
        
        <div class="modal-body">
          <!-- 操作描述 -->
          <div class="action-preview" v-if="actionDescription">
            <span class="preview-icon">{{ actionIcon || '✨' }}</span>
            <div class="preview-text">{{ actionDescription }}</div>
          </div>

          <!-- 成员列表 -->
          <div class="members-grid">
            <div 
              v-for="member in members" 
              :key="member.id"
              class="member-option"
              :class="{ selected: selectedMemberId === member.id, insufficient: requireBalance && (member.balance || 0) < requiredBalance }"
              @click="selectMember(member)"
            >
              <div class="member-avatar">{{ member.name?.charAt(0) || '?' }}</div>
              <div class="member-info">
                <div class="member-name">{{ member.name }}</div>
                <div class="member-balance">
                  <span class="balance-icon">💰</span>
                  <span class="balance-value">{{ member.balance || 0 }}</span>
                  <span class="balance-unit">积分</span>
                </div>
              </div>
              <div class="member-check" v-if="selectedMemberId === member.id">✓</div>
              <div class="member-warning" v-else-if="requireBalance && (member.balance || 0) < requiredBalance">
                积分不足
              </div>
            </div>
          </div>

          <!-- 所需费用提示 -->
          <div class="cost-hint" v-if="requiredBalance > 0">
            <span>所需积分：</span>
            <strong>{{ requiredBalance }}</strong>
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="cancel-btn" @click="handleCancel">取消</button>
          <button 
            class="confirm-btn" 
            :disabled="!selectedMemberId || (requireBalance && selectedMemberBalance < requiredBalance) || loading"
            @click="handleConfirm"
          >
            {{ loading ? '处理中...' : (confirmText || '确认') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import axios from 'axios';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: '选择成员',
  },
  actionDescription: {
    type: String,
    default: '',
  },
  actionIcon: {
    type: String,
    default: '✨',
  },
  confirmText: {
    type: String,
    default: '确认',
  },
  requiredBalance: {
    type: Number,
    default: 0,
  },
  requireBalance: {
    type: Boolean,
    default: false,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  defaultMemberId: {
    type: Number,
    default: null,
  },
});

const emit = defineEmits(['update:visible', 'confirm', 'cancel']);

const members = ref([]);
const selectedMemberId = ref(null);

const selectedMemberBalance = computed(() => {
  const member = members.value.find(m => m.id === selectedMemberId.value);
  return member?.balance || 0;
});

// 加载成员列表
const loadMembers = async () => {
  try {
    const res = await axios.get('/api/v2/family/members');
    if (res.data?.code === 200) {
      members.value = res.data.data?.members || [];
      
      // 设置默认选中
      if (props.defaultMemberId) {
        selectedMemberId.value = props.defaultMemberId;
      } else if (members.value.length === 1) {
        // 只有一个成员时自动选中
        selectedMemberId.value = members.value[0].id;
      }
    }
  } catch (err) {
    console.error('加载成员列表失败:', err);
  }
};

// 选择成员
const selectMember = (member) => {
  // 如果需要余额检查且余额不足，不允许选择
  if (props.requireBalance && (member.balance || 0) < props.requiredBalance) {
    return;
  }
  selectedMemberId.value = member.id;
};

// 确认选择
const handleConfirm = () => {
  if (!selectedMemberId.value) return;
  
  const member = members.value.find(m => m.id === selectedMemberId.value);
  emit('confirm', {
    memberId: selectedMemberId.value,
    member,
  });
};

// 取消选择
const handleCancel = () => {
  emit('cancel');
  emit('update:visible', false);
};

// 监听显示状态变化
watch(() => props.visible, (newVal) => {
  if (newVal) {
    loadMembers();
    // 重置选择（除非有默认值）
    if (!props.defaultMemberId) {
      selectedMemberId.value = null;
    }
  }
});

onMounted(() => {
  if (props.visible) {
    loadMembers();
  }
});
</script>

<style scoped>
.member-selector-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.member-selector-modal {
  background: linear-gradient(180deg, #1e1e2e 0%, #1a1a2a 100%);
  border-radius: 20px;
  width: 90%;
  max-width: 420px;
  max-height: 85vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-header h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: #fff;
}

.close-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: color 0.3s;
}

.close-btn:hover {
  color: #fff;
}

.modal-body {
  padding: 24px;
  max-height: 50vh;
  overflow-y: auto;
}

/* 操作描述 */
.action-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  margin-bottom: 20px;
}

.preview-icon {
  font-size: 32px;
}

.preview-text {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.5;
}

/* 成员网格 */
.members-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.member-option {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid transparent;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.member-option:hover:not(.insufficient) {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(102, 126, 234, 0.3);
}

.member-option.selected {
  background: rgba(102, 126, 234, 0.15);
  border-color: rgba(102, 126, 234, 0.6);
}

.member-option.insufficient {
  opacity: 0.5;
  cursor: not-allowed;
}

.member-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  flex-shrink: 0;
}

.member-info {
  flex: 1;
}

.member-name {
  font-size: 16px;
  font-weight: 500;
  color: #fff;
  margin-bottom: 4px;
}

.member-balance {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}

.balance-icon {
  font-size: 12px;
}

.balance-value {
  font-weight: 600;
  color: #ffd700;
}

.member-check {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}

.member-warning {
  font-size: 11px;
  color: #ff4d4d;
  padding: 4px 8px;
  background: rgba(255, 77, 77, 0.2);
  border-radius: 4px;
}

/* 费用提示 */
.cost-hint {
  text-align: center;
  padding: 12px;
  margin-top: 16px;
  background: rgba(255, 215, 0, 0.1);
  border-radius: 8px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
}

.cost-hint strong {
  color: #ffd700;
  font-size: 16px;
}

/* Footer */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.cancel-btn {
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.cancel-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.confirm-btn {
  padding: 12px 32px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border: none;
  border-radius: 10px;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.confirm-btn:hover:not(:disabled) {
  transform: scale(1.02);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.confirm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 滚动条 */
.modal-body::-webkit-scrollbar {
  width: 6px;
}

.modal-body::-webkit-scrollbar-track {
  background: transparent;
}

.modal-body::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}
</style>
