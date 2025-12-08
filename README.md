托管班管理系统 (After-School Management System) - 技术架构说明
项目简介：这是一个基于 B/S 架构的全栈商业级管理系统，旨在解决教务机构在学员管理、课程消课、财务流水及权限控制等方面的核心痛点。项目采用前后端分离模式开发，实现了从报名、签到、退费到报表导出的完整业务闭环。

1. 技术栈概览 (Tech Stack)
本项目采用现代化的 Vue3 + Node.js + PostgreSQL 全栈方案，注重开发效率、代码规范与数据安全性。

💻 前端 (Client-Side)
核心框架：Vue 3 (Composition API) + Vite ⚡️ (极速构建)

UI 组件库：Element Plus (响应式后台管理界面)

状态/路由：Vue Router 4 (路由管理与权限守卫)

网络请求：Axios (拦截器封装、统一错误处理)

可视化/工具：

xlsx (SheetJS)：纯前端生成 Excel 财务报表。

@amap/amap-jsapi-loader：集成高德地图 SDK，实现 LBS 地址选点与可视化。

🛠 后端 (Server-Side)
运行时：Node.js

Web 框架：Express.js (RESTful API 设计)

数据库交互：pg (node-postgres 连接池)

安全/鉴权：

express-session + connect-pg-simple：Session 持久化存储至数据库。

bcryptjs：密码加盐哈希 (Salted Hash)。

中间件：自定义 authMiddleware (登录拦截) 和 adminMiddleware (角色鉴权)。

🗄 数据库 (Database)
核心数据库：PostgreSQL 14+

特性应用：ACID 事务控制、JSON 聚合查询、CTE (公用表表达式)。

2. 核心架构与解决方案 (Key Solutions)
2.1 安全鉴权体系 (Authentication & Security)
挑战：如何保证用户登录状态的持久化，并防止密码泄露？

解决方案：

Session 持久化：摒弃了默认的内存存储，使用 connect-pg-simple 将 Session 存入 PostgreSQL 数据库表 (session)。即使服务器重启，用户登录状态依然保留。

密码安全：拒绝明文存储。注册/重置密码时使用 bcrypt.hashSync 生成带盐值的哈希字符串；登录时使用 bcrypt.compareSync 进行校验，确保数据库即使被拖库也无法还原用户密码。

2.2 RBAC 权限控制 (Role-Based Access Control)
挑战：如何区分“管理员”与“普通教师”的操作边界，防止越权操作？

解决方案：构建了 “前端隐藏 + 后端拦截” 的双重防御体系。

数据库层：users 表增加 role 字段 (admin / teacher)。

后端层：封装 adminMiddleware 中间件。在 delete (删除) 和 drop (退课) 等敏感路由前挂载此中间件，非管理员请求直接返回 403 Forbidden。

前端层：利用 v-if="role === 'admin'" 动态渲染侧边栏菜单（如“员工管理”）和危险按钮（如“删除”），提升用户体验。

2.3 复杂业务的事务处理 (Database Transactions)
挑战：在“学员报名”或“退课退费”时，涉及多张表（订单表 orders、余额表 student_course_balance、学员表 students）的同时更新，如何保证数据一致性？

解决方案：

使用 PostgreSQL 的 Transaction (事务) 机制。

通过 client.query('BEGIN') 开启事务，依次执行：

插入订单记录 (报名为正数，退费为负数)。

更新学员课程余额/有效期 (使用 ON CONFLICT 处理新增或更新)。

更新学员状态 (如需)。

若任意步骤报错，触发 client.query('ROLLBACK') 回滚所有操作，确保财务账目永远平齐。

2.4 高性能聚合查询 (SQL Optimization)
挑战：学员列表需要展示“剩余课时”、“是否签到”、“有效期”等综合信息，如果采用循环查库 (N+1 问题) 会导致性能极差。

解决方案：

利用 PostgreSQL 强大的 CTE (Common Table Expressions) 和 JSON Aggregation 功能。

一条 SQL 搞定所有：先用 WITH 语句计算出每个学员的课程余额和签到状态（并过滤掉已过期课程），再通过 json_agg 将多个课程对象压缩成一个 JSON 数组返回给前端。后端接口响应速度极快且逻辑清晰。

2.5 智能退课与财务平账
挑战：学员中途退学，如何处理剩余资产和财务记录？

解决方案：

负数订单：设计了“负数金额”逻辑，退费时生成一条金额为负的订单记录，保证财务统计（SUM(amount)）准确无误。

精准退课：不采用粗暴的“删除学员”，而是将指定课程余额清零并设为过期，保留学员档案和历史数据，符合真实商业场景。

3. 数据库设计 (Database Schema)
系统采用典型的关系型数据库设计，遵循第三范式 (3NF)：

Users (员工表)：存储账号、加密密码、角色、激活状态。

Classes (课程/班级表)：定义商品，包含计费模式（按次/按期）、学费单价、排课周期。

Students (学员表)：核心资产，存储基础信息及 GIS 坐标。

Student_Course_Balance (学员课程余额表)：核心关联表，记录每个学生在每个班级的剩余课时或有效期。

Attendance (签到记录表)：记录消课流水，关联学生、班级和操作员。

Orders (订单流水表)：记录所有资金变动（充值、续费、退费）。

4. 目录结构说明 (Project Structure)
Plaintext

root/
├── client/                 # 前端项目 (Vue3 + Vite)
│   ├── src/
│   │   ├── api/            # Axios 封装
│   │   ├── components/     # 公共组件 (如 MapPicker.vue)
│   │   ├── views/          # 页面视图 (StudentList, Dashboard, OrderList...)
│   │   ├── layout/         # 布局文件 (Sidebar, Header)
│   │   └── router/         # 路由配置 (含 Login 拦截)
│   └── package.json
│
├── server/                 # 后端项目 (Node.js + Express)
│   ├── src/
│   │   ├── config/         # 数据库连接配置
│   │   ├── controllers/    # 业务逻辑控制器 (Student, Order, Auth...)
│   │   ├── middleware/     # 中间件 (authMiddleware, adminMiddleware)
│   │   └── routes/         # 路由定义
│   ├── app.js              # 入口文件 (Session 配置, 路由挂载)
│   └── package.json
│
└── README.md
5. 总结与展望
本项目通过全栈技术解决了一个具体的商业问题，实现了数据的闭环管理。 下一步计划：

DevOps：使用 PM2 进程守护，结合 Nginx 反向代理上线云服务器。

GIS 升级：引入 PostGIS 空间数据库，将目前的“文本地址”升级为 Geometry 类型，实现基于地理位置的商业分析（如：生源热力图、3公里竞品分析）。
