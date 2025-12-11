<template>
  <div class="common-layout">
    <el-container>
      <el-aside width="200px" class="aside-menu">
        <div class="logo">{{ $t('app.name') }}</div> <el-menu active-text-color="#ffd04b" background-color="#545c64" class="el-menu-vertical-demo"
          :default-active="route.path" text-color="#fff" router>
          
          <el-menu-item index="/">
            <el-icon><Odometer /></el-icon>
            <span>{{ $t('menu.dashboard') }}</span>
          </el-menu-item>

          <el-menu-item index="/students">
            <el-icon><User /></el-icon>
            <span>{{ $t('menu.students') }}</span>
          </el-menu-item>

          <el-menu-item index="/attendance">
            <el-icon><Calendar /></el-icon>
            <span>{{ $t('menu.attendance') }}</span>
          </el-menu-item>

          <el-menu-item index="/orders" v-if="role === 'admin'">
            <el-icon><Money /></el-icon> <span>{{ $t('menu.orders') }}</span>
          </el-menu-item>

          <el-menu-item index="/classes">
            <el-icon><School /></el-icon> <span>{{ $t('menu.classes') }}</span>
          </el-menu-item>

          <el-menu-item index="/users" v-if="role === 'admin'">
            <el-icon><Tools /></el-icon>
            <span>{{ $t('menu.users') }}</span>
          </el-menu-item>
        </el-menu>
      </el-aside>

      <el-container>
        <el-header class="header">
          <span>{{ $t('header.welcome') }}</span>
          
          <div class="header-right">
             <el-dropdown @command="handleLangCommand" style="margin-right: 20px; cursor: pointer;">
              <span class="lang-switch-dark">
                🌐 {{ currentLang === 'zh' ? '中文' : 'English' }}
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="zh">中文</el-dropdown-item>
                  <el-dropdown-item command="en">English</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>

            <el-button type="danger" size="small" link @click="handleLogout">{{ $t('header.logout') }}</el-button>
          </div>
        </el-header>

        <el-main class="main-content">
          <router-view></router-view>
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup>
import { Odometer, User, Calendar, Money, School, Tools } from '@element-plus/icons-vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

const router = useRouter();
const route = useRoute();
const { locale } = useI18n(); // 获取 i18n
const currentLang = ref(locale.value);

const userInfoStr = localStorage.getItem('user_info');
const userInfo = userInfoStr ? JSON.parse(userInfoStr) : {};
const role = userInfo.role || 'teacher';

const handleLogout = () => {
  localStorage.removeItem('user_token');
  localStorage.removeItem('user_info');
  router.push('/login');
  ElMessage.success('Logout success');
};

// 切换语言
const handleLangCommand = (command) => {
  locale.value = command;
  currentLang.value = command;
  localStorage.setItem('lang', command);
  ElMessage.success(command === 'zh' ? '已切换至中文' : 'Switched to English');
};
</script>

<style scoped>
.common-layout,
.el-container {
  height: 100vh;
}
.aside-menu {
  background-color: #545c64;
  color: white;
}
.logo {
  height: 60px;
  line-height: 60px;
  text-align: center;
  font-weight: bold;
  font-size: 18px;
  background-color: #434a50;
}
.header {
  background-color: #fff;
  border-bottom: 1px solid #ddd;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.header-right {
  display: flex;
  align-items: center;
}
.main-content {
  background-color: #f0f2f5;
  padding: 20px;
}
.lang-switch-dark {
  font-size: 14px;
  color: #606266;
}
</style>