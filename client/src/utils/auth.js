// client/src/utils/auth.js

/**
 * 获取当前登录用户信息
 */
export const getUser = () => {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

/**
 * 检查是否拥有指定权限
 * @param {String} permissionKey - 权限 Key，例如 'edu:student:delete'
 * @returns {Boolean}
 */
export const hasPermission = (permissionKey) => {
  const user = getUser();
  if (!user) return false;

  // 1. 超级管理员特权 (直接放行)
  if (user.role === 'admin') return true;

  // 2. 检查权限数组
  const permissions = user.permissions || [];
  return permissions.includes(permissionKey);
};

/**
 * 检查是否拥有列表中的任意一个权限 (用于菜单显示)
 * @param {Array} permissionKeys - 权限 Key 数组
 */
export const hasAnyPermission = (permissionKeys) => {
  const user = getUser();
  if (!user) return false;
  if (user.role === 'admin') return true;
  
  const userPerms = user.permissions || [];
  return permissionKeys.some(key => userPerms.includes(key));
};