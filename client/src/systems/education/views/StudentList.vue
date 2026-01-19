<template>
  <div class="student-list-container p-4">
    <el-card shadow="hover" class="mb-4">
      <div class="flex justify-between items-center">
        <div class="text-lg font-bold flex items-center">
          <span class="mr-2">🎓</span> {{ $t('student.title') }}
        </div>
        <el-button type="primary" icon="Plus" @click="openAddDialog" class="shadow-lg shadow-blue-500/30">
          {{ $t('student.addBtn') }}
        </el-button>
      </div>
    </el-card>

    <el-card shadow="never">
      <el-table :data="tableData" stripe style="width: 100%" v-loading="loading">
        <el-table-column prop="name" :label="$t('student.colName')" width="140">
          <template #default="scope">
            <div class="font-bold text-gray-700 flex items-center">
              {{ scope.row.name }}
              <el-tooltip v-if="scope.row.allergies" :content="'⚠️ 过敏: ' + scope.row.allergies" placement="top">
                <span class="ml-1 text-red-500 cursor-help animate-pulse text-xs">🚫</span>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="grade" label="年级" width="100">
          <template #default="{ row }">
            <el-tag size="small" type="info" effect="plain">{{ row.grade || '-' }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="gender" :label="$t('student.colGender')" width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="row.gender === '男' ? '' : 'danger'" effect="plain">
              {{ row.gender }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="parent_name" :label="$t('student.colParent')" width="120" />
        <el-table-column prop="parent_phone" :label="$t('student.colPhone')" width="150" />

        <el-table-column :label="$t('student.colAddress')" min-width="150">
          <template #default="scope">
            <div v-if="scope.row.address" class="flex items-center text-gray-600 cursor-pointer hover:text-blue-600"
              @click="viewLocation(scope.row)">
              <el-icon class="mr-1">
                <Location />
              </el-icon>
              <span class="truncate max-w-[150px]">{{ scope.row.address }}</span>
            </div>
            <el-button v-else type="primary" link size="small" @click="viewLocation(scope.row)">
              {{ $t('student.btnSelectLoc') }}
            </el-button>
          </template>
        </el-table-column>

        <el-table-column :label="$t('student.colBalance')" width="150">
          <template #default="scope">
            <div class="font-mono font-bold text-green-600">
              ¥ {{ (scope.row.balance / 100).toFixed(2) }}
            </div>
          </template>
        </el-table-column>

        <el-table-column :label="$t('student.colCourses')" min-width="220">
          <template #default="scope">
            <div v-if="scope.row.courses && scope.row.courses.length > 0" class="flex flex-wrap gap-1">
              <el-tag v-for="(course, index) in scope.row.courses" :key="index" size="small"
                :type="isCourseExpiring(course) ? 'danger' : 'primary'" effect="light">
                {{ course.class_name }}
                <span v-if="course.expired_at" class="text-xs scale-90 ml-1 opacity-80">
                  至{{ new Date(course.expired_at).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }) }}
                </span>
              </el-tag>
            </div>
            <span v-else class="text-gray-300 text-xs">未报班</span>
          </template>
        </el-table-column>

        <el-table-column :label="$t('common.action')" width="280" fixed="right">
          <template #default="scope">
            <div class="flex items-center">
              <el-button size="small" link @click="$router.push(`/system/students/${scope.row.id}`)">
                {{ $t('common.detail') }}
              </el-button>
              <el-button size="small" type="primary" link @click="openEnrollDialog(scope.row)">
                {{ $t('student.btnEnroll') }}
              </el-button>
              <el-dropdown trigger="click" class="ml-2">
                <span class="el-dropdown-link text-xs text-gray-400 cursor-pointer hover:text-blue-500">
                  更多 <el-icon class="el-icon--right"><arrow-down /></el-icon>
                </span>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click="openEditDialog(scope.row)">编辑档案</el-dropdown-item>
                    <el-dropdown-item v-if="hasPermission(PERMISSIONS.ORDER.REFUND)" @click="openDropDialog(scope.row)">办理退课</el-dropdown-item>
                    <el-dropdown-item v-if="hasPermission(PERMISSIONS.STUDENT.DELETE)" divided class="text-red-500"
                      @click="handleDelete(scope.row)">删除学员</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="isEdit ? $t('student.dialogEditTitle') : $t('student.dialogAddTitle')"
      width="600px" destroy-on-close align-center>
      <el-form :model="form" label-width="110px" class="px-2">

        <h3 class="text-sm font-bold text-gray-800 border-l-4 border-blue-500 pl-2 mb-4">基本信息</h3>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item :label="$t('student.labelName')" required>
              <el-input v-model="form.name" :placeholder="$t('student.placeholderName')" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="年级" required>
              <el-select v-model="form.grade" placeholder="请选择年级" style="width: 100%">
                <el-option label="幼儿园" value="幼儿园" />
                <el-option label="一年级" value="一年级" />
                <el-option label="二年级" value="二年级" />
                <el-option label="三年级" value="三年级" />
                <el-option label="四年级" value="四年级" />
                <el-option label="五年级" value="五年级" />
                <el-option label="六年级" value="六年级" />
                <el-option label="初中" value="初中" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item :label="$t('student.labelGender')">
              <el-radio-group v-model="form.gender">
                <el-radio label="男">👦 男</el-radio>
                <el-radio label="女">👧 女</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="$t('student.labelParent')" required>
              <el-input v-model="form.parent_name" :placeholder="$t('student.placeholderParent')" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item :label="$t('student.labelPhone')" required>
              <el-input v-model="form.parent_phone" :placeholder="$t('student.placeholderPhone')" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="isEdit ? $t('student.labelBalance') : $t('student.labelInitialBalance')">
              <el-input-number v-model="displayBalance" :min="0" :step="100" controls-position="right" class="w-full" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item :label="$t('student.labelAddress')">
          <el-input v-model="form.address" :placeholder="$t('student.placeholderAddress')" readonly>
            <template #append>
              <el-button @click="showMapPicker" :icon="Location">{{ $t('student.btnSelectLoc') }}</el-button>
            </template>
          </el-input>
        </el-form-item>

        <div class="mt-6 mb-2 bg-red-50 rounded-lg p-4 border border-red-100">
          <div class="flex items-center text-red-600 font-bold mb-4 text-sm">
            <el-icon class="mr-1">
              <Warning />
            </el-icon>
            <span>安全与特训档案 (避险核心)</span>
          </div>

          <el-form-item label="⚠️ 过敏源">
            <el-input v-model="form.allergies" placeholder="如：花生、海鲜（无则不填）" clearable>
              <template #prefix><span class="text-red-500">🚫</span></template>
            </el-input>
          </el-form-item>

          <el-form-item label="🤝 接送人">
            <el-input v-model="form.authorized_pickups" placeholder="姓名+电话，多个用逗号分隔" />
          </el-form-item>

          <el-form-item label="🎯 特训目标">
            <el-select v-model="form.habit_goals" multiple filterable allow-create default-first-option
              placeholder="输入目标回车 (如: 拖拉)" class="w-full">
              <el-option label="拖拉磨蹭" value="拖拉磨蹭" />
              <el-option label="坐姿不正" value="坐姿不正" />
              <el-option label="字迹潦草" value="字迹潦草" />
              <el-option label="专注力差" value="专注力差" />
            </el-select>
          </el-form-item>

          <el-form-item label="📝 协议状态">
            <div class="flex items-center justify-between w-full">
              <span class="text-gray-500 text-xs">是否已签署《入托免责协议》四件套？</span>
              <el-switch v-model="form.agreements_signed" active-text="已签" inactive-text="未签" inline-prompt
                style="--el-switch-on-color: #13ce66; --el-switch-off-color: #ff4949" />
            </div>
          </el-form-item>
        </div>

      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">{{ $t('common.cancel') }}</el-button>
          <el-button type="primary" @click="handleSubmit" class="px-6">{{ $t('common.confirm') }}</el-button>
        </span>
      </template>
    </el-dialog>

    <MapPicker v-model="mapPickerVisible"
      :initial-lng="mapViewMode ? (viewingStudent?.longitude || null) : form.longitude"
      :initial-lat="mapViewMode ? (viewingStudent?.latitude || null) : form.latitude"
      :initial-address="mapViewMode ? (viewingStudent?.address || null) : null" :readonly="mapViewMode"
      :title="mapViewMode ? $t('student.labelAddress') : $t('student.btnSelectLoc')" @confirm="handleMapConfirm" />

    <el-dialog v-model="enrollDialogVisible" :title="$t('student.btnEnroll')" width="450px">
      <el-form :model="enrollForm" label-width="80px">
        <el-form-item :label="$t('student.labelName')">
          <div class="font-bold text-lg">{{ enrollForm.studentName }}</div>
        </el-form-item>
        <el-form-item :label="$t('class.labelName')">
          <el-select v-model="enrollForm.class_id" :placeholder="$t('common.placeholderSelect')" style="width: 100%"
            @change="handleClassChange">
            <el-option v-for="item in classList" :key="item.id" :label="item.class_name" :value="item.id">
              <span class="float-left">{{ item.class_name }}</span>
              <span class="float-right text-gray-400 text-xs">¥{{ item.tuition_fee / 100 }}</span>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item :label="$t('order.colAmount')">
          <el-input-number v-model="enrollForm.displayAmount" :min="0" :precision="2" :step="100" class="w-full" />
        </el-form-item>
        <el-form-item :label="$t('common.remark')">
          <el-input v-model="enrollForm.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="enrollDialogVisible = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="submitEnroll" :loading="submitting">{{ $t('common.confirm') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="dropDialogVisible" :title="$t('student.btnDrop')" width="450px">
      <el-form :model="dropForm" label-width="80px">
        <el-form-item label="退课课程">
          <el-select v-model="dropForm.class_id" placeholder="请选择课程" class="w-full">
            <el-option v-for="c in studentCourses" :key="c.class_id" :label="c.class_name" :value="c.class_id" />
          </el-select>
        </el-form-item>
        <el-form-item label="退款金额">
          <el-input-number v-model="dropForm.refund_amount" :min="0" :step="100" />
          <span class="ml-2 text-gray-500">元</span>
        </el-form-item>
        <el-form-item :label="$t('common.remark')">
          <el-input v-model="dropForm.remark" type="textarea" placeholder="退课原因..." />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dropDialogVisible = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="danger" @click="submitDrop">{{ $t('common.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import axios from 'axios';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Location, Warning, ArrowDown, Plus } from '@element-plus/icons-vue';
import MapPicker from '../../../shared/components/MapPicker.vue';
import { useI18n } from 'vue-i18n';
import { usePermission } from '@/composables/usePermission';
import { PERMISSIONS } from '@/constants/permissions';

const { t } = useI18n();
const { hasPermission } = usePermission();

// 保留 role 用于兼容（可逐步移除）
const userInfoStr = localStorage.getItem('user_info');
const role = userInfoStr ? JSON.parse(userInfoStr).role : 'teacher';

const tableData = ref([]);
const loading = ref(false);

// 新增/编辑弹窗状态
const dialogVisible = ref(false);
const isEdit = ref(false);
const form = reactive({
  id: null,
  name: '',
  gender: '男',
  grade: '',
  parent_name: '',
  parent_phone: '',
  address: '',
  longitude: null,
  latitude: null,
  allergies: '',
  authorized_pickups: '',
  habit_goals: [],
  agreements_signed: false
});
const displayBalance = ref(0);

// 地图相关
const mapPickerVisible = ref(false);
const mapViewMode = ref(false);
const viewingStudent = ref(null);

// 报名相关
const enrollDialogVisible = ref(false);
const submitting = ref(false);
const classList = ref([]);
const enrollForm = reactive({
  studentId: null, studentName: '', class_id: null, quantity: 1, displayAmount: 0, remark: ''
});

// 退课相关
const dropDialogVisible = ref(false);
const studentCourses = ref([]);
const dropForm = reactive({
  studentId: null, studentName: '', class_id: null, refund_amount: 0, remark: ''
});

// --- API 方法 ---
const fetchStudents = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/students');
    if (res.data.code === 200) tableData.value = res.data.data;
  } catch (err) { ElMessage.error(t('common.failed')); }
  finally { loading.value = false; }
};

const fetchClasses = async () => {
  try {
    const res = await axios.get('/api/classes');
    if (res.data.code === 200) classList.value = res.data.data;
  } catch (err) { console.error(err); }
};

// --- 表单操作 ---
const openAddDialog = () => {
  isEdit.value = false;
  // 重置表单，包括新增的避险字段
  Object.assign(form, {
    id: null,
    name: '',
    gender: '男',
    parent_name: '',
    parent_phone: '',
    address: '',
    longitude: null,
    latitude: null,
    allergies: '',
    authorized_pickups: '',
    habit_goals: [],
    agreements_signed: false
  });
  displayBalance.value = 0;
  dialogVisible.value = true;
};

const openEditDialog = (row) => {
  isEdit.value = true;
  // 回填数据
  Object.assign(form, row);
  // 处理可能为 null 的字段
  form.address = row.address || '';
  form.habit_goals = row.habit_goals || [];
  form.allergies = row.allergies || '';
  form.authorized_pickups = row.authorized_pickups || '';
  form.agreements_signed = row.agreements_signed || false;

  displayBalance.value = (row.balance / 100).toFixed(2);
  dialogVisible.value = true;
};

const handleSubmit = async () => {
  // ⭐ 新增：表单校验逻辑
  if (!form.name) return ElMessage.warning('请输入学员姓名');
  if (!form.grade) return ElMessage.warning('请选择年级');
  if (!form.parent_name) return ElMessage.warning('请输入家长姓名');
  if (!form.parent_phone) return ElMessage.warning('请输入联系电话');

  try {
    const payload = { ...form, balance: displayBalance.value * 100 };
    let res = isEdit.value
      ? await axios.put(`/api/students/${form.id}`, payload)
      : await axios.post('/api/students', payload);

    if (res.data.code === 200) {
      ElMessage.success(t('common.success'));
      dialogVisible.value = false;
      fetchStudents();
    } else { ElMessage.error(res.data.msg); }
  } catch (err) { ElMessage.error(t('common.failed')); }
};

// --- 地图逻辑 ---
const showMapPicker = () => { mapViewMode.value = false; viewingStudent.value = null; mapPickerVisible.value = true; };
const viewLocation = (row) => { viewingStudent.value = row; mapViewMode.value = true; mapPickerVisible.value = true; };
const handleMapConfirm = (data) => {
  if (mapViewMode.value) { mapViewMode.value = false; viewingStudent.value = null; return; }
  form.longitude = data.lng; form.latitude = data.lat; form.address = data.address;
};

// --- 报名逻辑 ---
const openEnrollDialog = (row) => {
  enrollForm.studentId = row.id; enrollForm.studentName = row.name; enrollForm.class_id = null;
  enrollForm.quantity = 1; enrollForm.displayAmount = 0; enrollForm.remark = '';
  if (classList.value.length === 0) fetchClasses();
  enrollDialogVisible.value = true;
};
const handleClassChange = () => {
  const selectedClass = classList.value.find(c => c.id === enrollForm.class_id);
  if (selectedClass) enrollForm.displayAmount = (selectedClass.tuition_fee / 100) * enrollForm.quantity;
};
const submitEnroll = async () => {
  if (!enrollForm.class_id) return ElMessage.warning(t('common.placeholderSelect'));
  submitting.value = true;
  try {
    const payload = {
      student_id: enrollForm.studentId, class_id: enrollForm.class_id,
      quantity: enrollForm.quantity, amount: enrollForm.displayAmount * 100, remark: enrollForm.remark
    };
    const res = await axios.post('/api/orders', payload);
    if (res.data.code === 200) {
      ElMessage.success(t('common.success'));
      enrollDialogVisible.value = false; fetchStudents();
    } else { ElMessage.error(res.data.msg); }
  } catch (err) { ElMessage.error(t('common.failed')); }
  finally { submitting.value = false; }
};

// --- 退课逻辑 ---
const openDropDialog = (row) => {
  if (!row.courses || row.courses.length === 0) return ElMessage.warning('该学员没有在读课程');
  dropForm.studentId = row.id; dropForm.studentName = row.name; dropForm.class_id = null;
  dropForm.refund_amount = 0; dropForm.remark = '';
  studentCourses.value = row.courses;
  dropDialogVisible.value = true;
};
const submitDrop = async () => {
  if (!dropForm.class_id) return ElMessage.warning('请选择退课课程');
  try {
    const res = await axios.post(`/api/students/${dropForm.studentId}/drop`, dropForm);
    if (res.data.code === 200) {
      ElMessage.success(t('common.success'));
      dropDialogVisible.value = false; fetchStudents();
    } else { ElMessage.error(res.data.msg); }
  } catch (err) { ElMessage.error(t('common.failed')); }
};

// --- 删除逻辑 ---
const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(
      t('common.confirm') + ' ' + t('common.delete') + '?',
      t('common.delete'),
      { confirmButtonText: t('common.confirm'), cancelButtonText: t('common.cancel'), type: 'warning' }
    );
    const res = await axios.delete(`/api/students/${row.id}`);
    if (res.data.code === 200) {
      ElMessage.success(t('common.success'));
      fetchStudents();
    } else { ElMessage.error(res.data.msg || t('common.failed')); }
  } catch (err) { if (err !== 'cancel') ElMessage.error(t('common.failed')); }
};

// 工具函数
const isCourseExpiring = (course) => {
  if (course.expired_at) {
    const expireDate = new Date(course.expired_at);
    const today = new Date();
    const sevenDaysLater = new Date(); sevenDaysLater.setDate(today.getDate() + 7);
    return expireDate < sevenDaysLater;
  }
  return false;
};

onMounted(() => { fetchStudents(); });
</script>

<style scoped>
/* 增加一些 Element Plus 的样式覆盖，让表格更紧凑 */
:deep(.el-table .cell) {
  padding: 8px 12px;
}
</style>