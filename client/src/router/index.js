// client/src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import Layout from '../layout/Layout.vue'
import Dashboard from '../views/Dashboard.vue' 
// 注意：确保你之前把 Dashboard 代码放到了 client/src/views/Dashboard.vue
import Login from '../views/Login.vue' // 引入登录页

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: Login
  },
  {
    path: '/',
    component: Layout, // 先加载布局
    children: [
      {
        path: '', // 默认子路由 (首页)
        name: 'Dashboard',
        component: Dashboard
      },
      {
        path: 'students',
        name: 'Students',
        // 懒加载：暂时先写个空壳，等会我们去建这个文件
        component: () => import('../views/StudentList.vue') 
      },
      { 
        path: 'attendance', 
        name: 'Attendance', 
        component: () => import('../views/Attendance.vue') 
      },
      { 
        path: 'orders', 
        name: 'Orders', 
        // 懒加载你的订单列表页
        component: () => import('../views/OrderList.vue') 
      },
      { 
        path: 'classes', 
        name: 'Classes', 
        component: () => import('../views/ClassManagement.vue') 
      },
      {
        path: 'students/:id', // 动态路由
        name: 'StudentDetail',
        component: () => import('../views/StudentDetail.vue')
      },
      { 
        path: 'users', 
        name: 'Users', 
        component: () => import('../views/UserList.vue') 
      },
      { 
        path: 'map', 
        name: 'StudentMap', 
        component: () => import('../views/StudentMap.vue') 
      },
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// ⭐ 全局前置守卫 (Global Guard)
router.beforeEach((to, from, next) => {
  // 1. 检查是否有 Token (登录凭证)
  const isAuthenticated = localStorage.getItem('user_token')

  // 2. 如果去的地方不是登录页，且没有登录
  if (to.name !== 'Login' && !isAuthenticated) {
    next({ name: 'Login' }) // 强制踢回登录页
  } 
  // 3. 登录了还想去登录页？直接踢回首页 (优化体验)
  else if (to.name === 'Login' && isAuthenticated) {
    next({ name: 'Dashboard' })
  }
  // 4. 放行
  else {
    next()
  }
})

export default router