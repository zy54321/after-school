# 系统架构文档

## 📋 目录结构

### 前端结构 (`client/src/`)

```
client/src/
├── views/
│   ├── portal/              # 门户层 - 作品集展示
│   │   └── Home.vue         # 门户首页（卡片展示）
│   ├── system/              # 教务管理系统
│   │   ├── SystemHome.vue   # 系统首页/介绍页
│   │   ├── Dashboard.vue    # 仪表盘
│   │   ├── StudentList.vue  # 学员管理
│   │   ├── Attendance.vue   # 签到消课
│   │   ├── OrderList.vue    # 订单管理
│   │   ├── ClassManagement.vue  # 课程/班级管理
│   │   ├── UserList.vue     # 用户管理
│   │   └── StudentMap.vue   # 网格化管理（生源热力图）
│   └── strategy/            # 商业分析系统
│       └── StrategyMap.vue  # 商业分析地图
├── layout/
│   ├── PortalLayout.vue     # 门户布局（无侧边栏）
│   ├── AdminLayout.vue      # 教务系统布局（带侧边栏）
│   └── StrategyLayout.vue   # 商业分析布局（HUD风格）
├── components/              # 公共组件
│   └── MapPicker.vue        # 地图选择器
├── router/
│   └── index.js             # 路由配置
├── locales/                 # 国际化
│   ├── zh.js
│   └── en.js
└── config/                  # 配置文件
    └── mapStyles.js
```

### 后端结构 (`server/src/`)

```
server/src/
├── controllers/             # 业务逻辑控制器
│   ├── authController.js    # 认证相关
│   ├── studentController.js # 学员管理
│   ├── classController.js  # 课程/班级管理
│   ├── orderController.js   # 订单管理
│   ├── attendanceController.js  # 签到管理
│   ├── dashboardController.js    # 仪表盘数据
│   ├── userController.js    # 用户管理
│   ├── mapboxController.js  # Mapbox相关（商业分析）
│   └── amapController.js    # 高德地图相关（已废弃）
├── routes/                  # 路由定义
│   ├── authRoutes.js        # POST /api/login
│   ├── studentRoutes.js     # /api/students/*
│   ├── classRoutes.js       # /api/classes/*
│   ├── orderRoutes.js       # /api/orders/*
│   ├── attendanceRoutes.js  # /api/attendance/*
│   ├── dashboardRoutes.js   # /api/dashboard/*
│   ├── userRoutes.js        # /api/users/*
│   └── mapboxRoutes.js      # /api/mapbox/*
├── middleware/              # 中间件
│   ├── authMiddleware.js    # 登录验证
│   ├── adminMiddleware.js   # 管理员权限
│   └── guestMiddleware.js  # 游客权限
└── config/
    └── db.js                # 数据库配置
```

## 🏗️ 架构设计

### 三层架构

1. **门户层 (Portal)** - `/`
   - 公开访问
   - 作品集展示
   - 卡片式入口

2. **系统层 (System)** - `/system/*`
   - 需登录访问
   - 使用 `AdminLayout`（带侧边栏）
   - 教务管理系统相关功能

3. **分析层 (Analytics)** - `/strategy/*`
   - 需登录访问
   - 使用 `StrategyLayout`（HUD风格）
   - 商业分析相关功能

### 路由设计

#### 门户层路由
- `/` → `portal/Home.vue`（门户首页）

#### 教务系统路由
- `/system/home` → `system/SystemHome.vue`（系统首页/介绍页，独立页面）
- `/system/dashboard` → `system/Dashboard.vue`（仪表盘）
- `/system/students` → `system/StudentList.vue`（学员列表）
- `/system/students/:id` → `system/StudentDetail.vue`（学员详情）
- `/system/attendance` → `system/Attendance.vue`（签到消课）
- `/system/orders` → `system/OrderList.vue`（订单管理）
- `/system/classes` → `system/ClassManagement.vue`（课程管理）
- `/system/users` → `system/UserList.vue`（用户管理）
- `/system/grid-map` → `system/StudentMap.vue`（网格化管理）

#### 商业分析路由
- `/strategy/map` → `strategy/StrategyMap.vue`（商业分析地图）

## 🔌 API 接口规范

### 认证相关
- `POST /api/login` - 用户登录

