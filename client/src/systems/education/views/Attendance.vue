<template>
  <div class="attendance-container">
    <el-card shadow="never">
      <template #header>
        <div class="header-row">
          <span class="title">📅 {{ $t('attendance.title') }}</span>

          <el-select v-model="selectedClassId" :placeholder="$t('attendance.filterClass')" size="large"
            style="width: 300px" clearable>
            <el-option v-for="item in classList" :key="item.id" :label="item.class_name" :value="item.id" />
          </el-select>
        </div>
      </template>

      <div class="student-grid">
        <el-empty v-if="filteredStudents.length === 0" :description="$t('attendance.empty')" />

        <el-card v-for="card in filteredStudents" :key="`${card.studentId}-${card.classId}`" class="student-card"
          shadow="hover" :class="{ 'signed-in': card.todaySignedIn }">
          <div class="card-content">
            <div class="info">
              <div class="name">
                {{ card.studentName }}
                <el-tag size="small" effect="plain" style="margin-left: 5px;">{{ card.className }}</el-tag>
              </div>

              <div class="balance">
                <span v-if="card.expiredAt">
                  {{ $t('attendance.validUntil') }}: <span class="highlight" style="color: #E6A23C">{{
                    formatDate(card.expiredAt) }}</span>
                </span>
                <span v-else style="color: #909399;">
                  {{ $t('attendance.noExpiry') }}
                </span>
              </div>
            </div>

            <el-button v-if="!card.todaySignedIn" type="primary" size="large" class="check-btn"
              @click="handleCheckIn(card)" :loading="card.loading">
              {{ $t('attendance.btnCheckin') }}
            </el-button>
            <el-button v-else type="success" size="large" class="check-btn" disabled>
              <el-icon>
                <Check />
              </el-icon> {{ $t('attendance.btnSigned') }}
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
import { useI18n } from 'vue-i18n';
const { t } = useI18n();

const classList = ref([]);
const allStudents = ref([]);
const selectedClassId = ref('');

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

const filteredStudents = computed(() => {
  const allCards = allStudents.value.flatMap(student => {
    if (!student.courses || student.courses.length === 0) return [];
    return student.courses.map(course => ({
      studentId: student.id,
      studentName: student.name,
      classId: course.class_id,
      className: course.class_name,
      expiredAt: course.expired_at,
      todaySignedIn: course.has_signed_today,
      loading: false
    }));
  });
  if (!selectedClassId.value) return allCards;
  return allCards.filter(card => card.classId === selectedClassId.value);
});

const handleCheckIn = async (card) => {
  card.loading = true;
  try {
    const res = await axios.post('/api/attendance', {
      student_id: card.studentId,
      class_id: card.classId,
      operator_id: 1
    });

    if (res.data.code === 200) {
      ElMessage.success(t('attendance.msgSuccess'));
      const sourceStudent = allStudents.value.find(s => s.id === card.studentId);
      if (sourceStudent && sourceStudent.courses) {
        const sourceCourse = sourceStudent.courses.find(c => c.class_id === card.classId);
        if (sourceCourse) {
          if (res.data.data.expired_at) sourceCourse.expired_at = res.data.data.expired_at;
          sourceCourse.has_signed_today = true;
        }
      }
    } else {
      ElMessage.error(res.data.msg);
    }
  } catch (err) {
    ElMessage.error(t('common.failed'));
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
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.student-card {
  border-radius: 8px;
  transition: all 0.3s;
}

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

