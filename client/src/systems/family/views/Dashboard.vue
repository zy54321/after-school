<script setup>
import { useRouter } from 'vue-router';
import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue';
import axios from 'axios';
import { ElMessage, ElMessageBox } from 'element-plus';
import { UserFilled, Plus, Setting, Delete, Edit, List, Goods, Coin, PriceTag, Warning, House, Trophy, Calendar, More, ArrowLeft, ArrowRight } from '@element-plus/icons-vue';
import dayjs from 'dayjs';

const router = useRouter();
const goHome = () => { router.push('/'); };

// === 状态定义 ===
const loading = ref(false);
const currentMemberId = ref(null);
const members = ref([]);
const categories = ref([]);
const tasks = ref([]);
const rewards = ref([]);

// 面板数据
const dashboard = reactive({
  totalPoints: 0,
  history: [],
  usageStats: []
});

// 日历状态
const currentDate = ref(new Date());
const showDayDetailModal = ref(false); // 详情弹窗控制

// 弹窗状态
const showAddModal = ref(false);
const showCatModal = ref(false);
const showMemberModal = ref(false);
const showAuctionModal = ref(false);

// 表单数据 (保持不变)
const auctionForm = reactive({ auctionId: null, auctionName: '', startingPrice: 0, winnerId: null, bidPoints: 0 });
const addForm = reactive({ type: 'task', name: '', points: 1, category: '', limitType: 'unlimited', limitMax: 1, targetMembers: [] });
const catForm = reactive({ name: '' });
const memberForm = reactive({ id: null, name: '', avatarFile: null, avatarPreview: '' });

// 核心逻辑：数据过滤
const filteredTasks = computed(() => { if (!currentMemberId.value) return []; return tasks.value.filter(t => isVisible(t)); });
const filteredRewards = computed(() => { if (!currentMemberId.value) return []; return rewards.value.filter(r => (r.type === 'reward' || !r.type) && isVisible(r)); });
const auctionItems = computed(() => { return rewards.value.filter(r => r.type === 'auction'); });
const earnTasks = computed(() => filteredTasks.value.filter(t => t.points > 0));
const penaltyTasks = computed(() => filteredTasks.value.filter(t => t.points < 0));
const isVisible = (item) => { if (!item.target_members || item.target_members.length === 0) return true; return item.target_members.includes(currentMemberId.value); };

// 🟢 日历数据聚合逻辑
const dailyStats = computed(() => {
  const stats = {};
  console.log('📊 ========== dailyStats 计算开始 ==========');
  console.log('📊 dashboard.history:', dashboard.history);
  console.log('📊 dashboard.history 类型:', Array.isArray(dashboard.history));
  console.log('📊 dashboard.history 长度:', dashboard.history?.length);
  
  if (!dashboard.history || !Array.isArray(dashboard.history)) {
    console.log('📊 没有历史数据或不是数组');
    return stats;
  }

  console.log('📊 开始处理历史记录，共', dashboard.history.length, '条');
  dashboard.history.forEach((log, index) => {
    // 统一日期格式 YYYY-MM-DD
    const day = dayjs(log.created_at).format('YYYY-MM-DD');
    console.log(`📊 处理第${index + 1}条记录:`, {
      created_at: log.created_at,
      day: day,
      points_change: log.points_change,
      reward_id: log.reward_id
    });
    
    if (!stats[day]) {
      stats[day] = { gain: 0, penalty: 0, consume: 0, logs: [] };
    }
    stats[day].logs.push(log);

    // 统计分值
    if (log.points_change > 0) {
      stats[day].gain += log.points_change;
    } else {
      if (log.reward_id) stats[day].consume += Math.abs(log.points_change);
      else stats[day].penalty += Math.abs(log.points_change);
    }
  });
  
  console.log('📊 计算后的 stats:', stats);
  console.log('📊 stats 的键:', Object.keys(stats));
  console.log('📊 ========== dailyStats 计算结束 ==========');
  return stats;
});

// 获取选中日期的日志 (用于弹窗)
const selectedDayLogs = computed(() => {
  const day = dayjs(currentDate.value).format('YYYY-MM-DD');
  return dailyStats.value[day]?.logs || [];
});

