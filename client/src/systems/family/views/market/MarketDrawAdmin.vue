<template>
  <div class="market-admin">
    <nav class="breadcrumb">
      <router-link to="/family/market">市场</router-link>
      <span class="separator">/</span>
      <router-link to="/family/market/admin">市场管理</router-link>
      <span class="separator">/</span>
      <span class="current">抽奖池管理</span>
    </nav>

    <header class="page-header">
      <div class="header-left">
        <h1>🎰 抽奖池管理</h1>
        <p>创建与配置抽奖池和奖品版本（点击“配置奖品”选择商品）</p>
      </div>
      <button class="primary-btn" @click="openPoolModal()">+ 新建抽奖池</button>
    </header>

    <div class="section">
      <div class="table" v-if="pools.length > 0">
        <div class="table-row header">
          <div>名称</div>
          <div>类型</div>
          <div>券类型</div>
          <div>每次耗券</div>
          <div>状态</div>
          <div>操作</div>
        </div>
        <div class="table-row" v-for="pool in pools" :key="pool.id">
          <div>{{ pool.name }}</div>
          <div>{{ pool.pool_type }}</div>
          <div>{{ pool.ticket_type_name || '无' }}</div>
          <div>{{ pool.tickets_per_draw }}</div>
          <div>{{ pool.status }}</div>
          <div class="actions">
            <button class="link-btn" @click="openPoolModal(pool)">编辑</button>
            <button class="link-btn" @click="openVersionModal(pool)">配置奖品</button>
            <button class="link-btn danger" @click="deactivatePool(pool)">停用</button>
          </div>
        </div>
      </div>
      <div class="empty" v-else-if="!loading">暂无抽奖池</div>
    </div>

    <div class="loading-state" v-if="loading">加载中...</div>

    <!-- 抽奖池弹窗 -->
    <div class="modal-overlay" v-if="showPoolModal" @click.self="closePoolModal">
      <div class="modal-content">
        <h3>{{ poolForm.id ? '编辑抽奖池' : '新建抽奖池' }}</h3>
        <div class="form-group">
          <label>名称</label>
          <input v-model="poolForm.name" />
        </div>
        <div class="form-group">
          <label>描述</label>
          <textarea v-model="poolForm.description" rows="2"></textarea>
        </div>
        <div class="form-group">
          <label>图标</label>
          <input v-model="poolForm.icon" placeholder="🎰" />
        </div>
        <div class="form-group">
          <label>入场券类型</label>
          <select v-model.number="poolForm.entry_ticket_type_id">
            <option :value="null">无</option>
            <option v-for="t in ticketTypes" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>每次抽奖耗券</label>
          <input type="number" v-model.number="poolForm.tickets_per_draw" />
        </div>
        <div class="form-group">
          <label>类型</label>
          <select v-model="poolForm.pool_type">
            <option value="wheel">wheel</option>
            <option value="box">box</option>
            <option value="card">card</option>
            <option value="slot">slot</option>
          </select>
        </div>
        <div class="form-group">
          <label>状态</label>
          <select v-model="poolForm.status">
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
        </div>
        <div class="modal-actions">
          <button class="cancel-btn" @click="closePoolModal">取消</button>
          <button class="confirm-btn" @click="submitPool" :disabled="saving">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 版本弹窗 -->
    <div class="modal-overlay" v-if="showVersionModal" @click.self="closeVersionModal">
      <div class="modal-content">
        <h3>创建奖品版本</h3>
        <div class="form-group">
          <label>从商品选择奖品</label>
          <div class="prize-builder">
            <div class="prize-row header">
              <div>商品</div>
              <div>数量</div>
              <div>权重</div>
              <div>操作</div>
            </div>
            <div class="prize-row" v-for="(row, idx) in versionForm.prizeRows" :key="idx">
              <div>
                <select v-model.number="row.sku_id">
                  <option :value="null">选择商品</option>
                  <option v-for="sku in skus" :key="sku.id" :value="sku.id">
                    {{ sku.name }} ({{ sku.type }})
                  </option>
                </select>
              </div>
              <div>
                <input type="number" min="1" v-model.number="row.quantity" />
              </div>
              <div>
                <input type="number" min="1" v-model.number="row.weight" />
              </div>
              <div>
                <button class="link-btn danger" @click="removePrizeRow(idx)">移除</button>
              </div>
            </div>
            <button class="link-btn" @click="addPrizeRow">+ 添加商品奖品</button>
          </div>
        </div>
        <div class="form-group">
          <label>奖品 JSON（数组）</label>
          <textarea v-model="versionForm.prizesText" rows="6" placeholder='[{"id":1,"name":"10积分","type":"points","value":10,"weight":50}]'></textarea>
        </div>
        <div class="form-group">
          <label>保底次数（可选）</label>
          <input type="number" v-model.number="versionForm.min_guarantee_count" />
        </div>
        <div class="form-group">
          <label>保底奖品 ID（可选）</label>
          <input type="number" v-model.number="versionForm.guarantee_prize_id" />
        </div>
        <div class="modal-actions">
          <button class="cancel-btn" @click="closeVersionModal">取消</button>
          <button class="confirm-btn" @click="submitVersion" :disabled="saving">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';

