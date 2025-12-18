const pool = require('../../shared/config/db');
// 引入 bcrypt 加密库
const bcrypt = require('bcryptjs');

// 登录逻辑
const login = async (req, res) => {
  const { username, password } = req.body;

  // 1. 简单的参数校验
  if (!username || !password) {
    return res.status(400).json({ code: 400, msg: '用户名和密码不能为空' });
  }

  try {
    // 2. 查询数据库
    // 注意：只根据用户名查用户
    const queryText = `
      SELECT id, username, password, real_name, role, is_active 
      FROM users 
      WHERE username = $1
    `;
    const result = await pool.query(queryText, [username]);

    // 3. 判断结果
    if (result.rows.length > 0) {
      const user = result.rows[0];

      // 3. 核心修改：使用 bcrypt.compareSync 比对明文密码和数据库里的哈希值
      // password: 前端传来的明文 '123456'
      // user.password: 数据库里的密文 '$2a$10$...'
      const isMatch = bcrypt.compareSync(password, user.password);
      if (!isMatch) {
        return res.json({ code: 401, msg: '用户名或密码错误' });
      }

      // 检查账号是否被禁用 (Soft Delete 检查)
      if (user.is_active === false) {
        return res.json({ code: 403, msg: '该账号已被禁用，请联系管理员' });
      }

      // 登录成功 (存 Session，要把密码从对象里删掉，别存进 Session)
      delete user.password; 
      req.session.user = user;

      // 登录成功
      res.json({
        code: 200,
        msg: '登录成功',
        data: user,
        // 💡 进阶提示：正式项目这里应该生成 JWT Token 返回给前端
      });
    } else {
      // 登录失败
      res.json({
        code: 401, // 401 Unauthorized
        msg: '用户名或密码错误',
      });
    }
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ code: 500, msg: '服务器内部错误' });
  }
};

module.exports = {
  login,
};