// 原生日历：生成当前月份的日期数组
const calendarDays = computed(() => {
  const year = dayjs(currentDate.value).year();
  const month = dayjs(currentDate.value).month();
  const firstDay = dayjs(`${year}-${month + 1}-01`);
  const daysInMonth = firstDay.daysInMonth();
  const startDayOfWeek = firstDay.day(); // 0 = 周日, 6 = 周六
  
  const days = [];
  
  // 添加上个月的日期（用于填充第一周）
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
  
  // 添加当月的日期
  for (let day = 1; day <= daysInMonth; day++) {
    const date = firstDay.date(day).toDate();
    days.push({
      date: date,
      dayStr: firstDay.date(day).format('YYYY-MM-DD'),
      isCurrentMonth: true
    });
  }
  
  // 添加下个月的日期（用于填充最后一周，确保7行）
  const remainingDays = 42 - days.length; // 6行 x 7天 = 42
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

// 星期标题
const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

// 切换月份
const changeMonth = (delta) => {
  currentDate.value = dayjs(currentDate.value).add(delta, 'month').toDate();
  loadMemberData();
};

// 监听日历月份变化
watch(() => currentDate.value, (newVal, oldVal) => {
  const newMonth = dayjs(newVal).format('YYYY-MM');
  const oldMonth = oldVal ? dayjs(oldVal).format('YYYY-MM') : '';
  if (newMonth !== oldMonth) {
    loadMemberData();
  }
});

// 监听 dashboard.history 变化，确保 dailyStats 重新计算
watch(() => dashboard.history, (newVal) => {
  console.log('🔄 watch dashboard.history 变化:', newVal);
  console.log('🔄 触发 dailyStats 重新计算');
  // 强制访问 dailyStats 以触发计算
  const _ = dailyStats.value;
  console.log('🔄 dailyStats.value 已更新:', _);
}, { deep: true, immediate: true });

// 监听日历日期选择（Element Plus 日历组件会在点击日期时触发）
watch(() => currentDate.value, (newVal) => {
  // 延迟一下，确保是用户点击触发的，而不是初始化
  const dayStr = dayjs(newVal).format('YYYY-MM-DD');
  console.log('🟢 日期变化监听:', dayStr);
  // 注意：这里不自动打开弹窗，因为用户可能只是想切换月份
});

onMounted(async () => {
  // 初始化数据
  await initData();
});

// 🟢 点击日历格子的处理函数
const handleDateClick = (dayStr) => {
  // 更新当前选中日期
  currentDate.value = dayjs(dayStr).toDate();
  // 打开弹窗显示详情
  showDayDetailModal.value = true;
};

// 批量操作
const contextMenu = reactive({ visible: false, x: 0, y: 0, item: null, type: '' });
let longPressTimer = null;
const isBatchMode = ref(false);
const selectedLogIds = ref([]);
const isAllSelected = computed(() => selectedDayLogs.value.length > 0 && selectedLogIds.value.length === selectedDayLogs.value.length);
const toggleBatchMode = () => { isBatchMode.value = !isBatchMode.value; selectedLogIds.value = []; };
const handleSelectAll = (val) => { selectedLogIds.value = val ? selectedDayLogs.value.map(h => h.id) : []; };

const handleBatchRevoke = () => {
  if (selectedLogIds.value.length === 0) return;
  ElMessageBox.confirm(`确定要撤销选中的 ${selectedLogIds.value.length} 条记录吗？`, '批量撤销', { confirmButtonText: '确定', type: 'warning' })
    .then(async () => {
      const res = await axios.post('/api/family/revoke', { logIds: selectedLogIds.value });
      if (res.data.code === 200) { ElMessage.success('批量撤销成功'); isBatchMode.value = false; selectedLogIds.value = []; loadMemberData(); }
    });
};

// === 初始化 & 数据加载 ===
const initData = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/family/init');
    if (res.data.code === 200) {
      members.value = res.data.data.members;
      categories.value = res.data.data.categories;
      tasks.value = res.data.data.tasks;
      rewards.value = res.data.data.rewards;
      if (members.value.length > 0 && !currentMemberId.value) currentMemberId.value = members.value[0].id;
      if (currentMemberId.value) loadMemberData();
    }
  } finally { loading.value = false; }
};

