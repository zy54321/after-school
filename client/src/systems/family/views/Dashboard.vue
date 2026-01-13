<script setup>
import { useRouter } from 'vue-router';
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import axios from 'axios';
import { ElMessage, ElMessageBox } from 'element-plus';
import { UserFilled, Plus, Setting, Delete, Edit, List, Goods, PriceTag, Warning, House, Trophy, Calendar, Box, ArrowDown } from '@element-plus/icons-vue';
import dayjs from 'dayjs';
// 导入子组件
import EarnTasks from '../components/EarnTasks.vue';
import PenaltyTasks from '../components/PenaltyTasks.vue';
import Rewards from '../components/Rewards.vue';
import Auctions from '../components/Auctions.vue';
import BillCalendar from '../components/BillCalendar.vue';
import Backpack from '../components/Backpack.vue';

const { t, locale } = useI18n();
const router = useRouter();
const goHome = () => { router.push('/'); };

// 语言切换
const currentLang = ref(locale.value);
const handleLangCommand = (command) => {
  locale.value = command;
  currentLang.value = command;
  localStorage.setItem('lang', command);
  ElMessage.success(command === 'zh' ? t('common.lang.switchedToZh') : t('common.lang.switchedToEn'));
};

// 组件引用
const backpackRef = ref(null);

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

// 背包统计数据
const backpackStats = reactive({
  unused_count: 0
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
  // 初始化语言设置
  const savedLang = localStorage.getItem('lang');
  if (savedLang && (savedLang === 'zh' || savedLang === 'en')) {
    locale.value = savedLang;
    currentLang.value = savedLang;
  }
  // 初始化数据
  await initData();
});

// 注意：handleDateClick 函数已移至 BillCalendar 组件内部

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
    }
    
    // 🎒 加载背包统计数据
    try {
      const backpackRes = await axios.get('/api/family/backpack', {
        params: { memberId: currentMemberId.value, status: 'unused' }
      });
      if (backpackRes.data.code === 200) {
        backpackStats.unused_count = backpackRes.data.data.stats?.unused_count || 0;
      }
    } catch (e) {
      console.error('加载背包统计失败:', e);
    }
    } catch (e) { 
    console.error('🔄 加载数据失败:', e); 
  }
  
  // 🎒 刷新背包组件数据
  if (backpackRef.value && backpackRef.value.refresh) {
    backpackRef.value.refresh();
  }
};

const switchMember = (id) => { currentMemberId.value = id; loadMemberData(); };
// 处理任务点击
const handleTask = async (task) => {
  // 参数验证
  if (!currentMemberId.value) {
    ElMessage.warning(t('familyDashboard.msgSelectMember'));
    return;
  }
  if (!task || !task.id) {
    ElMessage.error(t('familyDashboard.msgTaskIncomplete'));
    return;
  }
  if (task.points === undefined || task.points === null) {
    ElMessage.error(t('familyDashboard.msgInvalidPoints'));
    return;
  }

  dashboard.totalPoints += task.points;
  try {
    const res = await axios.post('/api/family/action', { 
      memberId: currentMemberId.value, 
      taskId: task.id, 
      points: task.points 
    });
    if (res.data.code === 200) {
      ElMessage.success(task.points > 0 ? `+${task.points}` : `${task.points}`);
      loadMemberData();
    } else {
      dashboard.totalPoints -= task.points;
      ElMessage.error(res.data.msg || t('familyDashboard.msgOperationFailed'));
    }
  } catch (err) {
    dashboard.totalPoints -= task.points;
    console.error('添加积分失败:', err);
    const errorMsg = err.response?.data?.msg || err.response?.data?.error || err.message || t('familyDashboard.msgOperationFailedRetry');
    ElMessage.error(errorMsg);
  }
};

