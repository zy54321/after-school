<template>
  <div class="user-list-container">
    <el-card shadow="never">
      <template #header>
        <div class="header-row">
          <span class="title">👥 {{ $t('user.title') }}</span>
          <el-button v-if="hasPermission(PERMISSIONS.USER.CREATE)" type="primary" icon="Plus" @click="openCreateDialog">{{ $t('user.addBtn') }}</el-button>
        </div>
      </template>

      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="username" :label="$t('user.colUsername')" width="120" />
        <el-table-column prop="real_name" :label="$t('user.colRealName')" width="120" />

        <el-table-column :label="$t('user.colRole')" width="120">
          <template #default="scope">
            <el-tag :type="scope.row.role === 'admin' ? 'danger' : 'info'">
              {{ scope.row.role === 'admin' ? $t('user.roleAdmin') : $t('user.roleTeacher') }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column :label="$t('user.colStatus')" width="100">
          <template #default="scope">
            <el-switch v-model="scope.row.is_active" @change="handleStatusChange(scope.row)" />
          </template>
        </el-table-column>

        <el-table-column :label="$t('user.colCreated')">
          <template #default="scope">{{ new Date(scope.row.created_at).toLocaleDateString() }}</template>
        </el-table-column>

        <el-table-column :label="$t('common.action')" width="200">
          <template #default="scope">
            <el-button v-if="hasPermission(PERMISSIONS.USER.UPDATE)" size="small" link type="primary" @click="openEditDialog(scope.row)">{{ $t('common.edit')
              }}</el-button>
            <el-button v-if="hasPermission(PERMISSIONS.USER.RESET_PASSWORD)" size="small" link type="warning" @click="openResetPwdDialog(scope.row)">{{ $t('user.btnResetPwd')
              }}</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="isEdit ? $t('user.dialogEditTitle') : $t('user.dialogCreateTitle')"
      width="500px">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="80px">
        <el-form-item :label="$t('user.labelUsername')" prop="username">
          <el-input v-model="form.username" :disabled="isEdit" />
        </el-form-item>
        <el-form-item :label="$t('user.labelRealName')">
          <el-input v-model="form.real_name" />
        </el-form-item>
        <el-form-item :label="$t('user.labelPassword')" v-if="!isEdit">
          <el-input v-model="form.password" placeholder="Default: 123456" />
        </el-form-item>
        <el-form-item :label="$t('user.labelRole')">
          <el-radio-group v-model="form.role">
            <el-radio label="teacher">{{ $t('user.roleTeacher') }}</el-radio>
            <el-radio label="admin">{{ $t('user.roleAdmin') }}</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="submitForm">{{ $t('common.save') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="pwdDialogVisible" :title="$t('user.dialogResetTitle')" width="400px">
      <p style="margin-bottom: 15px; color: #666;">
        For <strong>{{ currentRow?.real_name }}</strong>:
      </p>
      <el-input v-model="newPassword" show-password />
      <template #footer>
        <el-button @click="pwdDialogVisible = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="submitResetPwd">{{ $t('common.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { usePermission } from '@/composables/usePermission';
import { PERMISSIONS } from '@/constants/permissions';

const { t } = useI18n();
const { hasPermission } = usePermission();

const tableData = ref([]);
const loading = ref(false);
const dialogVisible = ref(false);
const isEdit = ref(false);
const form = reactive({ id: null, username: '', real_name: '', password: '', role: 'teacher' });
const formRef = ref(null);
const rules = {
  username: [{ required: true, message: 'Required', trigger: 'blur' }],
  real_name: [{ required: true, message: 'Required', trigger: 'blur' }],
  password: [{ required: true, message: 'Required', trigger: 'blur' }]
};
const pwdDialogVisible = ref(false);
const currentRow = ref(null);
const newPassword = ref('');

const fetchUsers = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/users');
    if (res.data.code === 200) tableData.value = res.data.data;
  } finally { loading.value = false; }
};

const openCreateDialog = () => {
  isEdit.value = false; form.username = ''; form.real_name = ''; form.password = ''; form.role = 'teacher';
  dialogVisible.value = true;
};

const openEditDialog = (row) => {
  isEdit.value = true; form.id = row.id; form.username = row.username; form.real_name = row.real_name; form.role = row.role;
  dialogVisible.value = true;
};

const submitForm = async () => {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (valid) {
      try {
        if (isEdit.value) {
          await axios.put(`/api/users/${form.id}`, { real_name: form.real_name, role: form.role, is_active: true });
        } else {
          await axios.post('/api/users', form);
        }
        ElMessage.success(t('common.success'));
        dialogVisible.value = false; fetchUsers();
      } catch (err) { ElMessage.error(t('common.failed')); }
    }
  });
};

const handleStatusChange = async (row) => {
  try { await axios.put(`/api/users/${row.id}`, { real_name: row.real_name, role: row.role, is_active: row.is_active }); ElMessage.success(t('common.success')); }
  catch (err) { row.is_active = !row.is_active; ElMessage.error(t('common.failed')); }
};

const openResetPwdDialog = (row) => { currentRow.value = row; newPassword.value = ''; pwdDialogVisible.value = true; };
const submitResetPwd = async () => {
  if (!newPassword.value) return ElMessage.warning(t('common.placeholderInput'));
  try {
    const res = await axios.put(`/api/users/${currentRow.value.id}/password`, { newPassword: newPassword.value });
    if (res.data.code === 200) { ElMessage.success(t('user.msgResetSuccess')); pwdDialogVisible.value = false; }
  } catch (err) { ElMessage.error(t('common.failed')); }
};

onMounted(() => { fetchUsers(); });
</script>

<style scoped>
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

