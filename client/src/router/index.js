import { createRouter, createWebHistory } from 'vue-router';
import axios from 'axios';
import { PERMISSIONS } from '@/constants/permissions';

// 引入布局组件（新结构）
import PortalLayout from '../portal/layout/PortalLayout.vue';
import EducationLayout from '../systems/education/layout/EducationLayout.vue';
import AnalyticsLayout from '../systems/analytics/layout/AnalyticsLayout.vue';

// ========== Session 校验缓存 ==========
// 缓存有效期：5分钟（毫秒）
const SESSION_CACHE_TTL = 5 * 60 * 1000;
let sessionCache = {
  isValid: false,
  timestamp: 0,
  permissions: null,
};

/**
 * 校验 Session 是否有效（带缓存）
 * @returns {Promise<boolean>} Session 是否有效
 */
async function checkSessionValid() {
  const now = Date.now();
  
  // 如果缓存有效且未过期，直接返回缓存结果
  if (sessionCache.isValid && (now - sessionCache.timestamp) < SESSION_CACHE_TTL) {
    return true;
  }
  
  try {
    const res = await axios.get('/api/permissions/auth/permissions');
    if (res.data && res.data.code === 200) {
      // 更新缓存
      sessionCache = {
        isValid: true,
        timestamp: now,
        permissions: res.data.data,
      };
      return true;
    }
    // 非 200 响应，清除缓存
    clearSessionCache();
    return false;
  } catch (err) {
    // 401 或其他错误，清除缓存
    clearSessionCache();
    return false;
  }
}

/**
 * 清除 Session 缓存（登出时调用）
 */
export function clearSessionCache() {
  sessionCache = {
    isValid: false,
    timestamp: 0,
    permissions: null,
  };
}

/**
 * 获取缓存的权限数据
 */
