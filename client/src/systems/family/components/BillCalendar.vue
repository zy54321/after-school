<script setup>
import { ref, computed, watch } from 'vue';
import { ArrowLeft, ArrowRight, Delete } from '@element-plus/icons-vue';
import { ElMessageBox } from 'element-plus';
import dayjs from 'dayjs';
import axios from 'axios';

const props = defineProps({
  history: {
    type: Array,
    required: true,
    default: () => []
  },
  currentDate: {
    type: Date,
    required: true
  },
  memberId: {
    type: Number,
    default: null
  }
});

const emit = defineEmits(['update:currentDate', 'refresh']);

// 日历数据聚合逻辑
const dailyStats = computed(() => {
  const stats = {};
  if (!props.history || !Array.isArray(props.history)) return stats;

  props.history.forEach(log => {
    const day = dayjs(log.created_at).format('YYYY-MM-DD');
    if (!stats[day]) {
      stats[day] = { gain: 0, penalty: 0, consume: 0, logs: [] };
    }
    stats[day].logs.push(log);

    if (log.points_change > 0) {
      stats[day].gain += log.points_change;
    } else {
      if (log.reward_id) stats[day].consume += Math.abs(log.points_change);
      else stats[day].penalty += Math.abs(log.points_change);
    }
  });
  return stats;
});

// 原生日历：生成当前月份的日期数组
const calendarDays = computed(() => {
  const year = dayjs(props.currentDate).year();
  const month = dayjs(props.currentDate).month();
  const firstDay = dayjs(`${year}-${month + 1}-01`);
  const daysInMonth = firstDay.daysInMonth();
  const startDayOfWeek = firstDay.day();
  
  const days = [];
  
  const prevMonth = firstDay.subtract(1, 'month');
  const prevMonthDays = prevMonth.daysInMonth();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    days.push({
      date: prevMonth.date(day).toDate(),
      dayStr: prevMonth.date(day).format('YYYY-MM-DD'),
      isCurrentMonth: false
    });
  }
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = firstDay.date(day).toDate();
    days.push({
      date: date,
      dayStr: firstDay.date(day).format('YYYY-MM-DD'),
      isCurrentMonth: true
    });
  }
  
  const remainingDays = 42 - days.length;
  const nextMonth = firstDay.add(1, 'month');
  for (let day = 1; day <= remainingDays; day++) {
    days.push({
      date: nextMonth.date(day).toDate(),
      dayStr: nextMonth.date(day).format('YYYY-MM-DD'),
      isCurrentMonth: false
    });
  }
  
  return days;
});

const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

// 弹窗状态
const showDayDetailModal = ref(false);
const selectedDate = ref(new Date());
const isBatchMode = ref(false);
const selectedLogIds = ref([]);

// 获取选中日期的日志
const selectedDayLogs = computed(() => {
  const day = dayjs(selectedDate.value).format('YYYY-MM-DD');
  return dailyStats.value[day]?.logs || [];
});

const isAllSelected = computed(() => {
  return selectedDayLogs.value.length > 0 && selectedLogIds.value.length === selectedDayLogs.value.length;
});

// 切换月份
const changeMonth = (delta) => {
  const newDate = dayjs(props.currentDate).add(delta, 'month').toDate();
  emit('update:currentDate', newDate);
};

// 点击日期
const handleDateClick = (dayStr) => {
  selectedDate.value = dayjs(dayStr).toDate();
  showDayDetailModal.value = true;
};

// 批量操作
const toggleBatchMode = () => {
  isBatchMode.value = !isBatchMode.value;
  selectedLogIds.value = [];
};

const handleSelectAll = (val) => {
  selectedLogIds.value = val ? selectedDayLogs.value.map(h => h.id) : [];
};

const handleBatchRevoke = () => {
  if (selectedLogIds.value.length === 0) return;
  ElMessageBox.confirm(`确定要撤销选中的 ${selectedLogIds.value.length} 条记录吗？`, '批量撤销', { confirmButtonText: '确定', type: 'warning' })
    .then(async () => {
      const res = await axios.post('/api/family/revoke', { logIds: selectedLogIds.value });
      if (res.data.code === 200) {
        isBatchMode.value = false;
        selectedLogIds.value = [];
        emit('refresh');
      }
    });
};

