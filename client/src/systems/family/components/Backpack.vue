<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import axios from 'axios';
import { ElMessage, ElMessageBox } from 'element-plus';
import dayjs from 'dayjs';

const { t } = useI18n();

const props = defineProps({
  memberId: {
    type: Number,
    default: null
  },
  members: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['refresh']);

// 状态
const loading = ref(false);
const items = ref([]);
const stats = ref({
  total_items: 0,
  unused_count: 0,
  used_count: 0
});
const filterStatus = ref('unused'); // 'unused' / 'used' / 'all'

// 转赠相关
const showTransferModal = ref(false);
const transferForm = ref({
  backpackId: null,
  toMemberId: null,
  quantity: 1,
  maxQuantity: 1
});

// 使用记录相关
const showUsageHistoryModal = ref(false);
const usageHistory = ref([]);
const loadingHistory = ref(false);

const showUseModal = ref(false);
const useForm = ref({
  item: null,
  quantity: 1
});

// 过滤后的物品列表
const filteredItems = computed(() => {
  if (filterStatus.value === 'all') {
    return items.value;
  }
  return items.value.filter(item => item.status === filterStatus.value);
});

// 加载背包数据
const loadBackpack = async () => {
  if (!props.memberId) {
    items.value = [];
    return;
  }

  loading.value = true;
  try {
    const res = await axios.get('/api/family/backpack', {
      params: {
        memberId: props.memberId,
        status: filterStatus.value === 'all' ? 'all' : filterStatus.value
      }
    });

    if (res.data.code === 200) {
      items.value = res.data.data.items || [];
      stats.value = res.data.data.stats || {
        total_items: 0,
        unused_count: 0,
        used_count: 0
      };
    }
  } catch (err) {
    console.error('加载背包失败:', err);
    ElMessage.error(t('familyDashboard.loadBackpackFailed'));
  } finally {
    loading.value = false;
  }
};

// 使用物品
const handleUse = (item) => {
  if (item.status !== 'unused') {
    ElMessage.warning(t('familyDashboard.itemUsed'));
    return;
  }

  // 打开弹窗而不是直接 confirm
  useForm.value = {
    item: item,
    quantity: 1
  };
  showUseModal.value = true;
};

const confirmUse = async () => {
  const { item, quantity } = useForm.value;
  if (!item) return;

  try {
    const res = await axios.post('/api/family/backpack/use', {
      backpackId: item.id,
      memberId: props.memberId,
      quantity: quantity
    });

    if (res.data.code === 200) {
      ElMessage.success(t('familyDashboard.useSuccess'));
      showUseModal.value = false;
      await loadBackpack();
      emit('refresh'); // 通知父组件刷新
    } else {
      ElMessage.warning(res.data.msg || t('familyDashboard.useFailed'));
    }
  } catch (err) {
    console.error('使用物品失败:', err);
    ElMessage.error(err.response?.data?.msg || t('familyDashboard.useFailed'));
  }
};

// 格式化时间
const formatTime = (time) => {
  if (!time) return '';
  return dayjs(time).format('YYYY-MM-DD HH:mm');
};

// 打开转赠弹窗
const openTransfer = (item) => {
  if (item.status !== 'unused') {
    ElMessage.warning(t('familyDashboard.itemUsed'));
    return;
  }
  transferForm.value = {
    backpackId: item.id,
    toMemberId: null,
    quantity: 1,
    maxQuantity: item.quantity || 1
  };
  showTransferModal.value = true;
};

// 确认转赠
const confirmTransfer = async () => {
  if (!transferForm.value.toMemberId) {
    ElMessage.warning(t('familyDashboard.transferTo'));
    return;
  }
  if (transferForm.value.toMemberId === props.memberId) {
    ElMessage.warning(t('familyDashboard.cannotTransferToSelf'));
    return;
  }

  try {
    const res = await axios.post('/api/family/backpack/transfer', {
      backpackId: transferForm.value.backpackId,
      fromMemberId: props.memberId,
      toMemberId: transferForm.value.toMemberId,
      quantity: transferForm.value.quantity
    });

    if (res.data.code === 200) {
      ElMessage.success(t('familyDashboard.transferSuccess'));
      showTransferModal.value = false;
      await loadBackpack();
      emit('refresh');
    } else {
      ElMessage.warning(res.data.msg || t('familyDashboard.transferFailed'));
    }
  } catch (err) {
    console.error('转赠失败:', err);
    ElMessage.error(err.response?.data?.msg || t('familyDashboard.transferFailed'));
  }
};

// 加载使用记录
const loadUsageHistory = async () => {
  if (!props.memberId) return;

  loadingHistory.value = true;
  try {
    const res = await axios.get('/api/family/backpack/usage-history', {
      params: {
        memberId: props.memberId,
        limit: 100
      }
    });

    if (res.data.code === 200) {
      usageHistory.value = res.data.data.history || [];
    }
  } catch (err) {
    console.error('加载使用记录失败:', err);
    ElMessage.error(t('common.failed'));
  } finally {
    loadingHistory.value = false;
  }
};

// 打开使用记录弹窗
const openUsageHistory = async () => {
  showUsageHistoryModal.value = true;
  await loadUsageHistory();
};

// 暴露刷新方法给父组件
defineExpose({
  refresh: loadBackpack
});

// 监听成员ID变化
watch(() => props.memberId, () => {
  loadBackpack();
}, { immediate: true });

// 监听筛选状态变化
watch(() => filterStatus.value, () => {
  loadBackpack();
});
</script>

<template>
  <div class="backpack-container">
    <!-- 统计和筛选 -->
    <div class="backpack-header">
      <div class="stats-bar">
        <div class="stat-item">
          <span class="label">{{ $t('common.total') }}</span>
          <span class="value">{{ stats.total_items }}</span>
        </div>
        <div class="stat-item unused">
          <span class="label">{{ $t('familyDashboard.unused') }}</span>
          <span class="value">{{ stats.unused_count }}</span>
        </div>
        <div class="stat-item used">
          <span class="label">{{ $t('familyDashboard.used') }}</span>
          <span class="value">{{ stats.used_count }}</span>
        </div>
      </div>

      <div class="filter-tabs">
        <div class="filter-tab" :class="{ active: filterStatus === 'all' }" @click="filterStatus = 'all'">
          {{ $t('familyDashboard.all') }}
        </div>
        <div class="filter-tab" :class="{ active: filterStatus === 'unused' }" @click="filterStatus = 'unused'">
          {{ $t('familyDashboard.unused') }}
        </div>
        <div class="filter-tab" :class="{ active: filterStatus === 'used' }" @click="filterStatus = 'used'">
          {{ $t('familyDashboard.used') }}
        </div>
        <div class="filter-tab history-tab" @click="openUsageHistory">
          {{ $t('familyDashboard.usageHistory') }}
        </div>
      </div>
    </div>

    <!-- 物品列表 -->
    <div v-if="loading" class="loading">{{ $t('common.loading') }}</div>
    <div v-else-if="filteredItems.length === 0" class="empty">
      <div class="empty-icon">🎒</div>
      <div class="empty-text">{{ $t('familyDashboard.emptyBackpack') }}</div>
    </div>
    <div v-else class="backpack-grid">
      <div v-for="item in filteredItems" :key="item.id" class="backpack-item"
        :class="{ 'is-used': item.status === 'used' }">
        <div class="item-icon">{{ item.reward_icon || '🎁' }}</div>
        <div class="item-info">
          <div class="item-name">{{ item.reward_name }}</div>
          <div class="item-meta">
            <span class="item-time">{{ $t('familyDashboard.obtainedAt') }}：{{ formatTime(item.obtained_at) }}</span>
            <span v-if="item.status === 'used'" class="item-time">
              {{ $t('familyDashboard.usedAt') }}：{{ formatTime(item.used_at) }}
            </span>
          </div>
        </div>
        <div class="item-actions">
          <div v-if="item.quantity > 1" class="quantity-badge">{{ item.quantity }}</div>
          <div class="action-buttons">
            <el-button v-if="item.status === 'unused'" type="primary" size="small" round @click="handleUse(item)">
              {{ $t('familyDashboard.use') }}
            </el-button>
            <el-button v-if="item.status === 'unused'" type="success" size="small" round @click="openTransfer(item)">
              {{ $t('familyDashboard.transfer') }}
            </el-button>
            <el-tag v-if="item.status === 'used'" type="info" size="small">{{ $t('familyDashboard.used') }}</el-tag>
          </div>
        </div>
      </div>
    </div>

    <!-- 转赠弹窗 -->
    <el-dialog v-model="showTransferModal" :title="$t('familyDashboard.transfer')" width="90%">
      <el-form label-position="top">
        <el-form-item :label="$t('familyDashboard.transferTo')">
          <el-select v-model="transferForm.toMemberId" :placeholder="$t('common.placeholderSelect')"
            style="width: 100%">
            <el-option v-for="member in members.filter(m => m.id !== memberId)" :key="member.id" :label="member.name"
              :value="member.id">
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item :label="$t('familyDashboard.quantity')">
          <el-input-number v-model="transferForm.quantity" :min="1" :max="transferForm.maxQuantity" />
          <div style="font-size: 0.75rem; color: #909399; margin-top: 4px;">
            {{ $t('familyDashboard.maxTransfer') }}：{{ transferForm.maxQuantity }}
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showTransferModal = false">{{ $t('familyDashboard.cancel') }}</el-button>
        <el-button type="primary" @click="confirmTransfer">{{ $t('familyDashboard.confirmTransfer') }}</el-button>
      </template>
    </el-dialog>

    <!-- 使用记录弹窗 -->
    <el-dialog v-model="showUsageHistoryModal" :title="$t('familyDashboard.usageHistory')" width="90%">
      <div v-if="loadingHistory" class="loading">{{ $t('common.loading') }}</div>
      <div v-else-if="usageHistory.length === 0" class="empty">
        <div class="empty-icon">📝</div>
        <div class="empty-text">{{ $t('familyDashboard.noHistory') }}</div>
      </div>
      <div v-else class="usage-history-list">
        <div v-for="record in usageHistory" :key="record.id" class="usage-record-item">
          <div class="record-icon">{{ record.reward_icon || '🎁' }}</div>
          <div class="record-info">
            <div class="record-name">{{ record.reward_name }}</div>
            <div class="record-meta">
              <span class="record-time">{{ $t('familyDashboard.usedAt') }}：{{ formatTime(record.used_at) }}</span>
              <span v-if="record.quantity > 1" class="record-quantity">{{ $t('familyDashboard.usedQuantity') }}：{{
                record.quantity }}</span>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>

    <el-dialog v-model="showUseModal" :title="$t('familyDashboard.use')" width="320px">
      <div v-if="useForm.item" style="text-align: center; padding: 10px;">
        <div style="font-size: 3rem; margin-bottom: 10px;">{{ useForm.item.reward_icon || '🎁' }}</div>
        <h3 style="margin: 0 0 5px 0;">{{ useForm.item.reward_name }}</h3>
        <p style="color: #666; font-size: 12px; margin-bottom: 20px;">
          当前拥有: {{ useForm.item.quantity }}
        </p>

        <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
          <span>使用数量:</span>
          <el-input-number v-model="useForm.quantity" :min="1" :max="useForm.item.quantity" size="default" />
        </div>
      </div>
      <template #footer>
        <el-button @click="showUseModal = false">{{ $t('familyDashboard.cancel') }}</el-button>
        <el-button type="primary" @click="confirmUse">{{ $t('familyDashboard.confirm') }}</el-button>
      </template>
    </el-dialog>

  </div>
</template>

<style scoped>
.backpack-container {
  padding: 10px;
  min-height: 200px;
}

.backpack-header {
  margin-bottom: 15px;
}

.stats-bar {
  display: flex;
  gap: 15px;
  margin-bottom: 15px;
  padding: 10px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  border-radius: 8px;
  background: #f5f7fa;
}

.stat-item .label {
  font-size: 0.75rem;
  color: #909399;
  margin-bottom: 4px;
}

.stat-item .value {
  font-size: 1.2rem;
  font-weight: bold;
  color: #333;
}

.stat-item.unused {
  background: #e8f5e9;
}

.stat-item.unused .value {
  color: #67c23a;
}

.stat-item.used {
  background: #f5f5f5;
}

.stat-item.used .value {
  color: #909399;
}

.filter-tabs {
  display: flex;
  gap: 8px;
  background: white;
  padding: 4px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  flex-wrap: wrap;
}

.filter-tab {
  flex: 1;
  text-align: center;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 0.9rem;
  color: #666;
  background: #f5f7fa;
  border: 1px solid #e5e7eb;
  cursor: pointer;
  transition: all 0.3s;
  font-weight: 500;
  user-select: none;
}

.filter-tab:hover {
  background: #ebeef5;
  border-color: #d3d4d6;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.filter-tab:active {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.filter-tab.active {
  background: linear-gradient(135deg, #f6d365 0%, #fda085 100%);
  color: white;
  font-weight: bold;
  border-color: #f6d365;
  box-shadow: 0 2px 8px rgba(246, 211, 101, 0.3);
}

.filter-tab.history-tab {
  background: #e3f2fd;
  border-color: #90caf9;
  color: #1976d2;
}

.filter-tab.history-tab:hover {
  background: #bbdefb;
  border-color: #64b5f6;
}

.action-buttons {
  display: flex;
  gap: 6px;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.usage-history-list {
  max-height: 400px;
  overflow-y: auto;
}

.usage-record-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f9f9f9;
  border-radius: 8px;
  margin-bottom: 8px;
}

.record-icon {
  font-size: 2rem;
  flex-shrink: 0;
}

.record-info {
  flex: 1;
}

.record-name {
  font-weight: bold;
  font-size: 1rem;
  color: #333;
  margin-bottom: 4px;
}

.record-meta {
  display: flex;
  gap: 12px;
  font-size: 0.75rem;
  color: #909399;
}

.record-quantity {
  color: #409eff;
}

.loading,
.empty {
  text-align: center;
  padding: 60px 20px;
  color: #909399;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 15px;
}

.empty-text {
  font-size: 1rem;
  color: #909399;
}

.backpack-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100%, 1fr));
  gap: 12px;
}

.backpack-item {
  background: white;
  border-radius: 12px;
  padding: 15px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 1px solid #e5e7eb;
  transition: all 0.3s;
}

.backpack-item.is-used {
  opacity: 0.7;
  background: #f9f9f9;
}

.backpack-item:active {
  transform: scale(0.98);
}

.item-icon {
  font-size: 2rem;
  flex-shrink: 0;
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-name {
  font-weight: bold;
  font-size: 1rem;
  color: #333;
  margin-bottom: 6px;
  word-break: break-word;
}

.item-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item-time {
  font-size: 0.75rem;
  color: #909399;
}

.item-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  flex-shrink: 0;
}

.quantity-badge {
  background: #409eff;
  color: white;
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: bold;
}

@media (min-width: 768px) {
  .backpack-grid {
    grid-template-columns: repeat(auto-fill, minmax(45%, 1fr));
  }
}
</style>
