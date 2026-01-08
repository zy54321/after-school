<template>
  <div class="permission-management-container">
    <el-card shadow="never">
      <template #header>
        <div class="header-row">
          <span class="title">🔐 权限配置管理</span>
        </div>
      </template>

      <!-- 角色列表 -->
      <div class="role-section">
        <div class="section-header">
          <h3>角色列表</h3>
          <el-button type="primary" icon="Plus" @click="openCreateRoleDialog">新增角色</el-button>
        </div>

        <el-table :data="roles" stripe v-loading="rolesLoading" style="margin-top: 20px">
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="name" label="角色名称" width="150" />
          <el-table-column prop="code" label="角色代码" width="150" />
          <el-table-column prop="description" label="描述" />
          <el-table-column label="系统角色" width="100">
            <template #default="scope">
              <el-tag v-if="scope.row.is_system" type="danger">是</el-tag>
              <el-tag v-else type="info">否</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200">
            <template #default="scope">
              <el-button size="small" link type="primary" @click="selectRole(scope.row)">配置权限</el-button>
              <el-button size="small" link type="primary" @click="openEditRoleDialog(scope.row)">编辑</el-button>
              <el-button 
                v-if="!scope.row.is_system" 
                size="small" 
                link 
                type="danger" 
                @click="handleDeleteRole(scope.row)">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 权限配置 -->
      <div class="permission-section" v-if="selectedRole">
        <div class="section-header">
          <h3>权限配置（选中角色：{{ selectedRole.name }}）</h3>
          <div>
            <el-button size="small" @click="selectAll">全选</el-button>
            <el-button size="small" @click="selectNone">全不选</el-button>
            <el-button type="primary" @click="savePermissions" :loading="saving">保存权限配置</el-button>
          </div>
        </div>

        <el-tree
          ref="permissionTreeRef"
          :data="permissionTree"
          :props="{ children: 'children', label: 'name' }"
          show-checkbox
          node-key="id"
          :default-checked-keys="checkedPermissionIds"
          :default-expand-all="true"
          style="margin-top: 20px"
        >
          <template #default="{ node, data }">
            <span class="tree-node">
              <span class="node-label">{{ data.name }}</span>
              <span v-if="data.code" class="node-code">({{ data.code }})</span>
            </span>
          </template>
        </el-tree>
      </div>

      <div v-else class="empty-hint">
        <el-empty description="请选择一个角色进行权限配置" />
      </div>
    </el-card>

    <!-- 创建/编辑角色对话框 -->
    <el-dialog
      v-model="roleDialogVisible"
      :title="isEditRole ? '编辑角色' : '新增角色'"
      width="500px"
    >
      <el-form :model="roleForm" :rules="roleRules" ref="roleFormRef" label-width="100px">
        <el-form-item label="角色代码" prop="code">
          <el-input v-model="roleForm.code" :disabled="isEditRole" placeholder="如：manager" />
        </el-form-item>
        <el-form-item label="角色名称" prop="name">
          <el-input v-model="roleForm.name" placeholder="如：经理" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="roleForm.description"
            type="textarea"
            :rows="3"
            placeholder="角色描述"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="roleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveRole" :loading="savingRole">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  getAllRoles,
  createRole,
  updateRole,
  deleteRole,
  getRolePermissions,
  assignRolePermissions,
  getPermissionTree,
} from '@/api/permission';
import { buildPermissionTree, flattenPermissionTree } from '@/utils/permissionTree';

// 数据
const roles = ref([]);
const rolesLoading = ref(false);
const selectedRole = ref(null);
const permissionTree = ref([]);
const checkedPermissionIds = ref([]);
const saving = ref(false);
const savingRole = ref(false);

// 角色对话框
const roleDialogVisible = ref(false);
const isEditRole = ref(false);
const roleForm = ref({
  code: '',
  name: '',
  description: '',
});
const roleFormRef = ref(null);

// 权限树引用
const permissionTreeRef = ref(null);

// 角色表单验证规则
const roleRules = {
  code: [
    { required: true, message: '请输入角色代码', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9_]+$/, message: '角色代码只能包含字母、数字和下划线', trigger: 'blur' },
  ],
  name: [
    { required: true, message: '请输入角色名称', trigger: 'blur' },
  ],
};

// 加载角色列表
const loadRoles = async () => {
  rolesLoading.value = true;
  try {
    const res = await getAllRoles();
    if (res.data.code === 200) {
      roles.value = res.data.data;
    }
  } catch (error) {
    ElMessage.error('加载角色列表失败');
  } finally {
    rolesLoading.value = false;
  }
};

