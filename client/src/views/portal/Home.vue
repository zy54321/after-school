<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Location } from '@element-plus/icons-vue';

const router = useRouter();
const { locale } = useI18n();

const currentLang = ref(locale.value);

const handleLangCommand = (command) => {
  locale.value = command;
  currentLang.value = command;
  localStorage.setItem('lang', command);
};

const handleSystemClick = () => {
  router.push({
    name: 'Login',
    query: { redirect: '/system/dashboard' }
  });
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
  overflow-y: auto;
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
  justify-content: center;
  align-items: center;
  gap: 60px;
  padding: 40px 20px;
  z-index: 5;
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
  line-height: 1.5;
  margin-bottom: 30px;
  height: 42px;
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
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  opacity: 0.2;
  z-index: 1;
  pointer-events: none;
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
      </div>
    </header>

    <main class="main-content">

      <section class="hero-area">
        <div class="badge-pill">Vue 3 • Node.js • PostGIS</div>
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

        <div class="app-card" @click="$router.push({ name: 'StrategyMap' })">
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
  </div>
</template>