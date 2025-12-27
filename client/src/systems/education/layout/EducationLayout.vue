<template>
  <div class="common-layout">
    <el-container>
      <el-aside width="200px" class="aside-menu">
        <div class="logo">{{ $t('app.name') }}</div>
        <el-menu active-text-color="#ffd04b" background-color="#545c64" class="el-menu-vertical-demo"
          :default-active="route.path" text-color="#fff" router>

          <el-menu-item index="/system/dashboard"> <el-icon>
              <Odometer />
            </el-icon>
            <span>{{ $t('menu.dashboard') }}</span>
          </el-menu-item>

          <el-menu-item index="/system/students"> <el-icon>
              <User />
            </el-icon>
            <span>{{ $t('menu.students') }}</span>
          </el-menu-item>

          <el-menu-item index="/system/grid-map">
            <el-icon>
              <MapLocation />
            </el-icon>
            <span>{{ $t('menu.map') }}</span>
          </el-menu-item>

          <el-menu-item index="/system/attendance"> <el-icon>
              <Calendar />
            </el-icon>
            <span>{{ $t('menu.attendance') }}</span>
          </el-menu-item>

          <el-menu-item index="/system/orders" v-if="role === 'admin'"> <el-icon>
              <Money />
            </el-icon>
            <span>{{ $t('menu.orders') }}</span>
          </el-menu-item>

          <el-menu-item index="/system/classes"> <el-icon>
              <School />
            </el-icon>
            <span>{{ $t('menu.classes') }}</span>
          </el-menu-item>

          <el-menu-item index="/system/users" v-if="role === 'admin'"> <el-icon>
              <Tools />
            </el-icon>
            <span>{{ $t('menu.users') }}</span>
          </el-menu-item>

          <el-sub-menu index="/system/catering">
            <template #title>
              <el-icon>
                <Food />
              </el-icon> <span>餐饮管理</span>
            </template>
            <el-menu-item index="/system/catering/ingredients">
              <el-icon>
                <Apple />
              </el-icon> 食材库
            </el-menu-item>
            <el-menu-item index="/system/catering/dishes">
              <el-icon>
                <Dish />
              </el-icon> 菜品库
            </el-menu-item>
            <el-menu-item index="/system/catering/weekly-menu">
              <el-icon>
                <Calendar />
              </el-icon> 食谱排期
            </el-menu-item>
          </el-sub-menu>

          <el-menu-item index="/system/daily-workflow">
            <el-icon>
              <DataBoard />
            </el-icon> <span>特训工作台</span>
          </el-menu-item>

          <el-menu-item index="PORTAL_LINK" @click="goHome">
            <el-icon>
              <HomeFilled />
            </el-icon>
            <span>{{ $t('menu.portal') }}</span>
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
import { Odometer, User, Calendar, Money, School, Tools, MapLocation, HomeFilled, Food, Apple, Dish } from '@element-plus/icons-vue';
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
  router.push('/');
  ElMessage.success('Logout success');
};

const goHome = () => {
  router.push('/');
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

.el-menu-vertical-demo {
  /* 确保菜单使用 flex 布局 */
  display: flex;
  flex-direction: column;
  height: 100%;
}
</style>
