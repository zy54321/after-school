<template>
  <div class="user-role-assignment-container">
    <el-card shadow="never">
      <template #header>
        <div class="header-row">
          <span class="title">👥 {{ $t('userRole.title') }}</span>
        </div>
      </template>

      <el-table :data="users" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="username" :label="$t('userRole.colUsername')" width="150" />
        <el-table-column prop="real_name" :label="$t('userRole.colRealName')" width="150" />
        <el-table-column :label="$t('userRole.colRoles')" width="200">
          <template #default="scope">
            <el-tag
              v-for="role in getUserRolesLocal(scope.row.id)"
              :key="role.id"
              :type="role.code === 'admin' ? 'danger' : 'info'"
              style="margin-right: 5px"
            >
              {{ role.name }}
            </el-tag>
            <span v-if="getUserRolesLocal(scope.row.id).length === 0" style="color: #909399">{{ $t('userRole.notAssigned') }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('common.action')" width="150">
          <template #default="scope">
            <el-button size="small" link type="primary" @click="openAssignDialog(scope.row)">
              {{ $t('userRole.assignRole') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 分配角色对话框 -->
    <el-dialog v-model="assignDialogVisible" :title="$t('userRole.dialogTitle')" width="500px">
      <div v-if="selectedUser">
        <p style="margin-bottom: 20px">
          <strong>{{ $t('user.colRealName') }}：</strong>{{ selectedUser.real_name }} ({{ selectedUser.username }})
        </p>
        <el-checkbox-group v-model="selectedRoleIds">
          <el-checkbox
            v-for="role in roles"
            :key="role.id"
            :label="role.id"
            :disabled="role.is_system && !hasSystemRole(role.id)"
          >
            {{ role.name }}
            <el-tag v-if="role.is_system" type="danger" size="small" style="margin-left: 5px">
              {{ $t('permission.colSystemRole') }}
            </el-tag>
          </el-checkbox>
        </el-checkbox-group>
      </div>
      <template #footer>
        <el-button @click="assignDialogVisible = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="saveUserRoles" :loading="saving">{{ $t('common.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { getAllRoles, getUserRoles, assignUserRoles } from '@/api/permission';
import axios from 'axios';

const { t } = useI18n();

// 数据
const users = ref([]);
const roles = ref([]);
const userRolesMap = ref({}); // userId -> roles[]
const loading = ref(false);
const saving = ref(false);

// 分配对话框
const assignDialogVisible = ref(false);
const selectedUser = ref(null);
const selectedRoleIds = ref([]);

// 加载用户列表
const loadUsers = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/users');
    if (res.data.code === 200) {
      users.value = res.data.data;
      // 加载每个用户的角色
      await loadAllUserRoles();
    }
  } catch (error) {
    ElMessage.error(t('common.failed'));
  } finally {
    loading.value = false;
  }
};

// 加载所有用户的角色
const loadAllUserRoles = async () => {
  const promises = users.value.map(async (user) => {
    try {
      const res = await getUserRoles(user.id);
      if (res.data.code === 200) {
        userRolesMap.value[user.id] = res.data.data;
      }
    } catch (error) {
      console.error(`加载用户 ${user.id} 的角色失败:`, error);
      userRolesMap.value[user.id] = [];
    }
  });
  await Promise.all(promises);
};

// 加载角色列表
const loadRoles = async () => {
  try {
    const res = await getAllRoles();
    if (res.data.code === 200) {
      roles.value = res.data.data;
    }
  } catch (error) {
    ElMessage.error(t('common.failed'));
  }
};

// 获取用户角色（从本地缓存）
const getUserRolesLocal = (userId) => {
  return userRolesMap.value[userId] || [];
};

// 检查用户是否已有系统角色
const hasSystemRole = (roleId) => {
  if (!selectedUser.value) return false;
  const userRoles = getUserRolesLocal(selectedUser.value.id);
  return userRoles.some(r => r.is_system && r.id === roleId);
};

// 打开分配对话框
const openAssignDialog = async (user) => {
  selectedUser.value = user;
  
  // 加载该用户的角色
  try {
    const res = await getUserRoles(user.id);
    if (res.data.code === 200) {
      selectedRoleIds.value = res.data.data.map(r => r.id);
    }
  } catch (error) {
    ElMessage.error(t('common.failed'));
    selectedRoleIds.value = [];
  }
  
  assignDialogVisible.value = true;
};

// 保存用户角色
const saveUserRoles = async () => {
  if (!selectedUser.value) return;

  saving.value = true;
  try {
    const res = await assignUserRoles(selectedUser.value.id, selectedRoleIds.value);
    if (res.data.code === 200) {
      ElMessage.success(t('userRole.msgSaveSuccess'));
      assignDialogVisible.value = false;
      // 重新加载用户角色
      const roleRes = await getUserRoles(selectedUser.value.id);
      if (roleRes.data.code === 200) {
        userRolesMap.value[selectedUser.value.id] = roleRes.data.data;
      }
    }
  } catch (error) {
    ElMessage.error(t('common.failed'));
  } finally {
    saving.value = false;
  }
};

// 初始化
onMounted(() => {
  loadUsers();
  loadRoles();
});
</script>

<style scoped>
.user-role-assignment-container {
  padding: 20px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title {
  font-size: 18px;
  font-weight: bold;
}
</style>

