/**
 * 权限常量定义
 * 统一管理所有权限代码，避免硬编码
 */

// 学员管理权限
const STUDENT = {
  MANAGE: 'student',
  CREATE: 'student:create',
  READ: 'student:read',
  UPDATE: 'student:update',
  DELETE: 'student:delete',
  EXPORT: 'student:export',
};

// 订单管理权限
const ORDER = {
  MANAGE: 'order',
  CREATE: 'order:create',
  READ: 'order:read',
  UPDATE: 'order:update',
  DELETE: 'order:delete',
  REFUND: 'order:refund',
};

// 用户管理权限
const USER = {
  MANAGE: 'user',
  CREATE: 'user:create',
  READ: 'user:read',
  UPDATE: 'user:update',
  DELETE: 'user:delete',
  RESET_PASSWORD: 'user:resetPassword',
};

// 课程管理权限
const CLASS = {
  MANAGE: 'class',
  CREATE: 'class:create',
  READ: 'class:read',
  UPDATE: 'class:update',
  DELETE: 'class:delete',
};

// 签到管理权限
const ATTENDANCE = {
  MANAGE: 'attendance',
  CREATE: 'attendance:create',
  READ: 'attendance:read',
  UPDATE: 'attendance:update',
  DELETE: 'attendance:delete',
};

// 仪表盘权限
const DASHBOARD = {
  MANAGE: 'dashboard',
  READ: 'dashboard:read',
};

// 报表管理权限
const REPORT = {
  MANAGE: 'report',
  READ: 'report:read',
  EXPORT: 'report:export',
};

// 日报管理权限
const DAILY_REPORT = {
  MANAGE: 'dailyReport',
  CREATE: 'dailyReport:create',
  READ: 'dailyReport:read',
  UPDATE: 'dailyReport:update',
  DELETE: 'dailyReport:delete',
};

// 地图管理权限
const MAP = {
  MANAGE: 'map',
  READ: 'map:read',
};

// 餐饮管理权限
const CATERING = {
  MANAGE: 'catering',
  INGREDIENTS_READ: 'catering:ingredients:read',
  INGREDIENTS_CREATE: 'catering:ingredients:create',
  INGREDIENTS_UPDATE: 'catering:ingredients:update',
  INGREDIENTS_DELETE: 'catering:ingredients:delete',
  DISHES_READ: 'catering:dishes:read',
  DISHES_CREATE: 'catering:dishes:create',
  DISHES_UPDATE: 'catering:dishes:update',
  DISHES_DELETE: 'catering:dishes:delete',
  MENU_READ: 'catering:menu:read',
  MENU_CREATE: 'catering:menu:create',
  MENU_UPDATE: 'catering:menu:update',
  MENU_DELETE: 'catering:menu:delete',
};

// 权限管理权限（仅管理员）
const PERMISSION = {
  MANAGE: 'permission',
  READ: 'permission:read',
  ASSIGN: 'permission:assign',
  ROLE_MANAGE: 'role:manage',
};

// 导出所有权限常量
module.exports = {
  STUDENT,
  ORDER,
  USER,
  CLASS,
  ATTENDANCE,
  DASHBOARD,
  REPORT,
  DAILY_REPORT,
  MAP,
  CATERING,
  PERMISSION,
  
  // 便捷方法：获取所有权限代码
  getAllPermissionCodes() {
    return [
      ...Object.values(STUDENT),
      ...Object.values(ORDER),
      ...Object.values(USER),
      ...Object.values(CLASS),
      ...Object.values(ATTENDANCE),
      ...Object.values(DASHBOARD),
      ...Object.values(REPORT),
      ...Object.values(DAILY_REPORT),
      ...Object.values(MAP),
      ...Object.values(CATERING),
      ...Object.values(PERMISSION),
    ].filter(code => code && !code.includes('MANAGE')); // 过滤掉模块级别的权限
  },
};

