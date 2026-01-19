# 🏫 托管班教务管理系统 (After-School Management System)

![Vue.js](https://img.shields.io/badge/Frontend-Vue3%20%2B%20Vite-4FC08D?logo=vue.js)
![Node.js](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933?logo=node.js)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20%2B%20PostGIS-4169E1?logo=postgresql)
![Status](https://img.shields.io/badge/Status-Production%20Ready-success)

> **项目简介**：这是一个基于 B/S 架构的商业级全栈管理系统。针对教务机构在学员档案、课程消课、财务流水及地理位置分析（GIS）等方面的核心痛点，提供了一套轻量化、高性能的数字化解决方案。

---

## ✨ 核心功能亮点 (Key Features)

### 1. 🗺️ GIS 地理信息集成 (Spatial Intelligence)
不同于传统的文本地址存储，本项目引入 **PostGIS** 空间数据库引擎：
- **精准坐标存储**：使用 `GEOMETRY(Point, 4326)` 类型存储学员家庭坐标。
- **可视化分布**：集成高德地图 SDK，实现学员分布落点与位置可视化。
- **空间查询**：支持“查找周边 3km 生源”等空间计算功能（Under Development）。

### 2. 💰 严谨的财务体系 (Financial Consistency)
- **ACID 事务保障**：在处理报名、退费、转课等资金变动时，严格使用数据库事务（Transaction），确保“扣款”与“生成订单”原子性执行。
- **双重计费模式**：完美支持“按次消课”与“按期（包月/包季）”两种复杂的教务计费逻辑。

### 3. 🛡️ 企业级权限控制 (Security & RBAC)
- **多角色权限**：区分超级管理员 (Admin) 与普通教师 (Teacher) 的操作边界。
- **演示模式 (Visitor Mode)**：为了方便作品展示，特设“游客中间件”。游客可查看全站数据，但所有 `POST/PUT/DELETE` 修改请求会被后端自动拦截，保障数据安全。

### 4. 📊 高性能数据聚合
- **SQL 优化**：摒弃低效的 ORM 循环查询 (N+1问题)，利用 PostgreSQL 的 **CTE (公用表表达式)** 和 **JSON Aggregation**，单次请求即可返回学员及其关联的所有课程余额信息。

---

## 🛠 技术栈 (Tech Stack)

| 领域 | 技术选型 | 理由 |
| :--- | :--- | :--- |
| **前端** | **Vue 3 (Composition API)** | 逻辑复用性强，配合 **Vite** 实现秒级热更新 |
| | Element Plus | 响应式后台 UI 组件库 |
| | Axios | 统一的网络请求封装与拦截器处理 |
| **后端** | **Node.js + Express** | 轻量高效的 RESTful API 设计 |
| | **PM2** | 生产环境的进程守护与负载均衡 |
| **数据库** | **PostgreSQL 16** | 世界上最先进的开源关系型数据库 |
| | **PostGIS** | 处理地理空间数据的行业标准插件 |
| **部署** | **Ubuntu 24.04 LTS** | 腾讯云轻量应用服务器 |
| | Nginx | 反向代理与静态资源托管 |

---

## 📚 文档导航

- **[架构文档](./ARCHITECTURE.md)** - 系统整体架构、目录结构、路由设计
- **[新系统集成指南](./SYSTEM_INTEGRATION_GUIDE.md)** - 如何添加新的小系统到门户首页
- **[API 接口参考](./API_REFERENCE.md)** - 完整的后端 API 接口文档

---

## 📸 系统预览 (Screenshots)

> *（建议在此处放 2-3 张截图：比如“学员地图选点”、“财务报表”、“移动端适配效果”）*

---

## 🚀 快速开始 (Quick Start)

### 环境要求
* Node.js >= 18.0
* PostgreSQL >= 14.0 (必须安装 PostGIS 扩展)

### 1\. 克隆项目
```bash
git clone [https://github.com/zy54321/after-school.git](https://github.com/zy54321/after-school.git)
cd after-school
```

### 2\. 数据库初始化

```sql
-- 在 PostgreSQL 中执行
CREATE DATABASE after_school;
\c after_school
CREATE EXTENSION postgis; -- ⚠️ 必须启用此插件
-- 导入 database/init.sql (如果有)
```

### 2.1 RBAC 权限初始化 ⚠️ 必须执行

```bash
# 在项目根目录执行，初始化 RBAC 权限体系
psql -U your_user -d after_school -f server/migrations/001_init_rbac.sql
```

> **说明**：此脚本会创建角色表、权限表，并为 admin 角色分配所有权限。
> 如果不执行此脚本，用户管理、学员删除、退款等功能将因权限校验失败而无法使用。

### 3\. 启动后端

```bash
cd server
# 复制配置文件并修改数据库密码
cp .env.example .env 
npm install
npm run dev
```

### 4\. 启动前端

```bash
cd client
npm install
npm run dev
```

-----

## 🗺 未来规划 (Roadmap)

  - [ ] **生源热力图**：基于 PostGIS 分析生源密集区域，辅助市场地推。
  - [ ] **微信消息推送**：上课签到后自动发送模板消息给家长。
  - [ ] **Docker 化**：提供 Docker Compose 文件以便一键部署。

-----

## 📄 License

MIT License © 2025

```
```