// 处理兑换
const handleRedeem = (reward) => {
  if (dashboard.totalPoints < reward.cost) return ElMessage.warning(t('familyDashboard.msgInsufficientPoints'));
  const status = checkRewardStatus(reward);
  if (!status.available) return;
  ElMessageBox.confirm(t('familyDashboard.msgRedeemConfirm').replace('{name}', reward.name), t('common.confirm')).then(async () => {
    const res = await axios.post('/api/family/redeem', { memberId: currentMemberId.value, rewardId: reward.id });
    if (res.data.code === 200) { ElMessage.success(t('familyDashboard.msgRedeemSuccess')); loadMemberData(); } else { ElMessage.warning(res.data.msg); }
  });
};

// 检查奖品状态
const checkRewardStatus = (reward) => {
  if (reward.limit_type === 'unlimited') return { available: true, text: '' };
  const stat = dashboard.usageStats.find(s => s.reward_id === reward.id);
  if (!stat) return { available: true, text: t('familyDashboard.msgLimitText').replace('{max}', reward.limit_max) };
  const left = reward.limit_max - parseInt(stat.usage_count);
  return left <= 0 ? { available: false, text: t('familyDashboard.msgSoldOut') } : { available: true, text: t('familyDashboard.msgRemaining').replace('{left}', left) };
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
  if (!auctionForm.winnerId) return ElMessage.warning(t('familyDashboard.msgSelectWinner'));
  if (auctionForm.bidPoints < auctionForm.startingPrice) return ElMessage.warning(t('familyDashboard.msgBelowStartingPrice'));
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
        </el-icon> {{ $t('familyDashboard.home') }}</div>
      <div class="points-circle"><span class="number">{{ dashboard.totalPoints }}</span><span class="label">{{ $t('familyDashboard.currentPoints') }}</span>
      </div>
      <div class="header-right">
        <el-dropdown @command="handleLangCommand" style="margin-right: 15px; cursor: pointer;">
          <span class="lang-switch-header">
            🌐 {{ currentLang === 'zh' ? $t('common.lang.zh') : $t('common.lang.en') }}
            <el-icon class="el-icon--right" style="font-size: 12px;">
              <ArrowDown />
            </el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="zh">{{ $t('common.lang.zh') }}</el-dropdown-item>
              <el-dropdown-item command="en">{{ $t('common.lang.en') }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <div class="admin-entry"><el-dropdown trigger="click"><span class="el-dropdown-link"
              style="color:white; cursor:pointer"><el-icon>
                <Setting />
              </el-icon> {{ $t('familyDashboard.manage') }}</span><template #dropdown><el-dropdown-menu><el-dropdown-item :icon="Plus"
                  @click="openAddRule">{{ $t('familyDashboard.addRule') }}</el-dropdown-item><el-dropdown-item :icon="PriceTag"
                  @click="showCatModal = true">{{ $t('familyDashboard.categoryManage') }}</el-dropdown-item></el-dropdown-menu></template></el-dropdown>
        </div>
      </div>
    </div>

    <el-tabs type="border-card" class="action-tabs">
      <el-tab-pane :label="$t('familyDashboard.earnPoints')">
        <template #label><span class="tab-label"><el-icon><List /></el-icon> {{ $t('familyDashboard.earnPoints') }}</span></template>
        <EarnTasks
          :tasks="filteredTasks"
          :categories="categories"
          @task-click="handleTask"
          @context-menu="handleContextMenu" />
      </el-tab-pane>
      
      <el-tab-pane :label="$t('familyDashboard.penaltyPoints')">
        <template #label><span class="tab-label" style="color:#F56C6C"><el-icon><Warning /></el-icon> {{ $t('familyDashboard.penaltyPoints') }}</span></template>
        <PenaltyTasks
          :tasks="filteredTasks"
          :categories="categories"
          @task-click="handleTask"
          @context-menu="handleContextMenu" />
      </el-tab-pane>
      
      <el-tab-pane :label="$t('familyDashboard.redeem')">
        <template #label><span class="tab-label"><el-icon><Goods /></el-icon> {{ $t('familyDashboard.redeem') }}</span></template>
        <Rewards
          :rewards="rewards"
          :current-member-id="currentMemberId"
          :total-points="dashboard.totalPoints"
          :usage-stats="dashboard.usageStats"
          :history="dashboard.history"
          @redeem="handleRedeem"
          @context-menu="handleContextMenu" />
      </el-tab-pane>
      
      <el-tab-pane :label="$t('familyDashboard.auction')">
        <template #label><span class="tab-label"><el-icon><Trophy /></el-icon> {{ $t('familyDashboard.auction') }}</span></template>
        <Auctions
          :rewards="rewards"
          :current-member-id="currentMemberId"
          :usage-stats="dashboard.usageStats"
          :history="dashboard.history"
          @auction-click="openAuctionSettle"
          @context-menu="handleContextMenu" />
      </el-tab-pane>

      <el-tab-pane :label="$t('familyDashboard.backpack')">
        <template #label>
          <span class="tab-label">
            <el-icon><Box /></el-icon> {{ $t('familyDashboard.backpack') }}
            <el-badge v-if="backpackStats.unused_count > 0" 
                      :value="backpackStats.unused_count" 
                      class="badge" />
          </span>
        </template>
        <Backpack
          ref="backpackRef"
          :member-id="currentMemberId"
          :members="members"
          @refresh="loadMemberData" />
      </el-tab-pane>

      <el-tab-pane :label="$t('familyDashboard.bill')">
        <template #label><span class="tab-label"><el-icon><Calendar /></el-icon> {{ $t('familyDashboard.bill') }}</span></template>
        <BillCalendar
          :history="dashboard.history"
          :current-date="currentDate"
          :member-id="currentMemberId"
          @update:current-date="handleCalendarMonthChange"
          @refresh="loadMemberData" />
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="showAddModal" :title="addForm.id ? $t('familyDashboard.edit') : $t('familyDashboard.add')" width="90%"><el-form
        label-position="top"><el-form-item :label="$t('familyDashboard.type')"><el-radio-group v-model="addForm.type"><el-radio-button
              label="task">{{ $t('familyDashboard.earnPoints') }}</el-radio-button><el-radio-button label="penalty">{{ $t('familyDashboard.penaltyPoints') }}</el-radio-button><el-radio-button
              label="reward">{{ $t('familyDashboard.redeem') }}</el-radio-button><el-radio-button
              label="auction">{{ $t('familyDashboard.auction') }}</el-radio-button></el-radio-group></el-form-item><el-form-item :label="$t('familyDashboard.name')"><el-input
            v-model="addForm.name" /></el-form-item><el-form-item v-if="addForm.type === 'auction'" :label="$t('familyDashboard.description')"><el-input
            v-model="addForm.description" type="textarea" :rows="4" :placeholder="$t('common.placeholderInput')" /></el-form-item><el-form-item :label="$t('familyDashboard.points')"><el-input-number v-model="addForm.points"
            :min="1" /></el-form-item><el-form-item v-if="addForm.type === 'reward' || addForm.type === 'auction'"
          :label="$t('familyDashboard.redeemLimit')"><el-radio-group v-model="addForm.limitType"><el-radio-button
              label="unlimited">{{ $t('familyDashboard.unlimited') }}</el-radio-button><el-radio-button label="weekly">{{ $t('familyDashboard.weekly') }}</el-radio-button><el-radio-button
              label="monthly">{{ $t('familyDashboard.monthly') }}</el-radio-button></el-radio-group></el-form-item><el-form-item
          v-if="(addForm.type === 'reward' || addForm.type === 'auction') && addForm.limitType !== 'unlimited'"
          :label="$t('familyDashboard.periodLimit')"><el-input-number v-model="addForm.limitMax" :min="1" /></el-form-item><el-form-item v-if="addForm.type !== 'reward' && addForm.type !== 'auction'"
          :label="$t('familyDashboard.category')"><el-select v-model="addForm.category"><el-option v-for="c in categories" :key="c.key"
              :label="c.name" :value="c.key" /></el-select></el-form-item><el-form-item v-if="addForm.type !== 'auction'"
          :label="$t('familyDashboard.target')"><el-checkbox-group v-model="addForm.targetMembers"><el-checkbox v-for="m in members" :key="m.id"
              :label="m.id">{{ m.name }}</el-checkbox></el-checkbox-group></el-form-item></el-form><template
        #footer><el-button @click="showAddModal = false">{{ $t('familyDashboard.cancel') }}</el-button><el-button type="primary"
          @click="submitAddItem">{{ $t('familyDashboard.save') }}</el-button></template></el-dialog>
    <el-dialog v-model="showAuctionModal" :title="$t('familyDashboard.auctionSettle')" width="90%"><el-form label-position="top"><el-form-item
          :label="$t('familyDashboard.winner')"><el-select v-model="auctionForm.winnerId" style="width:100%"><el-option v-for="m in members"
              :key="m.id" :label="m.name" :value="m.id" /></el-select></el-form-item><el-form-item
          :label="$t('familyDashboard.bidPrice')"><el-input-number v-model="auctionForm.bidPoints" :min="auctionForm.startingPrice"
            style="width:100%" /></el-form-item></el-form><template #footer><el-button
          @click="showAuctionModal = false">{{ $t('familyDashboard.cancel') }}</el-button><el-button type="primary"
          @click="submitAuction">{{ $t('familyDashboard.settle') }}</el-button></template></el-dialog>
    <el-dialog v-model="showCatModal" :title="$t('familyDashboard.category')" width="90%">
      <div v-for="c in categories" :key="c.id" class="cat-item-row"><span>{{ c.name }}</span><el-button link type="danger"
          :icon="Delete" @click="deleteCat(c.id)" v-if="c.parent_id !== 0" /></div>
      <div style="margin-top:10px;display:flex;gap:5px"><el-input v-model="catForm.name" /><el-button type="primary"
          @click="submitAddCat">{{ $t('familyDashboard.msgAddCategory') }}</el-button></div>
    </el-dialog>
    <el-dialog v-model="showMemberModal" :title="$t('familyDashboard.member')" width="85%">
      <div class="member-form">
        <div class="avatar-uploader" @click="$refs.fi.click()"><el-avatar :size="80"
            :src="$img(memberForm.avatarPreview)" /><input type="file" ref="fi" style="display:none"
            @change="handleFileChange"></div><el-input v-model="memberForm.name" style="margin-top:20px" />
      </div><template #footer><el-button @click="showMemberModal = false">{{ $t('familyDashboard.cancel') }}</el-button><el-button type="primary"
          @click="submitMember">{{ $t('familyDashboard.save') }}</el-button></template>
    </el-dialog>
    <div v-if="contextMenu.visible" class="context-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }" @click.stop>
      <div class="menu-item" @click="handleMenuAction('edit')"><el-icon>
          <Edit />
        </el-icon> {{ $t('familyDashboard.edit') }}</div>
      <div class="menu-item delete" @click="handleMenuAction('delete')"><el-icon>
          <Delete />
        </el-icon> {{ $t('familyDashboard.msgDelete') }}</div>
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
  display: flex;
  justify-content: center;
  align-items: center;
}

.points-circle .number {
  font-size: 3rem;
  font-weight: 800;
  line-height: 1;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
}

.header-right {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.lang-switch-header {
  color: white;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 15px;
  cursor: pointer;
  transition: all 0.3s;
}

.lang-switch-header:hover {
  background: rgba(255, 255, 255, 0.3);
}

.admin-entry {
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

.badge {
  margin-left: 4px;
}
</style>