<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { Warning, Clock, ArrowRight, Check } from '@element-plus/icons-vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const props = defineProps({
  limit: {
    type: Number,
    default: 10,
  },
});

const router = useRouter();
const loading = ref(false);
const reminders = ref([]);

const fetchOverdueReminders = async () => {
  try {
    loading.value = true;
    const res = await axios.get('/api/v2/reminders/overdue', {
      params: { limit: props.limit },
      withCredentials: true,
    });
    reminders.value = res.data.data || [];
  } catch (err) {
    console.error('获取逾期提醒失败:', err);
  } finally {
    loading.value = false;
  }
};

const formatOverdueTime = (time) => {
  if (!time) return '';
  return `逾期 ${dayjs(time).fromNow()}`;
};

const markAsRead = async (id) => {
  try {
    await axios.patch(`/api/v2/reminders/${id}/read`, {}, { withCredentials: true });
    ElMessage.success('已处理');
    await fetchOverdueReminders();
  } catch (err) {
    console.error('操作失败:', err);
    ElMessage.error('操作失败');
  }
};

const goToReminders = () => {
  router.push('/family/reminders');
};

onMounted(() => {
  fetchOverdueReminders();
});

defineExpose({ refresh: fetchOverdueReminders });
</script>

<template>
  <div class="overdue-reminders">
    <div class="widget-header">
      <div class="header-left">
        <el-icon class="header-icon"><Warning /></el-icon>
        <span class="header-title">逾期待办</span>
        <el-badge v-if="reminders.length > 0" :value="reminders.length" type="danger" />
      </div>
      <el-button type="primary" link size="small" @click="goToReminders">
        管理 <el-icon><ArrowRight /></el-icon>
      </el-button>
    </div>

    <div v-if="loading" class="loading-state">
      <el-skeleton :rows="3" animated />
    </div>

    <div v-else-if="reminders.length === 0" class="empty-state success">
      <div class="empty-icon">✅</div>
      <p>没有逾期事项，太棒了！</p>
    </div>

    <div v-else class="reminder-list">
      <div v-for="item in reminders" :key="item.id" class="reminder-item">
        <div class="reminder-icon">⚠️</div>
        <div class="reminder-content">
          <div class="reminder-title">{{ item.title }}</div>
          <div class="reminder-meta">
            <span v-if="item.member_name" class="member-name">{{ item.member_name }}</span>
            <span class="overdue-time">
              <el-icon><Clock /></el-icon>
              {{ formatOverdueTime(item.fire_at) }}
            </span>
          </div>
        </div>
        <el-button
          type="success"
          size="small"
          :icon="Check"
          circle
          @click="markAsRead(item.id)"
          title="标记已处理"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.overdue-reminders {
  background: linear-gradient(135deg, #fff1f0 0%, #ffebeb 100%);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid #ffa39e;
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
  color: #ff4d4f;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  color: #a8071a;
}

.loading-state {
  padding: 8px 0;
}

.empty-state {
  text-align: center;
  padding: 20px;
  color: #999;
}

.empty-state.success {
  background: rgba(82, 196, 26, 0.1);
  border-radius: 8px;
}

.empty-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.empty-state p {
  margin: 0;
  font-size: 13px;
  color: #52c41a;
}

.reminder-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reminder-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 8px;
  border: 1px solid #ffccc7;
  transition: all 0.2s;
}

.reminder-item:hover {
  box-shadow: 0 2px 8px rgba(255, 77, 79, 0.15);
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

.reminder-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.member-name {
  color: #666;
}

.overdue-time {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #f56c6c;
  font-weight: 500;
}
</style>
