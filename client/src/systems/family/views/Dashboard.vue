<script setup>
import { useRouter } from 'vue-router';
import { ref, reactive, computed, onMounted } from 'vue';
import axios from 'axios';
import { ElMessage, ElMessageBox } from 'element-plus';
import { UserFilled, Plus, Setting, Delete, Edit, List, Goods, Coin, PriceTag, Warning, House } from '@element-plus/icons-vue';
import dayjs from 'dayjs';

const router = useRouter();
const goHome = () => {
  router.push('/');
};

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

// 弹窗状态
const showAddModal = ref(false);
const showCatModal = ref(false);
const showMemberModal = ref(false);

// 表单数据
const addForm = reactive({
  type: 'task', // task, penalty, reward
  name: '',
  points: 1,
  category: '',
  limitType: 'unlimited',
  limitMax: 1,
  targetMembers: []
});
const catForm = reactive({ name: '' });
const memberForm = reactive({ id: null, name: '', avatarFile: null, avatarPreview: '' });

// 核心逻辑：数据过滤 (支持角色切换)
const filteredTasks = computed(() => {
  if (!currentMemberId.value) return [];
  return tasks.value.filter(t => isVisible(t));
});

const filteredRewards = computed(() => {
  if (!currentMemberId.value) return [];
  return rewards.value.filter(r => isVisible(r));
});

// 辅助函数：拆分“赚分任务”和“扣分任务”
const earnTasks = computed(() => filteredTasks.value.filter(t => t.points > 0));
const penaltyTasks = computed(() => filteredTasks.value.filter(t => t.points < 0));

// 辅助判断函数
const isVisible = (item) => {
  if (!item.target_members || item.target_members.length === 0) return true;
  return item.target_members.includes(currentMemberId.value);
};

// 右键菜单
const contextMenu = reactive({ visible: false, x: 0, y: 0, item: null, type: '' });
let longPressTimer = null;

// 批量撤销
const isBatchMode = ref(false);
const selectedLogIds = ref([]);
const isAllSelected = computed(() => {
  return dashboard.history.length > 0 && selectedLogIds.value.length === dashboard.history.length;
});

// 进入/退出 批量模式
const toggleBatchMode = () => {
  isBatchMode.value = !isBatchMode.value;
  selectedLogIds.value = []; // 清空选择
};

// 全选/取消全选
const handleSelectAll = (val) => {
  if (val) {
    selectedLogIds.value = dashboard.history.map(h => h.id);
  } else {
    selectedLogIds.value = [];
  }
};

// 批量撤销提交
const handleBatchRevoke = () => {
  if (selectedLogIds.value.length === 0) return;

  ElMessageBox.confirm(`确定要撤销选中的 ${selectedLogIds.value.length} 条记录吗？积分将自动回滚。`, '批量撤销', {
    confirmButtonText: '确定撤销',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    try {
      const res = await axios.post('/api/family/revoke', { logIds: selectedLogIds.value });
      if (res.data.code === 200) {
        ElMessage.success('批量撤销成功');
        isBatchMode.value = false;
        selectedLogIds.value = [];
        loadMemberData(); // 刷新列表
      }
    } catch (err) {
      ElMessage.error('操作失败');
    }
  });
};

// === 初始化 ===
const initData = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/family/init');
    if (res.data.code === 200) {
      members.value = res.data.data.members;
      categories.value = res.data.data.categories;
      tasks.value = res.data.data.tasks;
      rewards.value = res.data.data.rewards;

      if (members.value.length > 0 && !currentMemberId.value) {
        currentMemberId.value = members.value[0].id;
      }
      // 防止选中已删除成员
      if (currentMemberId.value && !members.value.find(m => m.id === currentMemberId.value)) {
        if (members.value.length > 0) currentMemberId.value = members.value[0].id;
        else currentMemberId.value = null;
      }

      if (currentMemberId.value) loadMemberData();
    }
  } finally { loading.value = false; }
};

const loadMemberData = async () => {
  if (!currentMemberId.value) return;
  const res = await axios.get('/api/family/member-dashboard', { params: { memberId: currentMemberId.value } });
  if (res.data.code === 200) {
    dashboard.totalPoints = res.data.data.totalPoints;
    dashboard.history = res.data.data.history;
    dashboard.usageStats = res.data.data.usageStats;
  }
};

// === 业务逻辑 ===
const switchMember = (id) => { currentMemberId.value = id; loadMemberData(); };

