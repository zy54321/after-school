const pool = require('../config/db');
const bcrypt = require('bcryptjs');

// 1. 获取所有员工列表
const getUsers = async (req, res) => {
  try {
    // 注意：千万不要把 password 查出来返回给前端！
    const result = await pool.query(`
      SELECT id, username, real_name, role, is_active, created_at 
      FROM users 
      ORDER BY id ASC
    `);
    res.json({ code: 200, data: result.rows });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// 2. 新增员工
const createUser = async (req, res) => {
  const { username, password, real_name, role } = req.body;
  
  // ✅ 新增：正则校验
  const usernameRegex = /^[a-zA-Z0-9]+$/;
  if (!usernameRegex.test(username)) {
    return res.json({ code: 400, msg: '用户名格式错误：只能包含英文和数字' });
  }
  
  if (!username || !password) {
    return res.json({ code: 400, msg: '用户名和密码必填' });
  }

  try {
    // 检查用户名是否重复
    const check = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (check.rows.length > 0) {
      return res.json({ code: 400, msg: '用户名已存在' });
    }

    // 加密密码
    const hash = bcrypt.hashSync(password, 10);

    await pool.query(
      'INSERT INTO users (username, password, real_name, role) VALUES ($1, $2, $3, $4)',
      [username, hash, real_name, role || 'teacher']
    );
    
    res.json({ code: 200, msg: '员工创建成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: '创建失败' });
  }
};

// 3. 修改员工信息 (改名、改角色、禁用/启用)
const updateUser = async (req, res) => {
  const { id } = req.params;
  const { real_name, role, is_active } = req.body;

  try {
    await pool.query(
      'UPDATE users SET real_name=$1, role=$2, is_active=$3 WHERE id=$4',
      [real_name, role, is_active, id]
    );
    res.json({ code: 200, msg: '更新成功' });
  } catch (err) {
    res.status(500).json({ msg: '更新失败' });
  }
};

// 4. 重置密码 (管理员强制重置)
const resetPassword = async (req, res) => {
  const { id } = req.params; // 用户ID
  const { newPassword } = req.body;

  if (!newPassword) return res.json({ code: 400, msg: '新密码不能为空' });

  try {
    const hash = bcrypt.hashSync(newPassword, 10);
    await pool.query('UPDATE users SET password=$1 WHERE id=$2', [hash, id]);
    res.json({ code: 200, msg: '密码重置成功' });
  } catch (err) {
    res.status(500).json({ msg: '重置失败' });
  }
};

module.exports = { getUsers, createUser, updateUser, resetPassword };