export function getCachedPermissions() {
  return sessionCache.permissions;
}

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
        meta: { 
          title: '用户管理',
          permissions: [PERMISSIONS.USER.READ],
        },
      },
      {
        path: 'permissions',
        name: 'Permissions',
        component: () => import('../systems/education/views/PermissionManagement.vue'),
        meta: { 
          title: '权限配置管理',
          permissions: [PERMISSIONS.PERMISSION.MANAGE],
        },
      },
      {
        path: 'user-roles',
        name: 'UserRoles',
        component: () => import('../systems/education/views/UserRoleAssignment.vue'),
        meta: { 
          title: '用户角色分配',
          permissions: [PERMISSIONS.PERMISSION.MANAGE],
        },
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
        meta: { 
          requiresAuth: true, 
          title: '字典管理',
          permissions: [PERMISSIONS.MAP.MANAGE],
        },
      },
    ],
  },

  // 5. 家庭积分系统 (Family System) - 需鉴权
  {
    path: '/family',
    component: () => import('../systems/family/layout/FamilyLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      // ========== 总览 ==========
      {
        path: 'dashboard',
        name: 'FamilyDashboard',
        component: () => import('../systems/family/views/FamilyDashboard.vue'),
      },
      // 旧版仪表盘（兼容）
      {
        path: 'legacy-dashboard',
        name: 'FamilyLegacyDashboard',
        component: () => import('../systems/family/views/Dashboard.vue'),
      },

      // ========== 市场层（不依赖 member）==========
      {
        path: 'market',
        name: 'FamilyMarket',
        component: () => import('../systems/family/views/market/MarketHome.vue'),
      },
      {
        path: 'market/shop',
        name: 'FamilyMarketShop',
        component: () => import('../systems/family/views/market/MarketShop.vue'),
      },
      {
        path: 'market/mystery',
        name: 'FamilyMarketMystery',
        component: () => import('../systems/family/views/market/MarketMystery.vue'),
      },
      {
        path: 'market/auction',
        name: 'FamilyMarketAuction',
        component: () => import('../systems/family/views/market/MarketAuction.vue'),
      },
      {
        path: 'auction/:id',
        name: 'FamilyAuctionDetail',
        component: () => import('../systems/family/views/market/AuctionDetail.vue'),
      },
      {
        path: 'market/draw',
        name: 'FamilyMarketDraw',
        component: () => import('../systems/family/views/market/MarketDraw.vue'),
      },
      {
        path: 'market/tasks',
        name: 'FamilyMarketTasks',
        component: () => import('../systems/family/views/market/MarketTasks.vue'),
      },
      {
        path: 'tasks/:id',
        name: 'FamilyTaskDetail',
        component: () => import('../systems/family/views/market/TaskDetail.vue'),
      },
      {
        path: 'market/issues',
        name: 'FamilyMarketIssues',
        component: () => import('../systems/family/views/market/MarketIssues.vue'),
      },
      {
        path: 'market/reminders',
        name: 'FamilyMarketReminders',
        component: () => import('../systems/family/views/market/MarketReminders.vue'),
      },
      {
        path: 'market/admin',
        name: 'FamilyMarketAdmin',
        component: () => import('../systems/family/views/market/MarketAdmin.vue'),
      },
      {
        path: 'market/admin/draw',
        name: 'FamilyMarketDrawAdmin',
        component: () => import('../systems/family/views/market/MarketDrawAdmin.vue'),
      },
      {
        path: 'market/admin/auction',
        name: 'FamilyMarketAuctionAdmin',
        component: () => import('../systems/family/views/market/MarketAuctionAdmin.vue'),
      },

      // ========== 成员资产层（必须 member）==========
      {
        path: 'member/:id/wallet',
        name: 'FamilyMemberWallet',
        component: () => import('../systems/family/views/member/MemberWallet.vue'),
      },
      {
        path: 'member/:id/inventory',
        name: 'FamilyMemberInventory',
        component: () => import('../systems/family/views/member/MemberInventory.vue'),
      },
      {
        path: 'member/:id/orders',
        name: 'FamilyMemberOrders',
        component: () => import('../systems/family/views/member/MemberOrders.vue'),
      },
      {
        path: 'member/:id/activity',
        name: 'FamilyMemberActivity',
        component: () => import('../systems/family/views/member/MemberActivity.vue'),
      },

      // ========== 旧版兼容路由（重定向或保留）==========
      {
        path: 'auction',
        redirect: '/family/market/auction',
      },
      {
        path: 'bounty',
        redirect: '/family/market/tasks',
      },
      {
        path: 'lottery',
        name: 'FamilyLottery',
        component: () => import('../systems/family/views/LotteryPage.vue'),
      },
      {
        path: 'lottery/:poolId',
        name: 'FamilyLotteryPool',
        component: () => import('../systems/family/views/LotteryPage.vue'),
      },
      {
        path: 'issues',
        redirect: '/family/market/issues',
      },
      {
        path: 'reminders',
        redirect: '/family/market/reminders',
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    // 如果有保存的位置（比如浏览器前进/后退），则使用保存的位置
    if (savedPosition) {
      return savedPosition;
    }
    // 否则滚动到顶部
    return { top: 0, left: 0, behavior: 'instant' };
  },
});

// 🚀 路由守卫（基于 Session 校验 + 权限校验）
router.beforeEach(async (to, from, next) => {
  // 不需要鉴权的路由，直接放行
  if (!to.meta.requiresAuth) {
    return next();
  }

  // 需要鉴权的路由，校验 Session
  const isLoggedIn = await checkSessionValid();

  if (!isLoggedIn) {
    // Session 无效，根据目标路径跳转到对应的系统首页
    if (to.fullPath.startsWith('/strategy')) {
      return next({
        path: '/strategy/home',
        query: { redirect: to.fullPath },
      });
    } else if (to.fullPath.startsWith('/family')) {
      return next({
        path: '/family/home',
        query: { redirect: to.fullPath },
      });
    } else {
      return next({
        path: '/system/home',
        query: { redirect: to.fullPath },
      });
    }
  }

  // Session 有效，同步权限到前端状态
  const { syncPermissionsFromCache } = await import('@/composables/usePermission');
  syncPermissionsFromCache();

  // 检查路由权限（如果配置了 meta.permissions）
  const requiredPermissions = to.meta.permissions;
  if (requiredPermissions && requiredPermissions.length > 0) {
    const cachedPermissions = getCachedPermissions() || [];
    const hasPermission = requiredPermissions.some(p => cachedPermissions.includes(p));
    
    if (!hasPermission) {
      // 没有权限，跳转到仪表盘并提示
      console.warn(`权限不足：需要 ${requiredPermissions.join(' 或 ')}`);
      return next({
        path: '/system/dashboard',
        query: { permissionDenied: '1' },
      });
    }
  }

  // 放行
  next();
});

export default router;