const handleRevoke = (log) => {
  ElMessageBox.confirm('确定撤销?', '提示').then(async () => {
    await axios.post('/api/family/revoke', { logId: log.id });
    emit('refresh');
  });
};
</script>

<template>
  <div class="bill-calendar-view">
    <div class="calendar-status" v-if="history.length > 0">
      本月共 {{ history.length }} 条记录
    </div>
    <div class="calendar-status" v-else>
      本月暂无记录 ({{ dayjs(currentDate).format('YYYY-MM') }})
    </div>

    <!-- 原生日历实现 -->
    <div class="custom-calendar">
      <!-- 月份切换栏 -->
      <div class="calendar-header">
        <el-button circle :icon="ArrowLeft" @click="changeMonth(-1)" size="small"></el-button>
        <span class="month-title">{{ dayjs(currentDate).format('YYYY年MM月') }}</span>
        <el-button circle :icon="ArrowRight" @click="changeMonth(1)" size="small"></el-button>
      </div>
      
      <!-- 日历表格 -->
      <table class="calendar-table">
        <thead>
          <tr>
            <th v-for="day in weekDays" :key="day" class="weekday-header">{{ day }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIndex) in Math.ceil(calendarDays.length / 7)" :key="rowIndex">
            <td
              v-for="(day, dayIndex) in calendarDays.slice(rowIndex * 7, (rowIndex + 1) * 7)"
              :key="dayIndex"
              class="calendar-day"
              :class="{ 'other-month': !day.isCurrentMonth, 'has-data': dailyStats && dailyStats[day.dayStr] }"
              @click="handleDateClick(day.dayStr)">
              <div class="cal-cell-content">
                <div class="day-header">
                  <span class="day-num">{{ dayjs(day.date).format('D') }}</span>
                  <span v-if="dailyStats && dailyStats[day.dayStr]" class="day-sum"
                    :class="{ 'pos': dailyStats[day.dayStr].gain > (dailyStats[day.dayStr].penalty + dailyStats[day.dayStr].consume), 'neg': dailyStats[day.dayStr].gain <= (dailyStats[day.dayStr].penalty + dailyStats[day.dayStr].consume) }">
                    {{ (dailyStats[day.dayStr].gain - dailyStats[day.dayStr].penalty - dailyStats[day.dayStr].consume) > 0 ?
                    '+' : ''}}{{ dailyStats[day.dayStr].gain - dailyStats[day.dayStr].penalty - dailyStats[day.dayStr].consume
                    }}
                  </span>
                </div>

                <!-- 当天统计信息 -->
                <div v-if="dailyStats && dailyStats[day.dayStr]" class="day-stats">
                  <div v-if="dailyStats[day.dayStr].gain > 0" class="stat-item stat-gain">
                    <span class="stat-label">赚</span>
                    <span class="stat-value">+{{ dailyStats[day.dayStr].gain }}</span>
                  </div>
                  <div v-if="dailyStats[day.dayStr].penalty > 0" class="stat-item stat-penalty">
                    <span class="stat-label">扣</span>
                    <span class="stat-value">-{{ dailyStats[day.dayStr].penalty }}</span>
                  </div>
                  <div v-if="dailyStats[day.dayStr].consume > 0" class="stat-item stat-consume">
                    <span class="stat-label">花</span>
                    <span class="stat-value">-{{ dailyStats[day.dayStr].consume }}</span>
                  </div>
                </div>

                <!-- 记录列表（最多显示2条，超出显示省略号） -->
                <div class="mini-logs" v-if="dailyStats && dailyStats[day.dayStr] && dailyStats[day.dayStr].logs.length > 0">
                  <div v-for="(log, index) in dailyStats[day.dayStr].logs.slice(0, 2)" :key="log.id" class="mini-log-item">
                    <span class="log-desc" :title="log.description">{{ log.description }}</span>
                    <span class="log-pts"
                      :class="{ 'p-plus': log.points_change > 0, 'p-minus': log.points_change < 0 }">
                      {{ log.points_change > 0 ? '+' : '' }}{{ log.points_change }}
                    </span>
                  </div>
                  <div v-if="dailyStats[day.dayStr].logs.length > 2" class="more-logs">
                    <span class="more-text">...</span>
                    <span class="more-count">+{{ dailyStats[day.dayStr].logs.length - 2 }}</span>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 详情弹窗 -->
    <el-dialog
      v-model="showDayDetailModal"
      :title="dayjs(selectedDate).format('MM月DD日') + ' 明细'"
      width="90%"
      class="day-detail-modal"
      append-to-body>
      <div class="modal-toolbar">
        <div class="summary-row" v-if="dailyStats[dayjs(selectedDate).format('YYYY-MM-DD')]">
          <div class="s-item get">收入: {{ dailyStats[dayjs(selectedDate).format('YYYY-MM-DD')].gain }}</div>
          <div class="s-item lost">扣: {{ dailyStats[dayjs(selectedDate).format('YYYY-MM-DD')].penalty }}</div>
          <div class="s-item use">花: {{ dailyStats[dayjs(selectedDate).format('YYYY-MM-DD')].consume }}</div>
        </div>
        <div class="summary-row" v-else>暂无记录</div>
        <div class="batch-btn" @click="toggleBatchMode">{{ isBatchMode ? '退出' : '批量管理' }}</div>
      </div>

      <div v-if="isBatchMode" class="batch-bar-modal">
        <el-checkbox v-model="isAllSelected" @change="handleSelectAll" label="全选" />
        <el-button type="danger" size="small" :disabled="selectedLogIds.length === 0"
          @click="handleBatchRevoke">删除</el-button>
      </div>

      <div class="detail-list-scroll">
        <div v-if="selectedDayLogs.length > 0">
          <div v-for="h in selectedDayLogs" :key="h.id" class="history-item">
            <div v-if="isBatchMode" class="h-check">
              <el-checkbox v-model="selectedLogIds" :label="h.id">
                <span style="display:none">.</span>
              </el-checkbox>
            </div>
            <div class="h-main">
              <span class="h-desc">{{ h.description }}</span>
              <span class="h-time">{{ dayjs(h.created_at).format('HH:mm') }}</span>
            </div>
            <div class="h-right">
              <span class="h-pts"
                :class="{ plus: h.points_change > 0, minus: h.points_change < 0 && !h.reward_id, consume: h.points_change < 0 && h.reward_id }">
                {{ h.points_change > 0 ? '+' : '' }}{{ h.points_change }}
              </span>
              <el-icon v-if="!isBatchMode" class="revoke-btn" @click="handleRevoke(h)">
                <Delete />
              </el-icon>
            </div>
          </div>
        </div>
        <div v-else class="empty-tip-modal">
          <div style="font-size: 30px; margin-bottom: 10px;">📅</div>
          今天还没有动静哦
        </div>
      </div>
      <template #footer>
        <el-button @click="showDayDetailModal = false" style="width:100%">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.bill-calendar-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
}

