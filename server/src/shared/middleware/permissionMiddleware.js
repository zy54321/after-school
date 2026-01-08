/**
 * 权限中间件
 * 提供权限检查功能，用于路由保护
 */
const permissionService = require('../services/permissionService');

/**
 * 检查用户是否拥有指定权限
 * @param {string} permissionCode - 权限代码
 * @returns {Function} Express 中间件函数
 */
const checkPermission = (permissionCode) => {
  return async (req, res, next) => {
    try {
      // 1. 检查用户是否登录
      if (!req.session || !req.session.user) {
        return res.status(401).json({
          code: 401,
          msg: '身份验证失败：请先登录'
        });
      }

      const userId = req.session.user.id;

      // 2. 检查用户是否有权限
      const hasPermission = await permissionService.hasPermission(userId, permissionCode);
      
      if (!hasPermission) {
        return res.status(403).json({
          code: 403,
          msg: `权限不足：需要 ${permissionCode} 权限`
        });
      }

      // 3. 有权限，放行
      next();
    } catch (error) {
      console.error('权限检查失败:', error);
      res.status(500).json({
        code: 500,
        msg: '权限检查失败，请稍后重试'
      });
    }
  };
};

/**
 * 检查用户是否拥有任意一个权限（OR 逻辑）
 * @param {Array<string>} permissionCodes - 权限代码数组
 * @returns {Function} Express 中间件函数
 */
const checkAnyPermission = (permissionCodes) => {
  return async (req, res, next) => {
    try {
      if (!req.session || !req.session.user) {
        return res.status(401).json({
          code: 401,
          msg: '身份验证失败：请先登录'
        });
      }

      const userId = req.session.user.id;
      const permissionCheck = await permissionService.checkPermissions(userId, permissionCodes);
      
      // 检查是否有任意一个权限
      const hasAny = Object.values(permissionCheck).some(has => has === true);
      
      if (!hasAny) {
        return res.status(403).json({
          code: 403,
          msg: `权限不足：需要以下权限之一：${permissionCodes.join(', ')}`
        });
      }

      next();
    } catch (error) {
      console.error('权限检查失败:', error);
      res.status(500).json({
        code: 500,
        msg: '权限检查失败，请稍后重试'
      });
    }
  };
};

/**
 * 检查用户是否拥有所有权限（AND 逻辑）
 * @param {Array<string>} permissionCodes - 权限代码数组
 * @returns {Function} Express 中间件函数
 */
const checkAllPermissions = (permissionCodes) => {
  return async (req, res, next) => {
    try {
      if (!req.session || !req.session.user) {
        return res.status(401).json({
          code: 401,
          msg: '身份验证失败：请先登录'
        });
      }

      const userId = req.session.user.id;
      const permissionCheck = await permissionService.checkPermissions(userId, permissionCodes);
      
      // 检查是否拥有所有权限
      const hasAll = Object.values(permissionCheck).every(has => has === true);
      
      if (!hasAll) {
        return res.status(403).json({
          code: 403,
          msg: `权限不足：需要以下所有权限：${permissionCodes.join(', ')}`
        });
      }

      next();
    } catch (error) {
      console.error('权限检查失败:', error);
      res.status(500).json({
        code: 500,
        msg: '权限检查失败，请稍后重试'
      });
    }
  };
};

module.exports = {
  checkPermission,
  checkAnyPermission,
  checkAllPermissions,
};

