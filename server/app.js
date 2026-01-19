const path = require('path');
const express = require('express');
const cors = require('cors');
// 引入 dotenv (标准版用法)
require('dotenv').config();

// 🟢 [探针 1] 全局异常捕获 (防止沉默崩溃)
process.on('uncaughtException', (err) => {
  console.error('💥 [致命错误] 未捕获的异常:', err);
  // 建议记录错误后退出，让 PM2 重启
  // process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 [致命错误] 未处理的 Promise 拒绝:', reason);
});

const pool = require('./src/shared/config/db');

// 🟢 [探针 2] 数据库连接错误监听
// 如果数据库断开或连不上，这里会报错
pool.on('error', (err, client) => {
  console.error('💥 [数据库错误] 数据库连接池发生意外错误:', err);
  process.exit(-1);
});

// === 引入 Session 相关包 ===
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
// === 引入拦截器 ===
const checkAuth = require('./src/shared/middleware/authMiddleware');
const checkGuest = require('./src/shared/middleware/guestMiddleware');

const app = express();
const port = process.env.PORT || 3000;

// 引入路由文件
const authRoutes = require('./src/portal/routes/authRoutes');
const studentRoutes = require('./src/systems/education/routes/studentRoutes');
const classRoutes = require('./src/systems/education/routes/classRoutes');
const orderRoutes = require('./src/systems/education/routes/orderRoutes');
const attendanceRoutes = require('./src/systems/education/routes/attendanceRoutes');
const dashboardRoutes = require('./src/systems/education/routes/dashboardRoutes');
const userRoutes = require('./src/systems/education/routes/userRoutes');
const amapRoutes = require('./src/systems/education/routes/amapRoutes');
const dailyReportRoutes = require('./src/systems/education/routes/dailyReportRoutes');
const cateringRoutes = require('./src/systems/catering/routes/cateringRoutes');
const familyRoutes = require('./src/systems/family/routes/familyRoutes');
const mapboxRoutes = require('./src/systems/analytics/routes/mapboxRoutes');
const dictionaryRoutes = require('./src/systems/analytics/routes/dictionaryRoutes');
const demographicsRoutes = require('./src/systems/analytics/routes/demographicsRoutes');
const permissionRoutes = require('./src/systems/education/routes/permissionRoutes');

// 🔥 信任反向代理
app.set('trust proxy', 1);

// 中间件
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'https://after-school.pages.dev',
      'https://www.afterlessons.com',
      'https://afterlessons.com',
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// === 配置 Session ===
// 注意：如果数据库连接失败，这里可能会抛出错误
try {
  app.use(
    session({
      store: new pgSession({
        pool: pool,
        tableName: 'session',
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || 'my_super_secret_key_123',
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      },
    })
  );
} catch (err) {
  console.error('💥 [Session错误] 初始化 Session 存储失败:', err);
}

// 挂载路由
app.use('/api', authRoutes);
app.use(checkGuest);

// 业务路由
// console.log('正在注册 Family 路由...'); 
// app.use('/api/family', (req, res, next) => {
//     console.log('>> 进入 Family 路由:', req.url);
//     next();
// }, checkAuth, familyRoutes);
app.use('/api/students', checkAuth, studentRoutes);
app.use('/api/classes', checkAuth, classRoutes);
app.use('/api/orders', checkAuth, orderRoutes);
app.use('/api/attendance', checkAuth, attendanceRoutes);
app.use('/api/dashboard', checkAuth, dashboardRoutes);
app.use('/api/reports', dailyReportRoutes);
app.use('/api/catering', cateringRoutes);
app.use('/api/amap', checkAuth, amapRoutes);
app.use('/api/users', checkAuth, userRoutes);
app.use('/api/permissions', permissionRoutes); // 权限管理路由（内部已包含权限检查）
app.use('/api/mapbox/dictionary', checkAuth, dictionaryRoutes);
app.use('/api/mapbox', checkAuth, mapboxRoutes);
app.use('/api/analytics/demographics', checkAuth, demographicsRoutes);
app.use('/api/family', checkAuth, familyRoutes);

// 启动服务
app.listen(port, () => {
  console.log(`✅ Backend Server running on http://localhost:${port}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});
