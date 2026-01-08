/**
 * 权限管理控制器
 * 处理权限、角色、用户角色相关的 HTTP 请求
 */
const permissionService = require('../../../shared/services/permissionService');
const pool = require('../../../shared/config/db');

/**
 * 获取所有权限列表（扁平结构）
 */
const getAllPermissions = async (req, res) => {
  try {
    const permissions = await permissionService.getAllPermissions();
    res.json({
      code: 200,
      msg: '获取成功',
      data: permissions
    });
  } catch (error) {
    console.error('获取权限列表失败:', error);
    res.status(500).json({
      code: 500,
      msg: '获取权限列表失败'
    });
  }
};

/**
 * 获取权限树（前端构建）
 * 返回按模块分组的权限树结构
 */
const getPermissionTree = async (req, res) => {
  try {
    const permissions = await permissionService.getAllPermissions();
    
    // 构建权限树
    const treeMap = {};
    const rootNodes = [];

    // 第一遍：创建所有节点
    permissions.forEach(permission => {
      const module = permission.module;
      if (!treeMap[module]) {
        treeMap[module] = {
          code: module,
          name: permission.module,
          children: []
        };
        rootNodes.push(treeMap[module]);
      }
      
      // 添加子节点
      treeMap[module].children.push(permission);
    });

    // 按 sort_order 排序
    rootNodes.forEach(node => {
      node.children.sort((a, b) => a.sort_order - b.sort_order);
    });

    res.json({
      code: 200,
      msg: '获取成功',
      data: rootNodes
    });
  } catch (error) {
    console.error('获取权限树失败:', error);
    res.status(500).json({
      code: 500,
      msg: '获取权限树失败'
    });
  }
};

/**
 * 获取所有角色列表
 */
const getAllRoles = async (req, res) => {
  try {
    const roles = await permissionService.getAllRoles();
    res.json({
      code: 200,
      msg: '获取成功',
      data: roles
    });
  } catch (error) {
    console.error('获取角色列表失败:', error);
    res.status(500).json({
      code: 500,
      msg: '获取角色列表失败'
    });
  }
};

/**
 * 创建角色
 */
