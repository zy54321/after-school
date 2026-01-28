<template>
  <div class="member-layout h-[calc(100vh-120px)] flex flex-col box-border overflow-hidden">

    <div class="member-selector flex-none pt-4 px-4 pb-2">
      <div class="selector-tabs flex gap-2 flex-wrap">
        <router-link v-for="m in members" :key="m.id" :to="`/family/member/${m.id}/wallet`"
          class="selector-tab px-4 py-2 rounded-full border border-white/10 text-gray-400 text-sm transition-all hover:bg-white/5 flex items-center gap-2"
          :class="{ 'bg-gradient-to-r from-blue-600 to-purple-600 text-white border-transparent shadow-lg': m.id === currentMemberId }">
          <span class="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">{{
            m.name?.charAt(0) || '?' }}</span>
          <span>{{ m.name }}</span>
        </router-link>
      </div>
    </div>

    <div
      class="member-container flex-1 flex flex-col min-h-0 mx-4 mb-4 bg-[#1e1e2d] rounded-2xl border border-white/5 overflow-hidden"
      v-if="member">

      <div class="flex-none p-6 pb-0">
        <div class="member-header flex justify-between items-center mb-6">
          <div class="member-info flex items-center gap-4">
            <div class="relative group">
              <div
                v-if="member.avatar"
                class="w-16 h-16 rounded-full overflow-hidden shadow-lg border-2 border-white/10">
                <img :src="$img(member.avatar)" :alt="member.name" class="w-full h-full object-cover" />
              </div>
              <div
                v-else
                class="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold shadow-lg border-2 border-white/10">
                {{ member.name?.charAt(0) || '?' }}
              </div>
              <div
                class="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                @click="openEditModal">
                <span class="text-white text-xs">编辑</span>
              </div>
            </div>
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <h1 class="text-2xl font-bold text-white">{{ member.name }}</h1>
                <button
                  @click="openEditModal"
                  class="edit-btn-icon"
                  title="编辑个人信息">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              </div>
              <p class="text-sm text-gray-400">{{ member.bio || '点击编辑添加个性签名' }}</p>
            </div>
          </div>
          <div
            class="balance-card bg-gradient-to-br from-yellow-400 to-orange-500 text-black px-6 py-3 rounded-xl shadow-lg transform hover:scale-105 transition-transform">
            <div class="text-xs font-bold opacity-80 uppercase tracking-wider">当前积分</div>
            <div class="text-3xl font-black font-mono tracking-tight">{{ balance }}</div>
          </div>
        </div>

        <nav class="asset-nav flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div class="flex gap-1 flex-1">
            <router-link :to="`/family/member/${currentMemberId}/wallet`" class="nav-item" active-class="active">
              <span>💰</span> 积分流水
            </router-link>
            <router-link :to="`/family/member/${currentMemberId}/inventory`" class="nav-item" active-class="active">
              <span>🎒</span> 我的背包
            </router-link>
            <router-link :to="`/family/member/${currentMemberId}/orders`" class="nav-item" active-class="active">
              <span>📦</span> 订单记录
            </router-link>
            <router-link :to="`/family/member/${currentMemberId}/activity`" class="nav-item" active-class="active">
              <span>📊</span> 活动记录
            </router-link>
          </div>
          <div class="flex gap-2 flex-none">
            <button class="action-btn add" @click="handleOpenAdjustModal('add')">
              <span class="text-lg mr-1">+</span> 奖励加分
            </button>
            <button class="action-btn deduct" @click="handleOpenAdjustModal('deduct')">
              <span class="text-lg mr-1">-</span> 惩罚扣分
            </button>
          </div>
        </nav>
      </div>

      <div class="content-area flex-1 overflow-hidden relative mb-5">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" @refresh-balance="loadWallet" @open-adjust-modal="handleOpenAdjustModal" class="h-full" />
          </transition>
        </router-view>
      </div>
    </div>

    <div class="loading-state flex-1 flex items-center justify-center text-gray-500" v-else>
      <div class="animate-pulse">加载中...</div>
    </div>

    <!-- 编辑个人信息弹窗 -->
    <div class="modal-overlay fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50"
      v-if="showEditModal" @click.self="closeEditModal">
      <div class="modal-content bg-[#1e1e2d] border border-white/10 shadow-2xl rounded-3xl w-[90%] max-w-[500px] p-6">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-xl font-bold text-white">编辑个人信息</h2>
          <button @click="closeEditModal" class="modal-close-btn">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="space-y-4">
          <!-- 头像上传 -->
          <div>
            <label class="block text-sm font-medium text-gray-400 mb-2">头像</label>
            <div class="flex items-center gap-4">
              <div class="relative">
                <div v-if="editForm.avatarPreview" class="w-20 h-20 rounded-full overflow-hidden border-2 border-white/10">
                  <img :src="editForm.avatarPreview" alt="预览" class="w-full h-full object-cover" />
                </div>
                <div
                  v-else
                  class="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold border-2 border-white/10">
                  {{ member?.name?.charAt(0) || '?' }}
                </div>
              </div>
              <div>
                <input type="file" :ref="el => avatarInput = el" @change="handleAvatarChange" accept="image/*"
                  class="hidden" />
                <button @click="avatarInput?.click()" class="modern-btn neutral small">
                  选择头像
                </button>
                <button v-if="editForm.avatarPreview" @click="clearAvatar" class="modern-btn danger-soft ml-2">
                  清除
                </button>
              </div>
            </div>
          </div>

          <!-- 个性签名 -->
          <div>
            <label class="block text-sm font-medium text-gray-400 mb-2">个性签名</label>
            <input v-model="editForm.bio" type="text" placeholder="请输入个性签名..."
              class="w-[calc(100%-40px)] bg-[#252538] text-white border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:border-blue-500/50 transition-all outline-none placeholder-gray-600"
              maxlength="200" />
            <div class="text-xs text-gray-500 mt-1 text-right">{{ editForm.bio?.length || 0 }}/200</div>
          </div>
        </div>

        <div class="flex gap-3 mt-6">
          <button @click="closeEditModal" class="modern-btn neutral flex-1">
            取消
          </button>
          <button @click="submitEdit" :disabled="editing" class="modern-btn primary-blue flex-1">
            <span v-if="editing" class="flex items-center justify-center gap-2">
              <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              保存中...
            </span>
            <span v-else>保存</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, getCurrentInstance, provide } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';
