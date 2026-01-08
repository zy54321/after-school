/**
 * 细粒度权限检查中间件
 * @param {string} requiredKey - 需要的权限Key，例如 'edu:student:delete'
 */
const requirePermission = (requiredKey) => {
  return (req, res, next) => {
    const user = req.session.user;

    // 1. 基础身份检查 (必须先登录)
    if (!user) {
      return res.status(401).json({ code: 401, msg: '请先登录' });
    }

    // 2. 超级管理员特权 (Super Admin Bypass)
    // 如果角色是 admin，直接放行，无视具体权限点
    if (user.role === 'admin') {
      return next();
    }

    // 3. 检查具体权限
    // 确保 permissions 是数组且包含所需的 Key
    const userPerms = user.permissions || [];
    if (userPerms.includes(requiredKey)) {
      return next(); // ✅ 有权限，放行
    }

    // 4. 权限不足
    return res.status(403).json({ 
      code: 403, 
      msg: `权限不足：需要 [${requiredKey}] 权限` 
    });
  };
};

module.exports = requirePermission;