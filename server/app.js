const express = require('express');
const cors = require('cors');
const pool = require('./src/shared/config/db');
require('dotenv').config();

// === 引入 Session 相关包 ===
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
// === 引入拦截器 ===
const checkAuth = require('./src/shared/middleware/authMiddleware');
const checkAdmin = require('./src/shared/middleware/adminMiddleware');
const checkGuest = require('./src/shared/middleware/guestMiddleware');

const app = express();
const port = process.env.PORT || 3000;

// 引入路由文件
// Portal 路由（认证等）
const authRoutes = require('./src/portal/routes/authRoutes');

// Education System 路由（教务系统）
const studentRoutes = require('./src/systems/education/routes/studentRoutes');
const classRoutes = require('./src/systems/education/routes/classRoutes');
const orderRoutes = require('./src/systems/education/routes/orderRoutes');
const attendanceRoutes = require('./src/systems/education/routes/attendanceRoutes');
const dashboardRoutes = require('./src/systems/education/routes/dashboardRoutes');
const userRoutes = require('./src/systems/education/routes/userRoutes');
const amapRoutes = require('./src/systems/education/routes/amapRoutes');

// Analytics System 路由（商业分析系统）
const mapboxRoutes = require('./src/systems/analytics/routes/mapboxRoutes');
const dictionaryRoutes = require('./src/systems/analytics/routes/dictionaryRoutes');
const demographicsRoutes = require('./src/systems/analytics/routes/demographicsRoutes');

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
// Portal 路由：认证相关（不需要登录）
app.use('/api', authRoutes);
app.use(checkGuest);

// 🔒 Education System 路由：受保护路由，需要登录
app.use('/api/students', checkAuth, studentRoutes);
app.use('/api/classes', checkAuth, classRoutes);
app.use('/api/orders', checkAuth, orderRoutes);
app.use('/api/attendance', checkAuth, attendanceRoutes);
app.use('/api/dashboard', checkAuth, dashboardRoutes);

// 🗺️ Education System 地图服务路由
app.use('/api/amap', checkAuth, amapRoutes);

// 🔒 Education System 管理员专属路由 (加双重锁：先登录，再查权限)
app.use('/api/users', checkAuth, checkAdmin, userRoutes);

// 🔒 Analytics System 路由：商业分析系统（需要登录）
app.use('/api/mapbox', checkAuth, mapboxRoutes);
// 🔒 Analytics System 字典管理路由（需要登录，部分操作需要管理员权限）
app.use('/api/mapbox/dictionary', checkAuth, dictionaryRoutes);
// 🔒 Analytics System 人口构成分析路由（需要登录）
app.use('/api/analytics/demographics', checkAuth, demographicsRoutes);

// 启动服务
app.listen(port, () => {
  console.log(`Backend Server running on http://localhost:${port}`);
});