import { ElMessage } from 'element-plus';

const route = useRoute();
const { proxy } = getCurrentInstance();
const members = ref([]);
const member = ref(null);
const balance = ref(0);
const showEditModal = ref(false);
const editing = ref(false);
const editForm = ref({
  bio: '',
  avatarPreview: '',
  avatarFile: null
});

const currentMemberId = computed(() => parseInt(route.params.id));

const loadMembers = async () => {
  try {
    const res = await axios.get('/api/v2/family/members');
    if (res.data?.code === 200) {
      members.value = res.data.data?.members || [];
    }
  } catch (err) {
    console.error('加载成员列表失败:', err);
  }
};

const loadWallet = async () => {
  if (!currentMemberId.value) return;
  try {
    const res = await axios.get('/api/v2/wallet', {
      params: { member_id: currentMemberId.value }
    });
    if (res.data?.code === 200) {
      member.value = res.data.data?.member || {};
      balance.value = res.data.data?.balance || 0;
    }
  } catch (err) {
    console.error('加载钱包失败:', err);
  }
};

const openEditModal = () => {
  if (!member.value) return;
  editForm.value = {
    bio: member.value.bio || '',
    avatarPreview: member.value.avatar ? proxy.$img(member.value.avatar) : '',
    avatarFile: null
  };
  showEditModal.value = true;
};

const closeEditModal = () => {
  showEditModal.value = false;
  editForm.value = {
    bio: '',
    avatarPreview: '',
    avatarFile: null
  };
};

