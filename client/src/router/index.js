import { createRouter, createWebHistory } from 'vue-router'
import Login from '../views/Login.vue'

// 引入新的布局组件
// 注意：原 Layout.vue 已重命名为 AdminLayout.vue
import PortalLayout from '../layout/PortalLayout.vue'
import AdminLayout from '../layout/AdminLayout.vue' 
import StrategyLayout from '../layout/StrategyLayout.vue'

const routes = [
  // 1. 门户层 (Portal) - 公开访问
  {
    path: '/',
    component: PortalLayout,
    children: [
      { 
        path: '', 
        name: 'Home', 
        component: () => import('../views/portal/Home.vue') 
      }
    ]
  },

  // 2. 登录页 - 独立
  {
    path: '/login',
    name: 'Login',
    component: Login
  },

  // 3. 教务系统层 (System) - 需鉴权
  {
    path: '/system',
    component: AdminLayout,
    meta: { requiresAuth: true }, // 标记需登录
    children: [
      { 
        path: 'dashboard', // 访问路径: /system/dashboard
        name: 'Dashboard', 
        component: () => import('../views/system/Dashboard.vue') 
      },
      { 
        path: 'students', 
        name: 'Students', 
        component: () => import('../views/system/StudentList.vue') 
      },
      { 
        path: 'students/:id', 
        name: 'StudentDetail',
        component: () => import('../views/system/StudentDetail.vue')
      },
      { 
        path: 'attendance', 
        name: 'Attendance', 
        component: () => import('../views/system/Attendance.vue') 
      },
      { 
        path: 'orders', 
        name: 'Orders', 
        component: () => import('../views/system/OrderList.vue') 
      },
      { 
        path: 'classes', 
        name: 'Classes', 
        component: () => import('../views/system/ClassManagement.vue') 
      },
      { 
        path: 'users', 
        name: 'Users', 
        component: () => import('../views/system/UserList.vue') 
      },
      // 原 "生源热力图" 现已归入系统作为基础 "网格化管理"
      { 
        path: 'grid-map', 
        name: 'GridMap', 
        component: () => import('../views/system/StudentMap.vue') 
      },
    ]
  },

  // 4. 战略分析层 (Strategy) - 需鉴权
  {
    path: '/strategy',
    component: StrategyLayout,
    // meta: { requiresAuth: true },
    children: [
      { 
        path: 'map', 
        name: 'StrategyMap', 
        component: () => import('../views/strategy/StrategyMap.vue') 
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 🚀 路由守卫
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('user_token')

  // 1. 需要登录，但没 Token -> 踢回登录页，并带上目标路径
  if (to.meta.requiresAuth && !token) {
    next({ 
      path: '/login', 
      query: { redirect: to.fullPath } 
    });
  } 
  // 2. [修改点] 已登录，还想去登录页 -> 放行 (允许用户看到"欢迎回来"页面)
  else if (to.path === '/login' && token) {
    next(); 
  }
  // 3. 其他情况，放行
  else {
    next();
  }
})

export default router