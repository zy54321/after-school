<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { ElMessage, ElMessageBox } from 'element-plus';
import dayjs from 'dayjs';
import {
  ArrowLeft,
  Plus,
  Refresh,
  Trophy,
  Timer,
  Coin,
  User,
  Box,
  Check,
} from '@element-plus/icons-vue';

const router = useRouter();

// ========== 状态 ==========
const loading = ref(false);
const members = ref([]);
const currentMemberId = ref(null);
const sessions = ref([]);
const currentSession = ref(null);
const lots = ref([]);
const activeTab = ref('sessions'); // sessions / lots

// 弹窗
const showCreateSessionModal = ref(false);
const showGenerateLotsModal = ref(false);
const showBidModal = ref(false);

// 表单
const sessionForm = reactive({
  title: '',
  scheduled_at: null,
});

const generateForm = reactive({
  common: 2,
  rare: 1,
  epic: 0,
  legendary: 0,
});

const bidForm = reactive({
  lotId: null,
  lotName: '',
  startPrice: 0,
  currentHighest: 0,
  bidPoints: 0,
});

// ========== 计算属性 ==========
const currentMember = computed(() => {
  return members.value.find((m) => m.id === currentMemberId.value);
});

const memberBalance = computed(() => {
  return currentMember.value?.balance || 0;
});

// ========== API 调用 ==========
const loadMembers = async () => {
  try {
    const res = await axios.get('/api/family/init');
    if (res.data.code === 200) {
      members.value = res.data.data.members || [];
      if (members.value.length > 0 && !currentMemberId.value) {
        currentMemberId.value = members.value[0].id;
      }
    }
  } catch (err) {
    console.error('加载成员失败:', err);
  }
};

const loadMemberBalance = async () => {
  if (!currentMemberId.value) return;
  try {
    const res = await axios.get('/api/family/member-dashboard', {
      params: { memberId: currentMemberId.value },
    });
    if (res.data.code === 200) {
      const member = members.value.find((m) => m.id === currentMemberId.value);
      if (member) {
        member.balance = res.data.data.totalPoints || 0;
      }
    }
  } catch (err) {
    console.error('加载余额失败:', err);
  }
};

const loadSessions = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/v2/auction/sessions');
    if (res.data.code === 200) {
      sessions.value = res.data.data.sessions || [];
    }
  } catch (err) {
    ElMessage.error('加载拍卖场次失败');
    console.error(err);
  } finally {
    loading.value = false;
  }
};

const loadSessionDetail = async (sessionId) => {
  loading.value = true;
  try {
    const res = await axios.get(`/api/v2/auction/sessions/${sessionId}`);
    if (res.data.code === 200) {
      currentSession.value = res.data.data.session;
      lots.value = res.data.data.lots || [];
      activeTab.value = 'lots';
    }
  } catch (err) {
    ElMessage.error('加载场次详情失败');
    console.error(err);
  } finally {
    loading.value = false;
  }
};

const createSession = async () => {
  if (!sessionForm.title.trim()) {
    return ElMessage.warning('请输入场次标题');
  }
  loading.value = true;
  try {
    const res = await axios.post('/api/v2/auction/sessions', {
      title: sessionForm.title,
      scheduled_at: sessionForm.scheduled_at,
    });
    if (res.data.code === 200) {
      ElMessage.success('创建成功');
      showCreateSessionModal.value = false;
      sessionForm.title = '';
      sessionForm.scheduled_at = null;
      await loadSessions();
    } else {
      ElMessage.error(res.data.msg || '创建失败');
    }
  } catch (err) {
    ElMessage.error(err.response?.data?.msg || '创建失败');
  } finally {
    loading.value = false;
  }
};

const generateLots = async () => {
  if (!currentSession.value) return;
  const total =
    generateForm.common +
    generateForm.rare +
    generateForm.epic +
    generateForm.legendary;
  if (total === 0) {
    return ElMessage.warning('请至少选择一个拍品');
  }
  loading.value = true;
  try {
    const res = await axios.post(
      `/api/v2/auction/sessions/${currentSession.value.id}/generate-lots`,
      generateForm
    );
    if (res.data.code === 200) {
      ElMessage.success(res.data.msg || '生成成功');
      showGenerateLotsModal.value = false;
      await loadSessionDetail(currentSession.value.id);
    } else {
      ElMessage.error(res.data.msg || '生成失败');
    }
  } catch (err) {
    ElMessage.error(err.response?.data?.msg || '生成失败');
  } finally {
    loading.value = false;
  }
};

const openBidModal = async (lot) => {
  if (!currentMemberId.value) {
    return ElMessage.warning('请先选择成员');
  }
  bidForm.lotId = lot.id;
  bidForm.lotName = lot.sku_name || lot.name;
  bidForm.startPrice = lot.start_price;
  bidForm.currentHighest = lot.current_price || lot.start_price;
  bidForm.bidPoints = lot.current_price ? lot.current_price + 1 : lot.start_price;
  showBidModal.value = true;
};

