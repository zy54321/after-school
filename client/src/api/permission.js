/**
 * 权限管理 API 服务
 */
import axios from 'axios';

const API_BASE = '/api';

/**
 * 获取所有权限列表
 */
export function getAllPermissions() {
  return axios.get(`${API_BASE}/permissions/permissions`);
}

/**
 * 获取权限树
 */
export function getPermissionTree() {
  return axios.get(`${API_BASE}/permissions/permissions/tree`);
}

/**
 * 获取所有角色列表
 */
export function getAllRoles() {
  return axios.get(`${API_BASE}/permissions/roles`);
}

/**
 * 创建角色
 */
export function createRole(data) {
  return axios.post(`${API_BASE}/permissions/roles`, data);
}

/**
 * 更新角色
 */
export function updateRole(id, data) {
  return axios.put(`${API_BASE}/permissions/roles/${id}`, data);
}

/**
 * 删除角色
 */
export function deleteRole(id) {
  return axios.delete(`${API_BASE}/permissions/roles/${id}`);
}

/**
 * 获取角色权限
 */
export function getRolePermissions(roleId) {
  return axios.get(`${API_BASE}/permissions/roles/${roleId}/permissions`);
}

/**
 * 分配角色权限
 */
export function assignRolePermissions(roleId, permissionIds) {
  return axios.post(`${API_BASE}/permissions/roles/${roleId}/permissions`, {
    permission_ids: permissionIds
  });
}

/**
 * 获取用户角色
 */
export function getUserRoles(userId) {
  return axios.get(`${API_BASE}/permissions/users/${userId}/roles`);
}

/**
 * 分配用户角色
 */
export function assignUserRoles(userId, roleIds) {
  return axios.post(`${API_BASE}/permissions/users/${userId}/roles`, {
    role_ids: roleIds
  });
}

/**
 * 移除用户角色
 */
export function removeUserRole(userId, roleId) {
  return axios.delete(`${API_BASE}/permissions/users/${userId}/roles/${roleId}`);
}

/**
 * 获取当前用户权限
 */
export function getCurrentUserPermissions() {
  return axios.get(`${API_BASE}/permissions/auth/permissions`);
}

/**
 * 检查当前用户权限
 */
export function checkCurrentUserPermission(permissionCode) {
  return axios.post(`${API_BASE}/permissions/auth/check-permission`, {
    permission_code: permissionCode
  });
}

