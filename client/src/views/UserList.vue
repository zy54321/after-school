<template>
  <div class="user-list-container">
    <el-card shadow="never">
      <template #header>
        <div class="header-row">
          <span class="title">👥 员工/权限管理</span>
          <el-button type="primary" icon="Plus" @click="openCreateDialog">新增员工</el-button>
        </div>
      </template>

      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="username" label="用户名" width="120" />
        <el-table-column prop="real_name" label="真实姓名" width="120" />
        
        <el-table-column label="角色" width="120">
          <template #default="scope">
            <el-tag :type="scope.row.role === 'admin' ? 'danger' : 'info'">
              {{ scope.row.role === 'admin' ? '管理员' : '普通教师' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="100">
          <template #default="scope">
            <el-switch 
              v-model="scope.row.is_active" 
              @change="handleStatusChange(scope.row)"
              active-color="#13ce66"
              inactive-color="#ff4949"
            />
          </template>
        </el-table-column>

        <el-table-column label="创建时间">
          <template #default="scope">
            {{ new Date(scope.row.created_at).toLocaleDateString() }}
          </template>
        </el-table-column>

        <el-table-column label="操作" width="200">
          <template #default="scope">
            <el-button size="small" link type="primary" @click="openEditDialog(scope.row)">编辑</el-button>
            <el-button size="small" link type="warning" @click="openResetPwdDialog(scope.row)">重置密码</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑员工' : '新增员工'" width="500px">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="80px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" :disabled="isEdit" placeholder="登录账号 (英文)" />
        </el-form-item>
        <el-form-item label="真实姓名">
          <el-input v-model="form.real_name" placeholder="例如：王老师" />
        </el-form-item>
        <el-form-item label="初始密码" v-if="!isEdit">
          <el-input v-model="form.password" placeholder="默认建议设为 123456" />
        </el-form-item>
        <el-form-item label="角色权限">
          <el-radio-group v-model="form.role">
            <el-radio label="teacher">普通教师</el-radio>
            <el-radio label="admin">管理员</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="pwdDialogVisible" title="重置密码" width="400px">
      <p style="margin-bottom: 15px; color: #666;">
        正在为 <strong>{{ currentRow?.real_name }}</strong> 重置密码：
      </p>
      <el-input v-model="newPassword" placeholder="请输入新密码" type="password" show-password />
      <template #footer>
        <el-button @click="pwdDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitResetPwd">确认重置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';

const tableData = ref([]);
const loading = ref(false);

// 新增/编辑逻辑
const dialogVisible = ref(false);
const isEdit = ref(false);
const form = reactive({ id: null, username: '', real_name: '', password: '', role: 'teacher' });

const formRef = ref(null); // 1. 创建表单引用
const rules = { // 2. 定义校验规则
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { 
      pattern: /^[a-zA-Z0-9]+$/, 
      message: '用户名只能包含英文和数字', 
      trigger: 'blur' 
    },
    { min: 3, max: 20, message: '长度在 3 到 20 个字符', trigger: 'blur' }
  ],
  real_name: [{ required: true, message: '请输入真实姓名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入初始密码', trigger: 'blur' }]
};

// 重置密码逻辑
const pwdDialogVisible = ref(false);
const currentRow = ref(null);
const newPassword = ref('');

const fetchUsers = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/users');
    if (res.data.code === 200) tableData.value = res.data.data;
  } finally {
    loading.value = false;
  }
};

// 打开新增
const openCreateDialog = () => {
  isEdit.value = false;
  form.username = '';
  form.real_name = '';
  form.password = ''; 
  form.role = 'teacher';
  dialogVisible.value = true;
};

// 打开编辑
const openEditDialog = (row) => {
  isEdit.value = true;
  form.id = row.id;
  form.username = row.username;
  form.real_name = row.real_name;
  form.role = row.role;
  dialogVisible.value = true;
};

// 提交保存
const submitForm = async () => {
  if (!formRef.value) return; 
  
  await formRef.value.validate(async (valid) => {
    if (valid) {
      try {
        if (isEdit.value) {
          // ✅ 修正点：这里要传写真实的数据，而不是注释
          await axios.put(`/api/users/${form.id}`, { 
            real_name: form.real_name,
            role: form.role,
            is_active: true // 编辑时默认保持激活，或者你可以不传这个字段取决于后端逻辑
          });
          ElMessage.success('更新成功');
        } else {
          // 新增模式：直接传整个 form
          await axios.post('/api/users', form);
          ElMessage.success('创建成功');
        }
        dialogVisible.value = false;
        fetchUsers();
      } catch (err) {
        ElMessage.error('操作失败: ' + (err.response?.data?.msg || err.message));
      }
    }
  });
};

// 切换状态
const handleStatusChange = async (row) => {
  try {
    await axios.put(`/api/users/${row.id}`, {
      real_name: row.real_name,
      role: row.role,
      is_active: row.is_active
    });
    ElMessage.success('状态已更新');
  } catch (err) {
    row.is_active = !row.is_active; // 失败回调
    ElMessage.error('更新失败');
  }
};

// 打开重置密码
const openResetPwdDialog = (row) => {
  currentRow.value = row;
  newPassword.value = '';
  pwdDialogVisible.value = true;
};

// 提交重置密码
const submitResetPwd = async () => {
  if (!newPassword.value) return ElMessage.warning('请输入密码');
  try {
    const res = await axios.put(`/api/users/${currentRow.value.id}/password`, {
      newPassword: newPassword.value
    });
    if (res.data.code === 200) {
      ElMessage.success('密码重置成功');
      pwdDialogVisible.value = false;
    }
  } catch (err) {
    ElMessage.error('重置失败');
  }
};

onMounted(() => {
  fetchUsers();
});
</script>

<style scoped>
.header-row { display: flex; justify-content: space-between; align-items: center; }
.title { font-size: 18px; font-weight: bold; }
</style>