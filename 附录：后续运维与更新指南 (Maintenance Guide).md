## 安全清理并启动后端流程

### 1️⃣ 进入项目目录

```bash
cd /var/www/after-school/server
```

---

### 2️⃣ 查看 3000 端口占用

```bash
sudo lsof -i :3000
```

* 输出示例：

```
COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
node    2455316 ubuntu  22u  IPv6  12345      0t0  TCP *:3000 (LISTEN)
```

* 记下 `PID`，这些是残留 Node 进程占用端口。

---

### 3️⃣ 杀掉残留 Node 进程

```bash
# 杀掉端口占用进程
sudo kill -9 $(sudo lsof -t -i :3000)

# 检查是否清理干净
sudo lsof -i :3000
```

* 如果没有输出，说明端口已经释放。

---

### 4️⃣ 清理 PM2 中的旧进程

```bash
# 列出 PM2 所有进程
pm2 list

# 删除旧的 after-school 记录
pm2 delete after-school

# 确认已删除
pm2 list
```

---

### 5️⃣ 安装依赖（确保最新）

```bash
# 生产环境安装依赖
npm install --production
```

* 如果你在开发环境测试，也可以用 `npm install` 安装 devDependencies。

---

### 6️⃣ 启动后端服务（PM2 管理）

```bash
pm2 start app.js --name "after-school" --log-date-format "YYYY-MM-DD HH:mm:ss"
```

* 参数说明：

  * `--name "after-school"` → 指定 PM2 名称
  * `--log-date-format` → 日志带日期，便于排查问题

---

### 7️⃣ 验证服务状态

```bash
pm2 list          # 确认 status 为 online
pm2 pid after-school  # 查看 PM2 管理的 PID
sudo lsof -i :3000   # 确认端口 PID 与 PM2 PID 一致
```

---

### 8️⃣ 查看实时日志（可选）

```bash
pm2 logs after-school --lines 100
```

* 用于排查启动异常或接口 404 问题。

---

### ✅ 注意事项

1. **每次部署前**，先执行第 2 步和第 3 步，确保端口 3000 没有残留 Node 进程。
2. **不要在服务器直接用 `node app.js` 启动**，会造成 PM2 PID 和端口 PID 不一致，容易循环重启。
3. 关闭 GitHub workflow 后，手动拉取最新代码再执行本流程即可。
