<template>
  <div class="class-container">
    <el-card shadow="never">
      <template #header>
        <div class="header-row">
          <span class="title">🏫 课程/班级管理</span>
          <el-button type="primary" icon="Plus" @click="openCreateDialog">新建课程</el-button>
        </div>
      </template>

      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="class_name" label="课程名称" min-width="150" />
        
        <el-table-column label="类型" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.billing_type === 'time' ? 'warning' : 'success'">
              {{ scope.row.billing_type === 'time' ? '包期/月' : '按次' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="开课/排课" min-width="240">
          <template #default="scope">
            <div style="font-size: 13px;">
              <div style="font-weight: bold; color: #303133;">
                🕒 周{{ formatDays(scope.row.schedule_days) }} {{ scope.row.time_range }}
              </div>
              <div style="color: #909399; margin-top: 4px;">
                📅 {{ formatDate(scope.row.start_date) }} 至 {{ formatDate(scope.row.end_date) }}
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="学费" width="120">
          <template #default="scope">
            ¥ {{ (scope.row.tuition_fee / 100).toFixed(2) }}
          </template>
        </el-table-column>

        <el-table-column prop="teacher_name" label="负责老师" width="100" />
        
        <el-table-column label="状态" width="80">
          <template #default="scope">
            <el-switch 
              v-model="scope.row.is_active" 
              @change="handleStatusChange(scope.row)"
              size="small"
              active-color="#13ce66"
              inactive-color="#ff4949"
            />
          </template>
        </el-table-column>

        <el-table-column label="操作" width="80">
          <template #default="scope">
            <el-button size="small" type="primary" link @click="openEditDialog(scope.row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑课程' : '新建课程'" width="600px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="课程名称">
          <el-input v-model="form.class_name" placeholder="例如：寒假晚托班" />
        </el-form-item>
        
        <el-form-item label="负责老师">
          <el-input v-model="form.teacher_name" placeholder="例如：王老师" />
        </el-form-item>

        <el-form-item label="计费类型">
          <el-radio-group v-model="form.billing_type" @change="calculateEndDate">
            <el-radio label="time">包期/包月 (按月数)</el-radio>
            <el-radio label="count">按次/短期 (按次数)</el-radio>
          </el-radio-group>
        </el-form-item>

        <div style="background: #f5f7fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
          
          <el-form-item label="开课日期">
            <el-date-picker 
              v-model="form.start_date" 
              type="date" 
              placeholder="选择开课日期" 
              style="width: 100%"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              @change="calculateEndDate"
            />
          </el-form-item>

          <el-form-item label="上课周期">
            <el-checkbox-group v-model="form.schedule_days" @change="calculateEndDate">
              <el-checkbox label="1">周一</el-checkbox>
              <el-checkbox label="2">周二</el-checkbox>
              <el-checkbox label="3">周三</el-checkbox>
              <el-checkbox label="4">周四</el-checkbox>
              <el-checkbox label="5">周五</el-checkbox>
              <el-checkbox label="6">周六</el-checkbox>
              <el-checkbox label="0">周日</el-checkbox>
            </el-checkbox-group>
          </el-form-item>

          <el-form-item label="上课时间">
            <el-time-picker
              v-model="form.time_range_arr"
              is-range
              range-separator="至"
              start-placeholder="开始"
              end-placeholder="结束"
              format="HH:mm"
              value-format="HH:mm"
              style="width: 100%"
            />
          </el-form-item>

          <el-form-item :label="form.billing_type === 'time' ? '有效期(月)' : '总课时(节)'">
            <el-input-number 
              v-model="form.duration_value" 
              :min="1" 
              @change="calculateEndDate" 
              style="width: 180px;"
            />
            <span style="margin-left: 10px; font-size: 12px; color: #666;">
              {{ form.billing_type === 'time' ? '个月' : '节课' }}
            </span>
          </el-form-item>

          <el-form-item label="结课日期">
             <el-date-picker 
              v-model="form.end_date" 
              type="date" 
              placeholder="系统根据周期自动计算" 
              style="width: 100%"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              disabled
            />
            <div style="font-size: 12px; color: #E6A23C; line-height: 1.5; margin-top: 5px;" v-if="form.billing_type === 'count'">
              * 系统已根据上课周期，自动推算出上满 {{ form.duration_value }} 节课的具体日期
            </div>
          </el-form-item>
        </div>
        <el-form-item label="学费金额">
          <el-input-number v-model="displayFee" :min="0" :step="100" />
          <span style="margin-left: 10px; color: gray;">元</span>
        </el-form-item>

        <el-form-item label="备注/描述">
          <el-input v-model="form.description" type="textarea" />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitForm">保 存</el-button>
        </span>
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
const dialogVisible = ref(false);
const isEdit = ref(false);

const form = reactive({
  id: null,
  class_name: '',
  billing_type: 'time', 
  teacher_name: '',
  description: '',
  is_active: true,
  start_date: '',
  duration_value: 1, 
  end_date: '',
  schedule_days: [], 
  time_range_arr: ['16:30', '18:30'], 
});
const displayFee = ref(0);

// 格式化工具
const formatDate = (dateStr) => {
  if(!dateStr) return '--';
  return dateStr.split('T')[0]; 
};

const formatDays = (daysStr) => {
  if(!daysStr) return '';
  const map = {'1':'一', '2':'二', '3':'三', '4':'四', '5':'五', '6':'六', '0':'日'};
  const arr = Array.isArray(daysStr) ? daysStr : daysStr.split(',');
  return arr.map(d => map[d]).join('、');
};

// --- ⭐ 核心算法：智能计算结课日期 ---
const calculateEndDate = () => {
  if (!form.start_date || !form.duration_value) return;

  const start = new Date(form.start_date);
  const duration = parseInt(form.duration_value);
  let end = new Date(start);

  if (form.billing_type === 'time') {
    // === 逻辑 A: 包月 (简单日期加法) ===
    end.setMonth(end.getMonth() + duration);
    end.setDate(end.getDate() - 1);
    form.end_date = end.toISOString().split('T')[0];
  } else {
    // === 逻辑 B: 按次 (根据上课周期数日子) ===
    
    // 如果没有选周期，默认按连续天数计算 (兜底)
    if (!form.schedule_days || form.schedule_days.length === 0) {
      end.setDate(end.getDate() + duration - 1);
      form.end_date = end.toISOString().split('T')[0];
      return;
    }

    // 算法：从开始日期一天天往后找，直到凑够 duration 节课
    let lessonsFound = 0;
    let currentPointer = new Date(start);
    
    // 限制循环次数防止死循环 (比如排了1000节课)
    let safeGuard = 0; 
    
    // 将 '1','2' 转为数字类型 1, 2 以便对比 (Date.getDay() 返回 0-6)
    const targetDays = form.schedule_days.map(d => parseInt(d));

    while (lessonsFound < duration && safeGuard < 3650) { // 最多往后推10年
      const dayOfWeek = currentPointer.getDay(); // 0(周日) - 6(周六)
      
      // 如果当前这天是上课日
      if (targetDays.includes(dayOfWeek)) {
        lessonsFound++;
      }

      // 如果还没凑够，指针往后移一天
      if (lessonsFound < duration) {
        currentPointer.setDate(currentPointer.getDate() + 1);
      }
      safeGuard++;
    }

    form.end_date = currentPointer.toISOString().split('T')[0];
  }
};

// 获取列表
const fetchClasses = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/classes');
    if (res.data.code === 200) tableData.value = res.data.data;
  } finally {
    loading.value = false;
  }
};

