/**
 * 前端权限代码常量定义
 * ⚠️ 必须与 server/src/shared/constants/permissions.js 完全一致
 * 格式: module:action
 */

export const PERMISSIONS = {
  // 用户管理
  USER: {
    READ: 'user:read',
    CREATE: 'user:create',
    UPDATE: 'user:update',
    DELETE: 'user:delete',
    RESET_PASSWORD: 'user:reset_password',
  },

  // 学员管理
  STUDENT: {
    READ: 'student:read',
    CREATE: 'student:create',
    UPDATE: 'student:update',
    DELETE: 'student:delete',
  },

  // 班级管理
  CLASS: {
    READ: 'class:read',
    CREATE: 'class:create',
    UPDATE: 'class:update',
    DELETE: 'class:delete',
  },

  // 订单管理
  ORDER: {
    READ: 'order:read',
    CREATE: 'order:create',
    UPDATE: 'order:update',
    DELETE: 'order:delete',
    REFUND: 'order:refund',
  },

  // 考勤管理
  ATTENDANCE: {
    READ: 'attendance:read',
    CREATE: 'attendance:create',
    UPDATE: 'attendance:update',
    DELETE: 'attendance:delete',
  },

  // 日报管理
  REPORT: {
    READ: 'report:read',
    CREATE: 'report:create',
    UPDATE: 'report:update',
    DELETE: 'report:delete',
  },

  // 餐饮管理
  CATERING: {
    READ: 'catering:read',
    CREATE: 'catering:create',
    UPDATE: 'catering:update',
    DELETE: 'catering:delete',
  },

  // 地图/字典管理
  MAP: {
    READ: 'map:read',
    MANAGE: 'map:manage',
  },

  // 权限管理
  PERMISSION: {
    READ: 'permission:read',
    MANAGE: 'permission:manage',
  },

  // 家庭积分系统
  FAMILY: {
    READ: 'family:read',
    MANAGE: 'family:manage',
  },
};

export default PERMISSIONS;
