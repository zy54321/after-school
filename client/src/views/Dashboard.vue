<template>
  <div class="dashboard-container">
    <el-row :gutter="20">
      <el-col :span="6">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>🎓 {{ $t('dashboard.totalStudents') }}</span>
            </div>
          </template>
          <div class="card-value">{{ stats.totalStudents }}</div>
        </el-card>
      </el-col>

      <el-col :span="6">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>📅 {{ $t('dashboard.todayCheckins') }}</span>
            </div>
          </template>
          <div class="card-value">{{ stats.todayCheckins }}</div>
        </el-card>
      </el-col>

      <el-col :span="6" v-if="role === 'admin'">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>💰 {{ $t('dashboard.todayIncome') }}</span>
            </div>
          </template>
          <div class="card-value" style="color: #67C23A">¥ {{ stats.todayIncome }}</div>
        </el-card>
      </el-col>

      <el-col :span="6">
        <el-card shadow="hover" class="warning-card">
          <template #header>
            <div class="card-header">
              <span>🚨 {{ $t('dashboard.renewalAlert') }}</span>
            </div>
          </template>
          <div class="card-value" style="color: #F56C6C">{{ stats.lowBalanceCount }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="action-card" shadow="never">
      <div style="font-weight: bold; margin-bottom: 15px;">⚡ {{ $t('dashboard.quickActions') }}</div>
      <el-button type="primary" size="large" icon="Plus">{{ $t('dashboard.btnEnroll') }}</el-button>
      <el-button type="success" size="large" icon="Check">{{ $t('dashboard.btnCheckin') }}</el-button>
      <el-button size="large" icon="User">{{ $t('dashboard.btnAddProfile') }}</el-button>
    </el-card>

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>
            <div class="clearfix">
              <span>📉 {{ $t('dashboard.listTitle') }}</span>
              <el-button style="float: right; padding: 3px 0" text>{{ $t('dashboard.viewAll') }}</el-button>
            </div>
          </template>
          <el-table :data="lowBalanceList" style="width: 100%" stripe>
            <el-table-column prop="name" :label="$t('dashboard.colName')" width="100" />
            <el-table-column prop="className" :label="$t('dashboard.colClass')" />
            <el-table-column :label="$t('dashboard.colExpiry')" width="150">
              <template #default="scope">
                <span style="color: red; font-weight: bold;">
                  {{ new Date(scope.row.expired_at).toLocaleDateString() }}
                </span>
              </template>
            </el-table-column>
            <el-table-column :label="$t('dashboard.colAction')">
              <template #default>
                <el-button size="small" type="primary" link>{{ $t('dashboard.btnRemind') }}</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card shadow="never">
          <template #header>
            <span>📝 {{ $t('dashboard.activities') }}</span>
          </template>
          <el-timeline>
            <el-timeline-item
              v-for="(activity, index) in activities"
              :key="index"
              :timestamp="activity.time"
              :type="activity.type"
            >
              {{ activity.content }}
            </el-timeline-item>
          </el-timeline>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n'; // 引入 i18n
const { t } = useI18n();

// 响应式数据
const stats = ref({
  totalStudents: 0,
  todayCheckins: 0,
  todayIncome: 0,
  lowBalanceCount: 0
});

const activities = ref([]);
const lowBalanceList = ref([]);
const loading = ref(false);

const userInfoStr = localStorage.getItem('user_info');
const role = userInfoStr ? JSON.parse(userInfoStr).role : 'teacher';

// 格式化时间的小工具
const formatTime = (isoString) => {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const fetchDashboardData = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/dashboard/summary');
    if (res.data.code === 200) {
      const data = res.data.data;
      
      stats.value = {
        totalStudents: data.totalStudents,
        todayCheckins: data.todayCheckins,
        todayIncome: (data.todayIncome / 100).toFixed(2),
        lowBalanceCount: data.lowBalanceCount
      };
      
      lowBalanceList.value = data.lowBalanceList || [];
      
      activities.value = data.activities.map(item => ({
        content: item.content,
        time: formatTime(item.time),
        type: 'success'
      }));
    }
  } catch (error) {
    console.error('Failed to fetch dashboard data', error);
    ElMessage.error(t('common.failed')); // 使用翻译
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchDashboardData();
});
</script>

<style scoped>
.dashboard-container {
  padding: 20px;
  background-color: #f0f2f5;
  min-height: 100vh;
}
.card-header {
  font-weight: bold;
  color: #606266;
}
.card-value {
  font-size: 28px;
  font-weight: bold;
  margin-top: 10px;
  color: #303133;
}
.action-card {
  margin-top: 20px;
}
</style>