<template>
  <div class="student-list-container">
    <el-card shadow="never" class="toolbar">
      <el-row justify="space-between" align="middle">
        <div class="title">🎓 学员列表</div>
        <el-button type="primary" icon="Plus" @click="openAddDialog">新增学员</el-button>
      </el-row>
    </el-card>

    <el-card shadow="never" style="margin-top: 20px;">
      <el-table :data="tableData" stripe style="width: 100%" v-loading="loading">
        <el-table-column prop="name" label="姓名" width="120" />
        <el-table-column prop="gender" label="性别" width="80" />
        <el-table-column prop="parent_name" label="家长姓名" width="120" />
        <el-table-column prop="parent_phone" label="联系电话" width="150" />

        <el-table-column label="地址" min-width="150">
          <template #default="scope">
            <el-button 
              v-if="scope.row.address || (scope.row.longitude && scope.row.latitude)"
              type="primary" 
              link 
              size="small"
              @click="viewLocation(scope.row)"
            >
              <el-icon><Location /></el-icon>
              {{ scope.row.address || '查看位置' }}
            </el-button>
            <span v-else style="color: #C0C4CC;">未设置</span>
          </template>
        </el-table-column>

        <el-table-column label="账户余额" width="150">
          <template #default="scope">
            <span style="color: #67C23A; font-weight: bold;">
              ¥ {{ (scope.row.balance / 100).toFixed(2) }}
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="joined_at" label="入学时间" width="180">
          <template #default="scope">
            {{ new Date(scope.row.joined_at).toLocaleDateString() }}
          </template>
        </el-table-column>

        <el-table-column label="在读课程 / 有效期" min-width="200">
          <template #default="scope">
            <div v-if="scope.row.courses && scope.row.courses.length > 0">
              <el-tag v-for="(course, index) in scope.row.courses" :key="index"
                style="margin-right: 5px; margin-bottom: 5px;" :type="isCourseExpiring(course) ? 'danger' : 'primary'">
                <span v-if="course.expired_at">
                  {{ course.class_name }} - 有效期至 {{ new Date(course.expired_at).toLocaleDateString() }}
                </span>
                <span v-else style="color: #909399;">
                  {{ course.class_name }} - 未设置有效期
                </span>
              </el-tag>
            </div>
            <span v-else style="color: #909399; font-size: 12px;">未报名</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="220">
          <template #default="scope">
            <el-button size="small" type="primary" link @click="openEnrollDialog(scope.row)">报名/续费</el-button>
            <el-button size="small" type="success" link @click="openEditDialog(scope.row)">编辑</el-button>
            <el-button size="small" type="danger" link @click="handleDelete(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑学员信息' : '新增学员档案'" width="500px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="学员姓名">
          <el-input v-model="form.name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="性别">
          <el-radio-group v-model="form.gender">
            <el-radio label="男">男</el-radio>
            <el-radio label="女">女</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="家长姓名">
          <el-input v-model="form.parent_name" placeholder="例如：张爸爸" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="form.parent_phone" placeholder="11位手机号" />
        </el-form-item>
        <el-form-item label="地址">
          <el-input 
            v-model="form.address" 
            placeholder="请点击右侧按钮选择地址位置"
            readonly
          >
            <template #append>
              <el-button @click="showMapPicker" icon="Location">选择位置</el-button>
            </template>
          </el-input>
          <div v-if="form.longitude && form.latitude" style="margin-top: 5px; font-size: 12px; color: #909399;">
            坐标：{{ form.longitude }}, {{ form.latitude }}
          </div>
        </el-form-item>
        <el-form-item :label="isEdit ? '账户余额' : '初始预存'">
          <el-input-number v-model="displayBalance" :min="0" :step="100" />
          <span style="margin-left: 10px; color: gray;">元 {{ isEdit ? '(可修改)' : '(可选)' }}</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSubmit">确 定</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 地图选择组件 -->
    <MapPicker
      v-model="mapPickerVisible"
      :initial-lng="mapViewMode ? (viewingStudent?.longitude || null) : form.longitude"
      :initial-lat="mapViewMode ? (viewingStudent?.latitude || null) : form.latitude"
      :initial-address="mapViewMode ? (viewingStudent?.address || null) : null"
      :readonly="mapViewMode"
      :title="mapViewMode ? '查看地址位置' : '选择地址位置'"
      @confirm="handleMapConfirm"
    />

    <el-dialog v-model="enrollDialogVisible" title="学员报名/续费" width="500px">
      <el-form :model="enrollForm" label-width="100px">

        <el-form-item label="当前学员">
          <el-tag type="info" size="large">{{ enrollForm.studentName }}</el-tag>
        </el-form-item>

        <el-form-item label="选择课程">
          <el-select v-model="enrollForm.class_id" placeholder="请选择班级" style="width: 100%" @change="handleClassChange">
            <el-option v-for="item in classList" :key="item.id" :label="item.class_name" :value="item.id">
              <span style="float: left">{{ item.class_name }}</span>
              <span style="float: right; color: #8492a6; font-size: 13px">
                ¥{{ item.tuition_fee / 100 }}/期
              </span>
            </el-option>
          </el-select>
        </el-form-item>

        <el-form-item label="购买数量">
          <el-input-number v-model="enrollForm.quantity" :min="1" @change="calculateTotal" />
          <span style="margin-left: 10px; color: gray;">(期/次/月)</span>
        </el-form-item>

        <el-form-item label="实收金额">
          <el-input-number v-model="enrollForm.displayAmount" :min="0" :precision="2" :step="100"
            style="width: 180px;" />
          <span style="margin-left: 10px; color: gray;">元</span>
        </el-form-item>

        <el-form-item label="备注">
          <el-input v-model="enrollForm.remark" type="textarea" placeholder="例如：微信转账，参加双11活动" />
        </el-form-item>

      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="enrollDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitEnroll" :loading="submitting">确认收费</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import axios from 'axios';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Location } from '@element-plus/icons-vue';