const handleTask = async (task) => {
  // 乐观更新 (支持负分扣减)
  dashboard.totalPoints += task.points;

  // 提示语区分
  const msg = task.points > 0 ? `积分 +${task.points}` : `扣除 ${Math.abs(task.points)} 分`;
  const type = task.points > 0 ? 'success' : 'warning';

  try {
    await axios.post('/api/family/action', { memberId: currentMemberId.value, taskId: task.id, points: task.points });
    ElMessage({ message: msg, type: type, duration: 1500 });
    loadMemberData();
  } catch (err) { dashboard.totalPoints -= task.points; ElMessage.error('失败'); }
};

const handleRedeem = (reward) => {
  const status = checkRewardStatus(reward);
  if (!status.available) return;
  ElMessageBox.confirm(`确定消耗 ${reward.cost} 积分兑换 "${reward.name}" 吗?`, '兑换确认', { confirmButtonText: '确定', type: 'warning' })
    .then(async () => {
      const res = await axios.post('/api/family/redeem', { memberId: currentMemberId.value, rewardId: reward.id });
      if (res.data.code === 200) { ElMessage.success('兑换成功！'); loadMemberData(); } else { ElMessage.warning(res.data.msg); }
    });
};

const checkRewardStatus = (reward) => {
  if (reward.limit_type === 'unlimited') return { available: true, text: '' };
  const stat = dashboard.usageStats.find(s => s.reward_id === reward.id);
  if (!stat) return { available: true, text: `本期限 ${reward.limit_max} 次` };
  const left = reward.limit_max - parseInt(stat.usage_count);
  return left <= 0 ? { available: false, text: '已兑完' } : { available: true, text: `剩余 ${left}/${reward.limit_max}` };
};

