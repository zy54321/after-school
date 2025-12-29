<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import axios from 'axios';
import { ElMessage, ElMessageBox } from 'element-plus';
import { UserFilled, Plus, Setting } from '@element-plus/icons-vue';
import dayjs from 'dayjs';

// === 状态定义 ===
const loading = ref(false);
const currentMemberId = ref(null);
const members = ref([]);
const tasks = ref([]);
const rewards = ref([]);

// 面板数据
const dashboard = reactive({
  totalPoints: 0,
  history: [],
  usageStats: [] // 记录商品兑换情况
});

// 管理弹窗
const showAddModal = ref(false);
const addForm = reactive({ type: 'task', name: '', points: 1, category: 'life', limitType: 'unlimited', limitMax: 1 });

// === 初始化 ===
const initData = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/family/init');
    if (res.data.code === 200) {
      members.value = res.data.data.members;
      tasks.value = res.data.data.tasks;
      rewards.value = res.data.data.rewards;

      // 默认选中第一个孩子
      if (members.value.length > 0 && !currentMemberId.value) {
        currentMemberId.value = members.value[0].id;
      }
      if (currentMemberId.value) loadMemberData();
    }
  } finally {
    loading.value = false;
  }
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

// 1. 切换孩子
const switchMember = (id) => {
  currentMemberId.value = id;
  loadMemberData();
};

// 2. 检查商品是否可兑换 (核心周期逻辑)
const checkRewardStatus = (reward) => {
  if (reward.limit_type === 'unlimited') return { available: true, text: '' };

  // 找到该商品的最近统计
  const stat = dashboard.usageStats.find(s => s.reward_id === reward.id);
  if (!stat) return { available: true, text: `本${cycleName(reward.limit_type)}限 ${reward.limit_max} 次` };

  // 简单起见，这里假设后端返回的 usageStats 已经是当前周期的计数 (在生产环境中，前端用 dayjs 再次校验 last_used 时间更稳妥)
  // 为了简化演示，我们假定后端逻辑已经过滤了时间。
  // 实际建议：后端返回所有记录，前端 dayjs 过滤。这里我们模拟一下：
  const count = parseInt(stat.usage_count); // 简化逻辑
  const left = reward.limit_max - count;

  if (left <= 0) return { available: false, text: '本期已兑完' };
  return { available: true, text: `剩余 ${left}/${reward.limit_max}` };
};

const cycleName = (type) => type === 'weekly' ? '周' : (type === 'monthly' ? '月' : '日');

// 3. 提交任务
const handleTask = async (task) => {
  // 乐观更新 UI (让用户觉得快)
  dashboard.totalPoints += task.points;

  try {
    await axios.post('/api/family/action', {
      memberId: currentMemberId.value,
      taskId: task.id,
      points: task.points
    });
    ElMessage.success({ message: `积分 ${task.points > 0 ? '+' : ''}${task.points}`, type: 'success', duration: 1500 });
    loadMemberData(); // 重新拉取保持一致
  } catch (err) {
    dashboard.totalPoints -= task.points; // 回滚
    ElMessage.error('网络小差，请重试');
  }
};

// 4. 兑换商品
const handleRedeem = (reward) => {
  const status = checkRewardStatus(reward);
  if (!status.available) return;

  ElMessageBox.confirm(`确定消耗 ${reward.cost} 积分兑换 "${reward.name}" 吗?`, '兑换确认', {
    confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning'
  }).then(async () => {
    const res = await axios.post('/api/family/redeem', {
      memberId: currentMemberId.value,
      rewardId: reward.id
    });
    if (res.data.code === 200) {
      ElMessage.success('兑换成功！');
      loadMemberData();
    } else {
      ElMessage.warning(res.data.msg);
    }
  });
};

// 5. 新增数据 (Task/Reward)
const submitAddItem = async () => {
  if (!addForm.name) return ElMessage.warning('请输入名称');

  const res = await axios.post('/api/family/create', addForm);
  if (res.data.code === 200) {
    ElMessage.success('添加成功');
    showAddModal.value = false;
    initData(); // 刷新列表
  }
};

