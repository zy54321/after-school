const checkAuth = (req, res, next) => {
  // 1. 检查 session 是否存在
  // 2. 检查 session 里有没有 user 信息 (登录成功时存进去的)
  if (req.session && req.session.user) {
    // ✅ 有身份，放行，进入下一个环节
    next();
  } else {
    // 🛑 没身份，直接拦截
    res.status(401).json({
      code: 401,
      msg: '身份验证失败：请先登录'
    });
  }
};

module.exports = checkAuth;

