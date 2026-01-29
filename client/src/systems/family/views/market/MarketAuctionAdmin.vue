<template>
  <div class="market-admin">
    <nav class="breadcrumb">
      <router-link to="/family/market">市场</router-link>
      <span class="separator">/</span>
      <router-link to="/family/market/admin">市场管理</router-link>
      <span class="separator">/</span>
      <span class="current">拍卖场次管理</span>
    </nav>

    <header class="page-header">
      <div class="header-left">
        <h1>🔨 拍卖场次管理</h1>
        <p>配置拍卖池 → 抽选拍品 → 开始拍卖</p>
      </div>
      <button class="primary-btn" @click="openSessionModal()">+ 新建场次</button>
    </header>

    <div class="section">
      <div class="table" v-if="sessions.length > 0">
        <div class="table-row header">
          <div>标题</div>
          <div>时间</div>
          <div>状态</div>
          <div>准备度</div>
          <div>进度</div>
          <div>操作</div>
        </div>
        <div class="table-row" v-for="session in sessions" :key="session.id">
          <div class="session-title">{{ session.title }}</div>
          <div>{{ formatDate(session.scheduled_at) }}</div>
          <div>
            <span class="status-badge" :class="session.status">
              {{ getStatusLabel(session.status) }}
            </span>
          </div>
          <div class="readiness">
            <span>池子: {{ session.pool_count || 0 }}</span>
            <span>拍品: {{ session.lot_count || 0 }}</span>
            <span v-if="session.active_lot" class="active-lot-hint">
              当前: {{ session.active_lot.title }}
            </span>
          </div>
          <div class="progress">
            <span>竞拍中: {{ session.open_count || 0 }}</span>
            <span>已成交: {{ session.sold_count || 0 }}</span>
            <span>流拍: {{ session.unsold_count || 0 }}</span>
            <span>出价者: {{ session.bidder_count || 0 }}</span>
          </div>
          <div class="actions">
            <button class="action-btn" @click="goToManage(session.id)">进入导演台</button>
            <button 
              v-if="session.status === 'active'" 
              class="action-btn primary" 
              @click="goToAuction(session.id)"
            >
              进入拍卖台
            </button>
            <button 
              v-if="['draft', 'scheduled'].includes(session.status)" 
              class="action-btn" 
              @click="startSession(session)"
              :disabled="saving"
            >
              开始
            </button>
            <button 
              v-if="session.status === 'active'" 
              class="action-btn" 
              @click="endSession(session)"
              :disabled="saving"
            >
              结束
            </button>
            <button 
              v-if="session.status === 'ended'" 
              class="action-btn" 
              @click="archiveSession(session)"
              :disabled="saving"
            >
              归档
            </button>
          </div>
        </div>
      </div>
      <div class="empty" v-else-if="!loading">暂无场次</div>
    </div>

    <div class="loading-state" v-if="loading">加载中...</div>

    <!-- 场次弹窗 -->
    <div class="modal-overlay" v-if="showSessionModal" @click.self="closeSessionModal">
      <div class="modal-content">
        <h3>新建场次</h3>
        <div class="form-group">
          <label>标题</label>
          <input v-model="sessionForm.title" />
        </div>
        <div class="form-group">
          <label>开始时间（可选）</label>
          <input type="datetime-local" v-model="sessionForm.scheduled_at" />
        </div>
        <div class="modal-actions">
          <button class="cancel-btn" @click="closeSessionModal">取消</button>
          <button class="confirm-btn" @click="submitSession" :disabled="saving">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 生成拍品弹窗 -->
    <div class="modal-overlay" v-if="showLotsModal" @click.self="closeLotsModal">
      <div class="modal-content">
        <h3>生成拍品</h3>
        <div class="form-group">
          <label>R</label>
          <input type="number" v-model.number="lotsForm.r" />
        </div>
        <div class="form-group">
          <label>SR</label>
          <input type="number" v-model.number="lotsForm.sr" />
        </div>
        <div class="form-group">
          <label>SSR</label>
          <input type="number" v-model.number="lotsForm.ssr" />
        </div>
        <div class="form-group">
          <label>UR</label>
          <input type="number" v-model.number="lotsForm.ur" />
        </div>
        <div class="modal-actions">
          <button class="cancel-btn" @click="closeLotsModal">取消</button>
          <button class="confirm-btn" @click="submitLots" :disabled="saving">
            {{ saving ? '生成中...' : '生成' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 设置池子弹窗 -->
    <div class="modal-overlay" v-if="showPoolModal" @click.self="closePoolModal">
      <div class="modal-content">
        <h3>设置拍卖品池子</h3>
        <div class="form-group">
          <label>选择 SKU</label>
          <div class="pool-list">
            <label v-for="sku in auctionableSkus" :key="sku.id" class="pool-item">
              <input type="checkbox" :value="sku.id" v-model="poolForm.sku_ids" />
              <span>{{ sku.name }}</span>
            </label>
          </div>
        </div>
        <div class="modal-actions">
          <button class="cancel-btn" @click="closePoolModal">取消</button>
          <button class="confirm-btn" @click="submitPool" :disabled="saving">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { ElMessage, ElMessageBox } from 'element-plus';

const router = useRouter();

const loading = ref(false);
const saving = ref(false);
const sessions = ref([]);

const showSessionModal = ref(false);
const showLotsModal = ref(false);
const showPoolModal = ref(false);
const selectedSessionId = ref(null);
const auctionableSkus = ref([]);

const sessionForm = ref({
  title: '',
  scheduled_at: '',
});

const lotsForm = ref({
  r: 0,
  sr: 0,
  ssr: 0,
  ur: 0,
});

const poolForm = ref({
  sku_ids: [],
});

const loadSessions = async () => {
  const res = await axios.get('/api/v2/auction/sessions-admin');
  if (res.data?.code === 200) {
    sessions.value = res.data.data?.sessions || [];
  }
};

const refresh = async () => {
  loading.value = true;
  try {
    await Promise.all([loadSessions(), loadAuctionableSkus()]);
  } finally {
    loading.value = false;
  }
};

const openSessionModal = () => {
  sessionForm.value = { title: '', scheduled_at: '' };
  showSessionModal.value = true;
};

const closeSessionModal = () => {
  showSessionModal.value = false;
};

const submitSession = async () => {
  if (!sessionForm.value.title) return;
  saving.value = true;
  try {
    await axios.post('/api/v2/auction/sessions', {
      title: sessionForm.value.title,
      scheduled_at: sessionForm.value.scheduled_at || undefined,
    });
    closeSessionModal();
    await refresh();
  } finally {
    saving.value = false;
  }
};

const openLotsModal = (session) => {
  selectedSessionId.value = session.id;
  lotsForm.value = { r: 0, sr: 0, ssr: 0, ur: 0 };
  showLotsModal.value = true;
};

const closeLotsModal = () => {
  showLotsModal.value = false;
  selectedSessionId.value = null;
};

const submitLots = async () => {
  if (!selectedSessionId.value) return;
  saving.value = true;
  try {
    await axios.post(`/api/v2/auction/sessions/${selectedSessionId.value}/generate-lots`, {
      r: lotsForm.value.r,
      sr: lotsForm.value.sr,
      ssr: lotsForm.value.ssr,
      ur: lotsForm.value.ur,
    });
    closeLotsModal();
    await refresh(); // ✅ 修复：提交后刷新
  } finally {
    saving.value = false;
  }
};

const loadAuctionableSkus = async () => {
  const res = await axios.get('/api/v2/auction/skus');
  if (res.data?.code === 200) {
    auctionableSkus.value = res.data.data?.skus || [];
  }
};

const openPoolModal = (session) => {
  selectedSessionId.value = session.id;
  poolForm.value = { sku_ids: [] };
  showPoolModal.value = true;
};

const closePoolModal = () => {
  showPoolModal.value = false;
  selectedSessionId.value = null;
};

const submitPool = async () => {
  if (!selectedSessionId.value) return;
  if (!poolForm.value.sku_ids.length) {
    alert('请选择至少一个 SKU');
    return;
  }
  saving.value = true;
  try {
    await axios.post(`/api/v2/auction/sessions/${selectedSessionId.value}/pool`, {
      sku_ids: poolForm.value.sku_ids,
    });
    closePoolModal();
    await refresh(); // ✅ 修复：提交后刷新
  } finally {
    saving.value = false;
  }
};

// 进入导演台
const goToManage = (sessionId) => {
  router.push(`/family/market/admin/auction/${sessionId}`);
};

// 进入拍卖台
const goToAuction = (sessionId) => {
  router.push(`/family/auction/${sessionId}`);
};

// 开始拍卖
const startSession = async (session) => {
  saving.value = true;
  try {
    await axios.post(`/api/v2/auction/sessions/${session.id}/start`);
    ElMessage.success('拍卖已开始');
    await refresh();
  } catch (err) {
    ElMessage.error(err.response?.data?.msg || '开始拍卖失败');
  } finally {
    saving.value = false;
  }
};

// 结束拍卖
const endSession = async (session) => {
  try {
    await ElMessageBox.confirm('确认结束该拍卖场次？', '确认结束', {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'warning',
    });
    saving.value = true;
    try {
      // TODO: 需要后端提供结束接口，暂时使用 settle
      await axios.post(`/api/v2/auction/sessions/${session.id}/settle`);
      ElMessage.success('拍卖已结束');
      await refresh();
    } catch (err) {
      ElMessage.error(err.response?.data?.msg || '结束拍卖失败');
    } finally {
      saving.value = false;
    }
  } catch {
    // 用户取消
  }
};

// 归档拍卖
const archiveSession = async (session) => {
  ElMessage.info('归档功能待实现');
};

// 获取状态标签
const getStatusLabel = (status) => {
  const labels = {
    draft: '草稿',
    scheduled: '已排期',
    active: '竞拍中',
    ended: '已结束',
    cancelled: '已取消',
  };
  return labels[status] || status;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '未设置';
  return new Date(dateStr).toLocaleString('zh-CN');
};

onMounted(() => {
  refresh();
});
</script>

<style scoped>
.market-admin { color: #fff; }
.breadcrumb { margin-bottom: 16px; font-size: 14px; }
.breadcrumb a { color: rgba(255,255,255,0.6); text-decoration: none; }
.breadcrumb .separator { margin: 0 8px; color: rgba(255,255,255,0.4); }
.page-header { display:flex; justify-content: space-between; align-items:center; margin-bottom: 16px; }
.page-header p { margin:0; color: rgba(255,255,255,0.6); }
.primary-btn { padding:8px 14px; border:none; border-radius:8px; background:linear-gradient(135deg,#667eea,#764ba2); color:#fff; cursor:pointer; }
.table { border:1px solid rgba(255,255,255,0.1); border-radius:12px; overflow:hidden; }
.table-row { display:grid; grid-template-columns:1.5fr 1fr 0.8fr 1.2fr 1.5fr 2fr; gap:10px; padding:10px 12px; border-bottom:1px solid rgba(255,255,255,0.08); }
.table-row.header { font-weight:600; background:rgba(255,255,255,0.06); }
.actions { display:flex; gap:8px; }
.pool-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px; }
.pool-item { display:flex; gap:6px; align-items:center; color: rgba(255,255,255,0.8); font-size: 13px; }
.link-btn { background:none; border:none; color:#8ab4f8; cursor:pointer; }
.action-btn { padding:6px 12px; border:1px solid rgba(255,255,255,0.2); border-radius:6px; background:rgba(255,255,255,0.05); color:#fff; cursor:pointer; font-size:12px; }
.action-btn:hover { background:rgba(255,255,255,0.1); }
.action-btn.primary { background:linear-gradient(135deg,#667eea,#764ba2); border:none; }
.action-btn:disabled { opacity:0.5; cursor:not-allowed; }
.status-badge { padding:4px 8px; border-radius:6px; font-size:12px; font-weight:600; }
.status-badge.draft { background:rgba(255,255,255,0.1); color:rgba(255,255,255,0.6); }
.status-badge.scheduled { background:rgba(255,193,7,0.2); color:#ffc107; }
.status-badge.active { background:rgba(79,172,254,0.2); color:#4facfe; }
.status-badge.ended { background:rgba(255,255,255,0.1); color:rgba(255,255,255,0.5); }
.readiness, .progress { display:flex; flex-direction:column; gap:4px; font-size:12px; color:rgba(255,255,255,0.7); }
.readiness span, .progress span { display:inline-block; }
.active-lot-hint { color:#4facfe; font-weight:600; }
.session-title { font-weight:600; }
.empty { padding:16px; color: rgba(255,255,255,0.5); }
.loading-state { text-align:center; padding: 20px; color: rgba(255,255,255,0.5); }
.modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:1000; }
.modal-content { background:#1a1a2e; padding:24px; border-radius:16px; width:90%; max-width:420px; }
.form-group { margin-bottom:12px; }
.form-group label { display:block; margin-bottom:6px; color: rgba(255,255,255,0.7); font-size:13px; }
.form-group input { width:100%; padding:8px; border-radius:8px; border:1px solid rgba(255,255,255,0.2); background:rgba(255,255,255,0.05); color:#fff; }
.modal-actions { display:flex; gap:12px; margin-top:16px; }
.cancel-btn, .confirm-btn { flex:1; padding:10px; border-radius:8px; border:none; cursor:pointer; }
.cancel-btn { background:rgba(255,255,255,0.1); color:#fff; }
.confirm-btn { background:linear-gradient(135deg,#667eea,#764ba2); color:#fff; font-weight:600; }
</style>
