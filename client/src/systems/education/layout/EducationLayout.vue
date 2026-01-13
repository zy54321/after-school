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

          <el-menu-item index="/system/orders" v-if="hasPermission('order:read')"> <el-icon>
              <Money />
            </el-icon>
            <span>{{ $t('menu.orders') }}</span>
          </el-menu-item>

          <el-menu-item index="/system/classes"> <el-icon>
              <School />
            </el-icon>
            <span>{{ $t('menu.classes') }}</span>
          </el-menu-item>

          <el-menu-item index="/system/users" v-if="hasPermission('user:read')"> <el-icon>
              <Tools />
            </el-icon>
            <span>{{ $t('menu.users') }}</span>
          </el-menu-item>

          <el-sub-menu index="/system/permissions" v-if="hasPermission('permission:read')">
            <template #title>
              <el-icon>
                <Lock />
              </el-icon>
              <span>{{ $t('permission.title') }}</span>
            </template>
            <el-menu-item index="/system/permissions">
              <el-icon>
                <Lock />
              </el-icon>
              {{ $t('permission.permissionConfig') }}
            </el-menu-item>
            <el-menu-item index="/system/user-roles">
              <el-icon>
                <User />
              </el-icon>
              {{ $t('userRole.title') }}
            </el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="/system/catering">
            <template #title>
              <el-icon>
                <Food />
              </el-icon> <span>{{ $t('catering.menu.title') }}</span>
            </template>
            <el-menu-item index="/system/catering/ingredients">
              <el-icon>
                <Apple />
              </el-icon> {{ $t('catering.menu.ingredients') }}
            </el-menu-item>
            <el-menu-item index="/system/catering/dishes">
              <el-icon>
                <Dish />
              </el-icon> {{ $t('catering.menu.dishes') }}
            </el-menu-item>
            <el-menu-item index="/system/catering/weekly-menu">
              <el-icon>
                <Calendar />
              </el-icon> {{ $t('catering.menu.weeklyMenu') }}
            </el-menu-item>
            <el-menu-item index="/system/catering/shopping-list">
              <el-icon>
                <ShoppingCart />
              </el-icon> {{ $t('catering.menu.shoppingList') }}
            </el-menu-item>
            <el-menu-item index="/system/catering/cost-analysis">
              <el-icon>
                <Money />
              </el-icon> {{ $t('catering.menu.costAnalysis') }}
            </el-menu-item>
          </el-sub-menu>

          <el-menu-item index="/system/daily-workflow">
            <el-icon>
              <DataBoard />
            </el-icon> <span>{{ $t('workflow.title') }}</span>
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
                🌐 {{ currentLang === 'zh' ? $t('common.lang.zh') : $t('common.lang.en') }}
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="zh">{{ $t('common.lang.zh') }}</el-dropdown-item>
                  <el-dropdown-item command="en">{{ $t('common.lang.en') }}</el-dropdown-item>
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
import { Odometer, User, Calendar, Money, School, Tools, MapLocation, HomeFilled, Food, Apple, Dish, ShoppingCart, DataBoard, Lock } from '@element-plus/icons-vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePermission, clearUserPermissions } from '@/composables/usePermission';
import axios from 'axios';

const router = useRouter();
const route = useRoute();
const { locale, t } = useI18n(); // 获取 i18n
const currentLang = ref(locale.value);

const userInfoStr = localStorage.getItem('user_info');
const userInfo = userInfoStr ? JSON.parse(userInfoStr) : {};
const role = userInfo.role || 'teacher';

// 权限检查
const { hasPermission } = usePermission();

// 加载用户权限
onMounted(async () => {
  try {
    const res = await axios.get('/api/permissions/auth/permissions');
    if (res.data.code === 200) {
      const { initUserPermissions } = await import('@/composables/usePermission');
      initUserPermissions(res.data.data);
    }
  } catch (error) {
    console.error('加载用户权限失败:', error);
  }
});

const handleLogout = () => {
  localStorage.removeItem('user_token');
  localStorage.removeItem('user_info');
  localStorage.removeItem('user_permissions');
  clearUserPermissions();
  router.push('/');
  ElMessage.success(t('header.logout') + ' ' + t('common.success'));
};

const goHome = () => {
  router.push('/');
};

// 切换语言
const handleLangCommand = (command) => {
  locale.value = command;
  currentLang.value = command;
  localStorage.setItem('lang', command);
  const { t } = useI18n();
  ElMessage.success(command === 'zh' ? t('common.lang.switchedToZh') : t('common.lang.switchedToEn'));
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
  /* ⭐ 核心修改：隐藏溢出，配合子页面的 Flex 布局实现局部滚动 */
  overflow: hidden;
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