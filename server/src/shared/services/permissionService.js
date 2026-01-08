/**
 * 权限服务层
 * 提供权限相关的数据库操作和业务逻辑
 */
const pool = require('../config/db');

class PermissionService {
  /**
   * 获取所有权限（扁平列表）
   * @returns {Promise<Array>} 权限列表
   */
  async getAllPermissions() {
    try {
      const result = await pool.query(`
        SELECT id, code, name, module, resource, action, description, 
               parent_code, sort_order, is_active, created_at
        FROM permissions
        WHERE is_active = TRUE
        ORDER BY module, sort_order, id
      `);
      return result.rows;
    } catch (error) {
      console.error('获取权限列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户所有权限（通过角色）
   * @param {number} userId - 用户ID
   * @returns {Promise<Array>} 权限代码数组，如 ['student:create', 'student:read', ...]
   */
  async getUserPermissions(userId) {
    try {
      const result = await pool.query(`
        SELECT DISTINCT p.code
        FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        JOIN user_roles ur ON rp.role_id = ur.role_id
        WHERE ur.user_id = $1 AND p.is_active = TRUE
        ORDER BY p.code
      `, [userId]);
      return result.rows.map(row => row.code);
    } catch (error) {
      console.error('获取用户权限失败:', error);
      throw error;
    }
  }

  /**
   * 检查用户是否有指定权限
   * @param {number} userId - 用户ID
   * @param {string} permissionCode - 权限代码
   * @returns {Promise<boolean>} 是否有权限
   */
  async hasPermission(userId, permissionCode) {
    try {
      const result = await pool.query(`
        SELECT COUNT(*) as count
        FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        JOIN user_roles ur ON rp.role_id = ur.role_id
        WHERE ur.user_id = $1 
          AND p.code = $2 
          AND p.is_active = TRUE
      `, [userId, permissionCode]);
      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      console.error('检查权限失败:', error);
      throw error;
    }
  }

  /**
   * 批量检查用户权限
   * @param {number} userId - 用户ID
   * @param {Array<string>} permissionCodes - 权限代码数组
   * @returns {Promise<Object>} 权限检查结果，如 { 'student:create': true, 'student:delete': false }
   */
  async checkPermissions(userId, permissionCodes) {
    try {
      if (!permissionCodes || permissionCodes.length === 0) {
        return {};
      }

      const result = await pool.query(`
        SELECT p.code
        FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        JOIN user_roles ur ON rp.role_id = ur.role_id
        WHERE ur.user_id = $1 
          AND p.code = ANY($2::varchar[])
          AND p.is_active = TRUE
      `, [userId, permissionCodes]);

      const userPermissions = result.rows.map(row => row.code);
      const resultMap = {};
      permissionCodes.forEach(code => {
        resultMap[code] = userPermissions.includes(code);
      });
      return resultMap;
    } catch (error) {
      console.error('批量检查权限失败:', error);
      throw error;
    }
  }

  /**
   * 获取角色权限
   * @param {number} roleId - 角色ID
   * @returns {Promise<Array>} 权限ID数组
   */
  async getRolePermissions(roleId) {
    try {
      const result = await pool.query(`
        SELECT permission_id
        FROM role_permissions
        WHERE role_id = $1
      `, [roleId]);
      return result.rows.map(row => row.permission_id);
    } catch (error) {
      console.error('获取角色权限失败:', error);
      throw error;
    }
  }

  /**
   * 分配角色权限
   * @param {number} roleId - 角色ID
   * @param {Array<number>} permissionIds - 权限ID数组
   * @returns {Promise<void>}
   */
  async assignRolePermissions(roleId, permissionIds) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. 删除该角色的所有现有权限
      await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);

      // 2. 插入新权限
      if (permissionIds && permissionIds.length > 0) {
        const values = permissionIds.map((_, index) => `($1, $${index + 2})`).join(', ');
        const params = [roleId, ...permissionIds];
        await client.query(`
          INSERT INTO role_permissions (role_id, permission_id)
          VALUES ${values}
          ON CONFLICT (role_id, permission_id) DO NOTHING
        `, params);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('分配角色权限失败:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取用户角色
   * @param {number} userId - 用户ID
   * @returns {Promise<Array>} 角色信息数组
   */
  async getUserRoles(userId) {
    try {
      const result = await pool.query(`
        SELECT r.id, r.code, r.name, r.description, r.is_system, r.is_active
        FROM roles r
        JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = $1 AND r.is_active = TRUE
        ORDER BY r.id
      `, [userId]);
      return result.rows;
    } catch (error) {
      console.error('获取用户角色失败:', error);
      throw error;
    }
  }

  /**
   * 分配用户角色
   * @param {number} userId - 用户ID
   * @param {Array<number>} roleIds - 角色ID数组
   * @returns {Promise<void>}
   */
  async assignUserRoles(userId, roleIds) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. 删除该用户的所有现有角色
      await client.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);

      // 2. 插入新角色
      if (roleIds && roleIds.length > 0) {
        const values = roleIds.map((_, index) => `($1, $${index + 2})`).join(', ');
        const params = [userId, ...roleIds];
        await client.query(`
          INSERT INTO user_roles (user_id, role_id)
          VALUES ${values}
          ON CONFLICT (user_id, role_id) DO NOTHING
        `, params);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('分配用户角色失败:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取所有角色
   * @returns {Promise<Array>} 角色列表
   */
  async getAllRoles() {
    try {
      const result = await pool.query(`
        SELECT id, code, name, description, is_system, is_active, created_at
        FROM roles
        WHERE is_active = TRUE
        ORDER BY id
      `);
      return result.rows;
    } catch (error) {
      console.error('获取角色列表失败:', error);
      throw error;
    }
  }

  /**
   * 根据权限代码获取权限ID
   * @param {string} permissionCode - 权限代码
   * @returns {Promise<number|null>} 权限ID
   */
  async getPermissionIdByCode(permissionCode) {
    try {
      const result = await pool.query(`
        SELECT id FROM permissions WHERE code = $1 AND is_active = TRUE
      `, [permissionCode]);
      return result.rows.length > 0 ? result.rows[0].id : null;
    } catch (error) {
      console.error('获取权限ID失败:', error);
      throw error;
    }
  }
}

module.exports = new PermissionService();

