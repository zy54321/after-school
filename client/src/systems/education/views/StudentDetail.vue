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

            <div class="safety-zone mb-4">
              <div class="safety-header">
                <el-icon class="mr-1">
                  <Warning />
                </el-icon> 安全与特训档案 (避险核心)
              </div>

              <div class="info-item safety-item">
                <span class="label">⚠️ 过敏源：</span>
                <span class="value red-text">{{ student.info.allergies || '无 (未录入)' }}</span>
              </div>

              <div class="info-item safety-item">
                <span class="label">🤝 授权接送：</span>
                <span class="value">{{ student.info.authorized_pickups || '未指定' }}</span>
              </div>

              <div class="info-item safety-item">
                <span class="label">🎯 特训目标：</span>
                <div class="tags-wrapper">
                  <el-tag v-for="goal in (student.info.habit_goals || [])" :key="goal" size="small" type="warning"
                    effect="dark">
                    {{ goal }}
                  </el-tag>
                  <span v-if="!student.info.habit_goals || student.info.habit_goals.length === 0"
                    class="text-gray-400">暂无目标</span>
                </div>
              </div>

              <div class="info-item safety-item">
                <span class="label">📝 协议签署：</span>
                <el-tag :type="student.info.agreements_signed ? 'success' : 'danger'" size="small">
                  {{ student.info.agreements_signed ? '已签署 (合规)' : '未签署 (高风控)' }}
                </el-tag>
              </div>

              <el-button type="primary" link size="small" @click="openEditDialog" class="mt-2 w-full">
                ✏️ 编辑特训档案
              </el-button>
            </div>
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
                      <div v-if="scope.row.fee_type === 'material'" class="text-xs text-gray-500">
                        (餐费代收)
                      </div>
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

    <el-dialog v-model="editDialogVisible" title="编辑特训档案" width="500px">
      <el-form :model="editForm" label-width="100px">
        <el-alert title="请务必如实填写，这是避险的关键证据。" type="warning" :closable="false" class="mb-4" />

        <el-form-item label="过敏源">
          <el-input v-model="editForm.allergies" placeholder="如：花生、海鲜（无则填'无'）" />
          <div class="text-xs text-red-400">⚠️ 红线信息，必须与家长书面确认</div>
        </el-form-item>

        <el-form-item label="授权接送人">
          <el-input v-model="editForm.authorized_pickups" placeholder="姓名+电话，多个用逗号分隔" />
        </el-form-item>

        <el-form-item label="特训目标">
          <el-select v-model="editForm.habit_goals" multiple filterable allow-create default-first-option
            placeholder="输入目标后回车 (如: 坐姿不正)" style="width: 100%">
            <el-option label="拖拉磨蹭" value="拖拉磨蹭" />
            <el-option label="坐姿不正" value="坐姿不正" />
            <el-option label="字迹潦草" value="字迹潦草" />
            <el-option label="专注力差" value="专注力差" />
          </el-select>
        </el-form-item>

        <el-form-item label="协议签署">
          <el-switch v-model="editForm.agreements_signed" active-text="已签署四件套协议" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="editDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="saveExtraInfo" :loading="saving">保存</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { Warning } from '@element-plus/icons-vue'; // 记得引入图标

const route = useRoute();
const loading = ref(false);
const activeTab = ref('courses');
const student = ref({});

// 编辑相关
const editDialogVisible = ref(false);
const saving = ref(false);
const editForm = ref({
  allergies: '',
  authorized_pickups: '',
  habit_goals: [],
  agreements_signed: false
});

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

// 打开编辑弹窗
const openEditDialog = () => {
  if (!student.value.info) return;
  // 复制当前数据到表单
  editForm.value = {
    allergies: student.value.info.allergies || '',
    authorized_pickups: student.value.info.authorized_pickups || '',
    habit_goals: student.value.info.habit_goals || [],
    agreements_signed: student.value.info.agreements_signed || false
  };
  editDialogVisible.value = true;
};

// 保存额外信息
const saveExtraInfo = async () => {
  saving.value = true;
  try {
    // 调用更新接口
    // 注意：这里我们复用 updateStudent 接口，只更新这几个字段，其他字段保持原样（需要后端支持 partial update 或传全量）
    // 为保险起见，我们将原有 info 和新 form 合并提交
    const payload = {
      ...student.value.info,
      ...editForm.value
    };

    const res = await axios.put(`/api/students/${student.value.info.id}`, payload);
    if (res.data.code === 200) {
      ElMessage.success('特训档案更新成功');
      student.value.info = res.data.data; // 更新视图
      editDialogVisible.value = false;
    } else {
      ElMessage.error(res.data.msg);
    }
  } catch (err) {
    console.error(err);
    ElMessage.error('保存失败');
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  fetchDetail();
});
</script>

<style scoped>
.page-header {
  margin-bottom: 20px;
}

.avatar-area {
  text-align: center;
  margin-bottom: 20px;
}

.avatar-area h2 {
  margin: 10px 0 5px;
}

.info-item {
  margin-bottom: 15px;
  display: flex;
  justify-content: space-between;
  font-size: 14px;
}

.label {
  color: #909399;
  min-width: 80px;
}

.balance {
  color: #f56c6c;
  font-weight: bold;
  font-size: 16px;
}

/* 🚨 安全区域样式 */
.safety-zone {
  background-color: #fef0f0;
  border: 1px solid #fde2e2;
  border-radius: 8px;
  padding: 15px;
}

.safety-header {
  color: #f56c6c;
  font-weight: bold;
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  border-bottom: 1px dashed #fab6b6;
  padding-bottom: 8px;
}

.safety-item {
  margin-bottom: 10px;
  align-items: flex-start;
}

.safety-item .label {
  color: #f56c6c;
  font-weight: 600;
}

.red-text {
  color: #f56c6c;
  font-weight: bold;
}

.tags-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: flex-end;
}

.w-full {
  width: 100%;
}

.mt-2 {
  margin-top: 8px;
}

.mr-1 {
  margin-right: 4px;
}

.mb-4 {
  margin-bottom: 16px;
}
</style>