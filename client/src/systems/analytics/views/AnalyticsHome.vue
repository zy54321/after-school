<template>
  <div class="landing-page">
    <header class="navbar">
      <div class="logo">
        <span class="icon">🗺️</span>
        <span class="text">{{ $t('analytics.home.title') }}</span>
      </div>
      <div class="nav-actions">
        <el-button link @click="$router.push('/')" style="margin-right: 20px; color: rgba(255,255,255,0.8);">
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
      <div class="hero-content">
        <div class="hero-badge">🚀 {{ $t('analytics.home.title') }}</div>
        <h1 class="slogan">{{ $t('analytics.home.slogan') }}</h1>
        <p class="sub-slogan">{{ $t('analytics.home.subSlogan') }}</p>
        <div class="hero-actions">
          <el-button v-if="!isLoggedIn" type="primary" size="large" class="cta-btn" @click="showLoginModal">
            {{ $t('analytics.home.ctaBtn') }}
            <el-icon class="el-icon--right">
              <Right />
            </el-icon>
          </el-button>
          <el-button v-else type="primary" size="large" class="cta-btn" @click="handleEnterSystem">
            🚀 {{ $t('analytics.home.enterNow') }}
            <el-icon class="el-icon--right">
              <Right />
            </el-icon>
          </el-button>
        </div>
      </div>
      <div class="hero-visual">
        <div class="glow-orb orb-1"></div>
        <div class="glow-orb orb-2"></div>
        <div class="glow-orb orb-3"></div>
      </div>
    </main>

    <!-- System Introduction -->
    <section class="intro-section">
      <div class="container">
        <h2 class="section-title">{{ $t('analytics.home.intro.title') }}</h2>
        <p class="section-desc">{{ $t('analytics.home.intro.desc') }}</p>
        <div class="highlights-grid">
          <div class="highlight-card">
            <div class="highlight-icon">📍</div>
            <h3>{{ $t('analytics.home.intro.highlight1') }}</h3>
            <p>{{ $t('analytics.home.intro.highlight1Desc') }}</p>
          </div>
          <div class="highlight-card">
            <div class="highlight-icon">⚙️</div>
            <h3>{{ $t('analytics.home.intro.highlight2') }}</h3>
            <p>{{ $t('analytics.home.intro.highlight2Desc') }}</p>
          </div>
          <div class="highlight-card">
            <div class="highlight-icon">📊</div>
            <h3>{{ $t('analytics.home.intro.highlight3') }}</h3>
            <p>{{ $t('analytics.home.intro.highlight3Desc') }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section class="features-section">
      <div class="container">
        <h2 class="section-title">核心功能</h2>
        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon">🗺️</div>
            <h3>{{ $t('analytics.home.features.mapTitle') }}</h3>
            <p>{{ $t('analytics.home.features.mapDesc') }}</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">📍</div>
            <h3>{{ $t('analytics.home.features.siteTitle') }}</h3>
            <p>{{ $t('analytics.home.features.siteDesc') }}</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">📚</div>
            <h3>{{ $t('analytics.home.features.dictTitle') }}</h3>
            <p>{{ $t('analytics.home.features.dictDesc') }}</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🎛️</div>
            <h3>{{ $t('analytics.home.features.layerTitle') }}</h3>
            <p>{{ $t('analytics.home.features.layerDesc') }}</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">📊</div>
            <h3>{{ $t('analytics.home.features.dataTitle') }}</h3>
            <p>{{ $t('analytics.home.features.dataDesc') }}</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">👥</div>
            <h3>{{ $t('analytics.home.features.demographicsTitle') }}</h3>
            <p>{{ $t('analytics.home.features.demographicsDesc') }}</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">📏</div>
            <h3>{{ $t('analytics.home.features.measurementTitle') }}</h3>
            <p>{{ $t('analytics.home.features.measurementDesc') }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Use Cases Section -->
    <section class="use-cases-section">
      <div class="container">
        <h2 class="section-title">{{ $t('analytics.home.useCases.title') }}</h2>
        <div class="use-cases-grid">
          <div class="use-case-card">
            <div class="use-case-number">01</div>
            <h3>{{ $t('analytics.home.useCases.case1.title') }}</h3>
            <p>{{ $t('analytics.home.useCases.case1.desc') }}</p>
          </div>
          <div class="use-case-card">
            <div class="use-case-number">02</div>
            <h3>{{ $t('analytics.home.useCases.case2.title') }}</h3>
            <p>{{ $t('analytics.home.useCases.case2.desc') }}</p>
          </div>
          <div class="use-case-card">
            <div class="use-case-number">03</div>
            <h3>{{ $t('analytics.home.useCases.case3.title') }}</h3>
            <p>{{ $t('analytics.home.useCases.case3.desc') }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Advantages Section -->
    <section class="advantages-section">
      <div class="container">
        <h2 class="section-title">{{ $t('analytics.home.advantages.title') }}</h2>
        <div class="advantages-grid">
          <div class="advantage-card">
            <div class="advantage-icon">⚡</div>
            <h3>{{ $t('analytics.home.advantages.adv1.title') }}</h3>
            <p>{{ $t('analytics.home.advantages.adv1.desc') }}</p>
          </div>
          <div class="advantage-card">
            <div class="advantage-icon">🔧</div>
            <h3>{{ $t('analytics.home.advantages.adv2.title') }}</h3>
            <p>{{ $t('analytics.home.advantages.adv2.desc') }}</p>
          </div>
          <div class="advantage-card">
            <div class="advantage-icon">✨</div>
            <h3>{{ $t('analytics.home.advantages.adv3.title') }}</h3>
            <p>{{ $t('analytics.home.advantages.adv3.desc') }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="cta-section">
      <div class="container">
        <h2 class="cta-title">准备好开始了吗？</h2>
        <p class="cta-desc">立即体验商业分析地图，让数据驱动您的商业决策</p>
        <el-button v-if="!isLoggedIn" type="primary" size="large" class="cta-btn-large" @click="showLoginModal">
          {{ $t('analytics.home.ctaBtn') }}
          <el-icon class="el-icon--right">
            <Right />
          </el-icon>
        </el-button>
        <el-button v-else type="primary" size="large" class="cta-btn-large" @click="handleEnterSystem">
          🚀 {{ $t('analytics.home.enterNow') }}
          <el-icon class="el-icon--right">
            <Right />
          </el-icon>
        </el-button>
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
          🚀 {{ $t('analytics.home.enterNow') }}
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

const targetPath = computed(() => route.query.redirect || '/strategy/map');
const targetSystemName = computed(() => {
  return `🔐 ${t('login.accessing')}：${t('login.systemStrategy')}`;
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
  background: #0a0e27;
  background-image: 
    radial-gradient(at 20% 30%, rgba(64, 158, 255, 0.1) 0px, transparent 50%),
    radial-gradient(at 80% 70%, rgba(102, 126, 234, 0.1) 0px, transparent 50%);
  font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', sans-serif;
  color: #fff;
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
  background: rgba(10, 14, 39, 0.8);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(64, 158, 255, 0.2);
  position: sticky;
  top: 0;
  z-index: 100;
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
  background: rgba(64, 158, 255, 0.1);
  border-color: rgba(64, 158, 255, 0.3);
  color: #409EFF;
}

.nav-login-btn:hover {
  background: rgba(64, 158, 255, 0.2);
  border-color: #409EFF;
}

.lang-switch {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
}

.lang-switch:hover {
  color: #409EFF;
}

/* Hero Section */
.hero-section {
  position: relative;
  padding: 120px 10% 80px;
  min-height: 600px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.hero-content {
  max-width: 800px;
  text-align: center;
  z-index: 2;
  position: relative;
}

.hero-badge {
  display: inline-block;
  padding: 8px 20px;
  background: rgba(64, 158, 255, 0.1);
  border: 1px solid rgba(64, 158, 255, 0.3);
  border-radius: 20px;
  color: #409EFF;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 24px;
}

.slogan {
  font-size: 56px;
  line-height: 1.2;
  margin-bottom: 24px;
  font-weight: 900;
  background: linear-gradient(135deg, #409EFF 0%, #67C23A 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.sub-slogan {
  font-size: 20px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 40px;
  line-height: 1.8;
}

.cta-btn {
  padding: 18px 40px;
  font-size: 18px;
  border-radius: 8px;
  background: linear-gradient(135deg, #409EFF 0%, #67C23A 100%);
  border: none;
  color: white;
  font-weight: 600;
  transition: all 0.3s;
  box-shadow: 0 4px 20px rgba(64, 158, 255, 0.4);
}

.cta-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 30px rgba(64, 158, 255, 0.6);
}

.hero-visual {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  z-index: 1;
}

.glow-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.3;
  animation: float 20s ease-in-out infinite;
}

.orb-1 {
  width: 400px;
  height: 400px;
  background: #409EFF;
  top: -100px;
  left: 10%;
  animation-delay: 0s;
}

.orb-2 {
  width: 300px;
  height: 300px;
  background: #67C23A;
  bottom: -50px;
  right: 15%;
  animation-delay: 5s;
}

.orb-3 {
  width: 250px;
  height: 250px;
  background: #E6A23C;
  top: 50%;
  right: 30%;
  animation-delay: 10s;
}

@keyframes float {
  0%, 100% {
    transform: translate(0, 0) scale(1);
  }
  33% {
    transform: translate(30px, -30px) scale(1.1);
  }
  66% {
    transform: translate(-20px, 20px) scale(0.9);
  }
}

/* Sections */
section {
  padding: 80px 0;
  position: relative;
}

.section-title {
  font-size: 42px;
  font-weight: 800;
  text-align: center;
  margin-bottom: 20px;
  color: #fff;
}

.section-desc {
  font-size: 18px;
  color: rgba(255, 255, 255, 0.7);
  text-align: center;
  max-width: 800px;
  margin: 0 auto 60px;
  line-height: 1.8;
}

/* Intro Section */
.intro-section {
  background: rgba(64, 158, 255, 0.05);
  border-top: 1px solid rgba(64, 158, 255, 0.1);
  border-bottom: 1px solid rgba(64, 158, 255, 0.1);
}

.highlights-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 30px;
  margin-top: 60px;
}

.highlight-card {
  padding: 40px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(64, 158, 255, 0.2);
  border-radius: 16px;
  text-align: center;
  transition: all 0.3s;
}

.highlight-card:hover {
  background: rgba(64, 158, 255, 0.1);
  border-color: #409EFF;
  transform: translateY(-5px);
}

.highlight-icon {
  font-size: 48px;
  margin-bottom: 20px;
}

.highlight-card h3 {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 12px;
  color: #409EFF;
}

.highlight-card p {
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.6;
}

/* Features Section */
.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 30px;
  margin-top: 60px;
}

.feature-card {
  padding: 40px 30px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(64, 158, 255, 0.2);
  border-radius: 16px;
  transition: all 0.3s;
  position: relative;
  overflow: hidden;
}

.feature-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #409EFF, #67C23A);
  transform: scaleX(0);
  transition: transform 0.3s;
}

.feature-card:hover {
  background: rgba(64, 158, 255, 0.1);
  border-color: #409EFF;
  transform: translateY(-5px);
  box-shadow: 0 10px 40px rgba(64, 158, 255, 0.2);
}

.feature-card:hover::before {
  transform: scaleX(1);
}

.feature-icon {
  font-size: 48px;
  margin-bottom: 20px;
}

.feature-card h3 {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 12px;
  color: #409EFF;
}

.feature-card p {
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.6;
  font-size: 15px;
}

/* Use Cases Section */
.use-cases-section {
  background: rgba(64, 158, 255, 0.05);
  border-top: 1px solid rgba(64, 158, 255, 0.1);
  border-bottom: 1px solid rgba(64, 158, 255, 0.1);
}

.use-cases-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 30px;
  margin-top: 60px;
}

.use-case-card {
  padding: 40px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(64, 158, 255, 0.2);
  border-radius: 16px;
  transition: all 0.3s;
  position: relative;
}

.use-case-card:hover {
  background: rgba(64, 158, 255, 0.1);
  border-color: #409EFF;
  transform: translateY(-5px);
}

.use-case-number {
  font-size: 72px;
  font-weight: 900;
  color: rgba(64, 158, 255, 0.2);
  line-height: 1;
  margin-bottom: 20px;
}

.use-case-card h3 {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 12px;
  color: #409EFF;
}

.use-case-card p {
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.6;
}

/* Advantages Section */
.advantages-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 30px;
  margin-top: 60px;
}

.advantage-card {
  padding: 40px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(64, 158, 255, 0.2);
  border-radius: 16px;
  text-align: center;
  transition: all 0.3s;
}

.advantage-card:hover {
  background: rgba(64, 158, 255, 0.1);
  border-color: #409EFF;
  transform: translateY(-5px);
}

.advantage-icon {
  font-size: 56px;
  margin-bottom: 20px;
}

.advantage-card h3 {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 12px;
  color: #409EFF;
}

.advantage-card p {
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.6;
}

/* CTA Section */
.cta-section {
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.1) 0%, rgba(102, 126, 234, 0.1) 100%);
  border-top: 1px solid rgba(64, 158, 255, 0.2);
  text-align: center;
  padding: 100px 0;
}

.cta-title {
  font-size: 42px;
  font-weight: 800;
  margin-bottom: 20px;
  color: #fff;
}

.cta-desc {
  font-size: 18px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 40px;
}

.cta-btn-large {
  padding: 20px 50px;
  font-size: 20px;
  border-radius: 8px;
  background: linear-gradient(135deg, #409EFF 0%, #67C23A 100%);
  border: none;
  color: white;
  font-weight: 600;
  transition: all 0.3s;
  box-shadow: 0 4px 20px rgba(64, 158, 255, 0.4);
}

.cta-btn-large:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 30px rgba(64, 158, 255, 0.6);
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
    font-size: 36px;
  }
  
  .section-title {
    font-size: 32px;
  }
  
  .hero-section {
    padding: 80px 5% 60px;
  }
  
  .navbar {
    padding: 15px 20px;
  }
}
</style>
