# 启动后端服务器

## 问题诊断
错误 `ECONNREFUSED` 表示后端服务器没有运行。

## 解决方法

### 方法 1：使用 npm（推荐）
```bash
cd server
npm run dev
```

### 方法 2：使用 node
```bash
cd server
node app.js
```

## 检查服务器是否启动成功
启动成功后，你应该看到：
```
✅ Backend Server running on http://localhost:3000
   Environment: development
```

## 常见问题

### 1. 数据库连接失败
如果看到数据库连接错误，请检查：
- `.env` 文件中的数据库配置是否正确
- PostgreSQL 服务是否正在运行
- 数据库名称、用户名、密码是否正确

### 2. 端口被占用
如果端口 3000 被占用，可以：
- 修改 `.env` 文件中的 `PORT` 变量
- 或者修改 `vite.config.js` 中的代理目标端口

### 3. Session 表不存在
如果看到 Session 表相关的错误，服务器会自动创建表，但需要确保数据库连接正常。
