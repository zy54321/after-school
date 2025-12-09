const checkGuest = (req, res, next) => {
  const user = req.session.user;

  // 1. 判断是否是游客 (根据 username 判断最简单直接)
  if (user && user.username === 'visitor') {
    
    // 2. 如果请求方法不是 GET (即 POST, PUT, DELETE)，直接拦截
    // 注意：如果有特殊的 POST 查询接口，需要在这里豁免，但目前你的系统没有
    if (req.method !== 'GET') {
      return res.status(403).json({
        code: 403,
        msg: '演示模式：游客账号仅供查看，禁止修改数据'
      });
    }
  }

  // 不是游客，或者只是 GET 请求，放行
  next();
};

module.exports = checkGuest;