<template>
  <div class="common-layout">
    <el-container>
      <el-aside width="200px" class="aside-menu">
        <div class="logo">托管班管理系统</div>
        <el-menu active-text-color="#ffd04b" background-color="#545c64" class="el-menu-vertical-demo"
          :default-active="route.path" text-color="#fff" router>
          <el-menu-item index="/">
            <el-icon>
              <Odometer />
            </el-icon>
            <span>仪表盘</span>
          </el-menu-item>

          <el-menu-item index="/students">
            <el-icon>
              <User />
            </el-icon>
            <span>学员管理</span>
          </el-menu-item>

          <el-menu-item index="/attendance">
            <el-icon>
              <Calendar />
            </el-icon>
            <span>签到消课</span>
          </el-menu-item>

          <el-menu-item index="/orders">
            <el-icon>
              <Money />
            </el-icon> <span>订单流水</span>
          </el-menu-item>

          <el-menu-item index="/classes">
            <el-icon>
              <School />
            </el-icon> <span>课程/班级</span>
          </el-menu-item>
        </el-menu>
      </el-aside>

      <el-container>
        <el-header class="header">
          <span>欢迎回来，管理员</span>
          <el-button type="danger" size="small" link @click="handleLogout">退出</el-button>
        </el-header>

        <el-main class="main-content">
          <router-view></router-view>
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup>
import { Odometer, User, Calendar } from '@element-plus/icons-vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';

const router = useRouter();
const route = useRoute();

const handleLogout = () => {
  // 1. 清除本地存储
  localStorage.removeItem('user_token');
  localStorage.removeItem('user_info');

  // 2. 强制跳转回登录页
  router.push('/login');
  ElMessage.success('已退出登录');
};
</script>

<style scoped>
.common-layout,
.el-container {
  height: 100vh;
  /* 全屏高度 */
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

.main-content {
  background-color: #f0f2f5;
  padding: 20px;
}
</style>