import MapPicker from '../components/MapPicker.vue';

// --- 1. 基础数据定义 ---
const tableData = ref([]);
const loading = ref(false);
const dialogVisible = ref(false); // 新增/编辑学员弹窗
const isEdit = ref(false); // 是否为编辑模式
const mapPickerVisible = ref(false); // 地图选择器显示状态
const mapViewMode = ref(false); // 地图查看模式（只读）
const viewingStudent = ref(null); // 正在查看的学员信息

// 学员表单
const form = reactive({
  id: null,
  name: '',
  gender: '男',
  parent_name: '',
  parent_phone: '',
  address: '', // 地址文本
  longitude: null, // 经度
  latitude: null // 纬度
});
const displayBalance = ref(0); // 临时变量，用于显示"元"

// --- ⭐ 2. 报名/续费相关数据定义 (之前缺失的部分) ---
const enrollDialogVisible = ref(false);
const submitting = ref(false);
const classList = ref([]); // 班级下拉框数据
const enrollForm = reactive({
  studentId: null,
  studentName: '',
  class_id: null,
  quantity: 1,
  displayAmount: 0, // 显示用的金额（元）
  remark: ''
});

// --- 3. 方法定义 ---

// 获取学员列表
const fetchStudents = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/students');
    if (res.data.code === 200) {
      tableData.value = res.data.data;
    }
  } catch (err) {
    ElMessage.error('获取列表失败');
  } finally {
    loading.value = false;
  }
};

// 获取班级列表
const fetchClasses = async () => {
  try {
    const res = await axios.get('/api/classes');
    if (res.data.code === 200) classList.value = res.data.data;
  } catch (err) { console.error('获取班级失败', err); }
};

// 打开报名弹窗
const openEnrollDialog = (row) => {
  enrollForm.studentId = row.id;
  enrollForm.studentName = row.name;
  enrollForm.class_id = null;
  enrollForm.quantity = 1;
  enrollForm.displayAmount = 0;
  enrollForm.remark = '';

  // 打开前先获取班级，防止下拉框为空
  if (classList.value.length === 0) fetchClasses();

  enrollDialogVisible.value = true;
};

// 联动计算价格
const handleClassChange = (classId) => {
  calculateTotal();
};

const calculateTotal = () => {
  // 1. 找到选中的班级对象
  const selectedClass = classList.value.find(c => c.id === enrollForm.class_id);
  if (selectedClass) {
    // 2. 单价(分) -> 单价(元)
    const pricePerUnit = selectedClass.tuition_fee / 100;
    // 3. 计算总价
    enrollForm.displayAmount = pricePerUnit * enrollForm.quantity;
  }
};

