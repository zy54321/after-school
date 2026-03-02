<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Location, User, Lock } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import axios from 'axios';
import { initUserPermissions, clearUserPermissions } from '@/composables/usePermission';
import { clearSessionCache } from '@/router';

const router = useRouter();
const { locale, t } = useI18n();

const currentLang = ref(locale.value);

const handleLangCommand = (command) => {
  locale.value = command;
  currentLang.value = command;
  localStorage.setItem('lang', command);
};

// 🟢 登录相关状态
const loginVisible = ref(false);
const loginFormRef = ref(null);
const loading = ref(false);
const loginForm = reactive({ username: '', password: '' });
const isLoggedIn = ref(false);
const userInfo = ref({});
const shouldRedirectAfterLogin = ref(false); // 标记登录后是否需要跳转
const redirectTarget = ref(''); // 存储跳转目标路径

const rules = {
  username: [{ required: true, message: 'Required', trigger: 'blur' }],
  password: [{ required: true, message: 'Required', trigger: 'blur' }]
};

// 🟢 格式化显示用户名：游客账号只显示"游客"
const displayUserName = computed(() => {
  if (!userInfo.value) return '';
  if (userInfo.value.username === 'visitor') {
    return '游客';
  }
  return userInfo.value.real_name || userInfo.value.username;
});

onMounted(async () => {
  // 滚动到页面顶部
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  
  // 通过 Session 校验判断登录状态
  try {
    const res = await axios.get('/api/permissions/auth/permissions');
    if (res.data && res.data.code === 200) {
      isLoggedIn.value = true;
      const infoStr = localStorage.getItem('user_info');
      if (infoStr) {
        userInfo.value = JSON.parse(infoStr);
      }
      initUserPermissions(res.data.data);
    }
  } catch (err) {
    // Session 无效，保持未登录状态
    isLoggedIn.value = false;
  }
});

const showLoginModal = () => {
  shouldRedirectAfterLogin.value = false; // 右上角登录按钮，不需要跳转
  loginVisible.value = true;
};

const handleSystemClick = () => {
  // 如果已登录，直接跳转到系统介绍页
  if (isLoggedIn.value) {
    router.push({
      name: 'SystemHome',
      query: { redirect: '/system/dashboard' }
    });
  } else {
    // 未登录，提示需要登录
    ElMessageBox.confirm(
      '请先登录以访问教务管理系统',
      '提示',
      {
        confirmButtonText: '去登录',
        cancelButtonText: '取消',
        type: 'info'
      }
    ).then(() => {
      // 设置跳转目标为系统介绍页
      redirectTarget.value = '/system/dashboard';
      shouldRedirectAfterLogin.value = true; // 点击卡片后登录，需要跳转
      loginVisible.value = true;
    }).catch(() => {
      // 用户取消
    });
  }
};

const handleStrategyClick = () => {
  // 如果已登录，直接跳转到商业分析系统首页
  if (isLoggedIn.value) {
    router.push({
      name: 'AnalyticsHome',
      query: { redirect: '/strategy/map' }
    });
  } else {
    // 未登录，提示需要登录
    ElMessageBox.confirm(
      t('login.needLoginForStrategy'),
      t('login.tipTitle'),
      {
        confirmButtonText: t('login.goLogin'),
        cancelButtonText: t('common.cancel'),
        type: 'info'
      }
    ).then(() => {
      // 设置跳转目标为商业分析系统首页
      redirectTarget.value = '/strategy/map';
      shouldRedirectAfterLogin.value = true; // 点击卡片后登录，需要跳转
      loginVisible.value = true;
    }).catch(() => {
      // 用户取消
    });
  }
};

const handleFamilyClick = () => {
  // 逻辑：点击卡片 -> 检查登录 -> 跳转到介绍页(FamilyHome)
  if (isLoggedIn.value) {
    router.push({
      name: 'FamilyHome',
      query: { redirect: '/family/dashboard' }
    });
  } else {
    ElMessageBox.confirm(
      '请先登录以访问家庭成长银行',
      '提示',
      {
        confirmButtonText: '去登录',
        cancelButtonText: '取消',
        type: 'info'
      }
    ).then(() => {
      redirectTarget.value = '/family/home'; // 登录后去介绍页
      shouldRedirectAfterLogin.value = true;
      loginVisible.value = true;
    }).catch(() => { });
  }
};

const fillVisitor = () => {
  loginForm.username = 'visitor';
  loginForm.password = '123456';
};

