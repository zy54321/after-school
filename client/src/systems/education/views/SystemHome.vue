<template>
  <div class="landing-page">
    <header class="navbar">
      <div class="logo">
        <span class="icon">🏫</span>
        <span class="text">{{ $t('app.name') }}</span>
      </div>
      <div class="nav-actions">
        <el-button link @click="$router.push('/')" style="margin-right: 20px; color: #606266;">
          <el-icon style="margin-right: 4px;">
            <HomeFilled />
          </el-icon>
          {{ $t('login.backHome') }}
        </el-button>

        <el-dropdown @command="handleLangCommand" style="margin-right: 15px; cursor: pointer; line-height: 32px;">
          <span class="lang-switch">
            🌐 {{ currentLang === 'zh' ? '中文' : 'English' }}
            <el-icon class="el-icon--right">
              <ArrowDown />
            </el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="zh">中文</el-dropdown-item>
              <el-dropdown-item command="en">English</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <el-button v-if="!isLoggedIn" round class="nav-login-btn" @click="showLoginModal">
          {{ $t('login.navBtn') }}
        </el-button>
        <el-button v-else round class="nav-login-btn" type="primary" plain @click="showLoginModal">
          <el-icon style="margin-right: 5px">
            <User />
          </el-icon>
          {{ displayUserName }}
        </el-button>
      </div>
    </header>

    <main class="hero-section">
      <div class="hero-content">
        <h1 class="slogan">{{ $t('login.slogan') }}</h1>
        <p class="sub-slogan">{{ $t('login.subSlogan') }}</p>
        <div class="hero-actions">
          <el-button v-if="!isLoggedIn" type="primary" size="large" class="cta-btn" @click="showLoginModal">
            {{ $t('login.ctaBtn') }}
            <el-icon class="el-icon--right">
              <Right />
            </el-icon>
          </el-button>
          <el-button v-else type="primary" size="large" class="cta-btn" @click="handleEnterSystem">
            🚀 {{ $t('login.enterNow') }}
            <el-icon class="el-icon--right">
              <Right />
            </el-icon>
          </el-button>
        </div>
      </div>

      <div class="hero-image">
        <div class="floating-card card-1">
          <div class="icon">🗺️</div>
          <div class="text">{{ $t('login.features.mapTitle') }}</div>
        </div>
        <div class="floating-card card-2">
          <div class="icon">💰</div>
          <div class="text">{{ $t('login.features.financeTitle') }}</div>
        </div>
      </div>
    </main>

    <section class="features-section">
      <div class="feature-item">
        <div class="feature-icon">📍</div>
        <h3>{{ $t('login.features.mapTitle') }}</h3>
        <p>{{ $t('login.features.mapDesc') }}</p>
      </div>
      <div class="feature-item">
        <div class="feature-icon">⚡️</div>
        <h3>{{ $t('login.features.checkinTitle') }}</h3>
        <p>{{ $t('login.features.checkinDesc') }}</p>
      </div>
      <div class="feature-item">
        <div class="feature-icon">🛡️</div>
        <h3>{{ $t('login.features.financeTitle') }}</h3>
        <p>{{ $t('login.features.financeDesc') }}</p>
      </div>
    </section>

    <el-dialog v-model="loginVisible" :title="dialogTitle" width="400px" align-center class="login-dialog">
      <div v-if="isLoggedIn" class="welcome-back-card">
        <el-avatar :size="80" src="https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png" />
        <h3>{{ $t('login.identityTitle') }}, {{ displayUserName }}</h3>

        <el-tag type="info" style="margin-bottom: 20px;">
          {{ targetSystemName }}
        </el-tag>

        <el-button type="primary" size="large" class="full-width-btn" @click="handleEnterSystem">
          🚀 {{ $t('login.enterNow') }}
        </el-button>

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

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { User, Lock, Right, ArrowDown, HomeFilled } from '@element-plus/icons-vue';
import axios from 'axios';
import { useI18n } from 'vue-i18n';

const { locale, t } = useI18n();
const router = useRouter();
const route = useRoute();

const currentLang = ref(locale.value);
const loginVisible = ref(false);
const loginFormRef = ref(null);
const loading = ref(false);
const loginForm = reactive({ username: '', password: '' });

const isLoggedIn = ref(false);
const userInfo = ref({});

