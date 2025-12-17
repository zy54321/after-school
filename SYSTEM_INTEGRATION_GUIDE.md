# 新系统集成指南

## 🎯 快速开始：添加一个新系统

本文档提供详细的步骤说明，帮助您快速添加一个新的小系统到门户首页。

---

## 📋 前置准备

在开始之前，请确认：
- [ ] 新系统的功能需求已明确
- [ ] 数据库表结构已设计（如需要）
- [ ] 系统名称和路由路径已确定

---

## 🚀 集成步骤

### 步骤 1：创建前端目录结构

```bash
# 在 client/src/views/ 下创建新系统目录
client/src/views/[system-name]/
├── [SystemName]Home.vue    # 系统首页/介绍页（必需）
└── [其他功能页面].vue      # 根据需求添加
```

**示例**：添加"客户关系管理系统 (CRM)"
```bash
client/src/views/crm/
├── CrmHome.vue
├── CustomerList.vue
└── ContactList.vue
```

---

### 步骤 2：创建系统首页组件

创建 `[SystemName]Home.vue`，参考 `SystemHome.vue` 的结构：

```vue
<template>
  <div class="landing-page">
    <!-- 导航栏 -->
    <header class="navbar">
      <div class="logo">
        <span class="icon">🎯</span>
        <span class="text">{{ $t('app.name') }}</span>
      </div>
      <!-- ... 导航栏内容 ... -->
    </header>

    <!-- 主要内容 -->
    <main class="hero-section">
      <!-- 系统介绍 -->
    </main>

    <!-- 功能特性 -->
    <section class="features-section">
      <!-- 特性展示 -->
    </section>

    <!-- 登录对话框 -->
    <el-dialog v-model="loginVisible" ...>
      <!-- 登录表单 -->
    </el-dialog>
  </div>
</template>

<script setup>
// 参考 SystemHome.vue 的实现
</script>
```

---

### 步骤 3：创建布局组件（可选）

如果新系统需要特殊的布局（如侧边栏、HUD风格等），创建布局组件：

```bash
client/src/layout/[SystemName]Layout.vue
```

**示例**：
- 教务系统使用 `AdminLayout`（带侧边栏）
- 商业分析使用 `StrategyLayout`（HUD风格）
- 如果不需要特殊布局，可以复用现有布局或创建新布局

---

### 步骤 4：在门户首页添加卡片

编辑 `client/src/views/portal/Home.vue`：

#### 4.1 添加卡片 HTML

在 `apps-grid` 部分添加：

```vue
<div class="app-card" @click="handle[SystemName]Click">
  <div class="card-glow [system-name]-glow"></div>
  <div class="card-content">
    <div class="icon-wrapper">🎯</div>
    <h3>{{ $t('portal.[systemName]Card.title') }}</h3>
    <p>{{ $t('portal.[systemName]Card.desc') }}</p>
    <div class="card-footer">
      <span class="tag private">{{ $t('portal.[systemName]Card.tag') }}</span>
      <span class="arrow">-></span>
    </div>
  </div>
</div>
```

#### 4.2 添加卡片样式

在 `<style>` 部分添加发光效果：

```css
.[system-name]-glow {
  background: #your-color;
}
```

#### 4.3 添加点击处理函数

在 `<script setup>` 中添加：

```javascript
const handle[SystemName]Click = () => {
  // 如果已登录，直接跳转
  if (isLoggedIn.value) {
    router.push({ name: '[SystemName]Home' });
  } else {
    // 未登录，提示需要登录
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
    }).catch(() => {
      // 用户取消
    });
  }
};
```

---

### 步骤 5：配置路由

编辑 `client/src/router/index.js`：

#### 5.1 引入布局组件（如需要）

```javascript
import [SystemName]Layout from '../layout/[SystemName]Layout.vue'
```

#### 5.2 添加路由配置

```javascript
const routes = [
  // ... 其他路由 ...

  // 新系统首页（独立页面）
  {
    path: '/[system-name]/home',
    name: '[SystemName]Home',
    component: () => import('../views/[system-name]/[SystemName]Home.vue')
  },

  // 新系统功能页面（使用布局）
  {
    path: '/[system-name]',
    component: [SystemName]Layout,
    meta: { requiresAuth: true }, // 如需登录
    children: [
      { 
        path: 'page1', 
        name: '[SystemName]Page1', 
        component: () => import('../views/[system-name]/Page1.vue') 
      },
      // ... 更多页面
    ]
  }
]
```

---

### 步骤 6：添加国际化文本

编辑 `client/src/locales/zh.js` 和 `client/src/locales/en.js`：

```javascript
// zh.js
export default {
  portal: {
    // ... 现有配置 ...
    [systemName]Card: {
      title: '系统名称',
      desc: '系统描述',
      tag: 'PRIVATE' // 或 'PUBLIC'
    }
  }
}

// en.js
export default {
  portal: {
    // ... 现有配置 ...
    [systemName]Card: {
      title: 'System Name',
      desc: 'System Description',
      tag: 'PRIVATE' // 或 'PUBLIC'
    }
  }
}
```

---

