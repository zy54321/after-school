<template>
  <div class="member-wallet-view h-full flex flex-col p-6 pt-4 box-border">

    <section
      class="wallet-section flex-1 flex flex-col min-h-0 bg-[#151520] rounded-2xl border border-white/5 overflow-hidden">

      <div class="flex justify-between items-center p-3 border-b border-white/5 bg-[#1a1a2e] flex-none">
        <h2 class="text-base font-bold flex items-center gap-2 text-white">
          <span>📜</span> 积分流水
        </h2>
        <div class="relative">
          <select v-model="filter.reasonCode" @change="loadLogs"
            class="filter-select appearance-none pl-3 pr-8 py-1 bg-[#252538] border border-white/10 rounded-lg text-xs text-gray-300 focus:border-blue-500 focus:outline-none transition-colors cursor-pointer hover:bg-[#2a2a40]">
            <option value="">全部类型</option>
            <option value="reward">🎁 兑换</option>
            <option value="bounty">📜 悬赏</option>
            <option value="auction">🔨 拍卖</option>
            <option value="lottery">🎰 抽奖</option>
            <option value="grant">🤲 发放</option>
            <option value="refund">↩️ 退款</option>
            <option value="manual">✍️ 手动</option>
          </select>
          <div class="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 text-xs">▼</div>
        </div>
      </div>

      <div class="logs-list flex-1 overflow-y-auto custom-scroll p-3">
        <div v-if="logs.length > 0">
          <div v-for="log in logs" :key="log.id"
            class="log-item mb-1.5 flex items-center gap-3 px-3 py-2.5 bg-[#252538] rounded-xl border border-white/5 group relative overflow-hidden transition-all hover:bg-[#2a2a40] hover:border-white/10 hover:shadow-md">

            <div class="log-icon w-8 h-8 rounded-full flex-none flex items-center justify-center text-sm shadow-inner"
              :class="log.points_change > 0 ? 'bg-gradient-to-br from-green-400/20 to-emerald-600/20 text-green-400' : 'bg-gradient-to-br from-red-400/20 to-rose-600/20 text-red-400'">
              {{ log.points_change > 0 ? '↗' : '↘' }}
            </div>

            <div class="log-content flex-1 min-w-0 flex flex-col justify-center">
              <div class="text-[14px] font-bold text-gray-100 truncate pr-2 leading-tight">{{ log.description }}</div>
              <div class="flex gap-2 mt-0.5 items-center">
                <span class="text-[10px] text-gray-500 font-mono">{{ formatTime(log.created_at) }}</span>
                <span class="text-[9px] px-1.5 py-0 rounded-full bg-white/5 text-gray-400 border border-white/5">{{
                  getReasonLabel(log.reason_code) }}</span>
              </div>
            </div>

            <div class="flex flex-col items-end gap-1 flex-none justify-center">
              <div class="font-bold text-base tabular-nums tracking-tight leading-none"
                :class="log.points_change > 0 ? 'text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500' : 'text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-rose-500'">
                {{ log.points_change > 0 ? '+' : '' }}{{ log.points_change }}
              </div>

              <button
                class="modern-btn danger-soft opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0"
                @click="handleRevoke(log)" title="撤销此记录">
                撤销
              </button>
            </div>
          </div>

          <button v-if="hasMore" @click="loadMore"
            class="w-full mt-3 py-2 bg-white/5 border border-white/5 rounded-lg text-xs text-gray-400 hover:bg-white/10 hover:text-white transition-all"
            :disabled="loading">
            {{ loading ? '加载中...' : '加载更多' }}
          </button>
        </div>

        <div class="h-full flex flex-col items-center justify-center text-gray-500 pb-10" v-else>
          <div class="text-4xl mb-3 opacity-30">📜</div>
          <div class="text-sm">暂无积分流水记录</div>
        </div>
      </div>
    </section>

    <div
      class="modal-overlay fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity"
      v-if="showAdjustModal" @click.self="closeAdjustModal">
      <div
        class="modal-content bg-[#1e1e2d] border border-white/10 shadow-2xl p-0 rounded-3xl w-[90%] max-w-[440px] overflow-hidden transform transition-all scale-100">

        <div class="px-6 py-5 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
          <h3 class="text-lg font-bold text-white flex items-center gap-2">
            <span class="text-2xl">{{ adjustForm.type === 'add' ? '✨' : '⚠️' }}</span>
            {{ adjustForm.type === 'add' ? '奖励加分' : '惩罚扣分' }}
          </h3>
          <div class="flex items-center gap-2">
            <button @click="openManageModal" class="modern-btn small neutral">
              <span>⚙️ 预设</span>
            </button>
            <button @click="closeAdjustModal"
              class="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors">
              <span class="text-lg leading-none">&times;</span>
            </button>
          </div>
        </div>

        <div class="p-6">
          <div class="presets-area mb-6">
            <div class="flex justify-between items-center mb-3">
              <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">快捷选择</span>
              <div class="flex gap-2 overflow-x-auto no-scrollbar max-w-[70%] justify-end">
                <button v-for="cat in presetCategories" :key="cat" @click="activeCategory = cat"
                  class="text-[10px] px-2 py-0.5 rounded-full border transition-all whitespace-nowrap"
                  :class="activeCategory === cat ? 'bg-white text-[#1e1e2d] border-white font-bold' : 'text-gray-500 border-white/10 hover:border-white/30'">
                  {{ cat }}
                </button>
              </div>
            </div>

            <div class="grid grid-cols-3 gap-2.5 max-h-[190px] overflow-y-auto overflow-x-hidden custom-scroll pr-1">
              <div v-for="preset in filteredPresets" :key="preset.id" @click="applyPreset(preset)"
                class="cursor-pointer relative group p-3 rounded-xl border transition-all duration-200 flex flex-col items-center justify-center gap-1.5 text-center min-h-[80px]"
                :class="adjustForm.reason === preset.label
                  ? (adjustForm.type === 'add' ? 'bg-blue-500/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-red-500/20 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.3)]')
                  : 'bg-[#252538] border-transparent hover:bg-[#2a2a40] hover:border-white/10'">
                <div class="text-2xl transform group-hover:scale-110 transition-transform">{{ preset.icon }}</div>
                <div class="text-xs text-gray-300 font-medium truncate w-full px-1">{{ preset.label }}</div>
                <div class="text-[9px] text-gray-500 absolute top-1 left-1.5 opacity-50">{{ preset.category || '常规' }}
                </div>

                <div class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-black/20 mt-1"
                  :class="adjustForm.type === 'add' ? 'text-blue-400' : 'text-red-400'">
                  {{ adjustForm.type === 'add' ? '+' : '-' }}{{ preset.points }}
                </div>

                <div v-if="adjustForm.reason === preset.label" class="absolute top-1 right-1 w-2 h-2 rounded-full"
                  :class="adjustForm.type === 'add' ? 'bg-blue-400' : 'bg-red-400'"></div>
              </div>

              <div v-if="filteredPresets.length === 0"
                class="col-span-3 py-8 flex flex-col items-center justify-center text-gray-500 border-2 border-dashed border-white/5 rounded-xl bg-white/[0.02]">
                <span class="text-2xl mb-2">📭</span>
                <span class="text-xs">该分类下暂无预设</span>
              </div>
            </div>
          </div>

          <div class="relative flex items-center justify-center my-6">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-white/10"></div>
            </div>
            <span class="relative bg-[#1e1e2d] px-3 text-xs text-gray-500 uppercase tracking-widest font-medium">或
              手动输入</span>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-xs font-medium text-gray-400 mb-1.5 ml-1">积分数额</label>
              <div class="relative">
                <input type="number" v-model.number="adjustForm.points" min="1"
                  class="w-[342px] max-w-full bg-[#252538] text-white text-base font-bold border border-white/10 rounded-xl px-3 py-2.5 pl-10 focus:ring-2 focus:border-transparent transition-all outline-none"
                  :class="adjustForm.type === 'add' ? 'focus:ring-blue-500/50' : 'focus:ring-red-500/50'" />
                <div class="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-base">
                  {{ adjustForm.type === 'add' ? '+' : '-' }}
                </div>
              </div>
            </div>

            <div>
              <label class="block text-xs font-medium text-gray-400 mb-1.5 ml-1">变动原因</label>
              <input v-model="adjustForm.reason" placeholder="请输入原因..."
                class="w-[372px] max-w-full bg-[#252538] text-white border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:border-transparent transition-all outline-none placeholder-gray-600"
                :class="adjustForm.type === 'add' ? 'focus:ring-blue-500/50' : 'focus:ring-red-500/50'" />
            </div>
          </div>

          <div class="flex gap-3 mt-8">
            <button class="modern-btn neutral flex-1" @click="closeAdjustModal">
              取消
            </button>
            <button class="modern-btn flex-[2]" :class="adjustForm.type === 'add' ? 'primary-blue' : 'primary-red'"
              @click="submitAdjust" :disabled="adjusting">
              <span v-if="adjusting"
                class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></span>
              {{ adjusting ? '提交中...' : '确认提交' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      class="modal-overlay fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[60] transition-opacity"
      v-if="showManageModal" @click.self="closeManageModal">
      <div
        class="modal-content bg-[#1e1e2d] border border-white/10 shadow-2xl rounded-3xl w-[90%] max-w-[500px] h-[85vh] flex flex-col overflow-hidden">

        <div class="px-6 py-4 border-b border-white/5 bg-white/[0.02] flex justify-between items-center flex-none">
          <h3 class="text-lg font-bold text-white flex items-center gap-2">
            <span>⚙️</span> 管理快捷预设
          </h3>
          <button @click="closeManageModal"
            class="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors">
            <span class="text-lg leading-none">&times;</span>
          </button>
        </div>

        <div class="px-6 pt-4 pb-2 flex-none flex flex-col gap-2">
          <div class="flex gap-2 overflow-x-auto no-scrollbar">
            <button v-for="cat in manageCategories" :key="cat" @click="activeManageCategory = cat"
              class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap border" :class="activeManageCategory === cat
                ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                : 'bg-[#252538] border-white/5 text-gray-400 hover:bg-[#32324a] hover:text-white'">
              {{ cat }}
            </button>
          </div>

          <div v-if="activeManageCategory !== '全部' && activeManageCategory !== '常规'"
            class="flex items-center justify-between bg-blue-500/10 border border-blue-500/20 px-3 py-2 rounded-lg">
            <div class="text-xs text-blue-300">
              当前分类：<span class="font-bold text-white">{{ activeManageCategory }}</span>
            </div>
            <div class="flex gap-2">
              <button @click="renameCategory(activeManageCategory)"
                class="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded transition-colors">
                ✏️ 重命名
              </button>
              <button @click="deleteCategory(activeManageCategory)"
                class="text-[10px] bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded transition-colors">
                🗑️ 删除分类
              </button>
            </div>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto custom-scroll px-4 pb-4 space-y-2.5 pt-2">
          <div v-for="preset in filteredManagePresets" :key="preset.id"
            class="flex items-center justify-between p-3.5 bg-[#252538] rounded-xl border border-white/5 group hover:border-white/10 transition-colors">
            <div class="flex items-center gap-4">
              <span class="text-3xl bg-black/20 w-12 h-12 flex items-center justify-center rounded-lg">{{ preset.icon
                }}</span>
              <div>
                <div class="font-bold text-sm text-gray-100">{{ preset.label }}</div>
                <div class="text-xs mt-1 inline-flex items-center gap-1.5"
                  :class="preset.type === 'add' ? 'text-blue-400' : 'text-red-400'">
                  <span class="w-1.5 h-1.5 rounded-full"
                    :class="preset.type === 'add' ? 'bg-blue-500' : 'bg-red-500'"></span>
                  {{ preset.type === 'add' ? '加分' : '扣分' }} <span class="font-bold">{{ preset.points }}</span>
                  <template v-if="activeManageCategory === '全部'">
                    <span class="text-gray-600 mx-1">|</span>
                    <span class="text-gray-500">{{ preset.category || '常规' }}</span>
                  </template>
                </div>
              </div>
            </div>
            <div
              class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
              <button @click="editPreset(preset)"
                class="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 flex items-center justify-center transition-colors">✏️</button>
              <button @click="deletePreset(preset.id)"
                class="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 flex items-center justify-center transition-colors">🗑️</button>
            </div>
          </div>

          <div v-if="filteredManagePresets.length === 0"
            class="h-full flex flex-col items-center justify-center text-gray-500 opacity-50 py-10">
            <span class="text-4xl mb-2">📝</span>
            <span class="text-sm">此分类下暂无预设</span>
          </div>
        </div>

        <div class="bg-[#151520] p-5 flex-none border-t border-white/10">
          <div class="flex items-center justify-between mb-4">
            <div class="text-sm font-bold text-gray-200 flex items-center gap-2">
              <span class="w-1 h-4 rounded-full bg-blue-500"></span>
              {{ editingPreset ? '编辑预设' : '新增预设' }}
            </div>
            <button v-if="editingPreset" @click="resetPresetForm"
              class="text-xs text-gray-500 hover:text-white underline">取消编辑</button>
          </div>

          <div class="grid grid-cols-4 gap-3 mb-3">
            <div class="col-span-3">
              <label class="text-[10px] uppercase font-bold text-gray-500 block mb-1.5 ml-1">名称</label>
              <input v-model="presetForm.label"
                class="w-[calc(100%-20px)] p-2 bg-[#252538] border border-white/10 rounded-lg text-sm text-white focus:border-blue-500 outline-none transition-colors"
                placeholder="如: 做家务" />
            </div>
            <div>
              <label class="text-[10px] uppercase font-bold text-gray-500 block mb-1.5 ml-1">图标</label>
              <input v-model="presetForm.icon"
                class="w-[calc(100%-20px)] p-2 bg-[#252538] border border-white/10 rounded-lg text-sm text-center text-white focus:border-blue-500 outline-none transition-colors"
                placeholder="🧹" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label class="text-[10px] uppercase font-bold text-gray-500 block mb-1.5 ml-1">类型</label>
              <select v-model="presetForm.type"
                class="w-[calc(100%-20px)] p-2 bg-[#252538] border border-white/10 rounded-lg text-sm text-white focus:border-blue-500 outline-none transition-colors appearance-none">
                <option value="add">➕ 奖励加分</option>
                <option value="deduct">➖ 惩罚扣分</option>
              </select>
            </div>
            <div>
              <label class="text-[10px] uppercase font-bold text-gray-500 block mb-1.5 ml-1">分值</label>
              <input type="number" v-model.number="presetForm.points"
                class="w-[calc(100%-20px)] p-2 bg-[#252538] border border-white/10 rounded-lg text-sm text-white focus:border-blue-500 outline-none transition-colors" />
            </div>
          </div>

          <div class="mb-5">
            <label class="text-[10px] uppercase font-bold text-gray-500 block mb-1.5 ml-1">分类 (点击快速选择)</label>
            <div class="flex gap-2 mb-2 overflow-x-auto no-scrollbar pb-1">
              <button v-for="tag in ['学习', '生活', '习惯', '行为']" :key="tag" @click="presetForm.category = tag"
                class="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-xs text-gray-400 border border-white/5 transition-colors whitespace-nowrap">
                {{ tag }}
              </button>
            </div>
            <input v-model="presetForm.category"
              class="w-[calc(100%-20px)] p-2 bg-[#252538] border border-white/10 rounded-lg text-sm text-white focus:border-blue-500 outline-none transition-colors"
              placeholder="输入自定义分类" />
          </div>

          <div class="flex gap-3">
            <button v-if="editingPreset" @click="resetPresetForm" class="modern-btn neutral flex-1">
              放弃
            </button>
            <button @click="savePreset" class="modern-btn primary-blue flex-[2]">
              {{ editingPreset ? '保存修改' : '立即添加' }}
            </button>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';
import { ElMessage, ElMessageBox } from 'element-plus';
import { 
  getMemberPresets, 
  createMemberPreset, 
  updateMemberPreset, 
  deleteMemberPreset 
} from '../../api/presetApi';

const route = useRoute();
const emit = defineEmits(['refresh-balance']);

// 基础状态
const logs = ref([]);
const loading = ref(false);
const hasMore = ref(true);
const filter = ref({ reasonCode: '' });
const pagination = ref({ offset: 0, limit: 20 });
const currentMemberId = computed(() => parseInt(route.params.id));

// 操作弹窗状态
const showAdjustModal = ref(false);
const adjusting = ref(false);
const adjustForm = ref({ type: 'add', points: 10, reason: '' });

// 预设管理状态
const allPresets = ref([]);
const presetsLoading = ref(false);
const showManageModal = ref(false);
const editingPreset = ref(null);
const presetForm = ref({ label: '', points: 10, type: 'add', icon: '🌟', category: '常规' });

// 主窗口分类 Tabs
const activeCategory = ref('全部');
const presetCategories = computed(() => {
  const cats = new Set(allPresets.value.filter(p => p.type === adjustForm.value.type).map(p => p.category || '常规'));
  return ['全部', ...Array.from(cats)];
});

// 管理窗口分类 Tabs
const activeManageCategory = ref('全部');
const manageCategories = computed(() => {
  const relevantPresets = allPresets.value.filter(p => p.type === adjustForm.value.type);
  const cats = new Set(relevantPresets.map(p => p.category || '常规'));
  return ['全部', ...Array.from(cats)];
});

// 主窗口筛选
const filteredPresets = computed(() => {
  return allPresets.value.filter(p => {
    const typeMatch = p.type === adjustForm.value.type;
    const catMatch = activeCategory.value === '全部' || (p.category || '常规') === activeCategory.value;
    return typeMatch && catMatch;
  });
});

// 管理窗口筛选
const filteredManagePresets = computed(() => {
  return allPresets.value.filter(p => {
    if (p.type !== adjustForm.value.type) return false;
    if (activeManageCategory.value === '全部') return true;
    return (p.category || '常规') === activeManageCategory.value;
  });
});

// ====== 撤销功能 ======
const handleRevoke = async (log) => {
  try {
    await ElMessageBox.confirm(
      '确定要撤销这条积分记录吗？\n\n撤销后：\n1. 积分将自动回滚（加分变回扣分，扣分变回加分）\n2. 如果是兑换商品，关联的背包物品也会被收回',
      '撤销确认',
      {
        confirmButtonText: '确定撤销',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
        lockScroll: false
      }
    );

    const res = await axios.post('/api/family/revoke', { logId: log.id });

    if (res.data?.code === 200) {
      ElMessage.success('撤销成功，积分已回滚');
      emit('refresh-balance');
      await loadLogs(true);
    }
  } catch (err) {
    if (err !== 'cancel') {
      console.error(err);
      ElMessage.error(err.response?.data?.msg || '撤销失败');
    }
  }
};

// ====== 预设管理逻辑 ======

const loadPresets = async (memberId = null) => {
  const targetMemberId = memberId || currentMemberId.value;
  if (!targetMemberId) {
    console.warn('memberId 为空，无法加载预设');
    return;
  }
  // 先清空本地数组，避免复用上一个成员的数据
  allPresets.value = [];
  presetsLoading.value = true;
  try {
    allPresets.value = await getMemberPresets(targetMemberId);
  } catch (err) {
    console.error('加载预设失败', err);
    ElMessage.error(err.message || '加载预设失败');
  } finally {
    presetsLoading.value = false;
  }
};

const openManageModal = () => {
  resetPresetForm();
  activeManageCategory.value = '全部';
  showManageModal.value = true;
};
const closeManageModal = () => {
  showManageModal.value = false;
  loadPresets();
};

const resetPresetForm = () => {
  editingPreset.value = null;
  const defaultCat = activeManageCategory.value !== '全部' ? activeManageCategory.value : '常规';
  presetForm.value = {
    label: '',
    points: 10,
    type: adjustForm.value.type,
    icon: '🌟',
    category: defaultCat
  };
};

const editPreset = (preset) => {
  editingPreset.value = preset;
  presetForm.value = { ...preset };
};

const savePreset = async () => {
  if (!presetForm.value.label) return ElMessage.warning('请输入名称');
  if (!currentMemberId.value) {
    ElMessage.error('无法获取成员ID，请刷新页面重试');
    return;
  }

  try {
    if (editingPreset.value) {
      // 更新成员预设
      await updateMemberPreset(currentMemberId.value, editingPreset.value.id, presetForm.value);
      ElMessage.success('修改成功');
    } else {
      // 创建成员预设
      await createMemberPreset(currentMemberId.value, presetForm.value);
      ElMessage.success('添加成功');
    }
    await loadPresets();
    resetPresetForm();
  } catch (err) {
    ElMessage.error(err.message || '保存失败');
  }
};

const deletePreset = async (id) => {
  if (!currentMemberId.value) {
    ElMessage.error('无法获取成员ID，请刷新页面重试');
    return;
  }
  try {
    await ElMessageBox.confirm('确定要删除这个预设吗？', '提示', {
      type: 'warning',
      lockScroll: false,
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      confirmButtonClass: 'el-button--danger'
    });
    // 等待删除成功（HTTP 200/204）才更新 UI
    await deleteMemberPreset(currentMemberId.value, id);
    // 删除成功后重新加载列表，确保 UI 与 DB 一致
    await loadPresets(currentMemberId.value);
    ElMessage.success('已删除');
  } catch (e) {
    if (e !== 'cancel') {
      // 删除失败时不更新本地列表，只提示错误
      ElMessage.error(e.message || '删除失败');
    }
  }
};

const renameCategory = async (oldName) => {
  if (!currentMemberId.value) {
    ElMessage.error('无法获取成员ID，请刷新页面重试');
    return;
  }
  try {
    const { value: newName } = await ElMessageBox.prompt('请输入新的分类名称', '重命名分类', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputValue: oldName,
      lockScroll: false,
    });

    if (newName && newName !== oldName) {
      // 注意：分类重命名需要批量更新该成员的所有相关预设
      // 这里暂时保留旧接口，如果后端不支持成员级分类管理，需要单独实现
      await axios.put('/api/family/presets/category/update', { oldCategory: oldName, newCategory: newName });
      ElMessage.success('重命名成功');
      activeManageCategory.value = newName;
      loadPresets();
    }
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error(e.response?.data?.msg || '重命名失败');
    }
  }
};