// 加载权限树
const loadPermissionTree = async () => {
  try {
    const res = await getPermissionTree();
    if (res.data.code === 200) {
      permissionTree.value = res.data.data;
    }
  } catch (error) {
    ElMessage.error('加载权限树失败');
  }
};

// 选择角色
const selectRole = async (role) => {
  selectedRole.value = role;
  checkedPermissionIds.value = [];

  // 加载该角色的权限
  try {
    const res = await getRolePermissions(role.id);
    if (res.data.code === 200) {
      checkedPermissionIds.value = res.data.data;
    }
  } catch (error) {
    ElMessage.error('加载角色权限失败');
  }
};

// 全选
const selectAll = () => {
  if (!permissionTreeRef.value) return;
  const allIds = flattenPermissionTree(permissionTree.value).map(p => p.id);
  permissionTreeRef.value.setCheckedKeys(allIds);
};

// 全不选
const selectNone = () => {
  if (!permissionTreeRef.value) return;
  permissionTreeRef.value.setCheckedKeys([]);
};

// 保存权限配置
const savePermissions = async () => {
  if (!selectedRole.value) {
    ElMessage.warning('请先选择角色');
    return;
  }

  const checkedKeys = permissionTreeRef.value.getCheckedKeys();
  const halfCheckedKeys = permissionTreeRef.value.getHalfCheckedKeys();
  const allCheckedKeys = [...checkedKeys, ...halfCheckedKeys];

  saving.value = true;
  try {
    const res = await assignRolePermissions(selectedRole.value.id, allCheckedKeys);
    if (res.data.code === 200) {
      ElMessage.success('权限配置保存成功');
      checkedPermissionIds.value = allCheckedKeys;
    }
  } catch (error) {
    ElMessage.error('保存权限配置失败');
  } finally {
    saving.value = false;
  }
};

// 打开创建角色对话框
const openCreateRoleDialog = () => {
  isEditRole.value = false;
  roleForm.value = {
    code: '',
    name: '',
    description: '',
  };
  roleDialogVisible.value = true;
};

// 打开编辑角色对话框
const openEditRoleDialog = (role) => {
  isEditRole.value = true;
  roleForm.value = {
    code: role.code,
    name: role.name,
    description: role.description || '',
  };
  roleDialogVisible.value = true;
};

// 保存角色
const saveRole = async () => {
  if (!roleFormRef.value) return;

  await roleFormRef.value.validate(async (valid) => {
    if (!valid) return;

    savingRole.value = true;
    try {
      if (isEditRole.value) {
        // 编辑角色
        const role = roles.value.find(r => r.code === roleForm.value.code);
        if (!role) return;

        const res = await updateRole(role.id, {
          name: roleForm.value.name,
          description: roleForm.value.description,
        });

        if (res.data.code === 200) {
          ElMessage.success('角色更新成功');
          roleDialogVisible.value = false;
          loadRoles();
        }
      } else {
        // 创建角色
        const res = await createRole(roleForm.value);
        if (res.data.code === 200) {
          ElMessage.success('角色创建成功');
          roleDialogVisible.value = false;
          loadRoles();
        }
      }
    } catch (error) {
      ElMessage.error(isEditRole.value ? '更新角色失败' : '创建角色失败');
    } finally {
      savingRole.value = false;
    }
  });
};

// 删除角色
const handleDeleteRole = async (role) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除角色"${role.name}"吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );

    const res = await deleteRole(role.id);
    if (res.data.code === 200) {
      ElMessage.success('角色删除成功');
      if (selectedRole.value && selectedRole.value.id === role.id) {
        selectedRole.value = null;
        checkedPermissionIds.value = [];
      }
      loadRoles();
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除角色失败');
    }
  }
};

// 初始化
onMounted(() => {
  loadRoles();
  loadPermissionTree();
});
</script>

<style scoped>
.permission-management-container {
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

.role-section {
  margin-bottom: 40px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.section-header h3 {
  margin: 0;
  font-size: 16px;
}

.permission-section {
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid #ebeef5;
}

.empty-hint {
  margin-top: 40px;
  padding: 40px;
  text-align: center;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 8px;
}

.node-label {
  font-weight: 500;
}

.node-code {
  color: #909399;
  font-size: 12px;
}
</style>

