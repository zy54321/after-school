import { createRouter, createWebHistory } from 'vue-router'

// 引入布局组件（新结构）
import PortalLayout from '../portal/layout/PortalLayout.vue'
import EducationLayout from '../systems/education/layout/EducationLayout.vue'
import AnalyticsLayout from '../systems/analytics/layout/AnalyticsLayout.vue'

const routes = [
  // 1. 门户层 (Portal) - 公开访问
  {
    path: '/',
    component: PortalLayout,
    children: [
      { 
        path: '', 
        name: 'Home', 
        component: () => import('../portal/views/Home.vue') 
      }
    ]
  },

  // 2. 教务系统首页 - 独立页面（不使用布局）
  {
    path: '/system/home',
    name: 'SystemHome',
    component: () => import('../systems/education/views/SystemHome.vue')
  },

  // 3. 教务系统层 (Education System) - 需鉴权
  {
    path: '/system',
    component: EducationLayout,
    meta: { requiresAuth: true }, // 标记需登录
    children: [
      { 
        path: 'dashboard', // 访问路径: /system/dashboard
        name: 'Dashboard', 
        component: () => import('../systems/education/views/Dashboard.vue') 
      },
      { 
        path: 'students', 
        name: 'Students', 
        component: () => import('../systems/education/views/StudentList.vue') 
      },
      { 
        path: 'students/:id', 
        name: 'StudentDetail',
        component: () => import('../systems/education/views/StudentDetail.vue')
      },
      { 
        path: 'attendance', 
        name: 'Attendance', 
        component: () => import('../systems/education/views/Attendance.vue') 
      },
      { 
        path: 'orders', 
        name: 'Orders', 
        component: () => import('../systems/education/views/OrderList.vue') 
      },
      { 
        path: 'classes', 
        name: 'Classes', 
        component: () => import('../systems/education/views/ClassManagement.vue') 
      },
      { 
        path: 'users', 
        name: 'Users', 
        component: () => import('../systems/education/views/UserList.vue') 
      },
      // 原 "生源热力图" 现已归入系统作为基础 "网格化管理"
      { 
        path: 'grid-map', 
        name: 'GridMap', 
        component: () => import('../systems/education/views/StudentMap.vue') 
      },
    ]
  },

  // 4. 商业分析层 (Analytics System) - 需鉴权
  {
    path: '/strategy',
    component: AnalyticsLayout,
    meta: { requiresAuth: true }, // 标记需登录
    children: [
      { 
        path: 'map', 
        name: 'StrategyMap', 
        component: () => import('../systems/analytics/views/StrategyMap.vue'),
        meta: { requiresAuth: true } // 子路由也需要登录
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

  // 1. 需要登录，但没 Token -> 跳转到教务系统首页，并带上目标路径
  if (to.meta.requiresAuth && !token) {
    next({ 
      path: '/system/home', 
      query: { redirect: to.fullPath } 
    });
  }
  // 3. 其他情况，放行
  else {
    next();
  }
})

export default router