### 步骤 7：创建后端 API（如需要）

#### 7.1 创建控制器

```bash
server/src/controllers/[systemName]Controller.js
```

```javascript
const db = require('../config/db');

// 获取数据列表
const get[Items] = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM [table_name] WHERE status = 1');
    res.json({ code: 200, data: result.rows });
  } catch (err) {
    res.status(500).json({ code: 500, msg: err.message });
  }
};

// 创建数据
const create[Item] = async (req, res) => {
  try {
    const { field1, field2 } = req.body;
    const result = await db.query(
      'INSERT INTO [table_name] (field1, field2) VALUES ($1, $2) RETURNING *',
      [field1, field2]
    );
    res.json({ code: 200, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ code: 500, msg: err.message });
  }
};

module.exports = {
  get[Items],
  create[Item],
  // ... 更多方法
};
```

#### 7.2 创建路由

```bash
server/src/routes/[systemName]Routes.js
```

```javascript
const express = require('express');
const router = express.Router();
const [systemName]Controller = require('../controllers/[systemName]Controller');
const { checkAuth } = require('../middleware/authMiddleware');
const { checkAdmin } = require('../middleware/adminMiddleware');

// 需要登录的接口
router.get('/', checkAuth, [systemName]Controller.get[Items]);
router.post('/', checkAuth, checkAdmin, [systemName]Controller.create[Item]);

// 需要管理员权限的接口
router.put('/:id', checkAuth, checkAdmin, [systemName]Controller.update[Item]);
router.delete('/:id', checkAuth, checkAdmin, [systemName]Controller.delete[Item]);

module.exports = router;
```

#### 7.3 注册路由

编辑 `server/app.js`：

```javascript
const [systemName]Routes = require('./src/routes/[systemName]Routes');
app.use('/api/[system-name]', [systemName]Routes);
```

---

## 📝 完整示例：添加"客户关系管理系统"

### 1. 前端文件结构

```
client/src/views/crm/
├── CrmHome.vue          # CRM系统首页
├── CustomerList.vue     # 客户列表
└── ContactList.vue      # 联系人列表

client/src/layout/
└── CrmLayout.vue        # CRM系统布局
```

### 2. 门户首页卡片

```vue
<div class="app-card" @click="handleCrmClick">
  <div class="card-glow crm-glow"></div>
  <div class="card-content">
    <div class="icon-wrapper">📊</div>
    <h3>{{ $t('portal.crmCard.title') }}</h3>
    <p>{{ $t('portal.crmCard.desc') }}</p>
    <div class="card-footer">
      <span class="tag private">{{ $t('portal.crmCard.tag') }}</span>
      <span class="arrow">-></span>
    </div>
  </div>
</div>
```

### 3. 路由配置

```javascript
{
  path: '/crm/home',
  name: 'CrmHome',
  component: () => import('../views/crm/CrmHome.vue')
},
{
  path: '/crm',
  component: CrmLayout,
  meta: { requiresAuth: true },
  children: [
    { path: 'customers', name: 'Customers', component: () => import('../views/crm/CustomerList.vue') },
    { path: 'contacts', name: 'Contacts', component: () => import('../views/crm/ContactList.vue') }
  ]
}
```

### 4. 后端 API

```javascript
// server/src/controllers/crmController.js
const getCustomers = async (req, res) => { /* ... */ };
const createCustomer = async (req, res) => { /* ... */ };

// server/src/routes/crmRoutes.js
router.get('/customers', checkAuth, crmController.getCustomers);
router.post('/customers', checkAuth, checkAdmin, crmController.createCustomer);

// server/app.js
app.use('/api/crm', crmRoutes);
```

---

## ✅ 检查清单

完成集成后，请确认：

- [ ] 前端目录结构已创建
- [ ] 系统首页组件已创建
- [ ] 门户首页卡片已添加
- [ ] 路由配置已更新
- [ ] 国际化文本已添加
- [ ] 后端 API 已创建（如需要）
- [ ] 路由守卫已配置（如需登录）
- [ ] 权限控制已实现（如需要）
- [ ] 样式已添加（卡片发光效果等）

---

## 🔍 常见问题

### Q: 新系统是否需要登录？
A: 根据需求决定。如需登录，在路由中添加 `meta: { requiresAuth: true }`。

### Q: 如何设置权限控制？
A: 
- 前端：检查 `localStorage.getItem('user_info')` 中的 `role`
- 后端：使用 `checkAuth`、`checkAdmin` 中间件

### Q: 新系统可以使用现有的布局吗？
A: 可以。如果不需要特殊布局，可以复用 `AdminLayout` 或其他现有布局。

### Q: 如何添加公共组件？
A: 将组件放在 `client/src/components/` 目录下，在需要的页面中引入。

---

## 📚 参考文件

- **系统首页示例**：`client/src/views/system/SystemHome.vue`
- **布局示例**：`client/src/layout/AdminLayout.vue`
- **路由配置**：`client/src/router/index.js`
- **后端控制器示例**：`server/src/controllers/studentController.js`
- **后端路由示例**：`server/src/routes/studentRoutes.js`

