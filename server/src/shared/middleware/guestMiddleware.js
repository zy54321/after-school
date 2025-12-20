const checkGuest = (req, res, next) => {
  const user = req.session.user;

  // 1. 判断是否是游客
  if (user && user.username === 'visitor') {

    // 这些接口虽然使用 POST 方法，但仅用于数据计算或验证，不涉及核心业务数据的增删改
    // 允许游客访问
    const allowedPostRoutes = [
      '/api/analytics/demographics/calculate', // 单点计算
      '/api/analytics/demographics/batch',     // 批量计算
      '/api/login',                            // 登录本身通常也是 POST，以防万一
      '/api/logout'
    ];

    // 获取当前请求的纯净路径 (去掉 ? 后面的参数)
    const currentPath = req.originalUrl.split('?')[0];

    // 2. 如果当前请求路径在白名单里，直接放行，不再检查方法
    if (allowedPostRoutes.includes(currentPath)) {
      return next();
    }
    
    // 3. 如果不是白名单接口，且方法不是 GET (即 POST, PUT, DELETE)，则拦截
    if (req.method !== 'GET') {
      return res.status(403).json({
        code: 403,
        msg: '演示模式：游客账号仅供查看，禁止修改数据'
      });
    }
  }

  // 不是游客，或者只是 GET 请求，或者命中了白名单，放行
  next();
};

module.exports = checkGuest;