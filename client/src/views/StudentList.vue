<template>
  <div class="student-list-container">
    <el-card shadow="never" class="toolbar">
      <el-row justify="space-between" align="middle">
        <div class="title">🎓 学员列表</div>
        <el-button type="primary" icon="Plus" @click="dialogVisible = true">新增学员</el-button>
      </el-row>
    </el-card>

    <el-card shadow="never" style="margin-top: 20px;">
      <el-table :data="tableData" stripe style="width: 100%" v-loading="loading">
        <el-table-column prop="name" label="姓名" width="120" />
        <el-table-column prop="gender" label="性别" width="80" />
        <el-table-column prop="parent_name" label="家长姓名" width="120" />
        <el-table-column prop="parent_phone" label="联系电话" width="150" />

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

        <el-table-column label="在读课程 / 剩余课时" min-width="200">
          <template #default="scope">
            <div v-if="scope.row.courses && scope.row.courses.length > 0">
              <el-tag v-for="(course, index) in scope.row.courses" :key="index"
                style="margin-right: 5px; margin-bottom: 5px;" :type="isCourseExpiring(course) ? 'danger' : 'primary'">
                <span v-if="course.expired_at">
                  {{ course.class_name }} - 有效期至 {{ new Date(course.expired_at).toLocaleDateString() }}
                </span>
                
                <span v-else>
                  {{ course.class_name }} - 剩 {{ course.remaining }} 节
                </span>
              </el-tag>
            </div>
            <span v-else style="color: #909399; font-size: 12px;">未报名</span>
          </template>
        </el-table-column>

        <el-table-column label="操作">
          <template #default="scope">
            <el-button size="small" type="primary" link @click="openEnrollDialog(scope.row)">报名/续费</el-button>
            <el-button size="small" type="danger" link>编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" title="新增学员档案" width="500px">
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
        <el-form-item label="初始预存">
          <el-input-number v-model="displayBalance" :min="0" :step="100" />
          <span style="margin-left: 10px; color: gray;">元 (可选)</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSubmit">确 定</el-button>
        </span>
      </template>
    </el-dialog>

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
import { ElMessage } from 'element-plus';

// --- 1. 基础数据定义 ---
const tableData = ref([]);
const loading = ref(false);
const dialogVisible = ref(false); // 新增学员弹窗

// 新增学员表单
const form = reactive({
  name: '',
  gender: '男',
  parent_name: '',
  parent_phone: ''
});
const displayBalance = ref(0); // 临时变量，用于显示“元”

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

// 提交新增学员
const handleSubmit = async () => {
  try {
    const payload = {
      ...form,
      balance: displayBalance.value * 100
    };

    const res = await axios.post('/api/students', payload);

    if (res.data.code === 200) {
      ElMessage.success('新增成功');
      dialogVisible.value = false;
      fetchStudents();

      // 重置表单
      form.name = '';
      form.parent_name = '';
      form.parent_phone = '';
      displayBalance.value = 0;
    } else {
      ElMessage.error(res.data.msg);
    }
  } catch (err) {
    ElMessage.error('操作失败');
  }
};

// 判断课程是否快过期或没课时了 (用于标签变红)
const isCourseExpiring = (course) => {
  if (course.expired_at) {
    // 包月课：如果有效期小于今天，或者只剩3天，变红
    const expireDate = new Date(course.expired_at);
    const today = new Date();
    const threeDaysLater = new Date();
    threeDaysLater.setDate(today.getDate() + 3);
    
    return expireDate < threeDaysLater;
  } else {
    // 按次课：少于 3 节变红
    return course.remaining < 3;
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