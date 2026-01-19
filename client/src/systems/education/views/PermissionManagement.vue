<template>
  <div class="permission-management-container">
    <el-card shadow="never">
      <template #header>
        <div class="header-row">
          <span class="title">🔐 {{ $t('permission.title') }}</span>
        </div>
      </template>

      <!-- 角色列表 -->
      <div class="role-section">
        <div class="section-header">
          <h3>{{ $t('permission.roleList') }}</h3>
          <el-button type="primary" icon="Plus" @click="openCreateRoleDialog">{{ $t('permission.addRole') }}</el-button>
        </div>

        <el-table :data="roles" stripe v-loading="rolesLoading" style="margin-top: 20px">
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="name" :label="$t('permission.colRoleName')" width="150" />
          <el-table-column prop="code" :label="$t('permission.colRoleCode')" width="150" />
          <el-table-column prop="description" :label="$t('permission.colDescription')" />
          <el-table-column :label="$t('permission.colSystemRole')" width="100">
            <template #default="scope">
              <el-tag v-if="scope.row.is_system" type="danger">{{ $t('permission.isSystem') }}</el-tag>
              <el-tag v-else type="info">{{ $t('permission.notSystem') }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column :label="$t('common.action')" width="200">
            <template #default="scope">
              <el-button size="small" link type="primary" @click="selectRole(scope.row)">{{ $t('permission.configPermission') }}</el-button>
              <el-button size="small" link type="primary" @click="openEditRoleDialog(scope.row)">{{ $t('permission.edit') }}</el-button>
              <el-button 
                v-if="!scope.row.is_system" 
                size="small" 
                link 
                type="danger" 
                @click="handleDeleteRole(scope.row)">
                {{ $t('permission.delete') }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 权限配置 -->
      <div class="permission-section" v-if="selectedRole">
        <div class="section-header">
          <h3>{{ $t('permission.permissionConfig') }}（{{ $t('permission.selectedRole') }}：{{ selectedRole.name }}）</h3>
          <div>
            <el-button size="small" @click="selectAll">{{ $t('permission.selectAll') }}</el-button>
            <el-button size="small" @click="selectNone">{{ $t('permission.selectNone') }}</el-button>
            <el-button type="primary" @click="savePermissions" :loading="saving">{{ $t('permission.savePermission') }}</el-button>
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
        <el-empty :description="$t('permission.emptyHint')" />
      </div>
    </el-card>

    <!-- 创建/编辑角色对话框 -->
    <el-dialog
      v-model="roleDialogVisible"
      :title="isEditRole ? $t('permission.dialogEditRole') : $t('permission.dialogCreateRole')"
      width="500px"
    >
      <el-form :model="roleForm" :rules="roleRules" ref="roleFormRef" label-width="100px">
        <el-form-item :label="$t('permission.labelRoleCode')" prop="code">
          <el-input v-model="roleForm.code" :disabled="isEditRole" :placeholder="$t('permission.placeholderRoleCode')" />
        </el-form-item>
        <el-form-item :label="$t('permission.labelRoleName')" prop="name">
          <el-input v-model="roleForm.name" :placeholder="$t('permission.placeholderRoleName')" />
        </el-form-item>
        <el-form-item :label="$t('permission.labelDescription')">
          <el-input
            v-model="roleForm.description"
            type="textarea"
            :rows="3"
            :placeholder="$t('permission.placeholderDescription')"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="roleDialogVisible = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="saveRole" :loading="savingRole">{{ $t('common.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
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

const { t } = useI18n();

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
const roleRules = computed(() => ({
  code: [
    { required: true, message: t('permission.placeholderRoleCode'), trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9_]+$/, message: t('permission.msgInvalidCode'), trigger: 'blur' },
  ],
  name: [
    { required: true, message: t('permission.placeholderRoleName'), trigger: 'blur' },
  ],
}));

// 加载角色列表
const loadRoles = async () => {
  rolesLoading.value = true;
  try {
    const res = await getAllRoles();
    if (res.data.code === 200) {
      roles.value = res.data.data;
    }
  } catch (error) {
    ElMessage.error(t('common.failed'));
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
    ElMessage.error(t('common.failed'));
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
    ElMessage.error(t('common.failed'));
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
    ElMessage.warning(t('permission.emptyHint'));
    return;
  }

  const checkedKeys = permissionTreeRef.value.getCheckedKeys();
  const halfCheckedKeys = permissionTreeRef.value.getHalfCheckedKeys();
  const allCheckedKeys = [...checkedKeys, ...halfCheckedKeys];

  saving.value = true;
  try {
    const res = await assignRolePermissions(selectedRole.value.id, allCheckedKeys);
    if (res.data.code === 200) {
      ElMessage.success(t('permission.msgSaveSuccess'));
      checkedPermissionIds.value = allCheckedKeys;
    }
  } catch (error) {
    ElMessage.error(t('common.failed'));
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
          ElMessage.success(t('permission.msgSaveSuccess'));
          roleDialogVisible.value = false;
          loadRoles();
        }
      } else {
        // 创建角色
        const res = await createRole(roleForm.value);
        if (res.data.code === 200) {
          ElMessage.success(t('permission.msgSaveSuccess'));
          roleDialogVisible.value = false;
          loadRoles();
        }
      }
    } catch (error) {
      ElMessage.error(t('common.failed'));
    } finally {
      savingRole.value = false;
    }
  });
};

// 删除角色
const handleDeleteRole = async (role) => {
  try {
    await ElMessageBox.confirm(
      t('permission.msgDeleteConfirm').replace('{name}', role.name),
      t('common.confirm'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
      }
    );

    const res = await deleteRole(role.id);
    if (res.data.code === 200) {
      ElMessage.success(t('permission.msgDeleteSuccess'));
      if (selectedRole.value && selectedRole.value.id === role.id) {
        selectedRole.value = null;
        checkedPermissionIds.value = [];
      }
      loadRoles();
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(t('common.failed'));
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
  max-height: 380px;
  overflow-y: auto;
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