const rules = {
  username: [{ required: true, message: 'Required', trigger: 'blur' }],
  password: [{ required: true, message: 'Required', trigger: 'blur' }]
};

const displayUserName = computed(() => {
  if (!userInfo.value) return '';
  if (userInfo.value.username === 'visitor') {
    return '游客';
  }
  return userInfo.value.real_name || userInfo.value.username;
});

const targetPath = computed(() => route.query.redirect || '/system/dashboard');
const targetSystemName = computed(() => {
  if (targetPath.value.includes('/strategy')) return `🔐 ${t('login.accessing')}：${t('login.systemStrategy')}`;
  return `🔐 ${t('login.accessing')}：${t('login.systemEdu')}`;
});
const dialogTitle = computed(() => isLoggedIn.value ? t('login.identityTitle') : t('login.loginBtn'));

onMounted(() => {
  const token = localStorage.getItem('user_token');
  const infoStr = localStorage.getItem('user_info');

  if (token && infoStr) {
    isLoggedIn.value = true;
    userInfo.value = JSON.parse(infoStr);
  }
});

const showLoginModal = () => { loginVisible.value = true; };

const handleLangCommand = (command) => {
  locale.value = command;
  currentLang.value = command;
  localStorage.setItem('lang', command);
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
          localStorage.setItem('user_token', 'logged_in');
          localStorage.setItem('user_info', JSON.stringify(res.data.data));

          isLoggedIn.value = true;
          userInfo.value = res.data.data;

          ElMessage.success('登录成功');
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

const handleEnterSystem = () => {
  router.push(targetPath.value);
};

const handleLogout = () => {
  localStorage.removeItem('user_token');
  localStorage.removeItem('user_info');
  isLoggedIn.value = false;
  loginForm.username = '';
  loginForm.password = '';
};
</script>

<style scoped>
.landing-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%);
  font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', sans-serif;
  color: #303133;
}

.navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 50px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  position: sticky;
  top: 0;
  z-index: 10;
}

.logo {
  font-size: 24px;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #409EFF;
}

.nav-login-btn {
  font-weight: 600;
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

.hero-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 80px 10%;
  min-height: 500px;
}

.hero-content {
  max-width: 600px;
}

.slogan {
  font-size: 48px;
  line-height: 1.2;
  margin-bottom: 24px;
  font-weight: 900;
  color: #1a1a1a;
}

.sub-slogan {
  font-size: 18px;
  color: #606266;
  margin-bottom: 40px;
  line-height: 1.6;
}

.cta-btn {
  padding: 25px 40px;
  font-size: 18px;
  border-radius: 8px;
  box-shadow: 0 10px 20px rgba(64, 158, 255, 0.3);
  transition: transform 0.2s;
}

.cta-btn:hover {
  transform: translateY(-2px);
}

.hero-image {
  position: relative;
  width: 400px;
  height: 300px;
  display: none;
}

@media (min-width: 1024px) {
  .hero-image {
    display: block;
  }
}

.floating-card {
  position: absolute;
  background: white;
  padding: 20px;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  gap: 15px;
  animation: float 6s ease-in-out infinite;
}

.card-1 {
  top: 20px;
  right: 0;
  z-index: 2;
}

.card-2 {
  bottom: 40px;
  left: 20px;
  animation-delay: 1s;
}

.floating-card .icon {
  font-size: 32px;
}

.floating-card .text {
  font-weight: bold;
  color: #303133;
}

@keyframes float {
  0% {
    transform: translateY(0px);
  }

  50% {
    transform: translateY(-15px);
  }

  100% {
    transform: translateY(0px);
  }
}

.features-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 40px;
  padding: 60px 10%;
  background: white;
}

.feature-item {
  padding: 30px;
  border-radius: 12px;
  background: #f9fafc;
  transition: all 0.3s;
}

.feature-item:hover {
  background: #fff;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
  transform: translateY(-5px);
}

.feature-icon {
  font-size: 40px;
  margin-bottom: 20px;
}

.feature-item h3 {
  margin: 0 0 10px 0;
  font-size: 20px;
}

.feature-item p {
  color: #909399;
  line-height: 1.6;
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

.lang-switch {
  font-size: 14px;
  color: #606266;
  display: flex;
  align-items: center;
}

.lang-switch:hover {
  color: #409EFF;
}
</style>