// === 成员管理 ===
const openAddMember = () => {
  memberForm.id = null; memberForm.name = ''; memberForm.avatarPreview = ''; memberForm.avatarFile = null;
  showMemberModal.value = true;
};
const handleFileChange = (e) => {
  const file = e.target.files[0];
  if (file) { memberForm.avatarFile = file; memberForm.avatarPreview = URL.createObjectURL(file); }
};
const submitMember = async () => {
  if (!memberForm.name) return ElMessage.warning('请输入昵称');
  const formData = new FormData();
  formData.append('name', memberForm.name);
  if (memberForm.id) formData.append('id', memberForm.id);
  if (memberForm.avatarFile) formData.append('avatar', memberForm.avatarFile);
  try {
    const res = await axios.post(memberForm.id ? '/api/family/member/update' : '/api/family/member/create', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    if (res.data.code === 200) { ElMessage.success('保存成功'); showMemberModal.value = false; initData(); }
  } catch (err) { ElMessage.error('操作失败'); }
};

// === 规则管理 (增加扣分逻辑) ===
const openAddRule = () => {
  delete addForm.id;
  addForm.type = 'task'; // 默认赚积分
  addForm.name = '';
  addForm.points = 1;
  addForm.targetMembers = [];
  showAddModal.value = true;
};

const submitAddItem = async () => {
  if (!addForm.name) return ElMessage.warning('请输入名称');

  // 🟢 核心逻辑：处理扣分分值 (转为负数)
  let finalPoints = Math.abs(addForm.points); // 先取绝对值
  if (addForm.type === 'penalty') finalPoints = -finalPoints; // 扣分类型转负

  // 如果是扣分，强制类型为 'task' 存入数据库
  const submitType = (addForm.type === 'penalty' || addForm.type === 'task') ? 'task' : 'reward';

  const payload = {
    ...addForm,
    type: submitType,
    points: finalPoints
  };

  const url = addForm.id ? '/api/family/update' : '/api/family/create';
  const res = await axios.post(url, payload);
  if (res.data.code === 200) { ElMessage.success('成功'); showAddModal.value = false; delete addForm.id; initData(); }
};

// === 菜单交互 ===
const handleContextMenu = (e, item, type) => { e.preventDefault(); showMenu(e.clientX, e.clientY, item, type); };
const handleTouchStart = (e, item, type) => { longPressTimer = setTimeout(() => { showMenu(e.touches[0].clientX, e.touches[0].clientY, item, type); }, 600); };
const handleTouchEnd = () => { clearTimeout(longPressTimer); };
const showMenu = (x, y, item, type) => { contextMenu.x = x; contextMenu.y = y; contextMenu.item = item; contextMenu.type = type; contextMenu.visible = true; };
const closeMenu = () => { contextMenu.visible = false; };

const handleMenuAction = async (action) => {
  contextMenu.visible = false;
  const { item, type } = contextMenu;

  if (action === 'delete') {
    if (type === 'member') { /* 成员删除逻辑省略，保持原样 */ return; }
    ElMessageBox.confirm('确定删除吗?', '提示', { type: 'warning' }).then(async () => {
      await axios.post('/api/family/delete', { id: item.id, type });
      ElMessage.success('已删除'); initData();
    });
  } else if (action === 'edit') {
    if (type === 'member') { /* 成员编辑逻辑省略，保持原样 */ showMemberModal.value = true; return; }

    addForm.id = item.id;
    addForm.name = type === 'task' ? item.title : item.name;
    addForm.category = item.category || (categories.value[0]?.key || 'study');
    addForm.limitType = item.limit_type || 'unlimited'; addForm.limitMax = item.limit_max || 1;
    addForm.targetMembers = item.target_members || [];

    // 🟢 回显逻辑：判断是任务还是扣分
    if (type === 'task') {
      if (item.points < 0) {
        addForm.type = 'penalty'; // 识别为扣分
        addForm.points = Math.abs(item.points); // 显示为正数
      } else {
        addForm.type = 'task';
        addForm.points = item.points;
      }
    } else {
      addForm.type = 'reward';
      addForm.points = item.cost;
    }
    showAddModal.value = true;
  }
};

const submitAddCat = async () => { /* 保持原样 */ if (!catForm.name) return; await axios.post('/api/family/category/create', { name: catForm.name }); initData(); catForm.name = ''; };
const deleteCat = async (id) => { /* 保持原样 */ await axios.post('/api/family/category/delete', { id }); initData(); };
const handleRevoke = (log) => { /* 保持原样 */ ElMessageBox.confirm('确定撤销?', '提示').then(async () => { await axios.post('/api/family/revoke', { logId: log.id }); loadMemberData(); }); };

onMounted(initData);
</script>

<template>
  <div class="family-dashboard" @click="closeMenu">
    <div class="member-bar">
      <div v-for="m in members" :key="m.id" class="member-avatar" :class="{ active: currentMemberId === m.id }"
        @click="switchMember(m.id)" @contextmenu="handleContextMenu($event, m, 'member')"
        @touchstart="handleTouchStart($event, m, 'member')" @touchend="handleTouchEnd">
        <el-avatar :size="40" :icon="UserFilled" :src="m.avatar" class="av-img" />
        <span class="name">{{ m.name }}</span>
      </div>
      <div class="member-avatar add-btn" @click="openAddMember"><el-icon>
          <Plus />
        </el-icon></div>
    </div>

    <div class="score-header">
      <div class="back-home" @click="goHome">
        <el-icon>
          <House />
        </el-icon> 首页
      </div>
      <div class="points-circle">
        <span class="number">{{ dashboard.totalPoints }}</span>
        <span class="label">当前积分</span>
      </div>
      <div class="admin-entry">
        <el-dropdown trigger="click">
          <span class="el-dropdown-link" style="color:white; cursor:pointer"><el-icon>
              <Setting />
            </el-icon> 管理 <el-icon class="el-icon--right"><arrow-down /></el-icon></span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item :icon="Plus" @click="openAddRule">添加规则/奖品</el-dropdown-item>
              <el-dropdown-item :icon="PriceTag" @click="showCatModal = true">分类管理</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <el-tabs type="border-card" class="action-tabs">

      <el-tab-pane label="赚积分">
        <template #label><span class="tab-label"><el-icon>
              <List />
            </el-icon> 赚积分</span></template>
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
          <div v-if="earnTasks.filter(x => !categories.map(c => c.key).includes(x.category)).length > 0">
            <div class="category-title">其他</div>
            <div class="grid">
              <div v-for="t in earnTasks.filter(x => !categories.map(c => c.key).includes(x.category))" :key="t.id"
                class="card task-card" @click="handleTask(t)">
                <div class="info">
                  <div class="t-name">{{ t.title }}</div>
                  <div class="t-pts text-blue">+{{ t.points }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="扣分">
        <template #label><span class="tab-label" style="color:#F56C6C"><el-icon>
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
          <div v-if="penaltyTasks.filter(x => !categories.map(c => c.key).includes(x.category)).length > 0">
            <div class="category-title">其他需注意</div>
            <div class="grid">
              <div v-for="t in penaltyTasks.filter(x => !categories.map(c => c.key).includes(x.category))" :key="t.id"
                class="card task-card warning" @click="handleTask(t)">
                <div class="info">
                  <div class="t-name">{{ t.title }}</div>
                  <div class="t-pts text-red">{{ t.points }}</div>
                </div>
              </div>
            </div>
          </div>
          <div v-if="penaltyTasks.length === 0" class="empty-tip">👍 表现很棒，暂无扣分项！</div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="兑奖品">
        <template #label><span class="tab-label"><el-icon>
              <Goods />
            </el-icon> 花积分</span></template>
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

      <el-tab-pane label="查账单">
        <template #label><span class="tab-label"><el-icon>
              <Coin />
            </el-icon> 账单</span></template>

        <div class="history-toolbar">
          <div v-if="!isBatchMode" class="btn-mode" @click="toggleBatchMode">
            <el-icon>
              <List />
            </el-icon> 批量管理
          </div>
          <div v-else class="batch-actions">
            <el-checkbox v-model="isAllSelected" @change="handleSelectAll" label="全选" size="small" />
            <span class="selected-count">已选 {{ selectedLogIds.length }} 项</span>
            <el-button type="danger" link size="small" :disabled="selectedLogIds.length === 0"
              @click="handleBatchRevoke">
              删除
            </el-button>
            <el-button link size="small" @click="toggleBatchMode">完成</el-button>
          </div>
        </div>

        <div class="history-list" :class="{ 'batch-mode': isBatchMode }">
          <div v-for="h in dashboard.history" :key="h.id" class="history-item" @click="isBatchMode ? null : null">

            <div v-if="isBatchMode" class="h-check">
              <el-checkbox v-model="selectedLogIds" :label="h.id" size="large"><span
                  style="display:none">.</span></el-checkbox>
            </div>

            <div class="h-main">
              <span class="h-desc">{{ h.description }}</span>
              <span class="h-time">{{ new Date(h.created_at).toLocaleString() }}</span>
            </div>

            <div class="h-right">
              <span class="h-pts" :class="{ plus: h.points_change > 0 }">
                {{ h.points_change > 0 ? '+' : '' }}{{ h.points_change }}
              </span>
              <el-icon v-if="!isBatchMode" class="revoke-btn" @click.stop="handleRevoke(h)">
                <Delete />
              </el-icon>
            </div>
          </div>

          <div v-if="dashboard.history.length === 0" class="empty-tip">暂无账单记录</div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="showAddModal" :title="addForm.id ? '编辑' : '添加'" width="90%">
      <el-form label-position="top">
        <el-form-item label="类型">
          <el-radio-group v-model="addForm.type">
            <el-radio-button label="task">赚积分</el-radio-button>
            <el-radio-button label="penalty">扣分</el-radio-button>
            <el-radio-button label="reward">奖品</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="名称"><el-input v-model="addForm.name" /></el-form-item>

        <el-form-item
          :label="addForm.type === 'penalty' ? '扣分分值 (填正数)' : (addForm.type === 'reward' ? '兑换价格' : '奖励分值')">
          <el-input-number v-model="addForm.points" :min="1" />
        </el-form-item>

        <el-form-item v-if="addForm.type === 'task' || addForm.type === 'penalty'" label="所属分类">
          <el-select v-model="addForm.category" placeholder="请选择分类">
            <el-option v-for="c in categories" :key="c.key" :label="c.name" :value="c.key" />
          </el-select>
        </el-form-item>

        <el-form-item label="适用对象 (不选则默认全部)">
          <el-checkbox-group v-model="addForm.targetMembers">
            <el-checkbox v-for="m in members" :key="m.id" :label="m.id" :value="m.id">{{ m.name }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>

        <template v-if="addForm.type === 'reward'">
          <el-form-item label="限购"><el-select v-model="addForm.limitType"><el-option label="不限"
                value="unlimited" /><el-option label="每周" value="weekly" /><el-option label="每月"
                value="monthly" /></el-select></el-form-item>
          <el-form-item v-if="addForm.limitType !== 'unlimited'"><el-input-number v-model="addForm.limitMax"
              :min="1" /></el-form-item>
        </template>
      </el-form>
      <template #footer><el-button @click="showAddModal = false">取消</el-button><el-button type="primary"
          @click="submitAddItem">保存</el-button></template>
    </el-dialog>

    <el-dialog v-model="showCatModal" title="分类管理" width="90%">
      <div class="cat-manage-list">
        <div v-for="c in categories" :key="c.id" class="cat-item-row">
          <span>{{ c.name }}</span>
          <el-button type="danger" link :icon="Delete" @click="deleteCat(c.id)" v-if="c.parent_id !== 0"></el-button>
          <el-tag v-else type="info" size="small">系统默认</el-tag>
        </div>
      </div>
      <div class="add-cat-row" style="margin-top: 20px; display: flex; gap: 10px;">
        <el-input v-model="catForm.name" placeholder="新分类名称" />
        <el-button type="primary" @click="submitAddCat">添加</el-button>
      </div>
    </el-dialog>

    <el-dialog v-model="showMemberModal" :title="memberForm.id ? '编辑成员' : '添加新成员'" width="85%" max-width="400px">
      <div class="member-form">
        <div class="avatar-uploader" @click="$refs.fileInput.click()">
          <el-avatar :size="80" :src="memberForm.avatarPreview" :icon="UserFilled" />
          <div class="upload-tip">点击更换头像</div>
          <input type="file" ref="fileInput" accept="image/*" style="display:none" @change="handleFileChange">
        </div>
        <el-input v-model="memberForm.name" placeholder="请输入昵称" style="margin-top:20px" size="large" />
      </div>
      <template #footer><el-button @click="showMemberModal = false">取消</el-button><el-button type="primary"
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
/* 保持所有样式不变，新增 empty-tip */
.family-dashboard {
  background: #fdf6ec;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-top: env(safe-area-inset-top, 20px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  overscroll-behavior: none;
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
  padding: 30px;
  text-align: center;
  background: linear-gradient(135deg, #f6d365 0%, #fda085 100%);
  color: white;
  position: relative;
}

.points-circle .number {
  font-size: 3.5rem;
  font-weight: 800;
  line-height: 1;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
}

.admin-entry {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(255, 255, 255, 0.2);
  padding: 5px 10px;
  border-radius: 15px;
  cursor: pointer;
}

.back-home {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(255, 255, 255, 0.2);
  padding: 5px 10px;
  border-radius: 15px;
  cursor: pointer;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 4px;
  color: white;
}

.back-home:active {
  background: rgba(255, 255, 255, 0.4);
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
  padding: 15px;
  -webkit-overflow-scrolling: touch;
  padding-bottom: calc(20px + env(safe-area-inset-bottom, 20px));
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(45%, 1fr));
  gap: 12px;
  padding: 5px;
}

.card {
  background: white;
  border-radius: 12px;
  padding: 15px;
  display: flex;
  align-items: center;
  border: 1px solid #e5e7eb;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
  cursor: pointer;
  position: relative;
  overflow: hidden;
  user-select: none;
}

.card:active {
  transform: scale(0.96);
  background: #f5f5f5;
}

.card.warning {
  border-left: 3px solid #F56C6C;
}

.task-card .icon {
  font-size: 24px;
  margin-right: 12px;
}

.t-name {
  font-weight: bold;
  font-size: 0.95rem;
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

.shop-grid .reward-card {
  flex-direction: column;
  text-align: center;
  padding: 20px 10px;
}

.r-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.r-name {
  font-weight: bold;
  margin-bottom: 5px;
}

.r-cost {
  color: #E6A23C;
  font-weight: bold;
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
  pointer-events: none;
}

.history-item {
  display: flex;
  justify-content: space-between;
  padding: 15px;
  border-bottom: 1px solid #f0f0f0;
  background: white;
}

.h-main {
  display: flex;
  flex-direction: column;
}

.h-time {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.h-pts {
  font-weight: bold;
  font-size: 1.1rem;
  color: #333;
}

.h-pts.plus {
  color: #F56C6C;
}

.h-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.revoke-btn {
  color: #ccc;
  cursor: pointer;
  padding: 5px;
  font-size: 1.1rem;
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
  margin: 15px 10px 5px;
  font-weight: bold;
  color: #909399;
  font-size: 0.9rem;
}

.cat-item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #eee;
}

.member-form {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px;
}

.avatar-uploader {
  position: relative;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.upload-tip {
  font-size: 12px;
  color: #409EFF;
  margin-top: 8px;
}

.empty-tip {
  text-align: center;
  color: #999;
  padding: 40px 0;
  font-size: 14px;
}

/* 🟢 账单批量管理样式 */
.history-toolbar {
  padding: 10px 15px;
  background: #f9f9f9;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  font-size: 14px;
}

.btn-mode {
  color: #409EFF;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}

.batch-actions {
  display: flex;
  align-items: center;
  gap: 15px;
  width: 100%;
  justify-content: space-between;
}

.selected-count {
  color: #666;
  font-size: 12px;
  flex: 1;
  text-align: center;
}

/* 列表项适配复选框 */
.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  /* 垂直居中 */
  padding: 15px;
  border-bottom: 1px solid #f0f0f0;
  background: white;
  transition: all 0.3s;
}

.h-check {
  margin-right: 10px;
  display: flex;
  align-items: center;
}

/* 调整复选框大小以适应手指点击 */
:deep(.el-checkbox__inner) {
  width: 20px;
  height: 20px;
}

:deep(.el-checkbox__inner::after) {
  height: 10px;
  left: 6px;
  top: 2px;
}
</style>