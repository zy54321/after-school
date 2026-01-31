<template>
  <div class="auction-session-manage">
    <nav class="breadcrumb">
      <router-link to="/family/market">市场</router-link>
      <span class="separator">/</span>
      <router-link to="/family/market/admin">市场管理</router-link>
      <span class="separator">/</span>
      <router-link to="/family/market/admin/auction">拍卖场次管理</router-link>
      <span class="separator">/</span>
      <span class="current">{{ session?.title || '加载中...' }}</span>
    </nav>

    <div v-if="session" class="manage-container">
      <header class="page-header">
        <div class="header-left">
          <h1>🎬 导演台：{{ session.title }}</h1>
          <span class="session-status" :class="session.status">
            {{ getStatusLabel(session.status) }}
          </span>
        </div>
        <div class="header-actions">
          <button 
            v-if="session.status === 'active'" 
            class="primary-btn" 
            @click="goToAuction"
          >
            进入拍卖台
          </button>
        </div>
      </header>

      <!-- Tab 导航 -->
      <div class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          class="tab-btn"
          :class="{ active: activeTab === tab.value }"
          @click="activeTab = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Tab 内容 -->
      <div class="tab-content">
        <!-- 基本信息 Tab -->
        <div v-show="activeTab === 'info'" class="tab-panel">
          <div class="info-card">
            <h3>基本信息</h3>
            <div class="info-row">
              <span class="info-label">标题</span>
              <span class="info-value">{{ session.title }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">状态</span>
              <span class="info-value">
                <span class="status-badge" :class="session.status">
                  {{ getStatusLabel(session.status) }}
                </span>
              </span>
            </div>
            <div class="info-row">
              <span class="info-label">预定时间</span>
              <span class="info-value">{{ formatDate(session.scheduled_at) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">最后事件</span>
              <span class="info-value">{{ formatDate(session.last_event_at) }}</span>
            </div>
          </div>
        </div>

        <!-- 池子 Tab -->
        <div v-show="activeTab === 'pool'" class="tab-panel">
          <div class="pool-card">
            <h3>拍卖品池子</h3>
            <div class="pool-stats">
              <span>已选 SKU: {{ poolForm.sku_ids.length }} 个</span>
            </div>
            <div class="pool-list">
              <div v-for="sku in auctionableSkus" :key="sku.id" class="pool-item">
                <label class="pool-item-label">
                  <input type="checkbox" :value="sku.id" v-model="poolForm.sku_ids" />
                  <span class="sku-name">{{ sku.name }}</span>
                </label>
                <div class="pool-item-meta">
                  <span class="rarity-badge" :class="rarityFromWeight(sku.weight_score)">
                    {{ rarityFromWeight(sku.weight_score).toUpperCase() }}
                  </span>
                  <span class="weight-score">{{ sku.weight_score ?? 0 }}</span>
                </div>
              </div>
            </div>
            <div class="pool-actions">
              <button class="save-btn" @click="submitPool" :disabled="saving">
                {{ saving ? '保存中...' : '保存池子' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 拍品 Tab -->
        <div v-show="activeTab === 'lots'" class="tab-panel">
          <div class="lots-card">
            <h3>拍品列表</h3>
            
            <!-- 生成面板 -->
            <div class="generate-panel">
              <h4>生成拍品</h4>
              <div class="generate-form">
                <div class="pool-preview">
                  <div class="pool-preview__title">
                    已勾选池子（{{ selectedPoolSkus.length }}）
                  </div>

                  <div v-if="selectedPoolSkus.length === 0" class="pool-preview__empty">
                    未选择任何商品，请先到「池子」Tab 勾选商品
                  </div>

                  <div v-else class="pool-preview__tags">
                    <el-tag
                      v-for="sku in selectedPoolSkus.slice(0, 20)"
                      :key="sku.id"
                      size="small"
                      style="margin: 4px 6px 0 0;"
                    >
                      {{ sku.name }}
                    </el-tag>

                    <span v-if="selectedPoolSkus.length > 20" class="pool-preview__more">
                      …还有 {{ selectedPoolSkus.length - 20 }} 个
                    </span>
                  </div>
                </div>

                <div class="form-row">
                  <label>总数量</label>
                  <input 
                    type="number" 
                    v-model.number="generateForm.count" 
                    min="1" 
                    placeholder="输入总数量"
                    class="form-input"
                  />
                </div>
                <div class="form-row">
                  <label>
                    <input type="checkbox" v-model="generateForm.unique" />
                    不允许重复 SKU
                  </label>
                </div>
                <div class="form-actions">
                  <button 
                    class="preview-btn" 
                    @click="previewGenerate"
                    :disabled="previewing || !generateForm.count"
                  >
                    {{ previewing ? '生成中...' : '预览生成' }}
                  </button>
                  <button 
                    class="reroll-btn" 
                    @click="rerollPreview"
                    :disabled="previewing || !previewData"
                  >
                    重摇
                  </button>
                  <button 
                    class="commit-append-btn" 
                    @click="commitGenerate(false)"
                    :disabled="committing || !previewData"
                  >
                    {{ committing ? '生成中...' : '确认追加' }}
                  </button>
                  <button 
                    class="commit-replace-btn" 
                    @click="commitGenerate(true)"
                    :disabled="committing || !previewData"
                  >
                    {{ committing ? '生成中...' : '确认替换' }}
                  </button>
                </div>
              </div>
            </div>

            <!-- 预览结果区 -->
            <div class="preview-section" v-if="previewData" v-loading="previewLoading">
              <h4>预览结果</h4>
              <div class="preview-info">
                <span>Seed: {{ previewData.seed }}</span>
                <span>总计: {{ previewData.preview_lots?.length || 0 }} 个</span>
                <span>R: {{ previewData.counts?.r || 0 }} / SR: {{ previewData.counts?.sr || 0 }} / SSR: {{ previewData.counts?.ssr || 0 }} / UR: {{ previewData.counts?.ur || 0 }}</span>
              </div>
              <div class="preview-table" v-if="previewData.preview_lots && previewData.preview_lots.length > 0">
                <div class="preview-header">
                  <div>排序</div>
                  <div>标题</div>
                  <div>稀有度</div>
                  <div>标价</div>
                  <div>拍卖价(7折)</div>
                  <div>锁定</div>
                </div>
                <div class="preview-row" v-for="(lot, index) in previewData.preview_lots" :key="index">
                  <div>{{ lot.sort_order || index + 1 }}</div>
                  <div>{{ lot.sku_name || `拍品#${lot.sku_id}` }}</div>
                  <div>
                    <span class="rarity-badge" :class="lot.rarity">
                      {{ lot.rarity?.toUpperCase() || 'R' }}
                    </span>
                  </div>
                  <div>{{ lot.base_price || lot.reserve_price || lot.start_price || 0 }} 积分</div>
                  <div class="auction-price">
                    <span class="price-highlight">{{ lot.auction_price || lot.reserve_price || lot.start_price || 0 }}</span>
                    <span class="discount-tag">7折</span>
                  </div>
                  <div>
                    <button 
                      class="lock-btn" 
                      :class="{ locked: isLocked(lot.sku_id) }"
                      @click="toggleLock(lot.sku_id)"
                    >
                      {{ isLocked(lot.sku_id) ? '🔒' : '🔓' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 抽奖中动画 -->
            <div class="drawing-animation" v-if="drawing">
              <div class="spinner"></div>
              <p>抽奖中...</p>
            </div>

            <!-- 现有拍品列表 -->
            <div class="existing-lots-section" v-loading="lotsLoading">
              <!-- 可排序拍品 -->
              <div v-if="reorderableLots.length > 0">
                <h4>可排序拍品</h4>
                <div class="lots-table">
                  <div class="lots-header">
                    <div>拖拽</div>
                    <div>排序</div>
                    <div>标题</div>
                    <div>稀有度</div>
                    <div>保留价</div>
                    <div>状态</div>
                    <div>操作</div>
                  </div>
                  <div class="lots-body" ref="lotsBodyRef">
                    <div 
                      class="lots-row" 
                      v-for="(lot, idx) in reorderableLots" 
                      :key="lot.id" 
                      :data-id="lot.id"
                    >
                      <div class="drag-handle">☰</div>
                      <div class="order-col">{{ idx + 1 }}</div>
                      <div>{{ lot.sku_name || lot.title || `拍品#${lot.id}` }}</div>
                      <div>{{ lot.rarity || 'common' }}</div>
                      <div>{{ lot.reserve_price || lot.start_price || 0 }} 积分</div>
                      <div>
                        <span class="lot-status" :class="lot.status">
                          {{ getLotStatusLabel(lot.status) }}
                        </span>
                      </div>
                      <div class="lot-actions">
                        <button 
                          v-if="lot.status === 'pending' && session.status === 'active'"
                          class="activate-btn"
                          @click="activateLot(lot.id)"
                          :disabled="activating"
                        >
                          {{ activating === lot.id ? '激活中...' : '激活此拍品' }}
                        </button>
                        <span v-else class="no-action">-</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 已完成拍品 -->
              <div v-if="finishedLots.length > 0" class="finished-lots-section">
                <h4>已完成（不可排序）</h4>
                <div class="lots-table">
                  <div class="lots-header">
                    <div>-</div>
                    <div>排序</div>
                    <div>标题</div>
                    <div>稀有度</div>
                    <div>保留价</div>
                    <div>状态</div>
                    <div>操作</div>
                  </div>
                  <div class="lots-body">
                    <div 
                      class="lots-row finished" 
                      v-for="(lot, idx) in finishedLots" 
                      :key="lot.id" 
                      :data-id="lot.id"
                    >
                      <div>-</div>
                      <div class="order-col">{{ idx + 1 }}</div>
                      <div>{{ lot.sku_name || lot.title || `拍品#${lot.id}` }}</div>
                      <div>{{ lot.rarity || 'common' }}</div>
                      <div>{{ lot.reserve_price || lot.start_price || 0 }} 积分</div>
                      <div>
                        <span class="lot-status" :class="lot.status">
                          {{ getLotStatusLabel(lot.status) }}
                        </span>
                      </div>
                      <div class="lot-actions">
                        <span class="no-action">-</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="empty" v-if="lots.length === 0">暂无拍品</div>
            </div>
          </div>
        </div>

        <!-- 进度 Tab -->
        <div v-show="activeTab === 'progress'" class="tab-panel">
          <div class="progress-card">
            <h3>拍卖进度</h3>
            
            <!-- 当前拍品 -->
            <div class="current-lot-section" v-if="session.active_lot">
              <h4>当前拍品</h4>
              <div class="current-lot-card">
                <div class="lot-info">
                  <div class="lot-title">{{ session.active_lot.title }}</div>
                  <div class="lot-status-badge" :class="session.active_lot.status">
                    {{ getLotStatusLabel(session.active_lot.status) }}
                  </div>
                </div>
                <button class="go-to-auction-btn" @click="goToAuction">
                  进入拍卖台
                </button>
              </div>
            </div>
            <div v-else class="no-active-lot">
              <p>暂无当前拍品</p>
            </div>

            <!-- 统计信息 -->
            <div class="stats-section">
              <h4>统计信息</h4>
              <div class="stats-grid">
                <div class="stat-item">
                  <div class="stat-value">{{ session.lot_count || 0 }}</div>
                  <div class="stat-label">总拍品</div>
                </div>
                <div class="stat-item">
                  <div class="stat-value">{{ session.open_count || 0 }}</div>
                  <div class="stat-label">竞拍中</div>
                </div>
                <div class="stat-item">
                  <div class="stat-value">{{ session.sold_count || 0 }}</div>
                  <div class="stat-label">已成交</div>
                </div>
                <div class="stat-item">
                  <div class="stat-value">{{ session.unsold_count || 0 }}</div>
                  <div class="stat-label">流拍</div>
                </div>
                <div class="stat-item">
                  <div class="stat-value">{{ session.bidder_count || 0 }}</div>
                  <div class="stat-label">出价者</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="loading-state" v-else-if="loading">
      加载中...
    </div>

    <div class="empty-state" v-else>
      <p>拍卖场次不存在</p>
      <router-link to="/family/market/admin/auction" class="back-btn">返回列表</router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, nextTick, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import { ElMessage, ElMessageBox, ElTag } from 'element-plus';
import Sortable from 'sortablejs';

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const lotsLoading = ref(false);      // 现有拍品 loading
const previewLoading = ref(false);   // 预览生成 loading
const saving = ref(false);
const activating = ref(null);
const session = ref(null);
const lots = ref([]);
const auctionableSkus = ref([]);
const activeTab = ref('info');

// 拆分可排序和已完成的拍品
const reorderableLots = computed(() => lots.value.filter(l => ['pending', 'active'].includes(l.status)));
const finishedLots = computed(() => lots.value.filter(l => ['sold', 'unsold'].includes(l.status)));

// 根据当前勾选的池子 SKU IDs 找到 SKU 名称
const selectedPoolSkus = computed(() => {
  const ids = new Set((poolForm.value.sku_ids || []).map(Number));
  return auctionableSkus.value.filter(s => ids.has(Number(s.id)));
});

const poolForm = ref({
  sku_ids: [],
});

// 生成拍品相关
const generateForm = ref({
  count: 10,
  unique: false,
});

const previewData = ref(null);
const previewing = ref(false);
const committing = ref(false);
const drawing = ref(false);
const lockedSkuIds = ref(new Set());

// 拖拽排序相关
const lotsBodyRef = ref(null);
let sortableInst = null;

const tabs = [
  { label: '基本信息', value: 'info' },
  { label: '池子', value: 'pool' },
  { label: '拍品', value: 'lots' },
  { label: '进度', value: 'progress' },
];

// 加载场次详情
const loadSession = async () => {
  const sessionId = route.params.id;
  if (!sessionId) return;
  
  loading.value = true;
  try {
    // 从 admin 列表接口获取基本信息
    const adminRes = await axios.get('/api/v2/auction/sessions-admin');
    if (adminRes.data?.code === 200) {
      const sessions = adminRes.data.data?.sessions || [];
      session.value = sessions.find(s => s.id === parseInt(sessionId)) || null;
    }
    
    // 并行加载其他数据
    await Promise.all([
      loadLots(),
      loadAuctionableSkus(),
      loadPoolConfig(),
    ]);
  } catch (err) {
    console.error('加载场次详情失败:', err);
    ElMessage.error(err.response?.data?.msg || '加载场次详情失败');
  } finally {
    loading.value = false;
  }
};

// 加载拍品列表
const loadLots = async () => {
  const sessionId = route.params.id;
  lotsLoading.value = true;
  try {
    const res = await axios.get(`/api/v2/auction/sessions/${sessionId}`);
    if (res.data?.code === 200) {
      const data = res.data.data;
      lots.value = data.lots || [];
    }
  } catch (err) {
    console.error('加载拍品列表失败:', err);
  } finally {
    lotsLoading.value = false;
  }
};

// 加载可拍卖 SKU
const loadAuctionableSkus = async () => {
  try {
    const res = await axios.get('/api/v2/auction/skus');
    if (res.data?.code === 200) {
      auctionableSkus.value = res.data.data?.skus || [];
    }
  } catch (err) {
    console.error('加载 SKU 列表失败:', err);
  }
};

// 加载池子配置（从 session.config 读取）
const loadPoolConfig = async () => {
  const sessionId = route.params.id;
  try {
    const res = await axios.get(`/api/v2/auction/sessions/${sessionId}`);
    if (res.data?.code === 200) {
      const data = res.data.data;
      const config = data.config || {};
      if (Array.isArray(config.pool_sku_ids)) {
        poolForm.value.sku_ids = config.pool_sku_ids.map(id => parseInt(id));
      }
    }
  } catch (err) {
    console.error('加载池子配置失败:', err);
  }
};

// 保存池子
const submitPool = async () => {
  const sessionId = route.params.id;
  if (!poolForm.value.sku_ids.length) {
    ElMessage.warning('请选择至少一个 SKU');
    return;
  }
  saving.value = true;
  try {
    const resp = await axios.post(`/api/v2/auction/sessions/${sessionId}/pool`, {
      sku_ids: poolForm.value.sku_ids,
    });
    
    // ✅ 兼容回填：从接口返回值读取池子ID（兼容多种字段名）
    const serverPoolIds =
      resp?.data?.data?.config?.pool_sku_ids ??
      resp?.data?.data?.pool_sku_ids ??
      resp?.data?.data?.sku_ids ??
      null;

    if (Array.isArray(serverPoolIds)) {
      poolForm.value.sku_ids = serverPoolIds.map(Number); // ✅ 回填勾选
    }
    
    ElMessage.success('池子已保存');
    
    // ✅ 本地同步：保证其他依赖 session.config 的地方立即正确
    session.value = session.value || {};
    session.value.config = session.value.config || {};
    session.value.config.pool_sku_ids = [...(poolForm.value.sku_ids || [])].map(Number);
    
    await loadSession(); // 刷新数据
  } catch (err) {
    ElMessage.error(err.response?.data?.msg || '保存池子失败');
  } finally {
    saving.value = false;
  }
};

// 激活拍品
const activateLot = async (lotId) => {
  const sessionId = route.params.id;
  try {
    await ElMessageBox.confirm('确认激活此拍品？', '确认激活', {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'warning',
    });
    
    activating.value = lotId;
    try {
      const res = await axios.post(`/api/v2/auction/sessions/${sessionId}/activate-lot`, {
        lot_id: lotId,
      });
      if (res.data?.code === 200) {
        ElMessage.success('拍品已激活');
        await loadSession(); // 刷新数据
      }
    } catch (err) {
      ElMessage.error(err.response?.data?.msg || '激活拍品失败');
    } finally {
      activating.value = null;
    }
  } catch {
    // 用户取消
  }
};

// 进入拍卖台
const goToAuction = () => {
  router.push(`/family/auction/${route.params.id}`);
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

// 获取拍品状态标签
const getLotStatusLabel = (status) => {
  const labels = {
    pending: '待拍',
    active: '竞拍中',
    sold: '已成交',
    unsold: '流拍',
    cancelled: '已取消',
  };
  return labels[status] || status;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '未设置';
  return new Date(dateStr).toLocaleString('zh-CN');
};

// 预览生成
const previewGenerate = async () => {
  const sessionId = route.params.id;
  if (!generateForm.value.count || generateForm.value.count < 1) {
    ElMessage.warning('请输入有效的总数量');
    return;
  }
  
  previewLoading.value = true;
  previewing.value = true;
  drawing.value = true;
  
  try {
    // 显示动画 800-1200ms
    const animationDuration = 800 + Math.random() * 400;
    const startTime = Date.now();
    
    const res = await axios.post(`/api/v2/auction/sessions/${sessionId}/lots/preview-generate`, {
      count: generateForm.value.count,
      unique: generateForm.value.unique,
      locked_sku_ids: Array.from(lockedSkuIds.value),
    });
    
    // 确保动画至少显示指定时长
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, animationDuration - elapsed);
    if (remaining > 0) {
      await new Promise(resolve => setTimeout(resolve, remaining));
    }
    
    if (res.data?.code === 200) {
      previewData.value = res.data.data;
      ElMessage.success('预览生成成功');
    } else {
      ElMessage.error(res.data?.msg || '预览生成失败');
    }
  } catch (err) {
    console.error('预览生成失败:', err);
    ElMessage.error(err.response?.data?.msg || '预览生成失败');
  } finally {
    previewLoading.value = false;
    previewing.value = false;
    drawing.value = false;
  }
};

// 重摇
const rerollPreview = async () => {
  // 使用新的 seed（不传 seed 参数，让后端自动生成）
  await previewGenerate();
};

// 确认生成
const commitGenerate = async (replace) => {
  if (!previewData.value || !previewData.value.preview_lots || previewData.value.preview_lots.length === 0) {
    ElMessage.warning('请先生成预览');
    return;
  }
  
  try {
    await ElMessageBox.confirm(
      replace 
        ? '确认替换现有拍品？此操作将清空未成交的拍品并生成新拍品。' 
        : '确认追加拍品？新拍品将添加到现有拍品列表末尾。',
      '确认生成',
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );
    
    committing.value = true;
    const sessionId = route.params.id;
    
    const res = await axios.post(`/api/v2/auction/sessions/${sessionId}/lots/commit-generate`, {
      seed: previewData.value.seed,
      preview_lots: previewData.value.preview_lots,
      replace,
    });
    
    if (res.data?.code === 200) {
      ElMessage.success(res.data.msg || '拍品已生成');
      // 清空预览数据
      previewData.value = null;
      lockedSkuIds.value.clear();
      // 刷新拍品列表
      await loadLots();
      // 刷新 session（更新统计信息）
      await loadSession();
    } else {
      ElMessage.error(res.data?.msg || '确认生成失败');
    }
  } catch (err) {
    if (err !== 'cancel') {
      console.error('确认生成失败:', err);
      ElMessage.error(err.response?.data?.msg || '确认生成失败');
    }
  } finally {
    committing.value = false;
  }
};

// 锁定/解锁 SKU
const toggleLock = (skuId) => {
  if (lockedSkuIds.value.has(skuId)) {
    lockedSkuIds.value.delete(skuId);
  } else {
    lockedSkuIds.value.add(skuId);
  }
};

// 检查 SKU 是否锁定
const isLocked = (skuId) => {
  return lockedSkuIds.value.has(skuId);
};

// 根据 weight_score 映射稀有度
const rarityFromWeight = (score) => {
  const s = Number(score) || 0;
  if (s >= 90) return 'ur';
  if (s >= 75) return 'ssr';
  if (s >= 50) return 'sr';
  return 'r';
};

// 初始化拖拽排序
const initSortable = async () => {
  await nextTick();
  if (!lotsBodyRef.value) return;

  if (sortableInst) {
    sortableInst.destroy();
    sortableInst = null;
  }

  sortableInst = new Sortable(lotsBodyRef.value, {
    animation: 150,
    handle: '.drag-handle',
    ghostClass: 'drag-ghost',
    filter: '.non-draggable', // 过滤掉已成交/流拍的拍品
    onEnd: async () => {
      // 只从 reorderable 容器收集 ids
      const ids = Array.from(lotsBodyRef.value.children)
        .map(el => parseInt(el.dataset.id))
        .filter(Boolean);

      // 同步本地顺序（只更新 reorderableLots 的顺序）
      const reorderableMap = new Map(reorderableLots.value.map(l => [l.id, l]));
      const finishedMap = new Map(finishedLots.value.map(l => [l.id, l]));
      
      // 重新组合：先 reorderable（按新顺序），后 finished（保持原顺序）
      const reorderedReorderable = ids.map(id => reorderableMap.get(id)).filter(Boolean).map((l, idx) => ({
        ...l,
        sort_order: (idx + 1) * 10
      }));
      
      lots.value = [...reorderedReorderable, ...finishedLots.value];

      // 落库
      try {
        await axios.post(`/api/v2/auction/sessions/${route.params.id}/lots/reorder`, {
          ordered_lot_ids: ids
        });
        ElMessage.success('排序已保存');
      } catch (err) {
        ElMessage.error(err.response?.data?.msg || '排序保存失败，已刷新恢复');
        await loadLots();
      }
    },
  });
};

// 监听切 tab / loads 后自动 init
watch(activeTab, (v) => {
  if (v === 'lots') initSortable();
});

watch(lots, () => {
  if (activeTab.value === 'lots') initSortable();
});

onMounted(() => {
  loadSession();
});
</script>

<style scoped>
.auction-session-manage {
  color: #fff;
  min-height: calc(100vh - 70px);
}

.breadcrumb {
  margin-bottom: 24px;
  font-size: 14px;
}

.breadcrumb a {
  color: rgba(255, 255, 255, 0.6);
  text-decoration: none;
}

.breadcrumb a:hover {
  color: #fff;
}

.breadcrumb .separator {
  margin: 0 8px;
  color: rgba(255, 255, 255, 0.4);
}

.breadcrumb .current {
  color: #fff;
}

.manage-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-left h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}

.session-status {
  padding: 6px 12px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
}

.session-status.draft {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
}

.session-status.scheduled {
  background: rgba(255, 193, 7, 0.2);
  color: #ffc107;
}

.session-status.active {
  background: rgba(79, 172, 254, 0.2);
  color: #4facfe;
}

.session-status.ended {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);
}

.primary-btn {
  padding: 10px 20px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border: none;
  border-radius: 10px;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}

.tabs {
  display: flex;
  gap: 8px;
  border-bottom: 2px solid rgba(255, 255, 255, 0.1);
}

.tab-btn {
  padding: 12px 24px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-bottom: -2px;
}

.tab-btn:hover {
  color: #fff;
}

.tab-btn.active {
  color: #4facfe;
  border-bottom-color: #4facfe;
}

.tab-content {
  padding: 24px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
}

.tab-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.info-card,
.pool-card,
.lots-card,
.progress-card {
  padding: 20px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
}

.info-card h3,
.pool-card h3,
.lots-card h3,
.progress-card h3 {
  margin: 0 0 16px;
  font-size: 18px;
  font-weight: 600;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  color: rgba(255, 255, 255, 0.6);
}

.info-value {
  font-weight: 600;
}

.pool-stats {
  margin-bottom: 16px;
  color: rgba(255, 255, 255, 0.7);
}

.pool-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.pool-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  transition: all 0.3s ease;
}

.pool-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.pool-item-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.pool-item-label input[type="checkbox"] {
  cursor: pointer;
}

.sku-name {
  flex: 1;
  font-weight: 600;
}

.pool-item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.weight-score {
  color: rgba(255, 255, 255, 0.6);
  min-width: 30px;
}

.pool-actions {
  display: flex;
  justify-content: flex-end;
}

.save-btn {
  padding: 10px 24px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border: none;
  border-radius: 10px;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.lots-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lots-header {
  display: grid;
  grid-template-columns: 0.5fr 0.5fr 2fr 0.8fr 1fr 0.8fr 1.2fr;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
}

.lots-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lots-row {
  display: grid;
  grid-template-columns: 0.5fr 0.5fr 2fr 0.8fr 1fr 0.8fr 1.2fr;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  align-items: center;
  cursor: move;
  transition: all 0.3s ease;
}

.lots-row:hover {
  background: rgba(255, 255, 255, 0.05);
}

.lots-row.non-draggable {
  cursor: default;
  opacity: 0.6;
}

.drag-handle {
  cursor: grab;
  font-size: 18px;
  color: rgba(255, 255, 255, 0.5);
  user-select: none;
  text-align: center;
}

.drag-handle:active {
  cursor: grabbing;
}

.drag-ghost {
  opacity: 0.5;
  background: rgba(79, 172, 254, 0.2);
}

.lot-status {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.lot-status.pending {
  background: rgba(255, 193, 7, 0.2);
  color: #ffc107;
}

.lot-status.active {
  background: rgba(79, 172, 254, 0.2);
  color: #4facfe;
}

.lot-status.sold {
  background: rgba(76, 175, 80, 0.2);
  color: #4caf50;
}

.lot-status.unsold {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);
}

.activate-btn {
  padding: 6px 12px;
  background: rgba(79, 172, 254, 0.2);
  border: 1px solid rgba(79, 172, 254, 0.3);
  border-radius: 6px;
  color: #4facfe;
  font-size: 12px;
  cursor: pointer;
}

.activate-btn:hover:not(:disabled) {
  background: rgba(79, 172, 254, 0.3);
}

.activate-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.no-action {
  color: rgba(255, 255, 255, 0.3);
  font-size: 12px;
}

.current-lot-section {
  margin-bottom: 24px;
}

.current-lot-section h4 {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
}

.current-lot-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: rgba(79, 172, 254, 0.1);
  border: 1px solid rgba(79, 172, 254, 0.3);
  border-radius: 12px;
}

.lot-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.lot-title {
  font-size: 18px;
  font-weight: 600;
}

.lot-status-badge {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.lot-status-badge.active {
  background: rgba(79, 172, 254, 0.2);
  color: #4facfe;
}

.go-to-auction-btn {
  padding: 10px 20px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border: none;
  border-radius: 10px;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}

.no-active-lot {
  padding: 40px;
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
}

.stats-section h4 {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
}

.stat-item {
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  text-align: center;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #4facfe;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.empty {
  padding: 40px;
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: rgba(255, 255, 255, 0.5);
}

.back-btn {
  display: inline-block;
  margin-top: 16px;
  padding: 10px 20px;
  background: rgba(79, 172, 254, 0.2);
  border: 1px solid rgba(79, 172, 254, 0.3);
  border-radius: 10px;
  color: #4facfe;
  text-decoration: none;
  transition: all 0.3s ease;
}

.back-btn:hover {
  background: rgba(79, 172, 254, 0.3);
  border-color: rgba(79, 172, 254, 0.5);
}

/* 生成面板样式 */
.generate-panel {
  margin-bottom: 24px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
}

.generate-panel h4 {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
}

.generate-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pool-preview {
  margin-bottom: 10px;
  padding: 10px;
  border: 1px dashed #ddd;
  border-radius: 8px;
}

.pool-preview__title {
  font-weight: 600;
  margin-bottom: 6px;
}

.pool-preview__empty {
  color: #999;
}

.pool-preview__more {
  margin-left: 8px;
  color: #999;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.form-row label {
  min-width: 100px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
}

.form-input {
  flex: 1;
  max-width: 200px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
}

.form-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.preview-btn,
.reroll-btn,
.commit-append-btn,
.commit-replace-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.preview-btn {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
}

.reroll-btn {
  background: rgba(255, 193, 7, 0.2);
  border: 1px solid rgba(255, 193, 7, 0.3);
  color: #ffc107;
}

.commit-append-btn {
  background: rgba(76, 175, 80, 0.2);
  border: 1px solid rgba(76, 175, 80, 0.3);
  color: #4caf50;
}

.commit-replace-btn {
  background: rgba(244, 67, 54, 0.2);
  border: 1px solid rgba(244, 67, 54, 0.3);
  color: #f44336;
}

.preview-btn:hover:not(:disabled),
.reroll-btn:hover:not(:disabled),
.commit-append-btn:hover:not(:disabled),
.commit-replace-btn:hover:not(:disabled) {
  opacity: 0.8;
  transform: translateY(-2px);
}

.preview-btn:disabled,
.reroll-btn:disabled,
.commit-append-btn:disabled,
.commit-replace-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 预览结果区样式 */
.preview-section {
  margin-bottom: 24px;
  padding: 20px;
  background: rgba(79, 172, 254, 0.05);
  border: 1px solid rgba(79, 172, 254, 0.2);
  border-radius: 12px;
}

.preview-section h4 {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
  color: #4facfe;
}

.preview-info {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
}

.auction-price {
  display: flex;
  align-items: center;
  gap: 6px;
}

.price-highlight {
  font-weight: 600;
  color: #ffd700;
  font-size: 15px;
}

.discount-tag {
  font-size: 10px;
  padding: 2px 6px;
  background: rgba(255, 215, 0, 0.2);
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 4px;
  color: #ffd700;
}

.preview-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-header {
  display: grid;
  grid-template-columns: 0.5fr 2fr 0.8fr 1fr 1.2fr 0.8fr;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
}

.preview-row {
  display: grid;
  grid-template-columns: 0.5fr 2fr 0.8fr 1fr 1.2fr 0.8fr;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  align-items: center;
}

.rarity-badge {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.rarity-badge.r {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
}

.rarity-badge.sr {
  background: rgba(79, 172, 254, 0.2);
  color: #4facfe;
}

.rarity-badge.ssr {
  background: rgba(156, 39, 176, 0.2);
  color: #9c27b0;
}

.rarity-badge.ur {
  background: rgba(255, 193, 7, 0.2);
  color: #ffc107;
}

.lock-btn {
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.lock-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.lock-btn.locked {
  background: rgba(255, 193, 7, 0.2);
  border-color: rgba(255, 193, 7, 0.3);
}

/* 抽奖中动画 */
.drawing-animation {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  background: rgba(255, 255, 255, 0.03);
  border: 2px dashed rgba(79, 172, 254, 0.3);
  border-radius: 12px;
  margin-bottom: 24px;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(79, 172, 254, 0.2);
  border-top-color: #4facfe;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.drawing-animation p {
  margin-top: 16px;
  font-size: 16px;
  font-weight: 600;
  color: #4facfe;
}

/* 现有拍品区域 */
.existing-lots-section > div:first-child {
  margin-bottom: 32px;
}

.finished-lots-section {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  opacity: 0.7;
}

.finished-lots-section h4 {
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  margin-bottom: 12px;
}

/* 现有拍品区域 */
.existing-lots-section {
  margin-top: 24px;
}

.existing-lots-section h4 {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
}
</style>