const handleLogin = async () => {
  if (!loginFormRef.value) return;
  await loginFormRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true;
      try {
        const res = await axios.post('/api/login', loginForm);
        if (res.data.code === 200) {
          // 只保存用户信息，不再使用 token
          localStorage.setItem('user_info', JSON.stringify(res.data.data));

          // 更新登录状态
          isLoggedIn.value = true;
          userInfo.value = res.data.data;

          // 加载用户权限
          try {
            const permRes = await axios.get('/api/permissions/auth/permissions');
            if (permRes.data.code === 200) {
              initUserPermissions(permRes.data.data);
            }
          } catch (permError) {
            console.error('加载用户权限失败:', permError);
          }

          ElMessage.success('登录成功');
          loginVisible.value = false;

          // 根据来源决定是否跳转
          if (shouldRedirectAfterLogin.value) {
            // 点击卡片后登录，根据目标路径跳转
            const targetPath = redirectTarget.value || '/system/dashboard';
            if (targetPath.includes('/strategy')) {
              // 跳转到商业分析系统首页
              router.push({
                name: 'AnalyticsHome',
                query: { redirect: targetPath }
              });
            } else {
              // 跳转到教务系统介绍页
              router.push({
                name: 'SystemHome',
                query: { redirect: targetPath }
              });
            }
            // 重置标记
            shouldRedirectAfterLogin.value = false;
            redirectTarget.value = '';
          }
          // 否则保持当前页面（右上角登录按钮）
        } else {
          ElMessage.error(res.data.msg || 'Login Failed');
        }
      } catch (err) {
        ElMessage.error('Server Error');
      } finally {
        loading.value = false;
      }
    }
  });
};

// 切换账号
const handleLogout = () => {
  // 清除用户信息和权限缓存（不再使用 user_token）
  localStorage.removeItem('user_info');
  localStorage.removeItem('user_permissions');
  clearUserPermissions();
  clearSessionCache();
  isLoggedIn.value = false;
  userInfo.value = {};
  loginForm.username = '';
  loginForm.password = '';
};
</script>

<style scoped>
/* =================================
     全局布局与变量
     ================================= */
.portal-container {
  min-height: 100vh;
  width: 100%;

  /* 🟢 修改 1: 增强对比度 */
  /* 颜色逻辑：深黑背景 -> 亮靛蓝(高光) -> 深紫(过渡) -> 深黑背景 */
  background: linear-gradient(125deg,
      #020617 0%,
      /* 纯黑底 */
      #1e1b4b 35%,
      /* 深靛蓝 */
      #4338ca 50%,
      /* 🟢 亮靛蓝 (核心高光，让流动可见) */
      #312e81 65%,
      /* 深靛蓝 */
      #020617 100%
      /* 纯黑底 */
    );

  /* 🟢 修改 2: 增大尺寸，让光带更宽 */
  background-size: 300% 300%;

  /* 🟢 修改 3: 提速到 10秒 */
  animation: gradientFlow 10s ease infinite;

  /* ... 以下保持不变 ... */
  color: #fff;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  /* 🟢 修复滚动问题：移除 overflow-y: auto，让滚动发生在 body 上 */
  overflow-x: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
}

/* =================================
   动画定义 (请确保这段代码在 style 标签内)
   ================================= */

/* 🟢 新增：背景流动动画 */
@keyframes gradientFlow {
  0% {
    background-position: 0% 50%;
  }

  50% {
    background-position: 100% 50%;
  }

  100% {
    background-position: 0% 50%;
  }
}

/* 🟢 原有的淡入动画 (保持不变) */
@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* =================================
     1. 导航栏 (Navbar)
     ================================= */
.navbar {
  padding: 20px 40px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 10;
}

.brand {
  font-size: 1.2rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}

.lang-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.1);
  padding: 8px 16px;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.3s;
  color: #cbd5e1;
  font-size: 0.9rem;
}

.lang-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

/* =================================
     2. 主内容区 (Main Content)
     ================================= */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  /* 🟢 修复滚动问题：改为 flex-start，避免内容不足时居中导致滚动问题 */
  justify-content: flex-start;
  align-items: center;
  gap: 60px;
  padding: 80px 20px 40px;
  z-index: 5;
  /* 🟢 确保内容有足够的最小高度 */
  min-height: calc(100vh - 200px);
}

/* Hero 个人简介 */
.hero-area {
  text-align: center;
  max-width: 800px;
  /* 移除复杂的 animation，防止因为缺少 keyframes 导致不可见 */
  /* animation: fadeInDown 0.8s ease-out; */
}

.badge-pill {
  display: inline-block;
  padding: 6px 16px;
  background: rgba(16, 185, 129, 0.1);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 24px;
  letter-spacing: 1px;
}

