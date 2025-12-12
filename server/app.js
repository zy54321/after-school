const express = require('express');
const cors = require('cors');
const pool = require('./src/config/db');
require('dotenv').config();

// === 引入 Session 相关包 ===
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
// === 引入拦截器 ===
const checkAuth = require('./src/middleware/authMiddleware');
const checkAdmin = require('./src/middleware/adminMiddleware');
const checkGuest = require('./src/middleware/guestMiddleware');

const app = express();
const port = process.env.PORT || 3000;

// 引入路由文件
const authRoutes = require('./src/routes/authRoutes');
const studentRoutes = require('./src/routes/studentRoutes');
const classRoutes = require('./src/routes/classRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const attendanceRoutes = require('./src/routes/attendanceRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const userRoutes = require('./src/routes/userRoutes');
const amapRoutes = require('./src/routes/amapRoutes');

// 中间件
app.use(cors({
  // 👇 改成数组，允许多个来源
  origin: [
    'http://localhost:5173',             // 本地开发用
    'https://after-school.pages.dev',    // Cloudflare 默认域名
    'https://www.afterlessons.com',      // 你的自定义域名 (带www)
    'https://afterlessons.com'           // 你的自定义域名 (不带www)
  ],
  credentials: true
}));
app.use(express.json());

// === 配置 Session ===
app.use(session({
  store: new pgSession({
    pool : pool,                // 使用现有的数据库连接池
    tableName : 'session',      // 表名 (插件会自动创建)
    createTableIfMissing: true  // 自动建表
  }),
  secret: 'my_super_secret_key_123', // 建议改个复杂的字符串
  resave: false,
  saveUninitialized: false, // 没登录时不创建 session，节省空间
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30天过期
    httpOnly: true, // 前端 JS 无法读取，防 XSS
    // secure: false // 如果是 HTTPS 需要设为 true
  }
}));

// 挂载路由
// 这样访问就是 POST /api/login
app.use('/api', authRoutes);
app.use(checkGuest);
// 🔒 受保护路由：加上 checkAuth
// 只有登录后才能访问以下接口
app.use('/api/students', checkAuth, studentRoutes);
app.use('/api/classes', checkAuth, classRoutes);
app.use('/api/orders', checkAuth, orderRoutes);
app.use('/api/attendance', checkAuth, attendanceRoutes);
app.use('/api/dashboard', checkAuth, dashboardRoutes);

// 🗺️ 高德代理路由
app.use('/api/amap', checkAuth, amapRoutes);

// 🔒 管理员专属路由 (加双重锁：先登录，再查权限)
app.use('/api/users', checkAuth, checkAdmin, userRoutes);

// 启动服务
app.listen(port, () => {
  console.log(`Backend Server running on http://localhost:${port}`);
});