onMounted(initData);
</script>

<template>
  <div class="family-dashboard">
    <div class="member-bar">
      <div v-for="m in members" :key="m.id" class="member-avatar" :class="{ active: currentMemberId === m.id }"
        @click="switchMember(m.id)">
        <el-avatar :size="40" :icon="UserFilled" :src="m.avatar" class="av-img" />
        <span class="name">{{ m.name }}</span>
      </div>
      <div class="member-avatar add-btn" @click="ElMessage.info('多孩子管理功能开发中...')">
        <el-icon>
          <Plus />
        </el-icon>
      </div>
    </div>

    <div class="score-header">
      <div class="points-circle">
        <span class="number">{{ dashboard.totalPoints }}</span>
        <span class="label">当前积分</span>
      </div>
      <div class="admin-entry" @click="showAddModal = true">
        <el-icon>
          <Setting />
        </el-icon> 规则管理
      </div>
    </div>

    <el-tabs type="border-card" class="action-tabs">
      <el-tab-pane label="赚积分">
        <div class="task-list">
          <div class="category-title">📘 学习任务</div>
          <div class="grid">
            <div v-for="t in tasks.filter(x => x.category === 'study')" :key="t.id" class="card task-card"
              @click="handleTask(t)">
              <div class="icon">{{ t.icon || '📘' }}</div>
              <div class="info">
                <div class="t-name">{{ t.title }}</div>
                <div class="t-pts text-blue">+{{ t.points }}</div>
              </div>
            </div>
          </div>

          <div class="category-title">☀️ 生活与家务</div>
          <div class="grid">
            <div v-for="t in tasks.filter(x => ['life', 'chore'].includes(x.category))" :key="t.id"
              class="card task-card" @click="handleTask(t)">
              <div class="icon">{{ t.icon || '🧹' }}</div>
              <div class="info">
                <div class="t-name">{{ t.title }}</div>
                <div class="t-pts text-green">+{{ t.points }}</div>
              </div>
            </div>
          </div>

          <div class="category-title">⚠️ 需注意行为</div>
          <div class="grid">
            <div v-for="t in tasks.filter(x => x.points < 0)" :key="t.id" class="card task-card warning"
              @click="handleTask(t)">
              <div class="info">
                <div class="t-name">{{ t.title }}</div>
                <div class="t-pts text-red">{{ t.points }}</div>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="兑奖品">
        <div class="grid shop-grid">
          <div v-for="r in rewards" :key="r.id" class="card reward-card"
            :class="{ disabled: !checkRewardStatus(r).available || dashboard.totalPoints < r.cost }"
            @click="handleRedeem(r)">
            <div class="r-icon">{{ r.icon || '🎁' }}</div>
            <div class="r-name">{{ r.name }}</div>
            <div class="r-cost">💰 {{ r.cost }}</div>

            <div v-if="r.limit_type !== 'unlimited'" class="limit-badge">
              {{ checkRewardStatus(r).text }}
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="查账单">
        <div class="history-list">
          <div v-for="h in dashboard.history" :key="h.id" class="history-item">
            <div class="h-main">
              <span class="h-desc">{{ h.description }}</span>
              <span class="h-time">{{ new Date(h.created_at).toLocaleString() }}</span>
            </div>
            <div class="h-pts" :class="{ plus: h.points_change > 0 }">
              {{ h.points_change > 0 ? '+' : '' }}{{ h.points_change }}
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="showAddModal" title="添加新规则" width="90%">
      <el-form label-position="top">
        <el-form-item label="类型">
          <el-radio-group v-model="addForm.type">
            <el-radio-button label="task">加分任务</el-radio-button>
            <el-radio-button label="reward">奖励商品</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="名称">
          <el-input v-model="addForm.name" placeholder="如: 背诵古诗 / 乐高玩具" />
        </el-form-item>

        <el-form-item label="分值">
          <el-input-number v-model="addForm.points" :min="1" />
        </el-form-item>

        <el-form-item v-if="addForm.type === 'task'" label="分类">
          <el-select v-model="addForm.category">
            <el-option label="学习" value="study" />
            <el-option label="生活" value="life" />
            <el-option label="家务" value="chore" />
          </el-select>
        </el-form-item>

        <template v-if="addForm.type === 'reward'">
          <el-form-item label="限购周期">
            <el-select v-model="addForm.limitType">
              <el-option label="不限" value="unlimited" />
              <el-option label="每周刷新" value="weekly" />
              <el-option label="每月刷新" value="monthly" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="addForm.limitType !== 'unlimited'" label="周期内限购次数">
            <el-input-number v-model="addForm.limitMax" :min="1" />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="showAddModal = false">取消</el-button>
        <el-button type="primary" @click="submitAddItem">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
