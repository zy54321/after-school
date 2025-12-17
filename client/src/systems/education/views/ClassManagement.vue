<template>
  <div class="class-container">
    <el-card shadow="never">
      <template #header>
        <div class="header-row">
          <span class="title">🏫 {{ $t('class.title') }}</span>
          <el-button type="primary" icon="Plus" @click="openCreateDialog">{{ $t('class.addBtn') }}</el-button>
        </div>
      </template>

      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="class_name" :label="$t('class.colName')" min-width="150" />

        <el-table-column :label="$t('class.colType')" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.billing_type === 'time' ? 'warning' : 'success'">
              {{ scope.row.billing_type === 'time' ? $t('class.typeTime') : $t('class.typeCount') }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column :label="$t('class.colSchedule')" min-width="240">
          <template #default="scope">
            <div style="font-size: 13px;">
              <div style="font-weight: bold; color: #303133;">
                🕒 {{ formatDays(scope.row.schedule_days) }} {{ scope.row.time_range }}
              </div>
              <div style="color: #909399; margin-top: 4px;">
                📅 {{ formatDate(scope.row.start_date) }} ~ {{ formatDate(scope.row.end_date) }}
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column :label="$t('class.colFee')" width="120">
          <template #default="scope">
            ¥ {{ (scope.row.tuition_fee / 100).toFixed(2) }}
          </template>
        </el-table-column>

        <el-table-column prop="teacher_name" :label="$t('class.colTeacher')" width="100" />

        <el-table-column :label="$t('class.colDesc')" min-width="150" show-overflow-tooltip>
          <template #default="scope">{{ scope.row.description || '--' }}</template>
        </el-table-column>

        <el-table-column :label="$t('class.colStatus')" width="80">
          <template #default="scope">
            <el-switch v-model="scope.row.is_active" @change="handleStatusChange(scope.row)" />
          </template>
        </el-table-column>

        <el-table-column :label="$t('common.action')" width="150">
          <template #default="scope">
            <el-button size="small" type="primary" link @click="openEditDialog(scope.row)">{{ $t('common.edit')
              }}</el-button>
            <el-button size="small" type="danger" link @click="handleDelete(scope.row)">{{ $t('common.delete')
              }}</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="isEdit ? $t('class.dialogEditTitle') : $t('class.dialogCreateTitle')"
      width="600px">
      <el-form :model="form" label-width="100px">
        <el-form-item :label="$t('class.labelName')">
          <el-input v-model="form.class_name" />
        </el-form-item>
        <el-form-item :label="$t('class.labelTeacher')">
          <el-input v-model="form.teacher_name" />
        </el-form-item>
        <el-form-item :label="$t('class.labelType')">
          <el-radio-group v-model="form.billing_type" @change="calculateEndDate">
            <el-radio label="time">{{ $t('class.typeTime') }}</el-radio>
            <el-radio label="count">{{ $t('class.typeCount') }}</el-radio>
          </el-radio-group>
        </el-form-item>

        <div style="background: #f5f7fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
          <el-form-item :label="$t('class.labelStartDate')">
            <el-date-picker v-model="form.start_date" type="date" value-format="YYYY-MM-DD" @change="calculateEndDate"
              style="width: 100%" />
          </el-form-item>

          <el-form-item :label="$t('class.labelSchedule')">
            <el-checkbox-group v-model="form.schedule_days" @change="calculateEndDate">
              <el-checkbox label="1">{{ $t('class.week.1') }}</el-checkbox>
              <el-checkbox label="2">{{ $t('class.week.2') }}</el-checkbox>
              <el-checkbox label="3">{{ $t('class.week.3') }}</el-checkbox>
              <el-checkbox label="4">{{ $t('class.week.4') }}</el-checkbox>
              <el-checkbox label="5">{{ $t('class.week.5') }}</el-checkbox>
              <el-checkbox label="6">{{ $t('class.week.6') }}</el-checkbox>
              <el-checkbox label="0">{{ $t('class.week.0') }}</el-checkbox>
            </el-checkbox-group>
          </el-form-item>

          <el-form-item :label="$t('class.labelTime')">
            <el-time-picker v-model="form.time_range_arr" is-range value-format="HH:mm" style="width: 100%" />
          </el-form-item>

          <el-form-item
            :label="form.billing_type === 'time' ? $t('class.labelDurationTime') : $t('class.labelDurationCount')">
            <el-input-number v-model="form.duration_value" :min="1" @change="calculateEndDate" style="width: 180px;" />
          </el-form-item>

          <el-form-item :label="$t('class.labelEndDate')">
            <el-date-picker v-model="form.end_date" type="date" disabled style="width: 100%" />
            <div style="font-size: 12px; color: #E6A23C;" v-if="form.billing_type === 'count'">* {{
              $t('class.hintAutoCalc')
              }}</div>
          </el-form-item>
        </div>
        <el-form-item :label="$t('class.labelFee')">
          <el-input-number v-model="displayFee" :min="0" :step="100" />
        </el-form-item>
        <el-form-item :label="$t('class.labelDesc')">
          <el-input v-model="form.description" type="textarea" />
        </el-form-item>
      </el-form>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">{{ $t('common.cancel') }}</el-button>
          <el-button type="primary" @click="submitForm">{{ $t('common.save') }}</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import axios from 'axios';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();

const tableData = ref([]);
const loading = ref(false);
const dialogVisible = ref(false);
const isEdit = ref(false);

const form = reactive({
  id: null, class_name: '', billing_type: 'time', teacher_name: '', description: '', is_active: true,
  start_date: '', duration_value: 1, end_date: '', schedule_days: [], time_range_arr: ['16:30', '18:30'],
});
const displayFee = ref(0);

const formatDate = (dateStr) => dateStr ? dateStr.split('T')[0] : '--';
const formatDays = (daysStr) => {
  if (!daysStr) return '';
  const arr = Array.isArray(daysStr) ? daysStr : daysStr.split(',');
  return arr.map(d => t(`class.week.${d}`)).join(', ');
};

const calculateEndDate = () => {
  if (!form.start_date || !form.duration_value) return;
  const start = new Date(form.start_date);
  const duration = parseInt(form.duration_value);
  let end = new Date(start);
  if (form.billing_type === 'time') {
    end.setMonth(end.getMonth() + duration);
    end.setDate(end.getDate() - 1);
    form.end_date = end.toISOString().split('T')[0];
  } else {
    if (!form.schedule_days || form.schedule_days.length === 0) {
      end.setDate(end.getDate() + duration - 1);
      form.end_date = end.toISOString().split('T')[0];
      return;
    }
    let lessonsFound = 0; let currentPointer = new Date(start); let safeGuard = 0;
    const targetDays = form.schedule_days.map(d => parseInt(d));
    while (lessonsFound < duration && safeGuard < 3650) {
      const dayOfWeek = currentPointer.getDay();
      if (targetDays.includes(dayOfWeek)) lessonsFound++;
      if (lessonsFound < duration) currentPointer.setDate(currentPointer.getDate() + 1);
      safeGuard++;
    }
    form.end_date = currentPointer.toISOString().split('T')[0];
  }
};

const fetchClasses = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/classes');
    if (res.data.code === 200) tableData.value = res.data.data;
  } finally { loading.value = false; }
};