const loading = ref(false);
const saving = ref(false);
const pools = ref([]);
const ticketTypes = ref([]);
const skus = ref([]);
const skuMap = computed(() => new Map(skus.value.map((sku) => [sku.id, sku])));

const showPoolModal = ref(false);
const showVersionModal = ref(false);
const currentPoolId = ref(null);

const poolForm = ref({
  id: null,
  name: '',
  description: '',
  icon: '',
  entry_ticket_type_id: null,
  tickets_per_draw: 1,
  pool_type: 'wheel',
  status: 'active',
});

const versionForm = ref({
  prizesText: '',
  prizeRows: [],
  min_guarantee_count: null,
  guarantee_prize_id: null,
});

const loadPools = async () => {
  const res = await axios.get('/api/v2/draw/admin/pools');
  if (res.data?.code === 200) {
    pools.value = res.data.data?.pools || [];
  }
};

const loadTicketTypes = async () => {
  const res = await axios.get('/api/v2/draw/overview');
  if (res.data?.code === 200) {
    ticketTypes.value = res.data.data?.ticketTypes || [];
  }
};

const loadSkus = async () => {
  const res = await axios.get('/api/v2/skus');
  if (res.data?.code === 200) {
    skus.value = res.data.data?.skus || [];
  }
};

const refresh = async () => {
  loading.value = true;
  try {
    await Promise.all([loadPools(), loadTicketTypes(), loadSkus()]);
  } finally {
    loading.value = false;
  }
};

const openPoolModal = (pool = null) => {
  if (pool) {
    poolForm.value = {
      id: pool.id,
      name: pool.name,
      description: pool.description || '',
      icon: pool.icon || '',
      entry_ticket_type_id: pool.entry_ticket_type_id || null,
      tickets_per_draw: pool.tickets_per_draw || 1,
      pool_type: pool.pool_type || 'wheel',
      status: pool.status || 'active',
    };
  } else {
    poolForm.value = {
      id: null,
      name: '',
      description: '',
      icon: '',
      entry_ticket_type_id: null,
      tickets_per_draw: 1,
      pool_type: 'wheel',
      status: 'active',
    };
  }
  showPoolModal.value = true;
};

const closePoolModal = () => {
  showPoolModal.value = false;
};

const submitPool = async () => {
  saving.value = true;
  try {
    const payload = {
      name: poolForm.value.name,
      description: poolForm.value.description || undefined,
      icon: poolForm.value.icon || undefined,
      entry_ticket_type_id: poolForm.value.entry_ticket_type_id,
      tickets_per_draw: poolForm.value.tickets_per_draw,
      pool_type: poolForm.value.pool_type,
      status: poolForm.value.status,
    };
    if (poolForm.value.id) {
      await axios.put(`/api/v2/draw/pools/${poolForm.value.id}`, payload);
    } else {
      await axios.post('/api/v2/draw/pools', payload);
    }
    closePoolModal();
    await refresh();
  } finally {
    saving.value = false;
  }
};

const openVersionModal = async (pool) => {
  currentPoolId.value = pool.id;
  
  // 1. 先重置表单
  versionForm.value = {
    prizesText: '',
    prizeRows: [],
    min_guarantee_count: null,
    guarantee_prize_id: null,
  };

  // 2. 尝试获取该 Pool 的最新版本详情（如果列表接口没返回详情，可能需要单独 fetch）
  // 这里假设我们需要单独获取详情来确保拿到 prizes
  loading.value = true;
  try {
    // 假设后端有 GET /api/v2/draw/pools/:id 接口返回详情
    const res = await axios.get(`/api/v2/draw/pools/${pool.id}`);
    if (res.data?.code === 200 && res.data.data?.version) {
      const version = res.data.data.version;
      const prizes = version.prizes || [];
      
      // 回填保底设置
      versionForm.value.min_guarantee_count = version.min_guarantee_count;
      versionForm.value.guarantee_prize_id = version.guarantee_prize_id;

      // 回填奖品列表 (优先转为 Rows 用于 UI 编辑)
      const rows = [];
      const leftoverPrizes = [];

      prizes.forEach(p => {
        if (p.type === 'sku' && p.sku_id) {
          rows.push({
            sku_id: p.sku_id,
            quantity: p.value || 1,
            weight: p.weight || 10
          });
        } else {
          leftoverPrizes.push(p);
        }
      });

      versionForm.value.prizeRows = rows;
      
      // 如果有非 SKU 的奖品，或者是手动填写的 JSON，回填到 Text 区域
      if (leftoverPrizes.length > 0) {
        versionForm.value.prizesText = JSON.stringify(leftoverPrizes, null, 2);
      }
    }
  } catch (e) {
    console.error('获取奖池详情失败', e);
  } finally {
    loading.value = false;
    showVersionModal.value = true;
  }
};