/* 样式重点：温馨、圆润、暖色调 */
.family-dashboard {
  background: #fdf6ec;
  /* 浅米色背景 */
  /* 🟢 修改 1: 固定高度并使用 Flex 布局 */
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* 隐藏整个页面的滚动条 */
}

/* 顶部孩子栏 */
.member-bar {
  /* 🟢 修改 2: 防止头部被压缩 */
  flex-shrink: 0;

  background: #fff;
  padding: 15px;
  display: flex;
  gap: 20px;
  overflow-x: auto;
  border-bottom: 1px solid #eee;
}

.member-avatar {
  display: flex;
  flex-direction: column;
  align-items: center;
  opacity: 0.6;
  transition: all 0.3s;
  cursor: pointer;
  /* 🟢 新增: 防止头像在小屏下被挤压 */
  flex-shrink: 0;
}

.member-avatar.active {
  opacity: 1;
  transform: scale(1.1);
}

.member-avatar .name {
  font-size: 12px;
  margin-top: 4px;
  color: #666;
  font-weight: bold;
}

/* 总分区域 */
.score-header {
  /* 🟢 修改 2: 防止头部被压缩 */
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
  display: block;
  line-height: 1;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
}

.points-circle .label {
  font-size: 0.9rem;
  opacity: 0.9;
}

.admin-entry {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 0.8rem;
  background: rgba(255, 255, 255, 0.2);
  padding: 5px 10px;
  border-radius: 15px;
  cursor: pointer;
}

/* 🟢 修改 3: 改造 Tabs 布局，让它撑满剩余空间 */
.action-tabs {
  flex: 1;
  /* 占据剩余高度 */
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* 关键：禁止自身撑开页面 */
  border-bottom: none;
  /* 去掉底边框，视觉更干净 */
}

/* 🟢 修改 4: 穿透 Element Plus 样式，让内容区独立滚动 */
:deep(.el-tabs__content) {
  flex: 1;
  /* 占据 Tabs 内部剩余高度 */
  overflow-y: auto;
  /* 开启垂直滚动 */
  padding: 15px;
  /* 保持内边距 */

  /* 增加滚动条顺滑度 (iOS) */
  -webkit-overflow-scrolling: touch;
}

/* 网格布局 */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(45%, 1fr));
  gap: 12px;
  padding: 5px;
  /* 微调 padding */
}

/* 卡片通用 */
.card {
  background: white;
  border-radius: 12px;
  padding: 15px;
  display: flex;
  align-items: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
  cursor: pointer;
  transition: transform 0.1s;
  position: relative;
  overflow: hidden;
}

.card:active {
  transform: scale(0.98);
  background: #fafafa;
}

/* 任务卡片 */
.task-card .icon {
  font-size: 24px;
  margin-right: 12px;
}

.task-card .t-name {
  font-weight: bold;
  font-size: 0.95rem;
  color: #333;
}

.text-blue {
  color: #409EFF;
  font-weight: bold;
}

.text-green {
  color: #67C23A;
  font-weight: bold;
}

.text-red {
  color: #F56C6C;
  font-weight: bold;
}

/* 商品卡片 */
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

/* 历史列表 */
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

.category-title {
  margin: 15px 10px 5px;
  font-weight: bold;
  color: #909399;
  font-size: 0.9rem;
}
</style>