const openCreateDialog = () => {
  isEdit.value = false;
  Object.assign(form, {
    id: null, class_name: '', billing_type: 'time', teacher_name: '', description: '', is_active: true,
    start_date: new Date().toISOString().split('T')[0], duration_value: 1, end_date: '',
    schedule_days: ['1', '3', '5'], time_range_arr: ['16:30', '18:30']
  });
  displayFee.value = 0; calculateEndDate(); dialogVisible.value = true;
};

const openEditDialog = (row) => {
  isEdit.value = true; Object.assign(form, row); displayFee.value = row.tuition_fee / 100;
  if (row.schedule_days && typeof row.schedule_days === 'string') form.schedule_days = row.schedule_days.split(',');
  if (row.time_range) form.time_range_arr = row.time_range.split('-');
  if (row.start_date) form.start_date = row.start_date.split('T')[0];
  if (row.end_date) form.end_date = row.end_date.split('T')[0];
  dialogVisible.value = true;
};

const submitForm = async () => {
  const payload = { ...form, tuition_fee: displayFee.value * 100, time_range: form.time_range_arr ? form.time_range_arr.join('-') : '' };
  try {
    if (isEdit.value) await axios.put(`/api/classes/${form.id}`, payload);
    else await axios.post('/api/classes', payload);
    ElMessage.success(t('common.success'));
    dialogVisible.value = false; fetchClasses();
  } catch (err) { ElMessage.error(t('common.failed')); }
};

const handleStatusChange = async (row) => {
  try { await axios.put(`/api/classes/${row.id}`, row); ElMessage.success(t('common.success')); }
  catch (err) { ElMessage.error(t('common.failed')); row.is_active = !row.is_active; }
};

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(t('common.confirm') + ' ' + t('common.delete') + '?', t('common.delete'), { type: 'warning' });
    const res = await axios.delete(`/api/classes/${row.id}`);
    if (res.data.code === 200) { ElMessage.success(t('common.success')); fetchClasses(); }
    else { ElMessage.error(res.data.msg); }
  } catch (err) { if (err !== 'cancel') ElMessage.error(t('common.failed')); }
};

onMounted(() => { fetchClasses(); });
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