const createRole = async (req, res) => {
  const { code, name, description } = req.body;

  if (!code || !name) {
    return res.json({
      code: 400,
      msg: '角色代码和名称必填'
    });
  }

  // 验证角色代码格式
  const codeRegex = /^[a-zA-Z0-9_]+$/;
  if (!codeRegex.test(code)) {
    return res.json({
      code: 400,
      msg: '角色代码格式错误：只能包含字母、数字和下划线'
    });
  }

  try {
    // 检查角色代码是否已存在
    const check = await pool.query('SELECT id FROM roles WHERE code = $1', [code]);
    if (check.rows.length > 0) {
      return res.json({
        code: 400,
        msg: '角色代码已存在'
      });
    }

    const result = await pool.query(`
      INSERT INTO roles (code, name, description, is_system, is_active)
      VALUES ($1, $2, $3, FALSE, TRUE)
      RETURNING id, code, name, description, is_system, is_active, created_at
    `, [code, name, description || null]);

    res.json({
      code: 200,
      msg: '角色创建成功',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('创建角色失败:', error);
    res.status(500).json({
      code: 500,
      msg: '创建角色失败'
    });
  }
};

/**
 * 更新角色
 */
const updateRole = async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  if (!name) {
    return res.json({
      code: 400,
      msg: '角色名称必填'
    });
  }

  try {
    // 检查角色是否存在且不是系统角色
    const roleCheck = await pool.query(
      'SELECT id, is_system FROM roles WHERE id = $1',
      [id]
    );

    if (roleCheck.rows.length === 0) {
      return res.json({
        code: 404,
        msg: '角色不存在'
      });
    }

    if (roleCheck.rows[0].is_system) {
      return res.json({
        code: 400,
        msg: '系统角色不可修改'
      });
    }

    await pool.query(`
      UPDATE roles 
      SET name = $1, description = $2
      WHERE id = $3
    `, [name, description || null, id]);

    res.json({
      code: 200,
      msg: '角色更新成功'
    });
  } catch (error) {
    console.error('更新角色失败:', error);
    res.status(500).json({
      code: 500,
      msg: '更新角色失败'
    });
  }
};

/**
 * 删除角色
 */
const deleteRole = async (req, res) => {
  const { id } = req.params;

  try {
    // 检查角色是否存在且不是系统角色
    const roleCheck = await pool.query(
      'SELECT id, is_system FROM roles WHERE id = $1',
      [id]
    );

    if (roleCheck.rows.length === 0) {
      return res.json({
        code: 404,
        msg: '角色不存在'
      });
    }

    if (roleCheck.rows[0].is_system) {
      return res.json({
        code: 400,
        msg: '系统角色不可删除'
      });
    }

    // 软删除：设置为不活跃
    await pool.query('UPDATE roles SET is_active = FALSE WHERE id = $1', [id]);

    res.json({
      code: 200,
      msg: '角色删除成功'
    });
  } catch (error) {
    console.error('删除角色失败:', error);
    res.status(500).json({
      code: 500,
      msg: '删除角色失败'
    });
  }
};

/**
 * 获取角色权限
 */
const getRolePermissions = async (req, res) => {
  const { id } = req.params;

  try {
    const permissionIds = await permissionService.getRolePermissions(parseInt(id));
    res.json({
      code: 200,
      msg: '获取成功',
      data: permissionIds
    });
  } catch (error) {
    console.error('获取角色权限失败:', error);
    res.status(500).json({
      code: 500,
      msg: '获取角色权限失败'
    });
  }
};

/**
 * 分配角色权限
 */
const assignRolePermissions = async (req, res) => {
  const { id } = req.params;
  const { permission_ids } = req.body;

  if (!Array.isArray(permission_ids)) {
    return res.json({
      code: 400,
      msg: '权限ID列表格式错误'
    });
  }

  try {
    await permissionService.assignRolePermissions(parseInt(id), permission_ids);
    res.json({
      code: 200,
      msg: '权限分配成功'
    });
  } catch (error) {
    console.error('分配角色权限失败:', error);
    res.status(500).json({
      code: 500,
      msg: '分配角色权限失败'
    });
  }
};

/**
 * 获取用户角色
 */
const getUserRoles = async (req, res) => {
  const { id } = req.params;

  try {
    const roles = await permissionService.getUserRoles(parseInt(id));
    res.json({
      code: 200,
      msg: '获取成功',
      data: roles
    });
  } catch (error) {
    console.error('获取用户角色失败:', error);
    res.status(500).json({
      code: 500,
      msg: '获取用户角色失败'
    });
  }
};

/**
 * 分配用户角色
 */
const assignUserRoles = async (req, res) => {
  const { id } = req.params;
  const { role_ids } = req.body;

  if (!Array.isArray(role_ids)) {
    return res.json({
      code: 400,
      msg: '角色ID列表格式错误'
    });
  }

  try {
    await permissionService.assignUserRoles(parseInt(id), role_ids);
    res.json({
      code: 200,
      msg: '角色分配成功'
    });
  } catch (error) {
    console.error('分配用户角色失败:', error);
    res.status(500).json({
      code: 500,
      msg: '分配用户角色失败'
    });
  }
};

/**
 * 移除用户角色
 */
const removeUserRole = async (req, res) => {
  const { id, roleId } = req.params;

  try {
    await pool.query(
      'DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2',
      [id, roleId]
    );

    res.json({
      code: 200,
      msg: '角色移除成功'
    });
  } catch (error) {
    console.error('移除用户角色失败:', error);
    res.status(500).json({
      code: 500,
      msg: '移除用户角色失败'
    });
  }
};

/**
 * 获取当前用户权限
 */
const getCurrentUserPermissions = async (req, res) => {
  try {
    if (!req.session || !req.session.user) {
      return res.status(401).json({
        code: 401,
        msg: '未登录'
      });
    }

    const userId = req.session.user.id;
    const permissions = await permissionService.getUserPermissions(userId);

    res.json({
      code: 200,
      msg: '获取成功',
      data: permissions
    });
  } catch (error) {
    console.error('获取当前用户权限失败:', error);
    res.status(500).json({
      code: 500,
      msg: '获取当前用户权限失败'
    });
  }
};

/**
 * 检查当前用户权限
 */
const checkCurrentUserPermission = async (req, res) => {
  try {
    if (!req.session || !req.session.user) {
      return res.status(401).json({
        code: 401,
        msg: '未登录'
      });
    }

    const { permission_code } = req.body;
    if (!permission_code) {
      return res.json({
        code: 400,
        msg: '权限代码必填'
      });
    }

    const userId = req.session.user.id;
    const hasPermission = await permissionService.hasPermission(userId, permission_code);

    res.json({
      code: 200,
      msg: '检查成功',
      data: {
        has_permission: hasPermission
      }
    });
  } catch (error) {
    console.error('检查权限失败:', error);
    res.status(500).json({
      code: 500,
      msg: '检查权限失败'
    });
  }
};

module.exports = {
  getAllPermissions,
  getPermissionTree,
  getAllRoles,
  createRole,
  updateRole,
  deleteRole,
  getRolePermissions,
  assignRolePermissions,
  getUserRoles,
  assignUserRoles,
  removeUserRole,
  getCurrentUserPermissions,
  checkCurrentUserPermission,
};