const deleteCategory = async (catName) => {
  if (!currentMemberId.value) {
    ElMessage.error('无法获取成员ID，请刷新页面重试');
    return;
  }
  try {
    await ElMessageBox.confirm(
      `确定要删除分类【${catName}】吗？\n\n注意：该分类下的所有预设项将被移动到「常规」分类，不会被删除。`,
      '删除分类',
      {
        type: 'warning',
        lockScroll: false,
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        confirmButtonClass: 'el-button--danger'
      }
    );

    // 注意：分类删除需要批量更新该成员的所有相关预设
    // 这里暂时保留旧接口，如果后端不支持成员级分类管理，需要单独实现
    await axios.post('/api/family/presets/category/delete', { category: catName });
    ElMessage.success('分类已删除');
    activeManageCategory.value = '全部';
    loadPresets();
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error(e.response?.data?.msg || '删除失败');
    }
  }
};

const applyPreset = (preset) => {
  adjustForm.value.points = preset.points;
  adjustForm.value.reason = preset.label;
};

// ====== 业务逻辑 ======

const loadLogs = async (reset = true) => {
  if (!currentMemberId.value) return;
  if (reset) {
    pagination.value.offset = 0;
    logs.value = [];
    hasMore.value = true;
  }
  loading.value = true;
  try {
    const res = await axios.get('/api/v2/wallet/logs', {
      params: {
        member_id: currentMemberId.value,
        limit: pagination.value.limit,
        offset: pagination.value.offset,
        reason_code: filter.value.reasonCode || undefined,
      }
    });
    if (res.data?.code === 200) {
      const newLogs = res.data.data?.logs || [];
      logs.value = reset ? newLogs : [...logs.value, ...newLogs];
      hasMore.value = newLogs.length >= pagination.value.limit;
      pagination.value.offset += newLogs.length;
    }
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
};

const loadMore = () => loadLogs(false);

const submitAdjust = async () => {
  if (!currentMemberId.value) return;
  if (!adjustForm.value.points || adjustForm.value.points <= 0) return ElMessage.warning('积分必须大于0');

  adjusting.value = true;
  try {
    const delta = adjustForm.value.type === 'add' ? adjustForm.value.points : -adjustForm.value.points;
    const title = adjustForm.value.reason || (delta > 0 ? '手动加分' : '手动扣分');

    const res = await axios.post('/api/family/action', {
      memberId: currentMemberId.value,
      points: delta,
      customTitle: title,
      reasonCode: 'manual',
    });

    if (res.data?.code === 200) {
      closeAdjustModal();
      emit('refresh-balance');
      await loadLogs();
      ElMessage.success('操作成功');
    }
  } catch (err) {
    ElMessage.error(err.response?.data?.msg || '操作失败');
  } finally {
    adjusting.value = false;
  }
};

const openAdjustModal = (type) => {
  adjustForm.value = { type, points: 10, reason: '' };
  activeCategory.value = '全部';
  showAdjustModal.value = true;
  if (allPresets.value.length === 0) {
    loadPresets();
  }
};

const closeAdjustModal = () => { showAdjustModal.value = false; adjusting.value = false; };

// 监听来自父组件的打开弹窗事件
const handleTriggerAdjustModal = (e) => {
  openAdjustModal(e.detail.type);
};

onMounted(() => {
  window.addEventListener('trigger-adjust-modal', handleTriggerAdjustModal);
  loadLogs();
  // 初始加载预设
  if (currentMemberId.value) {
    loadPresets(currentMemberId.value);
  }
});

onUnmounted(() => {
  window.removeEventListener('trigger-adjust-modal', handleTriggerAdjustModal);
});

const formatTime = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const getReasonLabel = (code) => {
  const map = { reward: '兑换', bounty: '悬赏', auction: '拍卖', lottery: '抽奖', manual: '手动', refund: '退款' };
  return map[code] || code;
};

// 监听路由 memberId 变化，切换成员时重载预设
watch(() => route.params.id, (newId, oldId) => {
  if (newId) {
    loadLogs();
    // 如果 memberId 发生变化，重新加载预设（清空旧数据并加载新数据）
    if (newId !== oldId || oldId === undefined) {
      loadPresets(parseInt(newId));
    }
  }
}, { immediate: true });
</script>

<style scoped>
/* 原有的 action-btn 样式 */
.action-btn {
  padding: 10px 20px;
  border-radius: 12px;
  color: #fff;
  font-weight: 700;
  font-size: 14px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1);
  filter: brightness(1.1);
}