const openCreateDialog = () => {
  isEdit.value = false;
  Object.assign(form, {
    id: null, class_name: '', billing_type: 'time', teacher_name: '', description: '', is_active: true,
    start_date: new Date().toISOString().split('T')[0], // 默认今天
    duration_value: 1,
    end_date: '',
    schedule_days: ['1','3','5'], // 默认一三五
    time_range_arr: ['16:30', '18:30']
  });
  displayFee.value = 0;
  calculateEndDate(); 
  dialogVisible.value = true;
};

const openEditDialog = (row) => {
  isEdit.value = true;
  Object.assign(form, row);
  displayFee.value = row.tuition_fee / 100;
  
  if (row.schedule_days && typeof row.schedule_days === 'string') {
    form.schedule_days = row.schedule_days.split(',');
  }
  if (row.time_range) {
    form.time_range_arr = row.time_range.split('-');
  }
  
  if(row.start_date) form.start_date = row.start_date.split('T')[0];
  if(row.end_date) form.end_date = row.end_date.split('T')[0];

  dialogVisible.value = true;
};

const submitForm = async () => {
  const payload = {
    ...form,
    tuition_fee: displayFee.value * 100,
    time_range: form.time_range_arr ? form.time_range_arr.join('-') : ''
  };

  try {
    if (isEdit.value) {
      await axios.put(`/api/classes/${form.id}`, payload);
      ElMessage.success('更新成功');
    } else {
      await axios.post('/api/classes', payload);
      ElMessage.success('创建成功');
    }
    dialogVisible.value = false;
    fetchClasses();
  } catch (err) {
    console.error(err);
    ElMessage.error('操作失败');
  }
};

const handleStatusChange = async (row) => {
  try {
    await axios.put(`/api/classes/${row.id}`, row);
    ElMessage.success('状态已更新');
  } catch (err) {
    ElMessage.error('更新失败');
    row.is_active = !row.is_active;
  }
};

onMounted(() => {
  fetchClasses();
});
</script>

<style scoped>
.header-row { display: flex; justify-content: space-between; align-items: center; }
.title { font-size: 18px; font-weight: bold; }
</style>