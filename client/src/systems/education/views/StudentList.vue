<template>
  <div class="student-list-container">
    <el-card shadow="never" class="toolbar">
      <el-row justify="space-between" align="middle">
        <div class="title">🎓 {{ $t('student.title') }}</div>
        <el-button type="primary" icon="Plus" @click="openAddDialog">{{ $t('student.addBtn') }}</el-button>
      </el-row>
    </el-card>

    <el-card shadow="never" style="margin-top: 20px;">
      <el-table :data="tableData" stripe style="width: 100%" v-loading="loading">
        <el-table-column prop="name" :label="$t('student.colName')" width="120" />
        <el-table-column prop="gender" :label="$t('student.colGender')" width="80" />
        <el-table-column prop="parent_name" :label="$t('student.colParent')" width="120" />
        <el-table-column prop="parent_phone" :label="$t('student.colPhone')" width="150" />

        <el-table-column :label="$t('student.colAddress')" min-width="150">
          <template #default="scope">
            <el-button v-if="scope.row.address || (scope.row.longitude && scope.row.latitude)" type="primary" link
              size="small" @click="viewLocation(scope.row)">
              <el-icon><Location /></el-icon>
              {{ scope.row.address || $t('student.btnSelectLoc') }}
            </el-button>
            <span v-else style="color: #C0C4CC;">--</span>
          </template>
        </el-table-column>

        <el-table-column :label="$t('student.colBalance')" width="150">
          <template #default="scope">
            <span style="color: #67C23A; font-weight: bold;">
              ¥ {{ (scope.row.balance / 100).toFixed(2) }}
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="joined_at" :label="$t('student.colJoined')" width="180">
          <template #default="scope">
            {{ new Date(scope.row.joined_at).toLocaleDateString() }}
          </template>
        </el-table-column>

        <el-table-column :label="$t('student.colCourses')" min-width="200">
          <template #default="scope">
            <div v-if="scope.row.courses && scope.row.courses.length > 0">
              <el-tag v-for="(course, index) in scope.row.courses" :key="index"
                style="margin-right: 5px; margin-bottom: 5px;" :type="isCourseExpiring(course) ? 'danger' : 'primary'">
                <span v-if="course.expired_at">
                  {{ course.class_name }} - {{ new Date(course.expired_at).toLocaleDateString() }}
                </span>
                <span v-else style="color: #909399;">
                  {{ course.class_name }}
                </span>
              </el-tag>
            </div>
            <span v-else style="color: #909399; font-size: 12px;">--</span>
          </template>
        </el-table-column>

        <el-table-column :label="$t('common.action')" width="300">
          <template #default="scope">
            <el-button size="small" link @click="$router.push(`/system/students/${scope.row.id}`)">{{ $t('common.detail') }}</el-button>
            <el-button size="small" type="primary" link @click="openEnrollDialog(scope.row)">{{ $t('student.btnEnroll') }}</el-button>
            <el-button size="small" type="success" link @click="openEditDialog(scope.row)">{{ $t('common.edit') }}</el-button>
            <el-button v-if="role === 'admin'" size="small" type="warning" link @click="openDropDialog(scope.row)">{{ $t('student.btnDrop') }}</el-button>
            <el-button v-if="role === 'admin'" size="small" type="danger" link @click="handleDelete(scope.row)">{{ $t('common.delete') }}</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="isEdit ? $t('student.dialogEditTitle') : $t('student.dialogAddTitle')" width="500px">
      <el-form :model="form" label-width="100px">
        <el-form-item :label="$t('student.labelName')">
          <el-input v-model="form.name" :placeholder="$t('student.placeholderName')" />
        </el-form-item>
        <el-form-item :label="$t('student.labelGender')">
          <el-radio-group v-model="form.gender">
            <el-radio label="男">{{ $t('student.genderMale') }}</el-radio>
            <el-radio label="女">{{ $t('student.genderFemale') }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item :label="$t('student.labelParent')">
          <el-input v-model="form.parent_name" :placeholder="$t('student.placeholderParent')" />
        </el-form-item>
        <el-form-item :label="$t('student.labelPhone')">
          <el-input v-model="form.parent_phone" :placeholder="$t('student.placeholderPhone')" />
        </el-form-item>
        <el-form-item :label="$t('student.labelAddress')">
          <el-input v-model="form.address" :placeholder="$t('student.placeholderAddress')" readonly>
            <template #append>
              <el-button @click="showMapPicker" icon="Location">{{ $t('student.btnSelectLoc') }}</el-button>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item :label="isEdit ? $t('student.labelBalance') : $t('student.labelInitialBalance')">
          <el-input-number v-model="displayBalance" :min="0" :step="100" />
          <span style="margin-left: 10px; color: gray;">{{ $t('student.unitYuan') }}</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">{{ $t('common.cancel') }}</el-button>
          <el-button type="primary" @click="handleSubmit">{{ $t('common.confirm') }}</el-button>
        </span>
      </template>
    </el-dialog>

    <MapPicker v-model="mapPickerVisible"
      :initial-lng="mapViewMode ? (viewingStudent?.longitude || null) : form.longitude"
      :initial-lat="mapViewMode ? (viewingStudent?.latitude || null) : form.latitude"
      :initial-address="mapViewMode ? (viewingStudent?.address || null) : null" :readonly="mapViewMode"
      :title="mapViewMode ? $t('student.labelAddress') : $t('student.btnSelectLoc')" @confirm="handleMapConfirm" />

    <el-dialog v-model="enrollDialogVisible" :title="$t('student.btnEnroll')" width="500px">
      <el-form :model="enrollForm" label-width="100px">
        <el-form-item :label="$t('student.labelName')">
          <el-tag type="info" size="large">{{ enrollForm.studentName }}</el-tag>
        </el-form-item>
        <el-form-item :label="$t('class.labelName')">
          <el-select v-model="enrollForm.class_id" :placeholder="$t('common.placeholderSelect')" style="width: 100%" @change="handleClassChange">
            <el-option v-for="item in classList" :key="item.id" :label="item.class_name" :value="item.id">
              <span style="float: left">{{ item.class_name }}</span>
              <span style="float: right; color: #8492a6; font-size: 13px">¥{{ item.tuition_fee / 100 }}</span>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item :label="$t('order.colAmount')">
          <el-input-number v-model="enrollForm.displayAmount" :min="0" :precision="2" :step="100" />
          <span style="margin-left: 10px;">{{ $t('student.unitYuan') }}</span>
        </el-form-item>
        <el-form-item :label="$t('common.remark')">
          <el-input v-model="enrollForm.remark" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="enrollDialogVisible = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="submitEnroll" :loading="submitting">{{ $t('common.confirm') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="dropDialogVisible" :title="$t('student.btnDrop')" width="500px">
       <el-form :model="dropForm" label-width="100px">
         <el-form-item :label="$t('common.remark')">
          <el-input v-model="dropForm.remark" type="textarea" />
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
import { Location } from '@element-plus/icons-vue';
import MapPicker from '../../../shared/components/MapPicker.vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const userInfoStr = localStorage.getItem('user_info');
const role = userInfoStr ? JSON.parse(userInfoStr).role : 'teacher';

const tableData = ref([]);
const loading = ref(false);
const dialogVisible = ref(false);
const isEdit = ref(false);
const mapPickerVisible = ref(false);
const mapViewMode = ref(false);
const viewingStudent = ref(null);
const form = reactive({
  id: null, name: '', gender: '男', parent_name: '', parent_phone: '',
  address: '', longitude: null, latitude: null
});
const displayBalance = ref(0);
const enrollDialogVisible = ref(false);
const submitting = ref(false);
const classList = ref([]);
const enrollForm = reactive({
  studentId: null, studentName: '', class_id: null, quantity: 1, displayAmount: 0, remark: ''
});
const dropDialogVisible = ref(false);
const studentCourses = ref([]);
const dropForm = reactive({
  studentId: null, studentName: '', class_id: null, refund_amount: 0, remark: ''
});

const fetchStudents = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/students');
    if (res.data.code === 200) tableData.value = res.data.data;
  } catch(err){ ElMessage.error(t('common.failed')); } 
  finally { loading.value = false; }
};
const fetchClasses = async () => {
  try {
    const res = await axios.get('/api/classes');
    if (res.data.code === 200) classList.value = res.data.data;
  } catch (err) { console.error(err); }
};
const openEnrollDialog = (row) => {
  enrollForm.studentId = row.id; enrollForm.studentName = row.name; enrollForm.class_id = null;
  enrollForm.quantity = 1; enrollForm.displayAmount = 0; enrollForm.remark = '';
  if (classList.value.length === 0) fetchClasses();
  enrollDialogVisible.value = true;
};
const handleClassChange = () => calculateTotal();
const calculateTotal = () => {
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
const openEditDialog = (row) => {
  isEdit.value = true;
  Object.assign(form, row);
  form.address = row.address || '';
  displayBalance.value = (row.balance / 100).toFixed(2);
  dialogVisible.value = true;
};
const openAddDialog = () => {
  isEdit.value = false;
  Object.assign(form, { id: null, name: '', gender: '男', parent_name: '', parent_phone: '', address: '', longitude: null, latitude: null });
  displayBalance.value = 0;
  dialogVisible.value = true;
};
const showMapPicker = () => { mapViewMode.value = false; viewingStudent.value = null; mapPickerVisible.value = true; };
const viewLocation = (row) => { viewingStudent.value = row; mapViewMode.value = true; mapPickerVisible.value = true; };
const handleMapConfirm = (data) => {
  if (mapViewMode.value) { mapViewMode.value = false; viewingStudent.value = null; return; }
  form.longitude = data.lng; form.latitude = data.lat; form.address = data.address;
};
const handleSubmit = async () => {
  try {
    const payload = { ...form, balance: displayBalance.value * 100 };
    let res = isEdit.value ? await axios.put(`/api/students/${form.id}`, payload) : await axios.post('/api/students', payload);
    if (res.data.code === 200) {
      ElMessage.success(t('common.success'));
      dialogVisible.value = false; fetchStudents();
    } else { ElMessage.error(res.data.msg); }
  } catch (err) { ElMessage.error(t('common.failed')); }
};
const isCourseExpiring = (course) => {
  if (course.expired_at) {
    const expireDate = new Date(course.expired_at);
    const today = new Date();
    const sevenDaysLater = new Date(); sevenDaysLater.setDate(today.getDate() + 7);
    return expireDate < sevenDaysLater;
  }
  return false;
};
const openDropDialog = (row) => {
  if (!row.courses || row.courses.length === 0) return ElMessage.warning('No courses');
  dropForm.studentId = row.id; dropForm.studentName = row.name; dropForm.class_id = null;
  dropForm.refund_amount = 0; dropForm.remark = '';
  studentCourses.value = row.courses;
  dropDialogVisible.value = true;
};
const submitDrop = async () => {
  try {
    const res = await axios.post(`/api/students/${dropForm.studentId}/drop`, dropForm);
    if (res.data.code === 200) {
      ElMessage.success(t('common.success'));
      dropDialogVisible.value = false; fetchStudents();
    } else { ElMessage.error(res.data.msg); }
  } catch(err) { ElMessage.error(t('common.failed')); }
};
const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(
      t('common.confirm') + ' ' + t('common.delete') + '?',
      t('common.delete'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
      }
    );
    const res = await axios.delete(`/api/students/${row.id}`);
    if (res.data.code === 200) {
      ElMessage.success(t('common.success'));
      fetchStudents();
    } else {
      ElMessage.error(res.data.msg || t('common.failed'));
    }
  } catch (err) {
    if (err !== 'cancel') ElMessage.error(t('common.failed'));
  }
};
onMounted(() => { fetchStudents(); });
</script>

