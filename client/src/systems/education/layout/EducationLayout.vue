<template>
  <el-container class="h-screen w-full">
    <el-aside width="220px" class="bg-white shadow-md flex flex-col transition-all duration-300">
      <div class="h-16 flex items-center justify-center border-b bg-blue-600 text-white">
        <el-icon class="mr-2" :size="20">
          <School />
        </el-icon>
        <span class="font-bold text-lg">教务系统</span>
      </div>

      <el-menu :default-active="route.path" class="border-r-0 flex-1 overflow-y-auto" :router="true">
        <el-menu-item index="/education/dashboard">
          <el-icon>
            <Odometer />
          </el-icon>
          <template #title>{{ locale === 'zh' ? '仪表盘' : 'Dashboard' }}</template>
        </el-menu-item>

        <el-menu-item index="/education/students" v-if="check('edu:student:view')">
          <el-icon>
            <User />
          </el-icon>
          <template #title>{{ locale === 'zh' ? '学员管理' : 'Students' }}</template>
        </el-menu-item>

        <el-menu-item index="/education/map" v-if="check('edu:student:view')">
          <el-icon>
            <MapLocation />
          </el-icon>
          <template #title>{{ locale === 'zh' ? '生源地图' : 'Map' }}</template>
        </el-menu-item>

        <el-menu-item index="/education/attendance" v-if="check('edu:attendance:view')">
          <el-icon>
            <Calendar />
          </el-icon>
          <template #title>{{ locale === 'zh' ? '考勤中心' : 'Attendance' }}</template>
        </el-menu-item>

        <el-menu-item index="/education/classes" v-if="check('edu:class:manage')">
          <el-icon>
            <School />
          </el-icon>
          <template #title>{{ locale === 'zh' ? '班级管理' : 'Classes' }}</template>
        </el-menu-item>

        <el-menu-item index="/education/orders" v-if="check('edu:class:manage')">
          <el-icon>
            <Money />
          </el-icon>
          <template #title>{{ locale === 'zh' ? '订单管理' : 'Orders' }}</template>
        </el-menu-item>

        <el-sub-menu index="/catering" v-if="check('cat:menu:view')">
          <template #title>
            <el-icon>
              <Food />
            </el-icon>
            <span>{{ locale === 'zh' ? '餐饮食谱' : 'Catering' }}</span>
          </template>
          <el-menu-item index="/catering/weekly-menu">
            <el-icon>
              <Dish />
            </el-icon>
            {{ locale === 'zh' ? '每周食谱' : 'Weekly Menu' }}
          </el-menu-item>
          <el-menu-item index="/catering/ingredients">
            <el-icon>
              <Apple />
            </el-icon>
            {{ locale === 'zh' ? '食材库' : 'Ingredients' }}
          </el-menu-item>
          <el-menu-item index="/catering/shopping-list">
            <el-icon>
              <ShoppingCart />
            </el-icon>
            {{ locale === 'zh' ? '采购清单' : 'Shopping List' }}
          </el-menu-item>
        </el-sub-menu>

        <el-menu-item index="/education/users" v-if="check('edu:user:view')">
          <el-icon>
            <Tools />
          </el-icon>
          <template #title>{{ locale === 'zh' ? '员工管理' : 'Staff' }}</template>
        </el-menu-item>

        <div class="border-t my-2 mx-4"></div>

        <el-menu-item @click="goHome">
          <el-icon>
            <HomeFilled />
          </el-icon>
          <template #title>{{ locale === 'zh' ? '返回门户' : 'Portal' }}</template>
        </el-menu-item>
      </el-menu>

      <div class="p-4 border-t bg-gray-50 flex items-center">
        <div
          class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold mr-2 shrink-0">
          {{ (userInfo.real_name || userInfo.username || 'U')[0].toUpperCase() }}
        </div>
        <div class="flex-1 min-w-0 overflow-hidden">
          <p class="text-sm font-medium truncate text-gray-800">{{ userInfo.real_name || userInfo.username }}</p>
          <p class="text-xs text-gray-500 truncate">{{ role }}</p>
        </div>
        <el-button link type="danger" size="small" @click="handleLogout" class="ml-1">
          <span class="text-xs">退出</span>
        </el-button>
      </div>
    </el-aside>

    <el-container>
      <el-header class="bg-white border-b flex items-center justify-between px-6 h-16 shadow-sm z-10">
        <div class="flex items-center">
          <h2 class="text-lg font-medium text-gray-800">{{ route.meta.title || (locale === 'zh' ? '教务管理' : 'Education')
            }}
          </h2>
        </div>

        <el-dropdown @command="handleLangCommand">
          <span class="cursor-pointer text-gray-600 hover:text-blue-600 flex items-center outline-none">
            {{ currentLang === 'zh' ? '中文' : 'English' }}
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
      </el-header>

      <el-main class="bg-gray-50 p-6 overflow-auto">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import {
  Odometer, User, Calendar, Money, School, Tools, MapLocation,
  HomeFilled, Food, Apple, Dish, ShoppingCart, ArrowDown
} from '@element-plus/icons-vue';

import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

// 🔴 修复点：使用相对路径引用，防止 @ 别名未配置导致的白屏
import { hasPermission } from '../../../utils/auth';

const router = useRouter();
const route = useRoute();
const { locale } = useI18n();
const currentLang = ref(locale.value);

const userInfoStr = localStorage.getItem('user_info');
let userInfo = {};
try {
  userInfo = userInfoStr ? JSON.parse(userInfoStr) : {};
} catch (e) {
  console.error('User info parse error', e);
}
const role = userInfo.role || 'teacher';

// 权限检查函数
const check = (key) => {
  // 防御性检查：如果 hasPermission 未正确加载，直接返回 true 或 false，防止报错白屏
  if (typeof hasPermission !== 'function') return false;
  // admin 兜底
  if (role === 'admin') return true;
  return hasPermission(key);
};

const handleLogout = () => {
  localStorage.removeItem('user_token');
  localStorage.removeItem('user_info');
  router.push('/');
  ElMessage.success(locale.value === 'zh' ? '退出成功' : 'Logout success');
};

const goHome = () => {
  router.push('/');
};

const handleLangCommand = (command) => {
  locale.value = command;
  currentLang.value = command;
  localStorage.setItem('lang', command);
  ElMessage.success(command === 'zh' ? '已切换至中文' : 'Switched to English');
};
</script>

<style scoped>
.el-menu-item.is-active {
  background-color: #ecf5ff;
  color: #409eff;
  border-right: 3px solid #409eff;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>