<template>
  <div class="landing-page">
    <header class="navbar">
      <div class="logo">
        <span class="icon">🏫</span>
        <span class="text">{{ $t('app.name') }}</span>
      </div>
      <div class="nav-actions">
        <el-button link @click="$router.push('/')" style="margin-right: 20px; color: rgba(0,0,0,0.7);">
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

    <!-- Hero Section -->
    <main class="hero-section">
      <div class="hero-background">
        <div class="pattern-dots"></div>
        <div class="gradient-circle circle-1"></div>
        <div class="gradient-circle circle-2"></div>
      </div>
      <div class="hero-content">
        <div class="hero-badge">
          <span class="badge-icon">✨</span>
          <span>{{ $t('app.name') }}</span>
        </div>
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
        <div class="hero-stats">
          <div class="stat-item">
            <div class="stat-number">60%</div>
            <div class="stat-label">运营效率提升</div>
          </div>
          <div class="stat-item">
            <div class="stat-number">40%</div>
            <div class="stat-label">管理成本降低</div>
          </div>
          <div class="stat-item">
            <div class="stat-number">3秒</div>
            <div class="stat-label">完成签到消课</div>
          </div>
          <div class="stat-item">
            <div class="stat-number">100%</div>
            <div class="stat-label">数据安全可控</div>
          </div>
        </div>
      </div>
    </main>

    <!-- System Introduction -->
    <section class="intro-section">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">{{ $t('login.intro.title') }}</h2>
          <p class="section-desc">{{ $t('login.intro.desc') }}</p>
        </div>
        <div class="highlights-grid">
          <div class="highlight-card card-1">
            <div class="card-icon-wrapper">
              <div class="highlight-icon">📋</div>
            </div>
            <h3>{{ $t('login.intro.highlight1') }}</h3>
            <p>{{ $t('login.intro.highlight1Desc') }}</p>
          </div>
          <div class="highlight-card card-2">
            <div class="card-icon-wrapper">
              <div class="highlight-icon">🤖</div>
            </div>
            <h3>{{ $t('login.intro.highlight2') }}</h3>
            <p>{{ $t('login.intro.highlight2Desc') }}</p>
          </div>
          <div class="highlight-card card-3">
            <div class="card-icon-wrapper">
              <div class="highlight-icon">📊</div>
            </div>
            <h3>{{ $t('login.intro.highlight3') }}</h3>
            <p>{{ $t('login.intro.highlight3Desc') }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section class="features-section">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">核心功能</h2>
          <p class="section-subtitle">一站式解决教育机构运营管理需求，让管理更简单、更高效</p>
        </div>
        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon-wrapper">
              <div class="feature-icon">📍</div>
            </div>
            <h3>{{ $t('login.features.mapTitle') }}</h3>
            <p>{{ $t('login.features.mapDesc') }}</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon-wrapper">
              <div class="feature-icon">⚡️</div>
            </div>
            <h3>{{ $t('login.features.checkinTitle') }}</h3>
            <p>{{ $t('login.features.checkinDesc') }}</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon-wrapper">
              <div class="feature-icon">🛡️</div>
            </div>
            <h3>{{ $t('login.features.financeTitle') }}</h3>
            <p>{{ $t('login.features.financeDesc') }}</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon-wrapper">
              <div class="feature-icon">👥</div>
            </div>
            <h3>{{ $t('login.features.studentTitle') }}</h3>
            <p>{{ $t('login.features.studentDesc') }}</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon-wrapper">
              <div class="feature-icon">📚</div>
            </div>
            <h3>{{ $t('login.features.classTitle') }}</h3>
            <p>{{ $t('login.features.classDesc') }}</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon-wrapper">
              <div class="feature-icon">📈</div>
            </div>
            <h3>{{ $t('login.features.reportTitle') }}</h3>
            <p>{{ $t('login.features.reportDesc') }}</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon-wrapper">
              <div class="feature-icon">🎯</div>
            </div>
            <h3>{{ $t('login.features.workflowTitle') }}</h3>
            <p>{{ $t('login.features.workflowDesc') }}</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon-wrapper">
              <div class="feature-icon">🍽️</div>
            </div>
            <h3>{{ $t('login.features.cateringTitle') }}</h3>
            <p>{{ $t('login.features.cateringDesc') }}</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon-wrapper">
              <div class="feature-icon">🔐</div>
            </div>
            <h3>{{ $t('login.features.permissionTitle') }}</h3>
            <p>{{ $t('login.features.permissionDesc') }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Use Cases Section -->
    <section class="use-cases-section">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">{{ $t('login.useCases.title') }}</h2>
        </div>
        <div class="use-cases-list">
          <div class="use-case-item">
            <div class="use-case-icon">🏠</div>
            <div class="use-case-content">
              <h3>{{ $t('login.useCases.case1.title') }}</h3>
              <p>{{ $t('login.useCases.case1.desc') }}</p>
            </div>
          </div>
          <div class="use-case-item">
            <div class="use-case-icon">🎓</div>
            <div class="use-case-content">
              <h3>{{ $t('login.useCases.case2.title') }}</h3>
              <p>{{ $t('login.useCases.case2.desc') }}</p>
            </div>
          </div>
          <div class="use-case-item">
            <div class="use-case-icon">📖</div>
            <div class="use-case-content">
              <h3>{{ $t('login.useCases.case3.title') }}</h3>
              <p>{{ $t('login.useCases.case3.desc') }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Advantages Section -->
    <section class="advantages-section">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">{{ $t('login.advantages.title') }}</h2>
        </div>
        <div class="advantages-list">
          <div class="advantage-item">
            <div class="advantage-number">01</div>
            <div class="advantage-content">
              <h3>{{ $t('login.advantages.adv1.title') }}</h3>
              <p>{{ $t('login.advantages.adv1.desc') }}</p>
            </div>
          </div>
          <div class="advantage-item">
            <div class="advantage-number">02</div>
            <div class="advantage-content">
              <h3>{{ $t('login.advantages.adv2.title') }}</h3>
              <p>{{ $t('login.advantages.adv2.desc') }}</p>
            </div>
          </div>
          <div class="advantage-item">
            <div class="advantage-number">03</div>
            <div class="advantage-content">
              <h3>{{ $t('login.advantages.adv3.title') }}</h3>
              <p>{{ $t('login.advantages.adv3.desc') }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="cta-section">
      <div class="container">
        <div class="cta-content">
          <h2 class="cta-title">准备好开始了吗？</h2>
          <p class="cta-desc">立即体验教务管理系统，让管理更简单、更高效</p>
          <el-button v-if="!isLoggedIn" type="primary" size="large" class="cta-btn-large" @click="showLoginModal">
            {{ $t('login.ctaBtn') }}
            <el-icon class="el-icon--right">
              <Right />
            </el-icon>
          </el-button>
          <el-button v-else type="primary" size="large" class="cta-btn-large" @click="handleEnterSystem">
            🚀 {{ $t('login.enterNow') }}
            <el-icon class="el-icon--right">
              <Right />
            </el-icon>
          </el-button>
        </div>
      </div>
    </section>

    <!-- Login Dialog -->
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
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', sans-serif;
  color: #1e293b;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

/* Navbar */
.navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 50px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(226, 232, 240, 0.8);
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.logo {
  font-size: 24px;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #f59e0b;
}

.nav-login-btn {
  font-weight: 600;
  background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
  border: none;
  color: white;
}

.nav-login-btn:hover {
  background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
}

.lang-switch {
  font-size: 14px;
  color: #64748b;
  display: flex;
  align-items: center;
}

.lang-switch:hover {
  color: #f59e0b;
}

/* Hero Section */
.hero-section {
  position: relative;
  padding: 100px 10% 80px;
  min-height: 650px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.hero-background {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
}

.pattern-dots {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: radial-gradient(circle, rgba(245, 158, 11, 0.1) 1px, transparent 1px);
  background-size: 40px 40px;
  opacity: 0.5;
}

.gradient-circle {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  opacity: 0.4;
  animation: float-circle 25s ease-in-out infinite;
}

.circle-1 {
  width: 500px;
  height: 500px;
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  top: -150px;
  left: 10%;
  animation-delay: 0s;
}

.circle-2 {
  width: 400px;
  height: 400px;
  background: linear-gradient(135deg, #fb923c 0%, #f97316 100%);
  bottom: -100px;
  right: 15%;
  animation-delay: 8s;
}

@keyframes float-circle {
  0%, 100% {
    transform: translate(0, 0) scale(1);
  }
  33% {
    transform: translate(50px, -50px) scale(1.1);
  }
  66% {
    transform: translate(-30px, 30px) scale(0.9);
  }
}

.hero-content {
  max-width: 900px;
  text-align: center;
  z-index: 2;
  position: relative;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  background: rgba(255, 255, 255, 0.9);
  border: 2px solid rgba(245, 158, 11, 0.2);
  border-radius: 50px;
  color: #f59e0b;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 32px;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.1);
}

.badge-icon {
  font-size: 18px;
}

.slogan {
  font-size: 64px;
  line-height: 1.1;
  margin-bottom: 24px;
  font-weight: 900;
  color: #0f172a;
  letter-spacing: -1px;
}

.sub-slogan {
  font-size: 22px;
  color: #475569;
  margin-bottom: 48px;
  line-height: 1.7;
  max-width: 700px;
  margin-left: auto;
  margin-right: auto;
}

.cta-btn {
  padding: 20px 48px;
  font-size: 18px;
  border-radius: 50px;
  background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
  border: none;
  color: white;
  font-weight: 600;
  transition: all 0.3s;
  box-shadow: 0 8px 24px rgba(245, 158, 11, 0.3);
}

.cta-btn:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 32px rgba(245, 158, 11, 0.4);
}

.hero-stats {
  display: flex;
  justify-content: center;
  gap: 60px;
  margin-top: 60px;
  padding-top: 40px;
  border-top: 1px solid rgba(226, 232, 240, 0.8);
}

.stat-item {
  text-align: center;
}

.stat-number {
  font-size: 36px;
  font-weight: 800;
  color: #f59e0b;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  color: #64748b;
  font-weight: 500;
}

/* Sections */
section {
  padding: 100px 0;
  position: relative;
}

.section-header {
  text-align: center;
  margin-bottom: 60px;
}

.section-title {
  font-size: 48px;
  font-weight: 800;
  margin-bottom: 16px;
  color: #0f172a;
  letter-spacing: -1px;
}

.section-desc {
  font-size: 20px;
  color: #64748b;
  max-width: 700px;
  margin: 0 auto;
  line-height: 1.7;
}

.section-subtitle {
  font-size: 18px;
  color: #94a3b8;
  margin-top: 8px;
}

/* Intro Section */
.intro-section {
  background: white;
  border-top: 1px solid #e2e8f0;
}

.highlights-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 32px;
}

.highlight-card {
  padding: 48px 40px;
  background: linear-gradient(135deg, #fff 0%, #f8fafc 100%);
  border: 2px solid #e2e8f0;
  border-radius: 24px;
  text-align: center;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.highlight-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #f59e0b, #f97316);
  transform: scaleX(0);
  transition: transform 0.4s;
}

.highlight-card:hover {
  border-color: #f59e0b;
  transform: translateY(-8px);
  box-shadow: 0 20px 40px rgba(245, 158, 11, 0.15);
}

.highlight-card:hover::before {
  transform: scaleX(1);
}

.card-icon-wrapper {
  width: 80px;
  height: 80px;
  margin: 0 auto 24px;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.4s;
}

.highlight-card:hover .card-icon-wrapper {
  transform: scale(1.1) rotate(5deg);
}

.highlight-icon {
  font-size: 40px;
}

.highlight-card h3 {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 12px;
  color: #0f172a;
}

.highlight-card p {
  color: #64748b;
  line-height: 1.7;
  font-size: 15px;
}

/* Features Section */
.features-section {
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 28px;
}

.feature-card {
  padding: 40px 32px;
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 20px;
  transition: all 0.3s;
  position: relative;
}

.feature-card:hover {
  border-color: #f59e0b;
  box-shadow: 0 12px 32px rgba(245, 158, 11, 0.12);
  transform: translateY(-4px);
}

.feature-icon-wrapper {
  width: 64px;
  height: 64px;
  margin-bottom: 24px;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.feature-icon {
  font-size: 32px;
}

.feature-card h3 {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 12px;
  color: #0f172a;
}

.feature-card p {
  color: #64748b;
  line-height: 1.7;
  font-size: 15px;
}

/* Use Cases Section */
.use-cases-section {
  background: white;
  border-top: 1px solid #e2e8f0;
}

.use-cases-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 900px;
  margin: 0 auto;
}

.use-case-item {
  display: flex;
  align-items: flex-start;
  gap: 32px;
  padding: 40px;
  background: linear-gradient(135deg, #fff 0%, #f8fafc 100%);
  border: 2px solid #e2e8f0;
  border-radius: 20px;
  transition: all 0.3s;
}

.use-case-item:hover {
  border-color: #f59e0b;
  box-shadow: 0 12px 32px rgba(245, 158, 11, 0.1);
  transform: translateX(8px);
}

.use-case-icon {
  font-size: 56px;
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.use-case-content h3 {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 8px;
  color: #0f172a;
}

.use-case-content p {
  color: #64748b;
  line-height: 1.7;
  font-size: 16px;
}

/* Advantages Section */
.advantages-section {
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
}

.advantages-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 900px;
  margin: 0 auto;
}

.advantage-item {
  display: flex;
  align-items: flex-start;
  gap: 32px;
  padding: 40px;
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 20px;
  transition: all 0.3s;
}

.advantage-item:hover {
  border-color: #f59e0b;
  box-shadow: 0 12px 32px rgba(245, 158, 11, 0.1);
  transform: translateX(8px);
}

.advantage-number {
  font-size: 48px;
  font-weight: 900;
  color: #f59e0b;
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.advantage-content h3 {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 8px;
  color: #0f172a;
}

.advantage-content p {
  color: #64748b;
  line-height: 1.7;
  font-size: 16px;
}

/* CTA Section */
.cta-section {
  background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  text-align: center;
  padding: 100px 0;
  position: relative;
  overflow: hidden;
}

.cta-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: radial-gradient(circle, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
  background-size: 40px 40px;
  opacity: 0.3;
}

.cta-content {
  position: relative;
  z-index: 2;
}

.cta-title {
  font-size: 48px;
  font-weight: 800;
  margin-bottom: 16px;
  color: white;
  letter-spacing: -1px;
}

.cta-desc {
  font-size: 20px;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 40px;
}

.cta-btn-large {
  padding: 20px 50px;
  font-size: 20px;
  border-radius: 50px;
  background: white;
  border: none;
  color: #f59e0b;
  font-weight: 600;
  transition: all 0.3s;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.cta-btn-large:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3);
}

/* Dialog Styles */
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

/* Responsive */
@media (max-width: 768px) {
  .slogan {
    font-size: 40px;
  }
  
  .section-title {
    font-size: 36px;
  }
  
  .hero-section {
    padding: 80px 5% 60px;
  }
  
  .navbar {
    padding: 15px 20px;
  }

  .hero-stats {
    flex-direction: column;
    gap: 30px;
  }

  .use-case-item,
  .advantage-item {
    flex-direction: column;
    text-align: center;
  }
}
</style>