const submitBid = async () => {
  if (!currentMemberId.value) {
    return ElMessage.warning('请先选择成员');
  }
  if (bidForm.bidPoints < bidForm.startPrice) {
    return ElMessage.warning(`出价不能低于起拍价 (${bidForm.startPrice})`);
  }
  loading.value = true;
  try {
    const res = await axios.post(`/api/v2/auction/lots/${bidForm.lotId}/bids`, {
      member_id: currentMemberId.value,
      bid_points: bidForm.bidPoints,
    });
    if (res.data.code === 200) {
      ElMessage.success(res.data.msg || '出价成功');
      showBidModal.value = false;
      await loadSessionDetail(currentSession.value.id);
    } else {
      ElMessage.error(res.data.msg || '出价失败');
    }
  } catch (err) {
    ElMessage.error(err.response?.data?.msg || '出价失败');
  } finally {
    loading.value = false;
  }
};

const settleSession = async () => {
  if (!currentSession.value) return;
  try {
    await ElMessageBox.confirm(
      '确定要结算此拍卖场次吗？结算后将无法修改。',
      '确认结算',
      {
        confirmButtonText: '确定结算',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );
  } catch {
    return;
  }
  loading.value = true;
  try {
    const res = await axios.post(
      `/api/v2/auction/sessions/${currentSession.value.id}/settle`
    );
    if (res.data.code === 200) {
      ElMessage.success(res.data.msg || '结算成功');
      await loadSessionDetail(currentSession.value.id);
      await loadMemberBalance();
    } else {
      ElMessage.error(res.data.msg || '结算失败');
    }
  } catch (err) {
    ElMessage.error(err.response?.data?.msg || '结算失败');
  } finally {
    loading.value = false;
  }
};

const goBack = () => {
  if (activeTab.value === 'lots') {
    activeTab.value = 'sessions';
    currentSession.value = null;
    lots.value = [];
  } else {
    router.push('/family/dashboard');
  }
};

// ========== 辅助函数 ==========
const getStatusTag = (status) => {
  const map = {
    draft: { type: 'info', label: '草稿' },
    scheduled: { type: 'warning', label: '待开始' },
    active: { type: 'success', label: '进行中' },
    ended: { type: 'danger', label: '已结束' },
    pending: { type: 'info', label: '待拍' },
    sold: { type: 'success', label: '已成交' },
    unsold: { type: 'danger', label: '流拍' },
  };
  return map[status] || { type: 'info', label: status };
};

const getRarityStyle = (rarity) => {
  const map = {
    common: { bg: '#f3f4f6', border: '#d1d5db', text: '#6b7280' },
    rare: { bg: '#dbeafe', border: '#3b82f6', text: '#1d4ed8' },
    epic: { bg: '#f3e8ff', border: '#a855f7', text: '#7c3aed' },
    legendary: { bg: '#fef3c7', border: '#f59e0b', text: '#b45309' },
  };
  return map[rarity] || map.common;
};

const getRarityLabel = (rarity) => {
  const map = {
    common: '普通',
    rare: '稀有',
    epic: '史诗',
    legendary: '传说',
  };
  return map[rarity] || rarity;
};

// ========== 生命周期 ==========
onMounted(async () => {
  await loadMembers();
  await loadMemberBalance();
  await loadSessions();
});

watch(currentMemberId, () => {
  loadMemberBalance();
});
</script>

<template>
  <div class="auction-page">
    <!-- 顶部导航 -->
    <header class="auction-header">
      <div class="header-left">
        <el-button :icon="ArrowLeft" circle @click="goBack" />
        <h1>🔨 拍卖大厅</h1>
      </div>
      <div class="header-right">
        <!-- 成员选择 -->
        <el-select
          v-model="currentMemberId"
          placeholder="选择成员"
          style="width: 140px"
        >
          <el-option
            v-for="m in members"
            :key="m.id"
            :label="m.name"
            :value="m.id"
          />
        </el-select>
        <div class="balance-badge" v-if="currentMember">
          <el-icon><Coin /></el-icon>
          <span>{{ memberBalance }}</span>
        </div>
      </div>
    </header>

    <!-- 主内容 -->
    <main class="auction-main" v-loading="loading">
      <!-- 场次列表 -->
      <div v-if="activeTab === 'sessions'" class="sessions-view">
        <div class="section-header">
          <h2>拍卖场次</h2>
          <div class="actions">
            <el-button :icon="Refresh" @click="loadSessions">刷新</el-button>
            <el-button
              type="primary"
              :icon="Plus"
              @click="showCreateSessionModal = true"
              >创建场次</el-button
            >
          </div>
        </div>

        <div class="sessions-grid">
          <div
            v-for="s in sessions"
            :key="s.id"
            class="session-card"
            :class="{ ended: s.status === 'ended' }"
            @click="loadSessionDetail(s.id)"
          >
            <div class="session-icon">🎪</div>
            <div class="session-info">
              <h3>{{ s.title }}</h3>
              <p v-if="s.scheduled_at">
                <el-icon><Timer /></el-icon>
                {{ dayjs(s.scheduled_at).format('MM/DD HH:mm') }}
              </p>
              <el-tag :type="getStatusTag(s.status).type" size="small">
                {{ getStatusTag(s.status).label }}
              </el-tag>
            </div>
            <div class="session-arrow">→</div>
          </div>

          <div
            v-if="sessions.length === 0"
            class="empty-state"
          >
            <p>暂无拍卖场次</p>
            <el-button type="primary" @click="showCreateSessionModal = true">
              创建第一个场次
            </el-button>
          </div>
        </div>
      </div>

      <!-- 拍品列表 -->
      <div v-if="activeTab === 'lots'" class="lots-view">
        <div class="section-header">
          <div class="title-area">
            <h2>{{ currentSession?.title }}</h2>
            <el-tag :type="getStatusTag(currentSession?.status).type">
              {{ getStatusTag(currentSession?.status).label }}
            </el-tag>
          </div>
          <div class="actions">
            <el-button
              v-if="currentSession?.status !== 'ended' && lots.length === 0"
              type="warning"
              @click="showGenerateLotsModal = true"
            >
              生成拍品
            </el-button>
            <el-button
              v-if="
                currentSession?.status !== 'ended' &&
                lots.length > 0
              "
              type="danger"
              :icon="Trophy"
              @click="settleSession"
            >
              结算拍卖
            </el-button>
            <el-button :icon="Refresh" @click="loadSessionDetail(currentSession.id)">
              刷新
            </el-button>
          </div>
        </div>

        <div class="lots-grid">
          <div
            v-for="lot in lots"
            :key="lot.id"
            class="lot-card"
            :style="{
              borderColor: getRarityStyle(lot.rarity).border,
              background: getRarityStyle(lot.rarity).bg,
            }"
          >
            <div class="lot-rarity-badge" :style="{ background: getRarityStyle(lot.rarity).border }">
              {{ getRarityLabel(lot.rarity) }}
            </div>
            <div class="lot-icon">{{ lot.sku_icon || '📦' }}</div>
            <div class="lot-name">{{ lot.sku_name || lot.name }}</div>
            <div class="lot-price">
              <span class="label">起拍价</span>
              <span class="value">{{ lot.start_price }}</span>
            </div>
            <div class="lot-current" v-if="lot.current_price > lot.start_price">
              <span class="label">当前最高</span>
              <span class="value highlight">{{ lot.current_price }}</span>
            </div>
            <div class="lot-bids">
              <el-icon><User /></el-icon>
              <span>{{ lot.bid_count || 0 }} 人出价</span>
            </div>
            <div class="lot-status">
              <el-tag :type="getStatusTag(lot.status).type" size="small">
                {{ getStatusTag(lot.status).label }}
              </el-tag>
            </div>
            <el-button
              v-if="['pending', 'active'].includes(lot.status)"
              type="primary"
              size="small"
              class="bid-btn"
              @click.stop="openBidModal(lot)"
            >
              出价
            </el-button>
            <div v-if="lot.status === 'sold'" class="lot-winner">
              <el-icon><Trophy /></el-icon>
              <span>{{ lot.winner_name || '已成交' }}</span>
            </div>
          </div>

          <div v-if="lots.length === 0" class="empty-state">
            <p>该场次暂无拍品</p>
            <el-button
              v-if="currentSession?.status !== 'ended'"
              type="warning"
              @click="showGenerateLotsModal = true"
            >
              立即生成拍品
            </el-button>
          </div>
        </div>
      </div>
    </main>

    <!-- 创建场次弹窗 -->
    <el-dialog v-model="showCreateSessionModal" title="创建拍卖场次" width="400px">
      <el-form :model="sessionForm" label-width="80px">
        <el-form-item label="场次标题" required>
          <el-input v-model="sessionForm.title" placeholder="例如：周末特惠拍卖" />
        </el-form-item>
        <el-form-item label="开始时间">
          <el-date-picker
            v-model="sessionForm.scheduled_at"
            type="datetime"
            placeholder="选择时间"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateSessionModal = false">取消</el-button>
        <el-button type="primary" @click="createSession" :loading="loading">
          创建
        </el-button>
      </template>
    </el-dialog>

    <!-- 生成拍品弹窗 -->
    <el-dialog v-model="showGenerateLotsModal" title="生成拍品" width="400px">
      <el-form :model="generateForm" label-width="80px">
        <el-form-item label="普通">
          <el-input-number v-model="generateForm.common" :min="0" :max="10" />
        </el-form-item>
        <el-form-item label="稀有">
          <el-input-number v-model="generateForm.rare" :min="0" :max="10" />
        </el-form-item>
        <el-form-item label="史诗">
          <el-input-number v-model="generateForm.epic" :min="0" :max="10" />
        </el-form-item>
        <el-form-item label="传说">
          <el-input-number v-model="generateForm.legendary" :min="0" :max="10" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showGenerateLotsModal = false">取消</el-button>
        <el-button type="warning" @click="generateLots" :loading="loading">
          生成
        </el-button>
      </template>
    </el-dialog>

    <!-- 出价弹窗 -->
    <el-dialog v-model="showBidModal" title="提交出价" width="360px">
      <div class="bid-modal-content">
        <div class="bid-item-info">
          <h3>{{ bidForm.lotName }}</h3>
          <p>
            起拍价: <strong>{{ bidForm.startPrice }}</strong> |
            当前最高: <strong>{{ bidForm.currentHighest }}</strong>
          </p>
        </div>
        <el-form label-width="80px">
          <el-form-item label="出价成员">
            <span>{{ currentMember?.name }}</span>
            <span class="balance-hint">(余额: {{ memberBalance }})</span>
          </el-form-item>
          <el-form-item label="出价积分">
            <el-input-number
              v-model="bidForm.bidPoints"
              :min="bidForm.startPrice"
              :max="memberBalance"
              style="width: 100%"
            />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="showBidModal = false">取消</el-button>
        <el-button type="primary" @click="submitBid" :loading="loading">
          确认出价
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.auction-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  color: #e0e0e0;
  font-family: 'Segoe UI', 'SF Pro Display', -apple-system, sans-serif;
}