.calendar-status {
  padding: 8px 15px;
  font-size: 13px;
  color: #409EFF;
  background: #ecf5ff;
  border-bottom: 1px solid #d9ecff;
  font-weight: bold;
  flex-shrink: 0;
}

.custom-calendar {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 10px;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  margin-bottom: 10px;
  border-bottom: 1px solid #eee;
}

.month-title {
  font-size: 16px;
  font-weight: bold;
  color: #333;
}

.calendar-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.weekday-header {
  padding: 8px 0;
  text-align: center;
  font-weight: bold;
  color: #666;
  font-size: 13px;
  border-bottom: 1px solid #eee;
}

.calendar-day {
  height: 100px;
  padding: 0;
  border: 1px solid #f0f0f0;
  vertical-align: top;
  cursor: pointer;
  transition: background 0.2s;
  position: relative;
}

.calendar-day:hover {
  background: #f0f9ff;
}

.calendar-day:active {
  background: #d4e8f8;
}

.calendar-day.other-month {
  opacity: 0.4;
  background: #fafafa;
}

.calendar-day.has-data {
  border-color: #409EFF;
  border-width: 2px;
}

.cal-cell-content {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  padding: 4px;
  box-sizing: border-box;
  position: relative;
  overflow: hidden;
}

.day-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 3px;
  flex-shrink: 0;
}