.hero-title {
  font-size: 2.8rem;
  font-weight: 800;
  margin-bottom: 20px;
  background: linear-gradient(to right, #ffffff, #94a3b8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-subtitle {
  font-size: 1.5rem;
  color: #cbd5e1;
  margin-bottom: 24px;
  font-weight: 300;
}

.hero-desc {
  font-size: 1.1rem;
  color: #64748b;
  max-width: 600px;
  margin: 0 auto;
  line-height: 1.6;
}

/* =================================
     3. 卡片网格 (Cards Grid)
     ================================= */
.apps-grid {
  display: flex;
  gap: 30px;
  flex-wrap: wrap;
  justify-content: center;
  width: 100%;
  max-width: 1200px;
}

/* 单个卡片 */
.app-card {
  background: rgba(30, 41, 59, 0.7);
  /* 半透明深蓝 */
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 30px;
  width: 320px;
  position: relative;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.app-card:hover {
  transform: translateY(-10px);
  border-color: rgba(255, 255, 255, 0.2);
}

/* 卡片发光特效 */
.card-glow {
  position: absolute;
  width: 150px;
  height: 150px;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0;
  transition: opacity 0.4s;
  top: -50px;
  right: -50px;
}

.edu-glow {
  background: #3b82f6;
}

.map-glow {
  background: #10b981;
}

.app-card:hover .card-glow {
  opacity: 0.2;
}

.card-content {
  position: relative;
  z-index: 2;
}

.icon-wrapper {
  font-size: 3rem;
  margin-bottom: 20px;
}

.app-card h3 {
  font-size: 1.25rem;
  margin-bottom: 10px;
  font-weight: 700;
  color: #fff;
}

.app-card p {
  font-size: 0.95rem;
  color: #94a3b8;
  line-height: 1.6;
  margin-bottom: 30px;
  min-height: 48px;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-word;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tag {
  font-size: 0.75rem;
  padding: 4px 10px;
  border-radius: 4px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tag.private {
  background: rgba(244, 63, 94, 0.15);
  color: #fb7185;
}

.tag.public {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
}

.arrow {
  color: #64748b;
  font-weight: bold;
  transition: transform 0.3s;
}

.app-card:hover .arrow {
  transform: translateX(5px);
  color: #fff;
}

.placeholder {
  opacity: 0.5;
  cursor: default;
  border-style: dashed;
}

.placeholder:hover {
  transform: none;
  border-color: rgba(255, 255, 255, 0.08);
}

/* Footer */
.footer {
  text-align: center;
  padding: 30px;
  color: #475569;
  font-size: 0.8rem;
}

/* 背景光球 */
.bg-orb {
  position: fixed;
  /* 🟢 修复滚动问题：改为 fixed，避免影响滚动 */
  border-radius: 50%;
  filter: blur(100px);
  opacity: 0.2;
  z-index: 1;
  pointer-events: none;
  /* 🟢 确保不会阻止滚动事件 */
}

.orb-1 {
  width: 500px;
  height: 500px;
  background: #4f46e5;
  top: -100px;
  left: 20%;
}

.orb-2 {
  width: 600px;
  height: 600px;
  background: #0ea5e9;
  bottom: -100px;
  right: 10%;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .hero-title {
    font-size: 2rem;
  }

  .apps-grid {
    flex-direction: column;
    align-items: center;
  }

  .app-card {
    width: 100%;
    max-width: 340px;
  }
}

/* 🟢 登录对话框样式 */
.login-dialog {
  z-index: 2000;
}

/* 🟢 修复双滚动条问题：防止 Element Plus Dialog 创建额外的滚动条 */
:deep(.el-overlay) {
  overflow: hidden !important;
}

:deep(.el-dialog__wrapper) {
  overflow: hidden !important;
}

/* 确保 body 在对话框打开时不会出现双滚动条 */
body.el-popup-parent--hidden {
  overflow-y: auto !important;
  padding-right: 0 !important;
}

.welcome-back-card {
  text-align: center;
  padding: 10px 0;
}

.welcome-back-card h3 {
  margin: 15px 0 5px;
  color: #303133;
}

.full-width-btn {
  width: 100%;
  font-weight: bold;
}

.dialog-header {
  text-align: center;
  margin-bottom: 25px;
}

.dialog-header p {
  margin: 0 0 10px 0;
  color: #606266;
}

.visitor-tag {
  cursor: pointer;
  transition: all 0.2s;
}

.visitor-tag:hover {
  transform: scale(1.05);
}

/* 🟢 导航栏登录按钮样式 */
.nav-login-btn {
  font-weight: 600;
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.nav-login-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
}
</style>

<template>
  <div class="portal-container">
    <header class="navbar">
      <div class="brand">
        <span class="logo">🚀</span>
        <span class="title">Dev.Portfolio</span>
      </div>
      <div class="actions">
        <el-dropdown @command="handleLangCommand" trigger="click">
          <span class="lang-btn">
            <el-icon>
              <Location />
            </el-icon>
            {{ currentLang === 'zh' ? 'CN' : 'EN' }}
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="zh">中文</el-dropdown-item>
              <el-dropdown-item command="en">English</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <!-- 🟢 登录按钮 -->
        <el-button v-if="!isLoggedIn" round class="nav-login-btn" @click="showLoginModal" style="margin-left: 15px;">
          <el-icon style="margin-right: 5px">
            <User />
          </el-icon>
          {{ $t('login.navBtn') }}
        </el-button>
        <el-button v-else round class="nav-login-btn" type="primary" plain @click="showLoginModal"
          style="margin-left: 15px;">
          <el-icon style="margin-right: 5px">
            <User />
          </el-icon>
          {{ displayUserName }}
        </el-button>
      </div>
    </header>

    <main class="main-content">

      <section class="hero-area">
        <h1 class="hero-title">
          {{ $t('portal.hero.greeting') }}
        </h1>
        <p class="hero-subtitle">
          {{ $t('portal.hero.role') }}
        </p>
        <p class="hero-desc">
          {{ $t('portal.hero.desc') }}
        </p>
      </section>

      <section class="apps-grid">
        <div class="app-card" @click="handleSystemClick">
          <div class="card-glow edu-glow"></div>
          <div class="card-content">
            <div class="icon-wrapper">🏫</div>
            <h3>{{ $t('portal.systemCard.title') }}</h3>
            <p>{{ $t('portal.systemCard.desc') }}</p>
            <div class="card-footer">
              <span class="tag private">{{ $t('portal.systemCard.tag') }}</span>
              <span class="arrow">-></span>
            </div>
          </div>
        </div>

        <div class="app-card" @click="handleStrategyClick">
          <div class="card-glow map-glow"></div>
          <div class="card-content">
            <div class="icon-wrapper">🗺️</div>
            <h3>{{ $t('portal.strategyCard.title') }}</h3>
            <p>{{ $t('portal.strategyCard.desc') }}</p>
            <div class="card-footer">
              <span class="tag public">{{ $t('portal.strategyCard.tag') }}</span>
              <span class="arrow">-></span>
            </div>
          </div>
        </div>

        <div class="app-card" @click="handleFamilyClick">
          <div class="card-glow" style="background: #f59e0b;"></div>
          <div class="card-content">
            <div class="icon-wrapper">🧸</div>
            <h3>{{ $t('portal.familyCard.title') }}</h3>
            <p>{{ $t('portal.familyCard.desc') }}</p>
            <div class="card-footer">
              <span class="tag" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b;">
                {{ $t('portal.familyCard.tag') }}
              </span>
              <span class="arrow">-></span>
            </div>
          </div>
        </div>

        <div class="app-card placeholder">
          <div class="card-content">
            <div class="icon-wrapper">🚧</div>
            <h3>Coming Soon</h3>
            <p>More innovative tools under construction...</p>
          </div>
        </div>
      </section>

    </main>

    <footer class="footer">
      <p>{{ $t('portal.copyright') }}</p>
    </footer>

    <div class="bg-orb orb-1"></div>
    <div class="bg-orb orb-2"></div>

    <!-- 🟢 登录对话框 -->
    <el-dialog v-model="loginVisible" :title="$t('login.loginBtn')" width="400px" align-center class="login-dialog"
      :lock-scroll="false">
      <div v-if="isLoggedIn" class="welcome-back-card">
        <el-avatar :size="80" src="https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png" />
        <h3>{{ $t('login.identityTitle') }}, {{ displayUserName }}</h3>
        <el-button link type="info" style="margin-top: 15px;" @click="handleLogout">
          {{ $t('login.switchAccount') }}
        </el-button>
      </div>

      <div v-else>
        <div class="dialog-header">
          <p>{{ $t('login.dialogSub') }}</p>
          <el-tag type="warning" effect="plain" class="visitor-tag" @click="fillVisitor">
            ⚡️ {{ $t('login.visitor') }}: visitor / 123456
          </el-tag>
        </div>

        <el-form :model="loginForm" :rules="rules" ref="loginFormRef" size="large" @keyup.enter="handleLogin">
          <el-form-item prop="username">
            <el-input v-model="loginForm.username" :placeholder="$t('login.usernamePlaceholder')" :prefix-icon="User" />
          </el-form-item>
          <el-form-item prop="password">
            <el-input v-model="loginForm.password" type="password" :placeholder="$t('login.passwordPlaceholder')"
              :prefix-icon="Lock" show-password />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="loading" class="full-width-btn" @click="handleLogin">
              {{ $t('login.loginBtn') }}
            </el-button>
          </el-form-item>
        </el-form>
      </div>
    </el-dialog>
  </div>
</template>