### 学员管理
- `GET /api/students` - 获取学员列表
- `GET /api/students/:id` - 获取学员详情
- `POST /api/students` - 创建学员
- `PUT /api/students/:id` - 更新学员
- `DELETE /api/students/:id` - 删除学员（软删除）
- `GET /api/students/locations` - 获取学员位置数据（GeoJSON）
- `GET /api/students/nearby` - 附近学员搜索

### 课程/班级管理
- `GET /api/classes` - 获取课程列表
- `POST /api/classes` - 创建课程
- `PUT /api/classes/:id` - 更新课程
- `DELETE /api/classes/:id` - 删除课程（硬删除，需检查依赖）

### 订单管理
- `GET /api/orders` - 获取订单列表
- `POST /api/orders` - 创建订单

### 签到管理
- `POST /api/attendance/checkin` - 学员签到

### 仪表盘
- `GET /api/dashboard` - 获取仪表盘统计数据

### 用户管理
- `GET /api/users` - 获取用户列表
- `POST /api/users` - 创建用户
- `PUT /api/users/:id` - 更新用户
- `PUT /api/users/:id/reset-password` - 重置密码

### 商业分析（Mapbox）
- `GET /api/mapbox/places` - 地点搜索
- `GET /api/mapbox/features` - 获取地图要素
- `POST /api/mapbox/features` - 创建地图要素
- `DELETE /api/mapbox/features/:id` - 删除地图要素

## 🔐 权限控制

### 用户角色
- `admin` - 管理员：拥有所有权限
- `teacher` - 普通教师：基础权限
- `visitor` - 游客：仅可查看

### 权限规则

#### 教务管理系统
- 所有功能需要登录（`requiresAuth: true`）
- 部分功能需要管理员权限（如订单管理、用户管理）

#### 商业分析地图
- 需要登录（`requiresAuth: true`）
- 游客：仅可查看地图数据
- 管理员：可以添加、删除数据

## 📝 添加新系统的标准流程

### 1. 前端部分

#### 1.1 创建系统目录和首页
```bash
client/src/views/[system-name]/
├── [SystemName]Home.vue    # 系统首页/介绍页
└── [其他页面].vue
```

#### 1.2 创建布局（如需要）
```bash
client/src/layout/[SystemName]Layout.vue
```

#### 1.3 在门户首页添加卡片
编辑 `client/src/views/portal/Home.vue`：

```vue
<!-- 在 apps-grid 中添加新卡片 -->
<div class="app-card" @click="handle[SystemName]Click">
  <div class="card-glow [system-name]-glow"></div>
  <div class="card-content">
    <div class="icon-wrapper">🎯</div>
    <h3>{{ $t('portal.[systemName]Card.title') }}</h3>
    <p>{{ $t('portal.[systemName]Card.desc') }}</p>
    <div class="card-footer">
      <span class="tag [private/public]">{{ $t('portal.[systemName]Card.tag') }}</span>
      <span class="arrow">-></span>
    </div>
  </div>
</div>
```

添加点击处理函数：
```javascript
const handle[SystemName]Click = () => {
  if (isLoggedIn.value) {
    router.push({ name: '[SystemName]Home' });
  } else {
    ElMessageBox.confirm(
      '请先登录以访问[系统名称]',
      '提示',
      {
        confirmButtonText: '去登录',
        cancelButtonText: '取消',
        type: 'info'
      }
    ).then(() => {
      redirectTarget.value = '/[system-name]/home';
      shouldRedirectAfterLogin.value = true;
      loginVisible.value = true;
    });
  }
};
```

#### 1.4 配置路由
编辑 `client/src/router/index.js`：

```javascript
// 系统首页（独立页面）
{
  path: '/[system-name]/home',
  name: '[SystemName]Home',
  component: () => import('../views/[system-name]/[SystemName]Home.vue')
},

// 系统功能页面（使用布局）
{
  path: '/[system-name]',
  component: [SystemName]Layout,
  meta: { requiresAuth: true },
  children: [
    { 
      path: 'page1', 
      name: '[SystemName]Page1', 
      component: () => import('../views/[system-name]/Page1.vue') 
    },
    // ... 更多页面
  ]
}
```

#### 1.5 添加国际化文本
编辑 `client/src/locales/zh.js` 和 `client/src/locales/en.js`：

