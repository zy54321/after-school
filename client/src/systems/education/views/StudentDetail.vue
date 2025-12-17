<template>
  <div class="detail-container" v-loading="loading">
    <div class="page-header">
      <el-page-header @back="$router.go(-1)" content="学员详情档案" />
    </div>

    <div class="main-content" v-if="student.info">
      <el-row :gutter="20">
        <el-col :span="8">
          <el-card shadow="never" class="info-card">
            <div class="avatar-area">
              <el-avatar :size="80" :src="'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png'" />
              <h2>{{ student.info.name }}</h2>
              <el-tag :type="student.info.status === 1 ? 'success' : 'info'">
                {{ student.info.status === 1 ? '在读' : '退学' }}
              </el-tag>
            </div>
            
            <el-divider />
            
            <div class="info-list">
              <div class="info-item">
                <span class="label">家长姓名：</span>
                <span>{{ student.info.parent_name }}</span>
              </div>
              <div class="info-item">
                <span class="label">联系电话：</span>
                <span>{{ student.info.parent_phone }}</span>
              </div>
              <div class="info-item">
                <span class="label">入学时间：</span>
                <span>{{ formatDate(student.info.joined_at) }}</span>
              </div>
              <div class="info-item">
                <span class="label">账户余额：</span>
                <span class="balance">¥ {{ (student.info.balance / 100).toFixed(2) }}</span>
              </div>
            </div>
          </el-card>
        </el-col>

        <el-col :span="16">
          <el-card shadow="never">
            <el-tabs v-model="activeTab">
              <el-tab-pane label="📚 在读课程" name="courses">
                <el-table :data="student.courses" stripe>
                  <el-table-column prop="class_name" label="课程名称" />
                  <el-table-column label="剩余课时/有效期">
                    <template #default="scope">
                      <span v-if="scope.row.expired_at" style="color: #E6A23C">
                        至 {{ formatDate(scope.row.expired_at) }}
                      </span>
                      <span v-else style="font-weight: bold; color: #409EFF">
                        {{ scope.row.remaining_lessons }} 节
                      </span>
                    </template>
                  </el-table-column>
                </el-table>
              </el-tab-pane>

              <el-tab-pane label="📅 签到记录" name="attendance">
                <el-table :data="student.attendanceLogs" stripe height="400">
                  <el-table-column prop="sign_in_time" label="签到时间" width="180">
                    <template #default="scope">
                      {{ formatDateTime(scope.row.sign_in_time) }}
                    </template>
                  </el-table-column>
                  <el-table-column prop="class_name" label="上课班级" />
                  <el-table-column prop="operator_name" label="操作人" width="100" />
                  <el-table-column label="状态" width="80">
                    <template #default>
                      <el-tag type="success" size="small">正常</el-tag>
                    </template>
                  </el-table-column>
                </el-table>
              </el-tab-pane>

              <el-tab-pane label="💰 缴费流水" name="orders">
                <el-table :data="student.orders" stripe height="400">
                  <el-table-column prop="created_at" label="时间" width="180">
                    <template #default="scope">
                      {{ formatDateTime(scope.row.created_at) }}
                    </template>
                  </el-table-column>
                  <el-table-column prop="class_name" label="购买课程" />
                  <el-table-column label="金额" width="120">
                    <template #default="scope">
                      ¥ {{ (scope.row.amount / 100).toFixed(2) }}
                    </template>
                  </el-table-column>
                  <el-table-column prop="remark" label="备注" />
                </el-table>
              </el-tab-pane>
            </el-tabs>
          </el-card>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';
import { ElMessage } from 'element-plus';

const route = useRoute();
const loading = ref(false);
const activeTab = ref('courses');
const student = ref({});

const formatDate = (str) => str ? new Date(str).toLocaleDateString() : '-';
const formatDateTime = (str) => str ? new Date(str).toLocaleString() : '-';

const fetchDetail = async () => {
  loading.value = true;
  const id = route.params.id;
  try {
    const res = await axios.get(`/api/students/${id}`);
    if (res.data.code === 200) {
      student.value = res.data.data;
    } else {
      ElMessage.error(res.data.msg);
    }
  } catch (err) {
    ElMessage.error('获取详情失败');
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchDetail();
});
</script>

<style scoped>
.page-header { margin-bottom: 20px; }
.avatar-area { text-align: center; margin-bottom: 20px; }
.avatar-area h2 { margin: 10px 0 5px; }
.info-item { margin-bottom: 15px; display: flex; justify-content: space-between; font-size: 14px; }
.label { color: #909399; }
.balance { color: #f56c6c; font-weight: bold; font-size: 16px; }
</style>