const handleAvatarChange = (e) => {
  const file = e.target.files[0];
  if (file) {
    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      ElMessage.warning('请选择图片文件');
      return;
    }
    // 验证文件大小（2MB）
    if (file.size > 2 * 1024 * 1024) {
      ElMessage.warning('图片大小不能超过2MB');
      return;
    }
    editForm.value.avatarFile = file;
    editForm.value.avatarPreview = URL.createObjectURL(file);
  }
};

const avatarInput = ref(null);

const clearAvatar = () => {
  editForm.value.avatarFile = null;
  editForm.value.avatarPreview = member.value?.avatar ? proxy.$img(member.value.avatar) : '';
  if (avatarInput.value) {
    avatarInput.value.value = '';
  }
};

const submitEdit = async () => {
  // 使用 currentMemberId 作为 id（从路由参数获取，更可靠）
  if (!currentMemberId.value || !member.value) {
    ElMessage.error('成员信息不完整，请刷新页面重试');
    return;
  }
  editing.value = true;
  try {
    const formData = new FormData();
    formData.append('id', String(currentMemberId.value)); // 使用路由参数中的 id
    formData.append('name', member.value.name || '');
    // bio 字段：如果为空字符串，也传递空字符串（允许清空）
    if (editForm.value.bio !== undefined) {
      formData.append('bio', editForm.value.bio || '');
    }
    // 头像：只有选择了新文件才上传
    if (editForm.value.avatarFile) {
      formData.append('avatar', editForm.value.avatarFile);
    }

    const res = await axios.post('/api/family/member/update', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    if (res.data?.code === 200) {
      ElMessage.success('更新成功');
      closeEditModal();
      await loadWallet();
      await loadMembers();
    } else {
      ElMessage.error(res.data?.msg || '更新失败');
    }
  } catch (err) {
    console.error('更新成员信息失败:', err);
    const errorMsg = err.response?.data?.msg || err.response?.data?.error || '更新失败';
    ElMessage.error(errorMsg);
    // 如果是数据库字段不存在的错误，提示运行迁移
    if (errorMsg.includes('column') && errorMsg.includes('does not exist')) {
      ElMessage.warning('请先运行数据库迁移脚本：017_add_member_bio.sql');
    }
  } finally {
    editing.value = false;
  }
};

// 处理打开调整积分弹窗
const handleOpenAdjustModal = (type) => {
  // 通过自定义事件通知子组件打开弹窗
  const event = new CustomEvent('trigger-adjust-modal', { detail: { type } });
  window.dispatchEvent(event);
};

watch(() => route.params.id, (newId) => {
  if (newId) loadWallet();
}, { immediate: true });

onMounted(() => {
  loadMembers();
});
</script>

<style scoped>
/* 这里只保留必要的样式，布局样式已移至 Tailwind 类 */
.nav-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.5);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}

.nav-item.active {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-weight: bold;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 编辑按钮图标样式 */
.edit-btn-icon {
  padding: 4px;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.edit-btn-icon:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
}

/* 现代按钮样式（与 MemberWallet.vue 保持一致） */
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

.modern-btn.danger-soft {
  padding: 6px 12px;
  font-size: 12px;
  border-radius: 8px;
  color: #fca5a5;
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.2);
}

.modern-btn.danger-soft:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #fee2e2;
  border-color: rgba(239, 68, 68, 0.3);
}

.modern-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
}

/* 弹窗关闭按钮样式 */
.modal-close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: #fff;
  transform: scale(1.05);
}

.modal-close-btn:active {
  transform: scale(0.95);
}

/* 操作按钮样式（奖励加分/惩罚扣分） */
.action-btn {
  padding: 8px 16px;
  border-radius: 10px;
  color: #fff;
  font-weight: 600;
  font-size: 13px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.1);
  border: 1px solid transparent;
}

.action-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.15);
  filter: brightness(1.1);
}

.action-btn:active {
  transform: translateY(0);
}

.action-btn.add {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border-color: rgba(59, 130, 246, 0.5);
}

.action-btn.deduct {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  border-color: rgba(239, 68, 68, 0.5);
}
</style>