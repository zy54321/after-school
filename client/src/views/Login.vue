<template>
  <div class="landing-page">
    <header class="navbar">
      <div class="logo">
        <span class="icon">🏫</span>
        <span class="text">智托管</span>
      </div>
      <div class="nav-actions">
        <el-button round class="nav-login-btn" @click="showLoginModal">登录系统</el-button>
      </div>
    </header>

    <main class="hero-section">
      <div class="hero-content">
        <h1 class="slogan">
          让教务管理<br>
          <span class="highlight">回归简单与纯粹</span>
        </h1>
        <p class="sub-slogan">
          专为中小托管机构打造的智能管家。从LBS生源地图到精准的财务流水，
          我们要做的，是让你从繁琐的表格中彻底解放。
        </p>
        <div class="hero-actions">
          <el-button type="primary" size="large" class="cta-btn" @click="showLoginModal">
            立即体验演示
            <el-icon class="el-icon--right"><Right /></el-icon>
          </el-button>
        </div>
      </div>
      
      <div class="hero-image">
        <div class="floating-card card-1">
          <div class="icon">🗺️</div>
          <div class="text">生源分布可视化</div>
        </div>
        <div class="floating-card card-2">
          <div class="icon">💰</div>
          <div class="text">财务流水 0 差错</div>
        </div>
      </div>
    </main>

    <section class="features-section">
      <div class="feature-item">
        <div class="feature-icon">📍</div>
        <h3>LBS 智能地图</h3>
        <p>集成高德地图 SDK，将学员住址转化为可视化坐标，辅助市场决策与校车规划。</p>
      </div>
      <div class="feature-item">
        <div class="feature-icon">⚡️</div>
        <h3>一键消课签到</h3>
        <p>告别纸质签到表。3秒完成学员签到，系统自动扣除课时并计算剩余有效期。</p>
      </div>
      <div class="feature-item">
        <div class="feature-icon">🛡️</div>
        <h3>严谨财务闭环</h3>
        <p>独创负数订单逻辑，完美处理退费、转课等复杂场景，每一分钱都有据可查。</p>
      </div>
    </section>

    <section class="contact-section">
      <div class="contact-container">
        <h2 class="section-title">🤝 联系我们</h2>
        <div class="contact-grid">
          <div class="contact-card">
            <div class="icon-box mobile">
              <el-icon><Phone /></el-icon>
            </div>
            <div class="info">
              <div class="label">手机 / 微信</div>
              <div class="value">18504254380</div>
            </div>
          </div>
          
          <div class="contact-card">
            <div class="icon-box email">
              <el-icon><Message /></el-icon>
            </div>
            <div class="info">
              <div class="label">电子邮箱</div>
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

    <el-dialog
      v-model="loginVisible"
      title="欢迎回来"
      width="400px"
      align-center
      class="login-dialog"
    >
      <div class="dialog-header">
        <p>请登录您的账号以继续管理</p>
        <el-tag type="warning" effect="plain" class="visitor-tag" @click="fillVisitor">
          ⚡️ 访客快捷通道: visitor / 123456
        </el-tag>
      </div>

      <el-form :model="loginForm" :rules="rules" ref="loginFormRef" size="large" @keyup.enter="handleLogin">
        <el-form-item prop="username">
          <el-input 
            v-model="loginForm.username" 
            placeholder="请输入账号" 
            :prefix-icon="User"
          />
        </el-form-item>

        <el-form-item prop="password">
          <el-input 
            v-model="loginForm.password" 
            type="password" 
            placeholder="请输入密码" 
            :prefix-icon="Lock" 
            show-password
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="loading" class="full-width-btn" @click="handleLogin">
            登 录
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
import { User, Lock, Right, Phone, Message } from '@element-plus/icons-vue';
import axios from 'axios';

const router = useRouter();
const loginVisible = ref(false);
const loginFormRef = ref(null);
const loading = ref(false);

const loginForm = reactive({
  username: '',
  password: ''
});

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
};

const showLoginModal = () => {
  loginVisible.value = true;
};

const fillVisitor = () => {
  loginForm.username = 'visitor';
  loginForm.password = '123456';
  ElMessage.success('已自动填充演示账号');
};

const handleLogin = async () => {
  if (!loginFormRef.value) return;

  await loginFormRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true;
      try {
        const res = await axios.post('/api/login', loginForm);

        if (res.data.code === 200) {
          ElMessage.success('登录成功');
          localStorage.setItem('user_token', 'logged_in');
          localStorage.setItem('user_info', JSON.stringify(res.data.data));
          loginVisible.value = false;
          router.push('/');
        } else {
          ElMessage.error(res.data.msg || '登录失败');
        }
      } catch (err) {
        console.error(err);
        ElMessage.error('服务器连接失败');
      } finally {
        loading.value = false;
      }
    }
  });
};
</script>

<style scoped>
/* 全局容器 */
.landing-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%);
  font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', sans-serif;
  color: #303133;
}

/* 导航栏 */
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

/* Hero 区域 */
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

/* 特性区 */
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

/* --- 新增：联系我们区域 --- */
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

/* 底部 */
.footer {
  text-align: center;
  padding: 40px;
  color: #909399;
  font-size: 14px;
  background: white;
  border-top: 1px solid #ebeef5;
}

/* 登录弹窗 */
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
</style>