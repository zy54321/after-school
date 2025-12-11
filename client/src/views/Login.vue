<template>
  <div class="landing-page">
    <header class="navbar">
      <div class="logo">
        <span class="icon">🏫</span>
        <span class="text">{{ $t('app.name') }}</span>
      </div>
      <div class="nav-actions">
        <el-dropdown @command="handleLangCommand" style="margin-right: 15px; cursor: pointer; line-height: 32px;">
          <span class="lang-switch">
            🌐 {{ currentLang === 'zh' ? '中文' : 'English' }}
            <el-icon class="el-icon--right"><arrow-down /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="zh">中文</el-dropdown-item>
              <el-dropdown-item command="en">English</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <el-button round class="nav-login-btn" @click="showLoginModal">{{ $t('login.navBtn') }}</el-button>
      </div>
    </header>

    <main class="hero-section">
      <div class="hero-content">
        <h1 class="slogan">
          {{ $t('login.slogan') }}
        </h1>
        <p class="sub-slogan">
          {{ $t('login.subSlogan') }}
        </p>
        <div class="hero-actions">
          <el-button type="primary" size="large" class="cta-btn" @click="showLoginModal">
            {{ $t('login.ctaBtn') }}
            <el-icon class="el-icon--right"><Right /></el-icon>
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

    <section class="contact-section">
      <div class="contact-container">
        <h2 class="section-title">🤝 {{ $t('login.contact') }}</h2>
        <div class="contact-grid">
          <div class="contact-card">
            <div class="icon-box mobile"><el-icon><Phone /></el-icon></div>
            <div class="info">
              <div class="label">{{ $t('login.phone') }}</div>
              <div class="value">18504254380</div>
            </div>
          </div>
          <div class="contact-card">
            <div class="icon-box email"><el-icon><Message /></el-icon></div>
            <div class="info">
              <div class="label">{{ $t('login.email') }}</div>
              <div class="value email-text">
                <div>zy54321game@gmail.com</div>
                <div>the_zy_email@163.com</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <footer class="footer">
      <p>© 2025 SmartCare System. Designed for Education.</p>
    </footer>

    <el-dialog v-model="loginVisible" :title="$t('login.dialogTitle')" width="400px" align-center class="login-dialog">
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
          <el-input v-model="loginForm.password" type="password" :placeholder="$t('login.passwordPlaceholder')" :prefix-icon="Lock" show-password />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" class="full-width-btn" @click="handleLogin">
            {{ $t('login.loginBtn') }}
          </el-button>
        </el-form-item>
      </el-form>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { User, Lock, Right, Phone, Message, ArrowDown } from '@element-plus/icons-vue';
import axios from 'axios';
import { useI18n } from 'vue-i18n'; // 👈 引入 hook

const { locale, t } = useI18n(); // 👈 获取 i18n 实例
const currentLang = ref(locale.value); // 当前语言状态

// 切换语言逻辑
const handleLangCommand = (command) => {
  locale.value = command;
  currentLang.value = command;
  localStorage.setItem('lang', command); // 记住选择
  ElMessage.success(command === 'zh' ? '已切换至中文' : 'Switched to English');
};

const router = useRouter();
const loginVisible = ref(false);
const loginFormRef = ref(null);
const loading = ref(false);

const loginForm = reactive({ username: '', password: '' });

// 校验规则也建议稍微改下，不过暂时不改也没事，重点是 UI
const rules = {
  username: [{ required: true, message: 'Required', trigger: 'blur' }],
  password: [{ required: true, message: 'Required', trigger: 'blur' }]
};

const showLoginModal = () => { loginVisible.value = true; };

const fillVisitor = () => {
  loginForm.username = 'visitor';
  loginForm.password = '123456';
  ElMessage.success(t('login.visitor') + ' OK');
};

const handleLogin = async () => {
  if (!loginFormRef.value) return;
  await loginFormRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true;
      try {
        const res = await axios.post('/api/login', loginForm);
        if (res.data.code === 200) {
          ElMessage.success(t('login.loginBtn') + ' Success');
          localStorage.setItem('user_token', 'logged_in');
          localStorage.setItem('user_info', JSON.stringify(res.data.data));
          loginVisible.value = false;
          router.push('/');
        } else {
          ElMessage.error(res.data.msg || 'Login Failed');
        }
      } catch (err) {
        console.error(err);
        ElMessage.error('Server Error');
      } finally {
        loading.value = false;
      }
    }
  });
};
</script>

<style scoped>
/* 保持原有样式不变，这里省略以节省篇幅 */
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
  color: #606266;
  border-color: #dcdfe6;
}
.nav-login-btn:hover {
  color: #409EFF;
  border-color: #c6e2ff;
  background-color: #ecf5ff;
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
.highlight {
  background: linear-gradient(120deg, #409EFF 0%, #67C23A 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
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
  .hero-image { display: block; }
}
.floating-card {
  position: absolute;
  background: white;
  padding: 20px;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.08);
  display: flex;
  align-items: center;
  gap: 15px;
  animation: float 6s ease-in-out infinite;
}
.card-1 { top: 20px; right: 0; z-index: 2; }
.card-2 { bottom: 40px; left: 20px; animation-delay: 1s; }
.floating-card .icon { font-size: 32px; }
.floating-card .text { font-weight: bold; color: #303133; }
@keyframes float {
  0% { transform: translateY(0px); }
  50% { transform: translateY(-15px); }
  100% { transform: translateY(0px); }
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
  box-shadow: 0 10px 30px rgba(0,0,0,0.05);
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
.contact-section {
  padding: 60px 10%;
  background: #fdfbfb;
  border-top: 1px solid #ebeef5;
}
.section-title {
  text-align: center;
  font-size: 24px;
  margin-bottom: 40px;
  color: #303133;
}
.contact-grid {
  display: flex;
  justify-content: center;
  gap: 30px;
  flex-wrap: wrap;
}
.contact-card {
  background: white;
  padding: 25px 40px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.03);
  display: flex;
  align-items: center;
  gap: 20px;
  min-width: 300px;
  transition: transform 0.2s;
}
.contact-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.06);
}
.icon-box {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: white;
}
.icon-box.mobile { background: linear-gradient(135deg, #36d1dc 0%, #5b86e5 100%); }
.icon-box.email { background: linear-gradient(135deg, #ff9966 0%, #ff5e62 100%); }
.info .label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 5px;
}
.info .value {
  font-size: 16px;
  font-weight: bold;
  color: #303133;
}
.email-text {
  font-size: 14px;
  line-height: 1.4;
}
.footer {
  text-align: center;
  padding: 40px;
  color: #909399;
  font-size: 14px;
  background: white;
  border-top: 1px solid #ebeef5;
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
.full-width-btn {
  width: 100%;
  font-weight: bold;
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