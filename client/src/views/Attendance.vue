<template>
  <div class="attendance-container">
    <el-card shadow="never">
      <template #header>
        <div class="header-row">
          <span class="title">📅 签到消课</span>
          
          <el-select 
            v-model="selectedClassId" 
            placeholder="筛选班级 (留空显示所有)" 
            size="large"
            style="width: 300px"
            clearable
          >
            <el-option
              v-for="item in classList"
              :key="item.id"
              :label="item.class_name"
              :value="item.id"
            />
          </el-select>
        </div>
      </template>

      <div class="student-grid">
        <el-empty v-if="filteredStudents.length === 0" description="暂无在读学员数据" />
        
        <el-card 
          v-for="card in filteredStudents" 
          :key="`${card.studentId}-${card.classId}`" 
          class="student-card" 
          shadow="hover"
          :class="{ 'signed-in': card.todaySignedIn }"
        >
          <div class="card-content">
            <div class="info">
              <div class="name">
                {{ card.studentName }}
                <el-tag size="small" effect="plain" style="margin-left: 5px;">{{ card.className }}</el-tag>
              </div>
              
              <div class="balance">
                <span v-if="card.expiredAt">
                  有效期至: <span class="highlight" style="color: #E6A23C">{{ formatDate(card.expiredAt) }}</span>
                </span>
                <span v-else>
                  剩余: <span class="highlight">{{ card.currentBalance }}</span> 课时
                </span>
              </div>
            </div>
            
            <el-button 
              v-if="!card.todaySignedIn"
              type="primary" 
              size="large" 
              class="check-btn"
              @click="handleCheckIn(card)"
              :loading="card.loading"
            >
              签 到
            </el-button>
            <el-button v-else type="success" size="large" class="check-btn" disabled>
              <el-icon><Check /></el-icon> 已签
            </el-button>
          </div>
        </el-card>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { Check } from '@element-plus/icons-vue';

const classList = ref([]);
const allStudents = ref([]);
const selectedClassId = ref(''); // 默认为空字符串

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString();
};

const fetchClasses = async () => {
  const res = await axios.get('/api/classes');
  if (res.data.code === 200) classList.value = res.data.data;
};

const fetchStudents = async () => {
  const res = await axios.get('/api/students');
  if (res.data.code === 200) allStudents.value = res.data.data;
};

// ⭐ 修改点 3: 核心扁平化逻辑
const filteredStudents = computed(() => {
  // 第一步：把“学生”拍扁成“课程卡片”
  // 如果张三报了2门课，这里会生成 2 个卡片对象
  const allCards = allStudents.value.flatMap(student => {
    if (!student.courses || student.courses.length === 0) return [];

    return student.courses.map(course => ({
      // 基础信息
      studentId: student.id,
      studentName: student.name,
      // 课程信息
      classId: course.class_id,
      className: course.class_name,
      currentBalance: course.remaining,
      expiredAt: course.expired_at,
      todaySignedIn: course.has_signed_today, // 后端返回的签到状态
      loading: false
    }));
  });

  // 第二步：根据下拉框进行过滤
  if (!selectedClassId.value) {
    return allCards; // 没选班级，显示所有
  }

  // 选了班级，只显示该班级的卡片
  return allCards.filter(card => card.classId === selectedClassId.value);
});

// ⭐ 修改点 4: 签到逻辑适配
const handleCheckIn = async (card) => {
  card.loading = true;
  try {
    const res = await axios.post('/api/attendance', {
      student_id: card.studentId,
      class_id: card.classId, // 注意：现在从 card 里取 classId，不再依赖 selectedClassId
      operator_id: 1
    });

    if (res.data.code === 200) {
      ElMessage.success(`${card.studentName} 签到成功`);
      
      // 更新源数据 (allStudents)，以触发视图自动更新
      const sourceStudent = allStudents.value.find(s => s.id === card.studentId);
      if (sourceStudent && sourceStudent.courses) {
        const sourceCourse = sourceStudent.courses.find(c => c.class_id === card.classId);
        if (sourceCourse) {
          sourceCourse.remaining = res.data.data.remaining;
          sourceCourse.has_signed_today = true; // 关键：更新源数据的签到状态
        }
      }
    } else {
      ElMessage.error(res.data.msg);
    }
  } catch (err) {
    console.error(err);
    ElMessage.error('签到失败');
  } finally {
    card.loading = false;
  }
};

onMounted(() => {
  fetchClasses();
  fetchStudents();
});
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
.student-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); /* 稍微调宽一点 */
  gap: 20px;
  margin-top: 20px;
}
.student-card {
  border-radius: 8px;
  transition: all 0.3s;
}
/* 已签到卡片的样式（可选：变灰一点或者加边框） */
.signed-in {
  background-color: #f0f9eb;
  border-color: #e1f3d8;
}

.card-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.name {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 5px;
  display: flex;
  align-items: center;
}
.highlight {
  color: #409EFF;
  font-weight: bold;
  font-size: 16px;
}
.check-btn {
  width: 90px;
}
</style>