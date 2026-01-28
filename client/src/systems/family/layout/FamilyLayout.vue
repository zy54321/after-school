<template>
  <div class="family-layout">
    <!-- 顶部导航栏 -->
    <header class="family-header">
      <div class="header-content">
        <div class="logo-section">
          <router-link to="/family/home" class="logo-link">
            <span class="logo-icon">🏠</span>
            <span class="logo-text">家庭成长银行</span>
          </router-link>
        </div>
        
        <nav class="main-nav">
          <router-link to="/family/market" class="nav-item" active-class="active">
            <span class="nav-icon">🛒</span>
            <span class="nav-text">市场</span>
          </router-link>
          <router-link 
            :to="currentMemberId ? `/family/member/${currentMemberId}/wallet` : '/family/dashboard'" 
            class="nav-item" 
            :class="{ active: $route.path.includes('/family/member/') }"
          >
            <span class="nav-icon">👤</span>
            <span class="nav-text">成员</span>
          </router-link>
          <router-link to="/family/dashboard" class="nav-item" active-class="active">
            <span class="nav-icon">📊</span>
            <span class="nav-text">总览</span>
          </router-link>
        </nav>
        
        <div class="user-section">
          <button @click="handleLogout" class="logout-btn">退出</button>
        </div>
      </div>
    </header>
    
    <!-- 主内容区 -->
    <main class="family-main">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { clearSessionCache } from '@/router';

const route = useRoute();
const router = useRouter();

// 从路由获取当前成员ID
const currentMemberId = computed(() => {
  return route.params.id || localStorage.getItem('currentMemberId');
});

// 登出
const handleLogout = async () => {
  try {
    await axios.post('/api/auth/logout');
  } catch (err) {
    console.error('登出失败:', err);
  }
  clearSessionCache();
  localStorage.removeItem('currentMemberId');
  router.push('/family/home');
};

</script>

<style scoped>
.family-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
}

.family-header {
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo-section .logo-link {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
}

.logo-icon {
  font-size: 28px;
}

.logo-text {
  font-size: 20px;
  font-weight: 700;
  background: linear-gradient(135deg, #ffd700, #ffb700);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.main-nav {
  display: flex;
  gap: 8px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border-radius: 12px;
  text-decoration: none;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
  transition: all 0.3s ease;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.nav-item.active {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.nav-icon {
  font-size: 18px;
}

.nav-text {
  font-size: 14px;
}

.user-section {
  display: flex;
  align-items: center;
  gap: 16px;
}


.logout-btn {
  padding: 8px 16px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.logout-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.family-main {
  flex: 1;
  min-height: calc(100vh - 70px);
  height: calc(100vh - 70px);
  padding: 0;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 响应式 */
@media (max-width: 768px) {
  .header-content {
    padding: 0 16px;
  }
  
  .logo-text {
    display: none;
  }
  
  .nav-text {
    display: none;
  }
  
  .nav-item {
    padding: 10px 14px;
  }
  
}
</style>