// 提交报名订单
const submitEnroll = async () => {
  if (!enrollForm.class_id) return ElMessage.warning('请选择课程');
  if (enrollForm.displayAmount <= 0) return ElMessage.warning('金额必须大于0');

  submitting.value = true;
  try {
    const payload = {
      student_id: enrollForm.studentId,
      class_id: enrollForm.class_id,
      quantity: enrollForm.quantity,
      amount: enrollForm.displayAmount * 100, // 核心：元转分
      remark: enrollForm.remark
    };

    const res = await axios.post('/api/orders', payload);

    if (res.data.code === 200) {
      ElMessage.success('报名成功！已自动增加课时');
      enrollDialogVisible.value = false;
      fetchStudents(); // 刷新列表，看看余额变了没
    } else {
      ElMessage.error(res.data.msg);
    }
  } catch (err) {
    ElMessage.error('交易失败');
  } finally {
    submitting.value = false;
  }
};

// 打开编辑对话框
const openEditDialog = (row) => {
  isEdit.value = true;
  form.id = row.id;
  form.name = row.name;
  form.gender = row.gender;
  form.parent_name = row.parent_name;
  form.parent_phone = row.parent_phone;
  form.address = row.address || '';
  form.longitude = row.longitude || null;
  form.latitude = row.latitude || null;
  displayBalance.value = (row.balance / 100).toFixed(2); // 分转元
  dialogVisible.value = true;
};

// 打开新增对话框
const openAddDialog = () => {
  isEdit.value = false;
  // 重置表单
  form.id = null;
  form.name = '';
  form.gender = '男';
  form.parent_name = '';
  form.parent_phone = '';
  form.address = '';
  form.longitude = null;
  form.latitude = null;
  displayBalance.value = 0;
  dialogVisible.value = true;
};

// 显示地图选择器
const showMapPicker = () => {
  mapViewMode.value = false;
  viewingStudent.value = null;
  mapPickerVisible.value = true;
};

// 查看地址位置
const viewLocation = (row) => {
  viewingStudent.value = row;
  mapViewMode.value = true;
  mapPickerVisible.value = true;
  // 如果没有坐标，地图组件会显示提示信息
};

// 地图选择确认回调
const handleMapConfirm = (data) => {
  if (mapViewMode.value) {
    // 查看模式，关闭即可
    mapViewMode.value = false;
    viewingStudent.value = null;
    return;
  }
  // 编辑模式，保存坐标
  form.longitude = data.lng;
  form.latitude = data.lat;
  form.address = data.address || `${data.lng}, ${data.lat}`;
};

// 提交新增/编辑学员
const handleSubmit = async () => {
  try {
    const payload = {
      name: form.name,
      gender: form.gender,
      parent_name: form.parent_name,
      parent_phone: form.parent_phone,
      address: form.address || null,
      longitude: form.longitude || null,
      latitude: form.latitude || null,
      balance: displayBalance.value * 100 // 元转分
    };

    let res;
    if (isEdit.value) {
      // 编辑模式
      res = await axios.put(`/api/students/${form.id}`, payload);
    } else {
      // 新增模式
      res = await axios.post('/api/students', payload);
    }

    if (res.data.code === 200) {
      ElMessage.success(isEdit.value ? '更新成功' : '新增成功');
      dialogVisible.value = false;
      fetchStudents();

      // 重置表单
      form.id = null;
      form.name = '';
      form.gender = '男';
      form.parent_name = '';
      form.parent_phone = '';
      form.address = '';
      form.longitude = null;
      form.latitude = null;
      displayBalance.value = 0;
    } else {
      ElMessage.error(res.data.msg);
    }
  } catch (err) {
    console.error(err);
    if (err.response?.data?.msg) {
      ElMessage.error(err.response.data.msg);
    } else {
      ElMessage.error('操作失败');
    }
  }
};

// 判断课程是否快过期 (用于标签变红)
const isCourseExpiring = (course) => {
  if (course.expired_at) {
    // 统一逻辑：如果有效期小于今天，或者只剩7天，变红
    const expireDate = new Date(course.expired_at);
    const today = new Date();
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(today.getDate() + 7);
    
    return expireDate < sevenDaysLater;
  }
  return false;
};

// 删除学员
const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除学员 "${row.name}" 吗？删除后该学员将不再显示在列表中。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );

    const res = await axios.delete(`/api/students/${row.id}`);
    
    if (res.data.code === 200) {
      ElMessage.success('删除成功');
      fetchStudents(); // 刷新列表
    } else {
      ElMessage.error(res.data.msg || '删除失败');
    }
  } catch (err) {
    if (err !== 'cancel') {
      console.error(err);
      if (err.response?.data?.msg) {
        ElMessage.error(err.response.data.msg);
      } else {
        ElMessage.error('删除失败');
      }
    }
  }
};

// 页面加载时自动获取
onMounted(() => {
  fetchStudents();
});
</script>

<style scoped>
.title {
  font-size: 18px;
  font-weight: bold;
}
</style>