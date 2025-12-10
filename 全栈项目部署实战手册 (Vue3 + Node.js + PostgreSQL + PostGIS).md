# 全栈项目部署实战手册 (Vue3 + Node.js + PostgreSQL + PostGIS)

**适用环境**：Ubuntu 22.04 / 24.04 LTS
**目标**：从零搭建一台运行商业级 GIS 管理系统的云服务器。

-----

## 第一阶段：服务器初始化

**1. 远程登录服务器**
打开本地终端（CMD 或 PowerShell），执行以下命令连接服务器：
`ssh ubuntu@你的公网IP`

**2. 切换超级管理员权限 (至关重要)**
登录后第一件事，切换到 root 用户，避免后续安装软件报权限错误：
`sudo -i`
*(提示符会从 $ 变为 \#，表示已获得最高权限)*

**3. 更新系统软件源**
确保下载的软件都是最新版：
`apt update && apt upgrade -y`

-----

## 第二阶段：安装基础环境

**1. 安装 Node.js v20 (LTS 版本)**
依次执行以下三行命令：

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v  # 验证安装，应输出 v20.x.x
```

**2. 安装 PM2 (进程守护工具)**
用于让后端服务在后台永久运行：
`npm install -g pm2`

**3. 安装 Nginx (Web 服务器)**
用于托管前端页面和反向代理：
`apt install -y nginx`

**4. 安装 PostgreSQL 数据库及 GIS 插件**
`apt install -y postgresql postgresql-contrib postgis`

-----

## 第三阶段：数据库配置

**1. 修改数据库默认密码**
PostgreSQL 默认创建了系统用户 postgres，需要重置密码：

```bash
sudo -u postgres psql
ALTER USER postgres WITH PASSWORD '你的强密码';
```

*(注意：SQL 语句末尾必须有分号 ;)*

**2. 创建业务数据库并启用 GIS**
继续在数据库命令行中执行：

```sql
CREATE DATABASE after_school;
\c after_school
CREATE EXTENSION postgis;  -- 核心步骤：启用地图支持
\q
```

-----

## 第四阶段：代码部署 (后端)

**1. 拉取代码**

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/你的用户名/after-school.git
```

**2. 安装后端依赖**

```bash
cd /var/www/after-school/server
npm install
```

**3. 配置环境变量**
创建 `.env` 配置文件：
`nano .env`

**粘贴以下内容 (注意端口设置)：**

```env
PORT=3000
DB_USER=postgres
DB_HOST=localhost
DB_NAME=after_school
DB_PASSWORD=刚才设置的数据库密码
DB_PORT=5432  
# 注意：Linux服务器上PG默认端口是5432，不要填本地的1125
SESSION_SECRET=my_secret_key
```

*(保存退出：按 Ctrl+O 回车，然后按 Ctrl+X)*

-----

## 第五阶段：数据迁移 (Navicat 远程传输)

**原理**：不直接开放服务器 5432 端口，而是通过 SSH 安全隧道连接。

**Navicat 操作步骤：**

1.  **新建连接** -\> 选择 PostgreSQL。
2.  **【SSH 标签页】(关键)**：
      * 勾选 **使用 SSH 通道**。
      * 主机：填 **服务器公网IP**。
      * 用户名：`ubuntu`。
      * 密码：服务器的登录密码。
3.  **【常规 标签页】**：
      * 主机：填 **localhost** (相对于服务器自己)。
      * 端口：`5432`。
      * 用户名：`postgres`。
      * 密码：数据库密码。
4.  **开始传输**：
      * 点击菜单栏 **工具** -\> **数据传输**。
      * 源：本地连接 (after\_school) -\> 目标：远程连接 (after\_school)。
      * 点击开始。

-----

## 第六阶段：前端构建与 Nginx 配置

**1. 构建前端静态文件**

```bash
cd /var/www/after-school/client
npm install
npm run build
```

*(构建完成后会生成 dist 目录)*

**2. 修改 Nginx 配置文件**
编辑默认配置：
`nano /etc/nginx/sites-available/default`

**清空原内容，粘贴以下配置：**

```nginx
server {
    listen 80;
    server_name 你的公网IP;  # 后续有域名了改成域名

    # 1. 前端页面 (Vue)
    location / {
        root /var/www/after-school/client/dist;
        index index.html;
        try_files $uri $uri/ /index.html; # 防止刷新404
    }

    # 2. 后端接口反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**3. 重启 Nginx**
`systemctl restart nginx`

-----

## 第七阶段：启动服务

**1. 启动后端**

```bash
cd /var/www/after-school/server
pm2 start app.js --name "server"
```

**2. 设置开机自启**
确保服务器重启后网站依然在线：

```bash
pm2 save
pm2 startup
```

**3. 最终验证**
打开浏览器访问：`http://你的公网IP`
如果看到登录页面，且能成功登录，说明部署圆满成功！

-----

## 常用维护命令速查

  * **查看服务状态**：`pm2 list`
  * **重启后端**：`pm2 restart server`
  * **查看报错日志**：`pm2 logs server`
  * **进入数据库命令行**：`sudo -u postgres psql`
