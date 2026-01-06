<script setup>
import { useRouter } from 'vue-router';
import { ref, reactive, computed, watch, onMounted } from 'vue';
import axios from 'axios';
import { ElMessage, ElMessageBox } from 'element-plus';
import { UserFilled, Plus, Setting, Delete, Edit, List, Goods, PriceTag, Warning, House, Trophy, Calendar } from '@element-plus/icons-vue';
import dayjs from 'dayjs';
// 导入子组件
import EarnTasks from '../components/EarnTasks.vue';
import PenaltyTasks from '../components/PenaltyTasks.vue';
import Rewards from '../components/Rewards.vue';
import Auctions from '../components/Auctions.vue';
import BillCalendar from '../components/BillCalendar.vue';

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

// 弹窗状态
const showAddModal = ref(false);
const showCatModal = ref(false);
const showMemberModal = ref(false);
const showAuctionModal = ref(false);

// 表单数据 (保持不变)
const auctionForm = reactive({ auctionId: null, auctionName: '', startingPrice: 0, winnerId: null, bidPoints: 0 });
const addForm = reactive({ type: 'task', name: '', points: 1, category: '', limitType: 'unlimited', limitMax: 1, targetMembers: [], description: '' });
const catForm = reactive({ name: '' });
const memberForm = reactive({ id: null, name: '', avatarFile: null, avatarPreview: '' });

// 核心逻辑：数据过滤
const filteredTasks = computed(() => { if (!currentMemberId.value) return []; return tasks.value.filter(t => isVisible(t)); });
const isVisible = (item) => { if (!item.target_members || item.target_members.length === 0) return true; return item.target_members.includes(currentMemberId.value); };


