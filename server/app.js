const express = require('express');
const cors = require('cors');
const pool = require('./src/config/db');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// 引入路由文件
const authRoutes = require('./src/routes/authRoutes');
const studentRoutes = require('./src/routes/studentRoutes');
const classRoutes = require('./src/routes/classRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const attendanceRoutes = require('./src/routes/attendanceRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');

// 中间件
app.use(cors()); // 允许跨域（虽然有 Proxy，但加上保险）
app.use(express.json()); // 允许解析 JSON 请求体

// 挂载路由
// 这样访问就是 POST /api/login
app.use('/api', authRoutes);
// 凡是 /api/students 开头的请求，都交给 studentRoutes 处理
app.use('/api/students', studentRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/dashboard', dashboardRoutes);

// 启动服务
app.listen(port, () => {
  console.log(`Backend Server running on http://localhost:${port}`);
});