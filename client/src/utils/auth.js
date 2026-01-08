/**
 * 获取当前登录用户信息
 * ✅ 修正：使用 'user_info' 匹配你的 EducationLayout.vue
 */
export const getUser = () => {
  const userStr = localStorage.getItem('user_info');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch (e) {
    console.error('解析用户信息失败', e);
    return null;
  }
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

// 供模板使用的简单检查函数（可选）
export const check = (key) => hasPermission(key);