// 监听日历月份变化
watch(() => currentDate.value, (newVal, oldVal) => {
  const newMonth = dayjs(newVal).format('YYYY-MM');
  const oldMonth = oldVal ? dayjs(oldVal).format('YYYY-MM') : '';
  if (newMonth !== oldMonth) {
    loadMemberData();
  }
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

// 批量操作（用于右键菜单）
const contextMenu = reactive({ visible: false, x: 0, y: 0, item: null, type: '' });
let longPressTimer = null;

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
// 处理任务点击
const handleTask = async (task) => {
  dashboard.totalPoints += task.points;
  try {
    await axios.post('/api/family/action', { memberId: currentMemberId.value, taskId: task.id, points: task.points });
    ElMessage.success(task.points > 0 ? `+${task.points}` : `${task.points}`);
    loadMemberData();
  } catch (err) { dashboard.totalPoints -= task.points; }
};

// 处理兑换
const handleRedeem = (reward) => {
  if (dashboard.totalPoints < reward.cost) return ElMessage.warning('积分不足！');
  const status = checkRewardStatus(reward);
  if (!status.available) return;
  ElMessageBox.confirm(`确定兑换 "${reward.name}" 吗?`, '确认').then(async () => {
    const res = await axios.post('/api/family/redeem', { memberId: currentMemberId.value, rewardId: reward.id });
    if (res.data.code === 200) { ElMessage.success('兑换成功！'); loadMemberData(); } else { ElMessage.warning(res.data.msg); }
  });
};

// 检查奖品状态
const checkRewardStatus = (reward) => {
  if (reward.limit_type === 'unlimited') return { available: true, text: '' };
  const stat = dashboard.usageStats.find(s => s.reward_id === reward.id);
  if (!stat) return { available: true, text: `限 ${reward.limit_max}` };
  const left = reward.limit_max - parseInt(stat.usage_count);
  return left <= 0 ? { available: false, text: '完' } : { available: true, text: `剩 ${left}` };
};

// 处理竞拍点击
const openAuctionSettle = (auction) => {
  auctionForm.auctionId = auction.id;
  auctionForm.auctionName = auction.name;
  auctionForm.startingPrice = auction.cost;
  auctionForm.bidPoints = auction.cost;
  auctionForm.winnerId = currentMemberId.value;
  showAuctionModal.value = true;
};

const submitAuction = async () => {
  if (!auctionForm.winnerId) return ElMessage.warning('请选择得标人');
  if (auctionForm.bidPoints < auctionForm.startingPrice) return ElMessage.warning('低于起拍价');
  await axios.post('/api/family/auction/settle', { auctionId: auctionForm.auctionId, memberId: auctionForm.winnerId, bidPoints: auctionForm.bidPoints });
  showAuctionModal.value = false;
  loadMemberData();
};
// 简单的增删改查
const openAddMember = () => { memberForm.id = null; memberForm.name = ''; memberForm.avatarPreview = ''; showMemberModal.value = true; };
const handleFileChange = (e) => { const f = e.target.files[0]; if (f) { memberForm.avatarFile = f; memberForm.avatarPreview = URL.createObjectURL(f); } };
const submitMember = async () => { const fd = new FormData(); fd.append('name', memberForm.name); if (memberForm.id) fd.append('id', memberForm.id); if (memberForm.avatarFile) fd.append('avatar', memberForm.avatarFile); await axios.post(memberForm.id ? '/api/family/member/update' : '/api/family/member/create', fd); showMemberModal.value = false; initData(); };
const openAddRule = () => { delete addForm.id; addForm.type = 'task'; addForm.name = ''; addForm.points = 1; addForm.targetMembers = []; addForm.description = ''; addForm.limitType = 'unlimited'; addForm.limitMax = 1; showAddModal.value = true; };
const submitAddItem = async () => {
  let pts = Math.abs(addForm.points); if (addForm.type === 'penalty') pts = -pts;
  const submitType = (addForm.type === 'penalty' || addForm.type === 'task') ? 'task' : addForm.type;
  const url = addForm.id ? '/api/family/update' : '/api/family/create';
  await axios.post(url, { ...addForm, type: submitType, points: pts, description: addForm.description || '' }); showAddModal.value = false; initData();
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
    addForm.description = item.description || '';
    addForm.limitType = item.limit_type || 'unlimited';
    addForm.limitMax = item.limit_max || 1;
    if (type === 'task') addForm.type = item.points < 0 ? 'penalty' : 'task'; else if (type === 'auction') addForm.type = 'auction'; else addForm.type = 'reward';
    showAddModal.value = true;
  }
};
const submitAddCat = async () => { if (catForm.name) await axios.post('/api/family/category/create', { name: catForm.name }); initData(); };
const deleteCat = async (id) => { await axios.post('/api/family/category/delete', { id }); initData(); };
// 处理日历月份变化
const handleCalendarMonthChange = (newDate) => {
  currentDate.value = newDate;
};
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
      <el-tab-pane label="赚分">
        <template #label><span class="tab-label"><el-icon><List /></el-icon> 赚分</span></template>
        <EarnTasks
          :tasks="filteredTasks"
          :categories="categories"
          @task-click="handleTask"
          @context-menu="handleContextMenu" />
      </el-tab-pane>
      
      <el-tab-pane label="扣分">
        <template #label><span class="tab-label" style="color:#F56C6C"><el-icon><Warning /></el-icon> 扣分</span></template>
        <PenaltyTasks
          :tasks="filteredTasks"
          :categories="categories"
          @task-click="handleTask"
          @context-menu="handleContextMenu" />
      </el-tab-pane>
      
      <el-tab-pane label="兑换">
        <template #label><span class="tab-label"><el-icon><Goods /></el-icon> 兑换</span></template>
        <Rewards
          :rewards="rewards"
          :current-member-id="currentMemberId"
          :total-points="dashboard.totalPoints"
          :usage-stats="dashboard.usageStats"
          :history="dashboard.history"
          @redeem="handleRedeem"
          @context-menu="handleContextMenu" />
      </el-tab-pane>
      
      <el-tab-pane label="竞拍">
        <template #label><span class="tab-label"><el-icon><Trophy /></el-icon> 竞拍</span></template>
        <Auctions
          :rewards="rewards"
          :current-member-id="currentMemberId"
          :usage-stats="dashboard.usageStats"
          :history="dashboard.history"
          @auction-click="openAuctionSettle"
          @context-menu="handleContextMenu" />
      </el-tab-pane>

      <el-tab-pane label="账单">
        <template #label><span class="tab-label"><el-icon><Calendar /></el-icon> 账单</span></template>
        <BillCalendar
          :history="dashboard.history"
          :current-date="currentDate"
          :member-id="currentMemberId"
          @update:current-date="handleCalendarMonthChange"
          @refresh="loadMemberData" />
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="showAddModal" :title="addForm.id ? '编辑' : '添加'" width="90%"><el-form
        label-position="top"><el-form-item label="类型"><el-radio-group v-model="addForm.type"><el-radio-button
              label="task">赚分</el-radio-button><el-radio-button label="penalty">扣分</el-radio-button><el-radio-button
              label="reward">奖品</el-radio-button><el-radio-button
              label="auction">竞拍</el-radio-button></el-radio-group></el-form-item><el-form-item label="名称"><el-input
            v-model="addForm.name" /></el-form-item><el-form-item v-if="addForm.type === 'auction'" label="描述"><el-input
            v-model="addForm.description" type="textarea" :rows="4" placeholder="请输入竞拍品描述，支持换行" /></el-form-item><el-form-item label="分值"><el-input-number v-model="addForm.points"
            :min="1" /></el-form-item><el-form-item v-if="addForm.type === 'reward' || addForm.type === 'auction'"
          label="兑换限制"><el-radio-group v-model="addForm.limitType"><el-radio-button
              label="unlimited">不限</el-radio-button><el-radio-button label="weekly">每周</el-radio-button><el-radio-button
              label="monthly">每月</el-radio-button></el-radio-group></el-form-item><el-form-item
          v-if="(addForm.type === 'reward' || addForm.type === 'auction') && addForm.limitType !== 'unlimited'"
          label="周期内兑换次数"><el-input-number v-model="addForm.limitMax" :min="1" /></el-form-item><el-form-item v-if="addForm.type !== 'reward' && addForm.type !== 'auction'"
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