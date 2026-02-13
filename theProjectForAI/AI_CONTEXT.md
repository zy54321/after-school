# AI_CONTEXT — After-School Management System

> 目的：给 AI 的“项目快速恢复上下文”锚点。后续每次改动，先读本文件 + AI_INDEX.json + AI_CHANGELOG.md，再输出 Cursor CSV。

## 1. 技术栈

- 前端：Vue 3 + Vite + Vue Router + Element Plus + Axios
- GIS：Mapbox GL + Mapbox Draw + Turf + gcoord
- 图表：ECharts
- 后端：Node.js + Express
- DB：PostgreSQL + PostGIS（pg）

## 2. 目录总览（高层）

- after-school-main/
  - client/  前端工程（Vite）
  - server/  后端工程（Express）
  - docs/    文档（若有）
  - *.md     架构/部署/数据库说明等

## 3. 前端（client）关键入口

- 入口：client/src/main.js → App.vue
- 路由：client/src/router/index.js
- 门户布局：client/src/portal/layout/PortalLayout.vue
- 子系统：client/src/systems/
  - education/  教务主系统
  - family/     家庭/成长银行/奖励商城等
  - analytics/  GIS/分析
  - catering/   餐饮相关
- 权限/常量：client/src/constants/permissions.js
- 权限工具：client/src/utils/permissionTree.js、client/src/composables/usePermission.js

## 4. 后端（server）关键入口

- 入口：server/app.js
- DB 配置：server/src/shared/config/db.js（通常读取 dotenv）
- 共享权限：server/src/shared/constants/permissions.js
- 子系统：server/src/systems/
  - education/ controllers + routes + utils
  - family/ controllers + routes + repos + services
  - analytics/ controllers + routes + services
  - catering/ controllers + routes
- 门户认证：server/src/portal/routes/authRoutes.js、controllers/authController.js

## 5. 运行方式（常用）

### 前端

- 目录：client/
- 安装：npm i
- 开发：npm run dev（以 package.json 为准）

### 后端

- 目录：server/
- 安装：npm i
- 开发：npm run dev
- 生产：npm run start

## 6. 改动约束（避免误伤）

- 尽量“最小 diff”，不要重写整文件
- UPDATE 必须用锚点替换：
  - ### BEFORE
  - ### AFTER
- 不确定处用 TODO，不要猜

## 7. 变更请求模板（你每次都按这个给 AI，省 token）

- 目标：一句话
- 范围白名单：只允许改哪些目录
- 黑名单：明确禁止改哪些目录/文件
- 现状：3~8 条 + 关键报错片段
- 验收：可观测结果
- 输出：
  1. 方案<=8行
  2. Cursor CSV（仅 CSV）