const loadMemberData = async () => {
  if (!currentMemberId.value) return;
  const monthStr = dayjs(currentDate.value).format('YYYY-MM');
  console.log('🔄 加载成员数据:', { memberId: currentMemberId.value, month: monthStr });
  try {
    const res = await axios.get('/api/family/member-dashboard', { params: { memberId: currentMemberId.value, month: monthStr } });
    console.log('🔄 API 响应:', res.data);
    if (res.data.code === 200) {
      dashboard.totalPoints = res.data.data.totalPoints;
      // 强制重新赋值，确保响应式更新
      dashboard.history = [...(res.data.data.history || [])];
      dashboard.usageStats = res.data.data.usageStats || [];
      console.log('🔄 数据已更新:', {
        totalPoints: dashboard.totalPoints,
        historyCount: dashboard.history.length,
        history: dashboard.history
      });
      // 强制触发 dailyStats 重新计算
      console.log('🔄 强制触发 dailyStats 计算');
      console.log('🔄 dailyStats.value:', dailyStats.value);
    }
  } catch (e) { 
    console.error('🔄 加载数据失败:', e); 
  }
};

const switchMember = (id) => { currentMemberId.value = id; loadMemberData(); };
const handleTask = async (task) => {
  dashboard.totalPoints += task.points;
  try {
    await axios.post('/api/family/action', { memberId: currentMemberId.value, taskId: task.id, points: task.points });
    ElMessage.success(task.points > 0 ? `+${task.points}` : `${task.points}`);
    loadMemberData();
  } catch (err) { dashboard.totalPoints -= task.points; }
};
const handleRedeem = (reward) => {
  if (dashboard.totalPoints < reward.cost) return ElMessage.warning('积分不足！');
  const status = checkRewardStatus(reward);
  if (!status.available) return;
  ElMessageBox.confirm(`确定兑换 "${reward.name}" 吗?`, '确认').then(async () => {
    const res = await axios.post('/api/family/redeem', { memberId: currentMemberId.value, rewardId: reward.id });
    if (res.data.code === 200) { ElMessage.success('兑换成功！'); loadMemberData(); } else { ElMessage.warning(res.data.msg); }
  });
};
const openAuctionSettle = (auction) => { auctionForm.auctionId = auction.id; auctionForm.auctionName = auction.name; auctionForm.startingPrice = auction.cost; auctionForm.bidPoints = auction.cost; auctionForm.winnerId = currentMemberId.value; showAuctionModal.value = true; };
const submitAuction = async () => {
  if (!auctionForm.winnerId) return ElMessage.warning('请选择得标人');
  if (auctionForm.bidPoints < auctionForm.startingPrice) return ElMessage.warning('低于起拍价');
  await axios.post('/api/family/auction/settle', { auctionId: auctionForm.auctionId, memberId: auctionForm.winnerId, bidPoints: auctionForm.bidPoints });
  showAuctionModal.value = false; loadMemberData();
};
const checkRewardStatus = (reward) => {
  if (reward.limit_type === 'unlimited') return { available: true, text: '' };
  const stat = dashboard.usageStats.find(s => s.reward_id === reward.id);
  if (!stat) return { available: true, text: `限 ${reward.limit_max}` };
  const left = reward.limit_max - parseInt(stat.usage_count);
  return left <= 0 ? { available: false, text: '完' } : { available: true, text: `剩 ${left}` };
};
// 简单的增删改查
const openAddMember = () => { memberForm.id = null; memberForm.name = ''; memberForm.avatarPreview = ''; showMemberModal.value = true; };
const handleFileChange = (e) => { const f = e.target.files[0]; if (f) { memberForm.avatarFile = f; memberForm.avatarPreview = URL.createObjectURL(f); } };
const submitMember = async () => { const fd = new FormData(); fd.append('name', memberForm.name); if (memberForm.id) fd.append('id', memberForm.id); if (memberForm.avatarFile) fd.append('avatar', memberForm.avatarFile); await axios.post(memberForm.id ? '/api/family/member/update' : '/api/family/member/create', fd); showMemberModal.value = false; initData(); };
const openAddRule = () => { delete addForm.id; addForm.type = 'task'; addForm.name = ''; addForm.points = 1; addForm.targetMembers = []; showAddModal.value = true; };
const submitAddItem = async () => {
  let pts = Math.abs(addForm.points); if (addForm.type === 'penalty') pts = -pts;
  const submitType = (addForm.type === 'penalty' || addForm.type === 'task') ? 'task' : addForm.type;
  const url = addForm.id ? '/api/family/update' : '/api/family/create';
  await axios.post(url, { ...addForm, type: submitType, points: pts }); showAddModal.value = false; initData();
};
const handleContextMenu = (e, item, type) => { e.preventDefault(); showMenu(e.clientX, e.clientY, item, type); };
const handleTouchStart = (e, item, type) => { longPressTimer = setTimeout(() => { showMenu(e.touches[0].clientX, e.touches[0].clientY, item, type); }, 600); };
const handleTouchEnd = () => { clearTimeout(longPressTimer); };
const showMenu = (x, y, item, type) => { contextMenu.x = x; contextMenu.y = y; contextMenu.item = item; contextMenu.type = type; contextMenu.visible = true; };
const closeMenu = () => { contextMenu.visible = false; };
const handleMenuAction = async (action) => {
  contextMenu.visible = false; const { item, type } = contextMenu;
  if (action === 'delete') {
    if (type === 'member') { await axios.post('/api/family/member/delete', { id: item.id }); initData(); return; }
    const delType = (type === 'auction') ? 'reward' : type; await axios.post('/api/family/delete', { id: item.id, type: delType }); initData();
  } else if (action === 'edit') {
    if (type === 'member') { memberForm.id = item.id; memberForm.name = item.name; memberForm.avatarPreview = item.avatar; showMemberModal.value = true; return; }
    addForm.id = item.id; addForm.name = type === 'task' ? item.title : item.name; addForm.points = Math.abs(item.points || item.cost);
    if (type === 'task') addForm.type = item.points < 0 ? 'penalty' : 'task'; else if (type === 'auction') addForm.type = 'auction'; else addForm.type = 'reward';
    showAddModal.value = true;
  }
};
const submitAddCat = async () => { if (catForm.name) await axios.post('/api/family/category/create', { name: catForm.name }); initData(); };
const deleteCat = async (id) => { await axios.post('/api/family/category/delete', { id }); initData(); };
const handleRevoke = (log) => { ElMessageBox.confirm('确定撤销?', '提示').then(async () => { await axios.post('/api/family/revoke', { logId: log.id }); loadMemberData(); }); }; // 删除后不关闭弹窗，方便连续操作
</script>

