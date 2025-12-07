<template>
  <div class="dashboard-container">
    <el-row :gutter="20">
      <el-col :span="6">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>🎓 在读学员</span>
            </div>
          </template>
          <div class="card-value">{{ stats.totalStudents }} 人</div>
        </el-card>
      </el-col>

      <el-col :span="6">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>📅 今日签到</span>
            </div>
          </template>
          <div class="card-value">{{ stats.todayCheckins }} 人</div>
        </el-card>
      </el-col>

      <el-col :span="6">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>💰 今日营收</span>
            </div>
          </template>
          <div class="card-value" style="color: #67C23A">¥ {{ stats.todayIncome }}</div>
        </el-card>
      </el-col>

      <el-col :span="6">
        <el-card shadow="hover" class="warning-card">
          <template #header>
            <div class="card-header">
              <span>🚨 续费预警</span>
            </div>
          </template>
          <div class="card-value" style="color: #F56C6C">{{ stats.lowBalanceCount }} 人</div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="action-card" shadow="never">
      <div style="font-weight: bold; margin-bottom: 15px;">⚡ 快捷操作</div>
      <el-button type="primary" size="large" icon="Plus">学员报名</el-button>
      <el-button type="success" size="large" icon="Check">快速签到</el-button>
      <el-button size="large" icon="User">新增档案</el-button>
    </el-card>

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>
            <div class="clearfix">
              <span>📉 需要续费的学员 (< 5课时)</span>
              <el-button style="float: right; padding: 3px 0" text>查看全部</el-button>
            </div>
          </template>
          <el-table :data="lowBalanceList" style="width: 100%" stripe>
            <el-table-column prop="name" label="姓名" width="100" />
            <el-table-column prop="className" label="课程" />
            <el-table-column label="剩余" width="80">
              <template #default="scope">
                <span style="color: red; font-weight: bold;">{{ scope.row.remaining }}</span>
              </template>
            </el-table-column>
            <el-table-column label="操作">
              <template #default>
                <el-button size="small" type="primary" link>催费</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card shadow="never">
          <template #header>
            <span>📝 今日动态</span>
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

// 响应式数据
const stats = ref({
  totalStudents: 0,
  todayCheckins: 0,
  todayIncome: 0,
  lowBalanceCount: 0
});

const activities = ref([]);
const loading = ref(false);

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
        // 后端返回的是分，前端除以 100
        todayIncome: (data.todayIncome / 100).toFixed(2),
        lowBalanceCount: data.lowBalanceCount
      };
      
      // 处理动态列表
      activities.value = data.activities.map(item => ({
        content: item.content,
        time: formatTime(item.time),
        type: 'success' // 颜色
      }));
    }
  } catch (error) {
    console.error('Failed to fetch dashboard data', error);
    ElMessage.error('面板数据加载失败');
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
  background-color: #f0f2f5; /* 浅灰底色，更有质感 */
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