const closeVersionModal = () => {
  showVersionModal.value = false;
  currentPoolId.value = null;
};

const addPrizeRow = () => {
  versionForm.value.prizeRows.push({
    sku_id: null,
    quantity: 1,
    weight: 10,
  });
};

const removePrizeRow = (index) => {
  versionForm.value.prizeRows.splice(index, 1);
};

const buildPrizesFromRows = () => {
  const rows = versionForm.value.prizeRows || [];
  const prizes = [];
  let idx = 1;
  for (const row of rows) {
    if (!row.sku_id) continue;
    const sku = skuMap.value.get(row.sku_id);
    if (!sku) continue;
    prizes.push({
      id: idx++,
      name: sku.name,
      icon: sku.icon || '🎁',
      type: 'sku',
      sku_id: sku.id,
      value: row.quantity || 1,
      weight: row.weight || 1,
    });
  }
  return prizes;
};

const submitVersion = async () => {
  if (!currentPoolId.value) return;
  let prizes;
  try {
    const builtPrizes = buildPrizesFromRows();
    if (builtPrizes.length > 0) {
      prizes = builtPrizes;
    } else {
      prizes = JSON.parse(versionForm.value.prizesText || '[]');
    }
  } catch (e) {
    alert('奖品 JSON 格式错误');
    return;
  }
  saving.value = true;
  try {
    await axios.post(`/api/v2/draw/pools/${currentPoolId.value}/versions`, {
      prizes,
      min_guarantee_count: versionForm.value.min_guarantee_count || undefined,
      guarantee_prize_id: versionForm.value.guarantee_prize_id || undefined,
    });
    closeVersionModal();
    await refresh();
  } finally {
    saving.value = false;
  }
};

const deactivatePool = async (pool) => {
  await axios.delete(`/api/v2/draw/pools/${pool.id}`);
  await refresh();
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
.table-row { display:grid; grid-template-columns:1.2fr 0.8fr 0.8fr 0.8fr 0.8fr 1fr; gap:10px; padding:10px 12px; border-bottom:1px solid rgba(255,255,255,0.08); }
.table-row.header { font-weight:600; background:rgba(255,255,255,0.06); }
.actions { display:flex; gap:8px; }
.link-btn { background:none; border:none; color:#8ab4f8; cursor:pointer; }
.link-btn.danger { color:#ff6b6b; }
.empty { padding:16px; color: rgba(255,255,255,0.5); }
.loading-state { text-align:center; padding: 20px; color: rgba(255,255,255,0.5); }
.modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:1000; }
.modal-content { background:#1a1a2e; padding:24px; border-radius:16px; width:90%; max-width:560px; max-height: 80vh; overflow-y: auto; }
.form-group { margin-bottom:12px; }
.form-group label { display:block; margin-bottom:6px; color: rgba(255,255,255,0.7); font-size:13px; }
.form-group input, .form-group textarea, .form-group select { width:100%; padding:8px; border-radius:8px; border:1px solid rgba(255,255,255,0.2); background:rgba(255,255,255,0.05); color:#fff; }
.prize-builder { display:flex; flex-direction:column; gap:10px; padding:12px; border-radius:12px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.03); }
.prize-row { display:grid; grid-template-columns:1.4fr 0.6fr 0.6fr 0.4fr; gap:10px; align-items:center; }
.prize-row.header { font-weight:600; color: rgba(255,255,255,0.7); }
.modal-actions { display:flex; gap:12px; margin-top:16px; }
.cancel-btn, .confirm-btn { flex:1; padding:10px; border-radius:8px; border:none; cursor:pointer; }
.cancel-btn { background:rgba(255,255,255,0.1); color:#fff; }
.confirm-btn { background:linear-gradient(135deg,#667eea,#764ba2); color:#fff; font-weight:600; }
</style>