```javascript
portal: {
  [systemName]Card: {
    title: '系统名称',
    desc: '系统描述',
    tag: 'PRIVATE' // 或 'PUBLIC'
  }
}
```

### 2. 后端部分

#### 2.1 创建控制器
```bash
server/src/controllers/[systemName]Controller.js
```

```javascript
const db = require('../config/db');

// 示例：获取数据列表
const get[Items] = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM [table_name] WHERE status = 1');
    res.json({ code: 200, data: result.rows });
  } catch (err) {
    res.status(500).json({ code: 500, msg: err.message });
  }
};

module.exports = {
  get[Items],
  // ... 更多方法
};
```

#### 2.2 创建路由
```bash
server/src/routes/[systemName]Routes.js
```

```javascript
const express = require('express');
const router = express.Router();
const [systemName]Controller = require('../controllers/[systemName]Controller');
const { checkAuth } = require('../middleware/authMiddleware');
const { checkAdmin } = require('../middleware/adminMiddleware');

router.get('/', checkAuth, [systemName]Controller.get[Items]);
router.post('/', checkAuth, checkAdmin, [systemName]Controller.create[Item]);
// ... 更多路由

module.exports = router;
```

#### 2.3 注册路由
编辑 `server/app.js`：

```javascript
const [systemName]Routes = require('./src/routes/[systemName]Routes');
app.use('/api/[system-name]', [systemName]Routes);
```

### 3. 数据库（如需要）

创建相应的数据表和字段。

## 🎯 最佳实践

### 命名规范
- **前端组件**：PascalCase（如 `SystemHome.vue`）
- **路由名称**：PascalCase（如 `SystemHome`）
- **路由路径**：kebab-case（如 `/system/home`）
- **后端控制器**：camelCase（如 `studentController.js`）
- **API 路径**：kebab-case（如 `/api/student-list`）

### 权限控制
- 路由级别：使用 `meta: { requiresAuth: true }`
- 组件级别：检查 `localStorage.getItem('user_info')` 中的 `role`
- 后端级别：使用 `checkAuth`、`checkAdmin` 中间件

### 国际化
- 所有用户可见文本使用 `$t()` 或 `t()` 函数
- 翻译键使用点号分隔的层级结构（如 `portal.systemCard.title`）

### 状态管理
- 登录状态：存储在 `localStorage`（`user_token`、`user_info`）
- 语言设置：存储在 `localStorage`（`lang`）

## 📚 当前系统列表

### 1. 教务管理系统 (`/system/*`)
- **首页**：`/system/home` - SystemHome.vue
- **功能**：学员管理、课程管理、订单管理、签到消课、用户管理等
- **布局**：AdminLayout（带侧边栏）
- **权限**：需登录，部分功能需管理员权限

### 2. 商业分析地图 (`/strategy/*`)
- **首页**：`/strategy/map` - StrategyMap.vue
- **功能**：地图数据采集、POI叠加、空间分析
- **布局**：StrategyLayout（HUD风格）
- **权限**：需登录，游客仅可查看，管理员可编辑

## 🔄 扩展指南

### 添加第三个系统示例

假设添加"客户关系管理系统 (CRM)"：

1. **创建目录结构**
   ```
   client/src/views/crm/
   ├── CrmHome.vue
   ├── CustomerList.vue
   └── ContactList.vue
   ```

2. **创建布局**（如需要）
   ```
   client/src/layout/CrmLayout.vue
   ```

3. **在门户首页添加卡片**
   - 添加卡片 HTML
   - 添加 `handleCrmClick` 函数

4. **配置路由**
   - `/crm/home` → CrmHome.vue
   - `/crm/*` → CrmLayout 下的子路由

5. **后端 API**
   - 创建 `crmController.js`
   - 创建 `crmRoutes.js`
   - 在 `app.js` 中注册路由

6. **国际化**
   - 添加翻译文本

## 📌 注意事项

1. **路由守卫**：所有需要登录的路由必须设置 `meta: { requiresAuth: true }`
2. **权限检查**：前后端都要进行权限验证
3. **错误处理**：统一的错误处理和提示
4. **代码复用**：公共组件放在 `components/` 目录
5. **样式隔离**：使用 `scoped` 样式避免冲突

