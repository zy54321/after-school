/**
 * 权限组合式函数
 * 提供权限检查功能，与后端 RBAC 体系对齐
 */
import { ref, computed } from 'vue';
import { getCachedPermissions } from '@/router';

// 用户权限列表（响应式）
const userPermissions = ref([]);

/**
 * 初始化用户权限
 * @param {Array<string>} permissions - 权限代码数组
 */
export function initUserPermissions(permissions) {
  userPermissions.value = permissions || [];
  // 同时存储到 localStorage（用于页面刷新后恢复）
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
 * 从 Session 缓存同步权限
 * 在路由守卫校验成功后调用
 */
export function syncPermissionsFromCache() {
  const cached = getCachedPermissions();
  if (cached && Array.isArray(cached)) {
    userPermissions.value = cached;
    localStorage.setItem('user_permissions', JSON.stringify(cached));
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
 * 获取当前权限列表（非响应式）
 */
export function getPermissionsList() {
  return [...userPermissions.value];
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
    return permissionCodes.some(code => userPermissions.value.includes(code));
  };

  /**
   * 检查用户是否拥有所有权限（AND 逻辑）
   * @param {Array<string>} permissionCodes - 权限代码数组
   * @returns {boolean} 是否拥有所有权限
   */
  const hasAllPermissions = (permissionCodes) => {
    if (!permissionCodes || permissionCodes.length === 0) return false;
    return permissionCodes.every(code => userPermissions.value.includes(code));
  };

  /**
   * 获取当前用户权限列表
   * @returns {Array<string>} 权限代码数组
   */
  const getPermissions = () => {
    return [...userPermissions.value];
  };

  /**
   * 计算属性：检查是否有指定权限（用于模板中）
   * @param {string} permissionCode - 权限代码
   * @returns {ComputedRef<boolean>} 响应式的权限检查结果
   */
  const canDo = (permissionCode) => {
    return computed(() => userPermissions.value.includes(permissionCode));
  };

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    getPermissions,
    canDo,
    // 响应式权限列表（只读）
    permissions: computed(() => userPermissions.value),
  };
}

// 初始化时从 localStorage 加载权限
loadUserPermissionsFromStorage();
