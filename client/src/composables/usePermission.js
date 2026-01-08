/**
 * 权限组合式函数
 * 提供权限检查功能
 */
import { ref, computed } from 'vue';

// 用户权限列表（从 localStorage 或 API 获取）
const userPermissions = ref([]);

/**
 * 初始化用户权限
 * @param {Array<string>} permissions - 权限代码数组
 */
export function initUserPermissions(permissions) {
  userPermissions.value = permissions || [];
  // 同时存储到 localStorage（可选）
  if (permissions) {
    localStorage.setItem('user_permissions', JSON.stringify(permissions));
  }
}

/**
 * 从 localStorage 加载用户权限
 */
export function loadUserPermissionsFromStorage() {
  try {
    const stored = localStorage.getItem('user_permissions');
    if (stored) {
      userPermissions.value = JSON.parse(stored);
    }
  } catch (error) {
    console.error('加载用户权限失败:', error);
    userPermissions.value = [];
  }
}

/**
 * 清除用户权限
 */
export function clearUserPermissions() {
  userPermissions.value = [];
  localStorage.removeItem('user_permissions');
}

/**
 * 权限检查组合式函数
 */
export function usePermission() {
  /**
   * 检查用户是否有指定权限
   * @param {string} permissionCode - 权限代码
   * @returns {boolean} 是否有权限
   */
  const hasPermission = (permissionCode) => {
    if (!permissionCode) return false;
    return userPermissions.value.includes(permissionCode);
  };

  /**
   * 检查用户是否拥有任意一个权限（OR 逻辑）
   * @param {Array<string>} permissionCodes - 权限代码数组
   * @returns {boolean} 是否有任意一个权限
   */
  const hasAnyPermission = (permissionCodes) => {
    if (!permissionCodes || permissionCodes.length === 0) return false;
    return permissionCodes.some(code => hasPermission(code));
  };

  /**
   * 检查用户是否拥有所有权限（AND 逻辑）
   * @param {Array<string>} permissionCodes - 权限代码数组
   * @returns {boolean} 是否拥有所有权限
   */
  const hasAllPermissions = (permissionCodes) => {
    if (!permissionCodes || permissionCodes.length === 0) return false;
    return permissionCodes.every(code => hasPermission(code));
  };

  /**
   * 获取当前用户权限列表
   * @returns {Array<string>} 权限代码数组
   */
  const getPermissions = () => {
    return [...userPermissions.value];
  };

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    getPermissions,
    // 响应式权限列表（只读）
    permissions: computed(() => userPermissions.value),
  };
}

// 初始化时从 localStorage 加载权限
loadUserPermissionsFromStorage();