.action-btn:active {
  transform: translateY(0);
}

.action-btn.add {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border: 1px solid rgba(59, 130, 246, 0.5);
}

.action-btn.deduct {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  border: 1px solid rgba(239, 68, 68, 0.5);
}

/* 新增：通用现代按钮样式 (Modern Button) */
.modern-btn {
  padding: 10px 20px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  border: 1px solid transparent;
}

.modern-btn:hover {
  transform: translateY(-2px);
  filter: brightness(1.1);
}

.modern-btn:active {
  transform: translateY(0);
}

.modern-btn.primary-blue {
  color: #fff;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border-color: rgba(59, 130, 246, 0.5);
  box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);
}

.modern-btn.primary-red {
  color: #fff;
  background: linear-gradient(135deg, #ef4444, #dc2626);
  border-color: rgba(239, 68, 68, 0.5);
  box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.3);
}

.modern-btn.neutral {
  color: #9ca3af;
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
}

.modern-btn.neutral:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.2);
}

.modern-btn.small {
  padding: 6px 12px;
  font-size: 12px;
  border-radius: 8px;
}

/* 🟢 新增：撤销按钮专用样式 (Soft Danger) */
.modern-btn.danger-soft {
  padding: 4px 10px;
  font-size: 11px;
  border-radius: 6px;
  height: auto;
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.1);
}

.modern-btn.danger-soft:hover {
  background: #ef4444;
  color: white;
  border-color: #ef4444;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
}

.filter-select {
  outline: none;
}

/* 自定义滚动条 */
.custom-scroll {
  overflow-x: hidden;
}

.custom-scroll::-webkit-scrollbar {
  width: 4px;
}

.custom-scroll::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.02);
}

.custom-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.custom-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* 隐藏横向滚动条但保留滚动功能 */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>