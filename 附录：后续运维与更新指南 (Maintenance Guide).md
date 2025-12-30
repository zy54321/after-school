# 📖 附录：后续运维与更新指南（Maintenance Guide · 修正版）

项目上线后，难免需要修改代码、修复 BUG 或增加新功能。以下是**经过生产环境验证的标准更新流程**。

---

## 1. 如何更新前端？（全自动 ⚡️）

得益于 **Cloudflare Pages** 与 **GitHub** 的深度集成，前端更新是完全自动化的。

### 操作步骤

1. 在本地电脑修改前端代码（`client/` 目录）。
2. 提交并推送到 GitHub：

```bash
git add .
git commit -m "feat: 更新前端功能"
git push
```

### 结果说明

* Cloudflare Pages 会自动监听 GitHub 仓库。
* 检测到 `push` 后，会自动执行：

  * 拉取代码
  * 安装依赖
  * 构建项目（`npm run build`）
  * 发布新版本
* 整个过程约 1–2 分钟。
* 构建完成后，直接刷新域名即可看到最新效果。
* 如构建失败，可前往 **Cloudflare 后台 → Deployments** 查看详细日志。

---

## 2. 如何更新后端？（半自动 🛠️）

后端运行在 **腾讯云服务器** 上，需要手动登录服务器进行更新。

### 前提条件

* 后端代码（`server/` 目录）已在本地修改并 **push 到 GitHub**
* 后端服务由 **PM2 管理**

---

### 更新步骤（标准流程）

#### 第一步：SSH 登录服务器

```bash
ssh ubuntu@你的公网IP
```

> ⚠️ **不建议长期使用 root 用户运行 Node 服务**
> 如需一次性权限修复，可临时使用 `sudo`

---

#### 第二步：进入后端目录并拉取最新代码

```bash
cd /var/www/after-school/server
git pull
```

> 如提示冲突，说明服务器上存在未提交的修改
> 推荐使用 `git stash` 处理，而不是强行覆盖

---

#### 第三步：安装依赖（仅在有新增依赖时）

如果你在本次更新中 **修改了 `package.json`（新增或升级依赖）**，执行：

```bash
npm install
```

如果只是改了业务逻辑代码，这一步可以跳过。

---

#### 第四步：重启后端服务（关键）

⚠️ **注意：这里必须使用 PM2 中真实存在的进程名**

推荐的标准做法是：

> **PM2 进程名固定为：`after-school-server`**

```bash
pm2 restart after-school-server
```

如果不确定进程名，可先查看：

```bash
pm2 list
```

---

#### 第五步：验证服务状态

```bash
pm2 list
```

确认：

* `status` 为 **online**
* 无持续重启（↺ 不在快速增长）

如需查看启动日志：

```bash
pm2 logs after-school-server
```

---

## 3. PM2 启动与命名规范（强烈建议）

### 推荐的首次启动方式（只做一次）

```bash
pm2 start npm --name after-school-server -- start
pm2 save
pm2 startup
```

说明：

* `npm start` 由 `package.json` 中的 `scripts.start` 控制
* 避免直接依赖具体入口文件（如 `server.js`）
* 以后**所有运维只操作 pm2，不直接 node 启动**

---

## 4. 常见更新场景速查表

| 场景             | 前端操作                | 后端操作                                               | 数据库操作                             |
| -------------- | ------------------- | -------------------------------------------------- | --------------------------------- |
| 只改 Vue 页面文字    | `git push`          | 无需操作                                               | 无需操作                              |
| 只改后端 API 逻辑    | 无需操作                | `ssh → git pull → pm2 restart after-school-server` | 无需操作                              |
| 新增 / 更新 npm 依赖 | `git push`（CF 自动安装） | `git pull → npm install → pm2 restart`             | 无需操作                              |
| 修改数据库表结构       | 视情况                 | 视情况                                                | 使用 Navicat 或 SQL 执行 `ALTER TABLE` |

---

## 5. 重要运维建议（请务必遵守）

* ✅ **永远不要在服务器上 `sudo npm install`**
* ✅ 后端代码只通过 **GitHub → git pull** 更新
* ❌ 不直接在服务器上用 `vim` 修改业务代码
* ❌ 生产环境不使用 `nodemon`
* ✅ `node_modules` 可随时删除并重装，这是正常行为

---

### 最佳实践总结

> **改代码 → 本地测试 → push GitHub → 服务器 git pull → pm2 restart**

只要严格遵循这条链路，
你的后端环境会长期保持 **干净、可控、可复现**。

---