/* Header */
.auction-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-left h1 {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
  background: linear-gradient(90deg, #ffd700, #ff8c00);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.balance-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: linear-gradient(135deg, #ffd700, #ff8c00);
  border-radius: 20px;
  color: #1a1a2e;
  font-weight: 700;
  font-size: 16px;
}

/* Main */
.auction-main {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.section-header h2 {
  font-size: 28px;
  font-weight: 700;
  margin: 0;
  color: #fff;
}

.title-area {
  display: flex;
  align-items: center;
  gap: 12px;
}

.actions {
  display: flex;
  gap: 12px;
}

/* Sessions Grid */
.sessions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.session-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.session-card:hover {
  background: rgba(255, 255, 255, 0.12);
  transform: translateY(-4px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.session-card.ended {
  opacity: 0.6;
}

.session-icon {
  font-size: 40px;
}

.session-info {
  flex: 1;
}

.session-info h3 {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.session-info p {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #aaa;
  display: flex;
  align-items: center;
  gap: 4px;
}

.session-arrow {
  font-size: 24px;
  color: #666;
}

/* Lots Grid */
.lots-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
}

.lot-card {
  position: relative;
  padding: 20px;
  border: 2px solid;
  border-radius: 16px;
  text-align: center;
  transition: all 0.3s ease;
}

.lot-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.lot-rarity-badge {
  position: absolute;
  top: -1px;
  right: -1px;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  border-radius: 0 14px 0 12px;
}

.lot-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.lot-name {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
}

.lot-price,
.lot-current {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  margin-bottom: 6px;
  color: #666;
}

.lot-price .value,
.lot-current .value {
  font-weight: 700;
  color: #333;
}

.lot-current .value.highlight {
  color: #e6a23c;
}

.lot-bids {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 13px;
  color: #888;
  margin: 8px 0;
}

.lot-status {
  margin-bottom: 12px;
}

.bid-btn {
  width: 100%;
}

.lot-winner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 14px;
  color: #67c23a;
  font-weight: 600;
}

/* Empty State */
.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 60px 20px;
  color: #888;
}

.empty-state p {
  font-size: 18px;
  margin-bottom: 20px;
}

/* Bid Modal */
.bid-modal-content {
  text-align: center;
}

.bid-item-info {
  margin-bottom: 20px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 12px;
}

.bid-item-info h3 {
  margin: 0 0 8px 0;
  font-size: 18px;
}

.bid-item-info p {
  margin: 0;
  color: #666;
}

.balance-hint {
  color: #909399;
  font-size: 13px;
  margin-left: 8px;
}

/* Responsive */
@media (max-width: 768px) {
  .auction-header {
    flex-direction: column;
    gap: 12px;
    padding: 12px 16px;
  }

  .header-left h1 {
    font-size: 20px;
  }

  .auction-main {
    padding: 16px;
  }

  .section-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .sessions-grid,
  .lots-grid {
    grid-template-columns: 1fr;
  }
}
</style>
