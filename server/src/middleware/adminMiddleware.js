const checkAdmin = (req, res, next) => {
  // 前置条件：必须已经经过 authMiddleware 验证，所以 req.session.user 一定存在
  const user = req.session.user;

  if (user && user.role === 'admin') {
    next(); // 是管理员，放行
  } else {
    res.status(403).json({ 
      code: 403, 
      msg: '权限不足：此操作仅限管理员' 
    });
  }
};

module.exports = checkAdmin;