<template>
  <div class="family-dashboard" @click="closeMenu">
    <div class="member-bar">
      <div v-for="m in members" :key="m.id" class="member-avatar" :class="{ active: currentMemberId === m.id }"
        @click="switchMember(m.id)" @contextmenu="handleContextMenu($event, m, 'member')"
        @touchstart="handleTouchStart($event, m, 'member')" @touchend="handleTouchEnd">
        <el-avatar :size="40" :icon="UserFilled" :src="$img(m.avatar)" class="av-img" />
        <span class="name">{{ m.name }}</span>
      </div>
      <div class="member-avatar add-btn" @click="openAddMember"><el-icon>
          <Plus />
        </el-icon></div>
    </div>
    <div class="score-header">
      <div class="back-home" @click="goHome"><el-icon>
          <House />
        </el-icon> 首页</div>
      <div class="points-circle"><span class="number">{{ dashboard.totalPoints }}</span><span class="label">当前积分</span>
      </div>
      <div class="admin-entry"><el-dropdown trigger="click"><span class="el-dropdown-link"
            style="color:white; cursor:pointer"><el-icon>
              <Setting />
            </el-icon> 管理</span><template #dropdown><el-dropdown-menu><el-dropdown-item :icon="Plus"
                @click="openAddRule">添加规则/奖品</el-dropdown-item><el-dropdown-item :icon="PriceTag"
                @click="showCatModal = true">分类管理</el-dropdown-item></el-dropdown-menu></template></el-dropdown>
      </div>
    </div>

    <el-tabs type="border-card" class="action-tabs">
      <el-tab-pane label="赚分"><template #label><span class="tab-label"><el-icon>
              <List />
            </el-icon> 赚分</span></template>
        <div class="task-list">
          <div v-for="cat in categories" :key="cat.id">
            <div v-if="earnTasks.filter(x => x.category === cat.key).length > 0">
              <div class="category-title">{{ cat.name }}</div>
              <div class="grid">
                <div v-for="t in earnTasks.filter(x => x.category === cat.key)" :key="t.id" class="card task-card"
                  @click="handleTask(t)" @contextmenu="handleContextMenu($event, t, 'task')"
                  @touchstart="handleTouchStart($event, t, 'task')" @touchend="handleTouchEnd">
                  <div class="icon">{{ t.icon || '✨' }}</div>
                  <div class="info">
                    <div class="t-name">{{ t.title }}</div>
                    <div class="t-pts text-blue">+{{ t.points }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>
      <el-tab-pane label="扣分"><template #label><span class="tab-label" style="color:#F56C6C"><el-icon>
              <Warning />
            </el-icon> 扣分</span></template>
        <div class="task-list">
          <div v-for="cat in categories" :key="cat.id">
            <div v-if="penaltyTasks.filter(x => x.category === cat.key).length > 0">
              <div class="category-title">{{ cat.name }}</div>
              <div class="grid">
                <div v-for="t in penaltyTasks.filter(x => x.category === cat.key)" :key="t.id"
                  class="card task-card warning" @click="handleTask(t)"
                  @contextmenu="handleContextMenu($event, t, 'task')" @touchstart="handleTouchStart($event, t, 'task')"
                  @touchend="handleTouchEnd">
                  <div class="icon">{{ t.icon || '⚠️' }}</div>
                  <div class="info">
                    <div class="t-name">{{ t.title }}</div>
                    <div class="t-pts text-red">{{ t.points }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>
      <el-tab-pane label="兑换"><template #label><span class="tab-label"><el-icon>
              <Goods />
            </el-icon> 兑换</span></template>
        <div class="grid shop-grid">
          <div v-for="r in filteredRewards" :key="r.id" class="card reward-card"
            :class="{ disabled: !checkRewardStatus(r).available || dashboard.totalPoints < r.cost }"
            @click="handleRedeem(r)" @contextmenu="handleContextMenu($event, r, 'reward')"
            @touchstart="handleTouchStart($event, r, 'reward')" @touchend="handleTouchEnd">
            <div class="r-icon">{{ r.icon || '🎁' }}</div>
            <div class="r-name">{{ r.name }}</div>
            <div class="r-cost">💰 {{ r.cost }}</div>
            <div v-if="r.limit_type !== 'unlimited'" class="limit-badge">{{ checkRewardStatus(r).text }}</div>
          </div>
        </div>
      </el-tab-pane>
      <el-tab-pane label="竞拍"><template #label><span class="tab-label"><el-icon>
              <Trophy />
            </el-icon> 竞拍</span></template>
        <div class="grid shop-grid">
          <div v-for="a in auctionItems" :key="a.id" class="card reward-card auction-card" @click="openAuctionSettle(a)"
            @contextmenu="handleContextMenu($event, a, 'auction')" @touchstart="handleTouchStart($event, a, 'auction')"
            @touchend="handleTouchEnd">
            <div class="r-icon">{{ a.icon || '🔨' }}</div>
            <div class="r-name">{{ a.name }}</div>
            <div class="r-cost">起拍: {{ a.cost }}</div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="账单">
        <template #label><span class="tab-label"><el-icon>
              <Calendar />
            </el-icon> 账单</span></template>
        <div class="bill-calendar-view">

          <div class="calendar-status" v-if="dashboard.history.length > 0">
            本月共 {{ dashboard.history.length }} 条记录
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
                  <td v-for="(day, dayIndex) in calendarDays.slice(rowIndex * 7, (rowIndex + 1) * 7)" 
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
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="showDayDetailModal" :title="dayjs(currentDate).format('MM月DD日') + ' 明细'" width="90%"
      class="day-detail-modal" append-to-body>
      <div class="modal-toolbar">
        <div class="summary-row" v-if="dailyStats[dayjs(currentDate).format('YYYY-MM-DD')]">
          <div class="s-item get">收入: {{ dailyStats[dayjs(currentDate).format('YYYY-MM-DD')].gain }}</div>
          <div class="s-item lost">扣: {{ dailyStats[dayjs(currentDate).format('YYYY-MM-DD')].penalty }}</div>
          <div class="s-item use">花: {{ dailyStats[dayjs(currentDate).format('YYYY-MM-DD')].consume }}</div>
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
            <div v-if="isBatchMode" class="h-check"><el-checkbox v-model="selectedLogIds" :label="h.id"><span
                  style="display:none">.</span></el-checkbox></div>
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

    <el-dialog v-model="showAddModal" :title="addForm.id ? '编辑' : '添加'" width="90%"><el-form
        label-position="top"><el-form-item label="类型"><el-radio-group v-model="addForm.type"><el-radio-button
              label="task">赚分</el-radio-button><el-radio-button label="penalty">扣分</el-radio-button><el-radio-button
              label="reward">奖品</el-radio-button><el-radio-button
              label="auction">竞拍</el-radio-button></el-radio-group></el-form-item><el-form-item label="名称"><el-input
            v-model="addForm.name" /></el-form-item><el-form-item label="分值"><el-input-number v-model="addForm.points"
            :min="1" /></el-form-item><el-form-item v-if="addForm.type !== 'reward' && addForm.type !== 'auction'"
          label="分类"><el-select v-model="addForm.category"><el-option v-for="c in categories" :key="c.key"
              :label="c.name" :value="c.key" /></el-select></el-form-item><el-form-item v-if="addForm.type !== 'auction'"
          label="对象"><el-checkbox-group v-model="addForm.targetMembers"><el-checkbox v-for="m in members" :key="m.id"
              :label="m.id">{{ m.name }}</el-checkbox></el-checkbox-group></el-form-item></el-form><template
        #footer><el-button @click="showAddModal = false">取消</el-button><el-button type="primary"
          @click="submitAddItem">保存</el-button></template></el-dialog>
    <el-dialog v-model="showAuctionModal" title="竞拍结算" width="90%"><el-form label-position="top"><el-form-item
          label="得标人"><el-select v-model="auctionForm.winnerId" style="width:100%"><el-option v-for="m in members"
              :key="m.id" :label="m.name" :value="m.id" /></el-select></el-form-item><el-form-item
          label="成交价"><el-input-number v-model="auctionForm.bidPoints" :min="auctionForm.startingPrice"
            style="width:100%" /></el-form-item></el-form><template #footer><el-button
          @click="showAuctionModal = false">取消</el-button><el-button type="primary"
          @click="submitAuction">成交</el-button></template></el-dialog>
    <el-dialog v-model="showCatModal" title="分类" width="90%">
      <div v-for="c in categories" :key="c.id" class="cat-item-row"><span>{{ c.name }}</span><el-button link type="danger"
          :icon="Delete" @click="deleteCat(c.id)" v-if="c.parent_id !== 0" /></div>
      <div style="margin-top:10px;display:flex;gap:5px"><el-input v-model="catForm.name" /><el-button type="primary"
          @click="submitAddCat">加</el-button></div>
    </el-dialog>
    <el-dialog v-model="showMemberModal" title="成员" width="85%">
      <div class="member-form">
        <div class="avatar-uploader" @click="$refs.fi.click()"><el-avatar :size="80"
            :src="$img(memberForm.avatarPreview)" /><input type="file" ref="fi" style="display:none"
            @change="handleFileChange"></div><el-input v-model="memberForm.name" style="margin-top:20px" />
      </div><template #footer><el-button @click="showMemberModal = false">取消</el-button><el-button type="primary"
          @click="submitMember">保存</el-button></template>
    </el-dialog>
    <div v-if="contextMenu.visible" class="context-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }" @click.stop>
      <div class="menu-item" @click="handleMenuAction('edit')"><el-icon>
          <Edit />
        </el-icon> 编辑</div>
      <div class="menu-item delete" @click="handleMenuAction('delete')"><el-icon>
          <Delete />
        </el-icon> 删除</div>
    </div>
  </div>
</template>

<style scoped>
/* 🟢 修复核心：强制撑开日历格子，确保有地方可点 */
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

/* 原生日历样式 */
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

/* 移动端适配：减小高度 */
@media screen and (max-width: 768px) {
  :deep(.el-calendar-table .el-calendar-day) {
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

  /* 手机端隐藏文字描述，避免太挤 */
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

/* 单元格内容布局：撑满父元素 */
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

/* 点击反馈 */

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

/* 当天统计信息 */
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

/* 日志列表 */
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

/* 详情弹窗样式 */
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

/* 列表项复用 */
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

/* 原有样式保持 */
.auction-card {
  border: 2px solid #e6a23c;
  background: #fffbf0;
}

.family-dashboard {
  background: #fdf6ec;
  height: 100vh;
  display: flex;
  flex-direction: column;
  /* padding-top: 20px; */
  overflow: hidden;
}

.member-bar {
  flex-shrink: 0;
  background: #fff;
  padding: 15px;
  display: flex;
  gap: 20px;
  overflow-x: auto;
  scrollbar-width: none;
}

.member-avatar {
  display: flex;
  flex-direction: column;
  align-items: center;
  opacity: 0.6;
  transition: all 0.3s;
  flex-shrink: 0;
}

.member-avatar.active {
  opacity: 1;
  transform: scale(1.1);
}

.score-header {
  flex-shrink: 0;
  padding: 20px;
  text-align: center;
  background: linear-gradient(135deg, #f6d365 0%, #fda085 100%);
  color: white;
  position: relative;
}

.points-circle .number {
  font-size: 3rem;
  font-weight: 800;
  line-height: 1;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
}

.admin-entry {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(255, 255, 255, 0.2);
  padding: 4px 8px;
  border-radius: 15px;
  cursor: pointer;
  font-size: 12px;
}

.back-home {
  position: absolute;
  top: 10px;
  left: 10px;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}

.action-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-bottom: none;
}

:deep(.el-tabs__content) {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(45%, 1fr));
  gap: 10px;
  padding: 5px;
}

.card {
  background: white;
  border-radius: 12px;
  padding: 15px;
  display: flex;
  align-items: center;
  border: 1px solid #e5e7eb;
  cursor: pointer;
  position: relative;
}

.card:active {
  transform: scale(0.96);
  background: #f5f5f5;
}

.task-card .icon {
  font-size: 24px;
  margin-right: 12px;
}

.t-name {
  font-weight: bold;
  font-size: 0.9rem;
  color: #333;
}

.text-blue {
  color: #409EFF;
  font-weight: bold;
}

.text-red {
  color: #F56C6C;
  font-weight: bold;
}

.card.warning {
  border-left: 3px solid #F56C6C;
}

.shop-grid .reward-card {
  flex-direction: column;
  text-align: center;
  padding: 15px 10px;
}

.r-icon {
  font-size: 28px;
  margin-bottom: 5px;
}

.r-name {
  font-weight: bold;
  font-size: 0.9rem;
}

.r-cost {
  color: #E6A23C;
  font-weight: bold;
  font-size: 0.9rem;
}

.limit-badge {
  position: absolute;
  top: 0;
  right: 0;
  background: #909399;
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-bottom-left-radius: 8px;
}

.reward-card.disabled {
  opacity: 0.5;
  filter: grayscale(1);
}

.context-menu {
  position: fixed;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 5px 0;
  z-index: 9999;
  min-width: 100px;
  border: 1px solid #eee;
}

.menu-item {
  padding: 10px 15px;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: #333;
}

.menu-item.delete {
  color: #F56C6C;
}

.category-title {
  margin: 10px 5px 5px;
  font-weight: bold;
  color: #909399;
  font-size: 0.85rem;
}

.cat-item-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}

.member-form {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px;
}

.avatar-uploader {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
}

.h-check {
  margin-right: 10px;
}
</style>