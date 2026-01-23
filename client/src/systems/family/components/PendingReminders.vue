<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { Bell, Clock, ArrowRight } from '@element-plus/icons-vue';
import { useRouter } from 'vue-router';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const props = defineProps({
  memberId: {
    type: Number,
    default: null,
  },
  limit: {
    type: Number,
    default: 5,
  },
});

const router = useRouter();
const loading = ref(false);
const reminders = ref([]);

const fetchPendingReminders = async () => {
  if (!props.memberId) return;
  
  try {
    loading.value = true;
    const res = await axios.get(`/api/v2/reminders/pending/${props.memberId}`, {
      params: { limit: props.limit },
      withCredentials: true,
    });
    reminders.value = res.data.data || [];
  } catch (err) {
    console.error('获取待办提醒失败:', err);
  } finally {
    loading.value = false;
  }
};

const formatTime = (time) => {
  if (!time) return '';
  const d = dayjs(time);
  if (d.isBefore(dayjs())) {
    return `逾期 ${d.fromNow()}`;
  }
  return d.fromNow();
};

const isOverdue = (time) => {
  return dayjs(time).isBefore(dayjs());
};

const goToReminders = () => {
  router.push('/family/reminders');
};

onMounted(() => {
  fetchPendingReminders();
});

defineExpose({ refresh: fetchPendingReminders });
</script>

<template>
  <div class="pending-reminders">
    <div class="widget-header">
      <div class="header-left">
        <el-icon class="header-icon"><Bell /></el-icon>
        <span class="header-title">待办提醒</span>
      </div>
      <el-button type="primary" link size="small" @click="goToReminders">
        查看全部 <el-icon><ArrowRight /></el-icon>
      </el-button>
    </div>

    <div v-if="loading" class="loading-state">
      <el-skeleton :rows="3" animated />
    </div>

    <div v-else-if="reminders.length === 0" class="empty-state">
      <div class="empty-icon">🎉</div>
      <p>暂无待办提醒</p>
    </div>

    <div v-else class="reminder-list">
      <div
        v-for="item in reminders"
        :key="item.id"
        class="reminder-item"
        :class="{ overdue: isOverdue(item.fire_at) }"
      >
        <div class="reminder-icon">
          {{ isOverdue(item.fire_at) ? '⚠️' : '🔔' }}
        </div>
        <div class="reminder-content">
          <div class="reminder-title">{{ item.title }}</div>
          <div class="reminder-time" :class="{ 'text-danger': isOverdue(item.fire_at) }">
            <el-icon><Clock /></el-icon>
            {{ formatTime(item.fire_at) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pending-reminders {
  background: linear-gradient(135deg, #fff9e6 0%, #fff5cc 100%);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid #ffe58f;
}

.widget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon {
  font-size: 20px;
  color: #faad14;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  color: #8b5a00;
}

.loading-state {
  padding: 8px 0;
}

.empty-state {
  text-align: center;
  padding: 20px;
  color: #999;
}

.empty-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.empty-state p {
  margin: 0;
  font-size: 13px;
}

.reminder-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reminder-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 8px;
  transition: all 0.2s;
}

.reminder-item:hover {
  background: rgba(255, 255, 255, 1);
  transform: translateX(4px);
}

.reminder-item.overdue {
  background: #fff2f0;
  border: 1px solid #ffccc7;
}

.reminder-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.reminder-content {
  flex: 1;
  min-width: 0;
}

.reminder-title {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.reminder-time {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.reminder-time.text-danger {
  color: #f56c6c;
  font-weight: 500;
}
</style>
