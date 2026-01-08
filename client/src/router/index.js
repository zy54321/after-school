import { createRouter, createWebHistory } from 'vue-router';

// 引入布局组件（新结构）
import PortalLayout from '../portal/layout/PortalLayout.vue';
import EducationLayout from '../systems/education/layout/EducationLayout.vue';
import AnalyticsLayout from '../systems/analytics/layout/AnalyticsLayout.vue';

const routes = [
  // 1. 门户层 (Portal) - 公开访问
  {
    path: '/',
    component: PortalLayout,
    children: [
      {
        path: '',
        name: 'Home',
        component: () => import('../portal/views/Home.vue'),
      },
    ],
  },

  // 2. 教务系统首页 - 独立页面（不使用布局）
  {
    path: '/system/home',
    name: 'SystemHome',
    component: () => import('../systems/education/views/SystemHome.vue'),
  },

  // 2.1 商业分析系统首页 - 独立页面（不使用布局）
  {
    path: '/strategy/home',
    name: 'AnalyticsHome',
    component: () => import('../systems/analytics/views/AnalyticsHome.vue'),
  },

  // 2.2 家庭积分系统首页 - 独立页面 (新增)
  {
    path: '/family/home',
    name: 'FamilyHome',
    component: () => import('../systems/family/views/FamilyHome.vue'),
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
        component: () => import('../systems/education/views/Dashboard.vue'),
      },
      {
        path: 'students',
        name: 'Students',
        component: () => import('../systems/education/views/StudentList.vue'),
      },
      {
        path: 'students/:id',
        name: 'StudentDetail',
        component: () => import('../systems/education/views/StudentDetail.vue'),
      },
      {
        path: 'attendance',
        name: 'Attendance',
        component: () => import('../systems/education/views/Attendance.vue'),
      },
      {
        path: 'orders',
        name: 'Orders',
        component: () => import('../systems/education/views/OrderList.vue'),
      },
      {
        path: 'classes',
        name: 'Classes',
        component: () =>
          import('../systems/education/views/ClassManagement.vue'),
      },
      {
        path: 'users',
        name: 'Users',
        component: () => import('../systems/education/views/UserList.vue'),
      },
      {
        path: 'permissions',
        name: 'Permissions',
        component: () => import('../systems/education/views/PermissionManagement.vue'),
        meta: { title: '权限配置管理' },
      },
      {
        path: 'user-roles',
        name: 'UserRoles',
        component: () => import('../systems/education/views/UserRoleAssignment.vue'),
        meta: { title: '用户角色分配' },
      },
      {
        path: 'grid-map',
        name: 'GridMap',
        component: () => import('../systems/education/views/StudentMap.vue'),
      },
      {
        path: 'daily-workflow',
        name: 'DailyWorkflow',
        component: () => import('../systems/education/views/DailyWorkflow.vue'),
        meta: { title: '特训工作台' },
      },
      {
        path: 'students/:id',
        component: () => import('../systems/education/views/StudentDetail.vue'),
      },
      {
        path: 'catering/ingredients',
        name: 'Ingredients',
        component: () => import('../systems/catering/views/Ingredients.vue'),
        meta: { title: '食材库' },
      },
      {
        path: 'catering/dishes',
        name: 'Dishes',
        component: () => import('../systems/catering/views/Dishes.vue'),
        meta: { title: '菜品库' },
      },
      {
        path: 'catering/weekly-menu',
        name: 'WeeklyMenu',
        component: () => import('../systems/catering/views/WeeklyMenu.vue'),
        meta: { title: '食谱排期' },
      },
      {
        path: 'catering/shopping-list',
        name: 'ShoppingList',
        component: () => import('../systems/catering/views/ShoppingList.vue'),
        meta: { title: '智能采购' },
      },
      {
        path: 'catering/cost-analysis',
        name: 'CostAnalysis',
        component: () => import('../systems/catering/views/CostAnalysis.vue'),
        meta: { title: '成本控制' },
      },
    ],
  },
  {
    path: '/report/view',
    name: 'ReportView',
    component: () => import('../systems/education/views/ReportView.vue'),
    meta: { title: '成长日报' },
  },
  {
    path: '/weekly-menu',
    name: 'PublicWeeklyMenu',
    component: () => import('../systems/catering/views/PublicWeeklyMenu.vue'),
    meta: { title: '本周食谱' },
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
        meta: { requiresAuth: true }, // 子路由也需要登录
      },
      // {
      //   path: 'demographics',
      //   name: 'DemographicsAnalysis',
      //   component: () => import('../systems/analytics/views/DemographicsAnalysisView.vue'),
      //   meta: { requiresAuth: true }
      // },
      {
        path: 'dictionary',
        name: 'DictionaryManagement',
        component: () =>
          import('../systems/analytics/views/DictionaryManagement.vue'),
        meta: { requiresAuth: true, requiresAdmin: true }, // 需要管理员权限
      },
    ],
  },

  // 5. 家庭积分系统 (Family System) - 需鉴权 (新增)
  {
    path: '/family',
    // 这里暂时复用 PortalLayout，或者您可以新建一个 Layout
    component: () => import('../portal/layout/PortalLayout.vue'),
    children: [
      {
        path: 'dashboard',
        name: 'FamilyDashboard',
        component: () => import('../systems/family/views/Dashboard.vue'),
        meta: { requiresAuth: true }, // 保护路由
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// 🚀 路由守卫
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('user_token');

  // 1. 需要登录，但没 Token -> 根据目标路径跳转到对应的系统首页
  if (to.meta.requiresAuth && !token) {
    // 判断目标路径属于哪个系统
    if (to.fullPath.startsWith('/strategy')) {
      // 商业分析系统，跳转到商业分析系统首页
      next({
        path: '/strategy/home',
        query: { redirect: to.fullPath },
      });
    } else if (to.fullPath.startsWith('/family')) {
      // (新增)
      // 家庭系统，跳转到家庭介绍页
      next({
        path: '/family/home',
        query: { redirect: to.fullPath },
      });
    } else {
      // 其他系统（教务系统等），跳转到教务系统首页
      next({
        path: '/system/home',
        query: { redirect: to.fullPath },
      });
    }
  }
  // 3. 其他情况，放行
  else {
    next();
  }
});

export default router;