.day-num {
  font-weight: bold;
  color: #333;
  font-size: 12px;
}

.day-sum {
  font-size: 10px;
  font-weight: bold;
  padding: 0 4px;
  border-radius: 4px;
}

.day-sum.pos {
  color: #67C23A;
  background: #e1f3d8;
}

.day-sum.neg {
  color: #909399;
  background: #f4f4f5;
}

.day-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  margin-bottom: 3px;
  font-size: 9px;
  flex-shrink: 0;
}

.stat-item {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  padding: 1px 4px;
  border-radius: 3px;
  white-space: nowrap;
  flex-shrink: 0;
  line-height: 1.2;
}

.stat-label {
  font-weight: bold;
  font-size: 8px;
  opacity: 0.9;
}

.stat-value {
  font-weight: bold;
  font-family: monospace;
  font-size: 9px;
}

.stat-gain {
  background: #e1f3d8;
  color: #67C23A;
}

.stat-penalty {
  background: #fef0f0;
  color: #F56C6C;
}

.stat-consume {
  background: #fdf6ec;
  color: #E6A23C;
}

.mini-logs {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
  min-height: 0;
  max-height: 100%;
}

.mini-log-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 9px;
  line-height: 12px;
  background: #f5f7fa;
  padding: 2px 4px;
  border-radius: 2px;
  flex-shrink: 0;
  min-height: 14px;
}

.log-desc {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #606266;
  margin-right: 3px;
  font-size: 9px;
}

.log-pts {
  font-weight: bold;
  flex-shrink: 0;
  font-family: monospace;
}

.p-plus {
  color: #67C23A;
}

.p-minus {
  color: #F56C6C;
}

.more-logs {
  font-size: 9px;
  color: #909399;
  text-align: center;
  background: #f0f2f5;
  border-radius: 2px;
  padding: 1px 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.more-text {
  font-weight: bold;
}

.more-count {
  font-weight: bold;
  color: #409EFF;
}

.modal-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}

.summary-row {
  display: flex;
  gap: 8px;
  font-size: 13px;
}

.s-item {
  font-weight: bold;
}

.s-item.get {
  color: #67C23A;
}

.s-item.lost {
  color: #F56C6C;
}

.s-item.use {
  color: #E6A23C;
}

.batch-btn {
  color: #409EFF;
  font-size: 12px;
  cursor: pointer;
}

.batch-bar-modal {
  background: #fdf6ec;
  padding: 5px;
  margin-bottom: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-list-scroll {
  max-height: 50vh;
  overflow-y: auto;
}

.empty-tip-modal {
  text-align: center;
  padding: 30px;
  color: #999;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.history-item {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #f5f5f5;
  align-items: center;
}

.h-main {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.h-desc {
  font-weight: bold;
  font-size: 14px;
  margin-bottom: 4px;
}

.h-time {
  font-size: 11px;
  color: #999;
}

.h-pts {
  font-weight: bold;
  font-size: 1.1rem;
  margin-right: 10px;
}

.h-pts.plus {
  color: #67C23A;
}

.h-pts.minus {
  color: #F56C6C;
}

.h-pts.consume {
  color: #E6A23C;
}

.revoke-btn {
  padding: 8px;
  color: #ccc;
  cursor: pointer;
}

.h-check {
  margin-right: 10px;
}

@media screen and (max-width: 768px) {
  .calendar-day {
    height: 85px !important;
  }

  .mini-log-item {
    font-size: 9px !important;
    line-height: 12px !important;
  }

  .day-num {
    font-size: 11px !important;
  }

  .day-sum {
    font-size: 9px !important;
    padding: 0 2px !important;
  }

  .log-desc {
    display: none;
  }

  .log-pts {
    width: 100%;
    text-align: center;
  }

  .day-stats {
    font-size: 8px;
    gap: 1px;
  }

  .stat-item {
    padding: 0 2px;
  }

  .stat-label {
    font-size: 7px;
  }
}
</style>

