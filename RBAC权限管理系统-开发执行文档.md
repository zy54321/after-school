# RBAC 权限管理系统 - 开发执行文档

> **项目名称**：托管班管理系统 - RBAC 权限管理模块  
> **技术栈**：Vue 3 (Element Plus) + Node.js (Express) + PostgreSQL  
> **文档版本**：v1.0  
> **创建日期**：2024

---

## 📋 目录

1. [任务说明](#1-任务说明)
2. [执行计划大纲](#2-执行计划大纲)
3. [技术要求](#3-技术要求)
4. [数据库设计](#4-数据库设计)
5. [API 接口规范](#5-api-接口规范)
6. [前端实现规范](#6-前端实现规范)
7. [开发检查清单](#7-开发检查清单)
8. [测试要求](#8-测试要求)

---

## 1. 任务说明

### 1.1 项目目标

在现有托管班管理系统中实施基于"配置化 + 细粒度"的 RBAC 权限管理系统，实现：

- ✅ **配置化权限管理**：管理员可通过界面配置用户权限，无需修改代码
- ✅ **细粒度权限控制**：支持模块、资源、操作三级权限控制
- ✅ **角色权限分配**：通过角色批量分配权限，提高管理效率
- ✅ **前端权限展示**：权限树形结构展示，操作直观
- ✅ **后端权限验证**：中间件统一权限检查，确保安全性

### 1.2 核心功能

1. **权限资源管理**
   - 权限列表维护（系统预置）
   - 权限代码规范：`资源:操作` 格式

2. **角色管理**
   - 角色 CRUD 操作
   - 角色权限分配（复选框勾选）
   - 系统角色保护（不可删除）

3. **用户角色分配**
   - 用户角色分配界面
   - 支持一个用户多个角色
   - 用户权限查看

4. **权限验证**
   - 后端中间件权限检查
   - 前端路由权限守卫
   - 前端菜单权限控制
   - 前端组件权限指令

### 1.3 设计原则

- **后端扁平存储**：权限数据扁平存储，避免递归查询
- **前端树形展示**：前端通过 `module` 和 `parent_code` 构建树形结构
- **无权限继承**：简化设计，不实现角色继承
- **仅角色分配**：不支持用户直接分配权限，统一通过角色分配
- **权限代码规范**：采用 `资源:操作` 格式（如 `student:create`）

---

## 2. 执行计划大纲

### 阶段一：数据库设计与迁移（预计 1 天）

**任务清单**：
- [ ] 创建数据库迁移脚本（SQL）
- [ ] 创建 4 张核心表：`permissions`, `roles`, `role_permissions`, `user_roles`
- [ ] 创建索引优化查询性能
- [ ] 编写初始化数据脚本（默认权限、默认角色、默认角色权限分配）
- [ ] 数据迁移脚本（将现有用户的 `role` 字段迁移到 `user_roles` 表）

**交付物**：
- `migrations/001_create_rbac_tables.sql`
- `migrations/002_init_rbac_data.sql`
- `migrations/003_migrate_user_roles.sql`

### 阶段二：后端服务开发（预计 2-3 天）

**任务清单**：
- [ ] 创建权限服务层 (`permissionService.js`)
  - [ ] `getAllPermissions()` - 获取所有权限（扁平列表）
  - [ ] `getUserPermissions(userId)` - 获取用户所有权限
  - [ ] `hasPermission(userId, permissionCode)` - 检查用户是否有权限
  - [ ] `getRolePermissions(roleId)` - 获取角色权限
  - [ ] `assignRolePermissions(roleId, permissionIds)` - 分配角色权限
  - [ ] `getUserRoles(userId)` - 获取用户角色
  - [ ] `assignUserRoles(userId, roleIds)` - 分配用户角色
- [ ] 创建权限控制器 (`permissionController.js`)
  - [ ] 权限管理接口
  - [ ] 角色管理接口
  - [ ] 用户角色管理接口
  - [ ] 权限检查接口
- [ ] 创建权限路由 (`permissionRoutes.js`)
- [ ] 创建权限中间件 (`permissionMiddleware.js`)
  - [ ] `checkPermission(permissionCode)` - 检查单个权限
  - [ ] `checkAnyPermission(permissionCodes)` - 检查任意权限
  - [ ] `checkAllPermissions(permissionCodes)` - 检查所有权限
- [ ] 创建权限常量文件 (`constants/permissions.js`)
- [ ] 集成到现有路由（替换 `checkAdmin` 中间件）

**交付物**：
- `server/src/shared/services/permissionService.js`
- `server/src/systems/education/controllers/permissionController.js`
- `server/src/systems/education/routes/permissionRoutes.js`
- `server/src/shared/middleware/permissionMiddleware.js`
- `server/src/shared/constants/permissions.js`

### 阶段三：前端页面开发（预计 2-3 天）

**任务清单**：
- [ ] 创建权限管理页面 (`PermissionManagement.vue`)
  - [ ] 角色列表展示
  - [ ] 角色 CRUD 操作
  - [ ] 权限树形展示（按模块分组）
  - [ ] 权限复选框勾选
  - [ ] 权限配置保存
- [ ] 创建用户角色分配页面 (`UserRoleAssignment.vue`)
  - [ ] 用户列表展示
  - [ ] 用户角色分配对话框
  - [ ] 用户权限查看
- [ ] 创建权限工具函数 (`utils/permissionTree.js`)
  - [ ] `buildPermissionTree(permissions)` - 构建权限树
- [ ] 创建权限组合式函数 (`composables/usePermission.js`)
  - [ ] `hasPermission(permissionCode)` - 检查权限
  - [ ] `hasAnyPermission(permissionCodes)` - 检查任意权限
  - [ ] `hasAllPermissions(permissionCodes)` - 检查所有权限
- [ ] 创建权限指令 (`directives/permission.js`)
- [ ] 修改路由配置（添加权限元数据）
- [ ] 修改菜单组件 (`EducationLayout.vue`) - 集成权限控制
- [ ] 创建权限 API 服务 (`api/permission.js`)

**交付物**：
- `client/src/systems/education/views/PermissionManagement.vue`
- `client/src/systems/education/views/UserRoleAssignment.vue`
- `client/src/utils/permissionTree.js`
- `client/src/composables/usePermission.js`
- `client/src/directives/permission.js`
- `client/src/api/permission.js`

### 阶段四：权限集成（预计 1-2 天）

**任务清单**：
- [ ] 替换现有权限检查逻辑
  - [ ] 替换 `checkAdmin` 中间件为 `checkPermission`
  - [ ] 更新路由权限配置
- [ ] 前端权限集成
  - [ ] 菜单权限控制
  - [ ] 按钮权限控制
  - [ ] 路由权限守卫
- [ ] 登录时加载用户权限
  - [ ] 登录接口返回用户权限列表
  - [ ] 前端存储用户权限（localStorage 或 Pinia store）

**交付物**：
- 更新后的路由文件
- 更新后的中间件使用
- 更新后的前端组件

### 阶段五：测试与优化（预计 1 天）

**任务清单**：
- [ ] 功能测试
  - [ ] 权限配置功能测试
  - [ ] 角色管理功能测试
  - [ ] 用户角色分配测试
  - [ ] 权限验证测试
- [ ] 性能测试
  - [ ] 权限查询性能测试
  - [ ] 权限缓存优化（如需要）
- [ ] 安全测试
  - [ ] 权限绕过测试
  - [ ] 未授权访问测试
- [ ] 用户体验测试
  - [ ] 界面操作流畅性
  - [ ] 错误提示友好性

**交付物**：
- 测试报告
- Bug 修复记录
- 性能优化记录

---

## 3. 技术要求

### 3.1 数据库要求

- **数据库**：PostgreSQL
- **命名规范**：
  - 表名：小写，下划线分隔（如 `role_permissions`）
  - 字段名：小写，下划线分隔（如 `permission_id`）
  - 索引名：`idx_表名_字段名`（如 `idx_role_permissions_role`）
- **约束要求**：
  - 外键使用 `ON DELETE CASCADE`
  - 唯一约束使用 `UNIQUE(字段1, 字段2)`
- **性能要求**：
  - 关键查询字段创建索引
  - 避免全表扫描

### 3.2 后端要求

- **代码规范**：
  - 使用 ES6+ 语法
  - 异步操作使用 `async/await`
  - 错误处理统一使用 `try/catch`
  - 返回格式统一：`{ code: 200, msg: '成功', data: ... }`
- **安全要求**：
  - 所有权限管理接口必须使用 `checkPermission('permission:assign')` 或 `checkPermission('role:manage')`
  - 权限检查必须在后端完成，前端仅用于 UI 展示
  - 敏感操作记录操作日志（可选）
- **性能要求**：
  - 权限查询考虑缓存（后续优化）
  - 避免 N+1 查询问题

### 3.3 前端要求

- **代码规范**：
  - 使用 Vue 3 Composition API
  - 使用 `<script setup>` 语法
  - 组件命名使用 PascalCase
  - 文件命名使用 PascalCase（组件）或 camelCase（工具函数）
- **UI 要求**：
  - 使用 Element Plus 组件库
  - 保持与现有系统 UI 风格一致
  - 响应式设计，支持不同屏幕尺寸
  - 错误提示友好，使用 ElMessage
- **性能要求**：
  - 权限树构建使用计算属性缓存
  - 大量数据使用虚拟滚动（如需要）

### 3.4 权限代码规范

- **格式**：`资源:操作`
- **资源命名**：小写，单数形式（如 `student`, `order`, `user`）
- **操作命名**：小写，动词形式（如 `create`, `read`, `update`, `delete`）
- **示例**：
  - `student:create` - 创建学员
  - `student:read` - 查看学员
  - `order:refund` - 退费
  - `user:resetPassword` - 重置密码

---

## 4. 数据库设计

### 4.1 表结构

#### 4.1.1 permissions 表

```sql
CREATE TABLE permissions (
  id SERIAL PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,     -- 权限代码，如 'student:create'
  name VARCHAR(100) NOT NULL,            -- 权限名称，如 '创建学员'
  module VARCHAR(50) NOT NULL,           -- 模块，如 'student', 'order', 'user'
  resource VARCHAR(50) NOT NULL,         -- 资源，如 'student', 'order'
  action VARCHAR(50) NOT NULL,          -- 操作，如 'create', 'read', 'update', 'delete'
  description TEXT,                      -- 权限描述
  parent_code VARCHAR(100),              -- 父权限代码（用于前端构建树）
  sort_order INTEGER DEFAULT 0,          -- 排序
  is_active BOOLEAN DEFAULT TRUE,         -- 是否启用
  created_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_permissions_module ON permissions(module);
CREATE INDEX idx_permissions_parent_code ON permissions(parent_code);
CREATE INDEX idx_permissions_code ON permissions(code);
```

#### 4.1.2 roles 表

```sql
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,      -- 角色代码，如 'admin', 'teacher'
  name VARCHAR(100) NOT NULL,            -- 角色名称，如 '管理员', '教师'
  description TEXT,                      -- 角色描述
  is_system BOOLEAN DEFAULT FALSE,        -- 是否系统角色（不可删除）
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_roles_code ON roles(code);
```

#### 4.1.3 role_permissions 表

```sql
CREATE TABLE role_permissions (
  id SERIAL PRIMARY KEY,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

-- 索引
CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_id);
```

#### 4.1.4 user_roles 表

```sql
CREATE TABLE user_roles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

-- 索引
CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);
```

### 4.2 初始化数据

#### 4.2.1 默认权限列表

需要预置的权限模块：

1. **学员管理 (student)**
   - `student:create` - 创建学员
   - `student:read` - 查看学员
   - `student:update` - 更新学员
   - `student:delete` - 删除学员
   - `student:export` - 导出学员

2. **订单管理 (order)**
   - `order:create` - 创建订单
   - `order:read` - 查看订单
   - `order:update` - 更新订单
   - `order:delete` - 删除订单
   - `order:refund` - 退费

3. **用户管理 (user)**
   - `user:create` - 创建用户
   - `user:read` - 查看用户
   - `user:update` - 更新用户
   - `user:delete` - 删除用户
   - `user:resetPassword` - 重置密码

4. **权限管理 (permission)**
   - `permission:read` - 查看权限配置
   - `permission:assign` - 分配权限
   - `role:manage` - 角色管理

5. **其他模块**（根据现有系统功能补充）
   - `class:*` - 课程管理
   - `attendance:*` - 签到管理
   - `dashboard:*` - 仪表盘
   - `report:*` - 报表管理
   - `catering:*` - 餐饮管理
   - 等等...

#### 4.2.2 默认角色

1. **admin（管理员）**
   - 拥有所有权限
   - `is_system: true`（不可删除）

2. **teacher（教师）**
   - 基础权限：
     - `student:read`, `student:update`
     - `order:read`
     - `attendance:*`
     - `dashboard:read`
     - 等等...
   - `is_system: true`（不可删除）

### 4.3 数据迁移

将现有用户的 `role` 字段迁移到 `user_roles` 表：

```sql
-- 迁移脚本
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.code = u.role
WHERE u.role IS NOT NULL
ON CONFLICT (user_id, role_id) DO NOTHING;
```

---

## 5. API 接口规范

### 5.1 权限管理接口

#### 5.1.1 获取所有权限

```
GET /api/permissions
```

**权限要求**：`permission:read`

**响应示例**：
```json
{
  "code": 200,
  "msg": "成功",
  "data": [
    {
      "id": 1,
      "code": "student:create",
      "name": "创建学员",
      "module": "student",
      "resource": "student",
      "action": "create",
      "description": "创建新学员",
      "parent_code": "student",
      "sort_order": 1,
      "is_active": true
    },
    ...
  ]
}
```

#### 5.1.2 获取权限树（前端构建）

```
GET /api/permissions/tree
```

**权限要求**：`permission:read`

**响应示例**：
```json
{
  "code": 200,
  "msg": "成功",
  "data": [
    {
      "code": "student",
      "name": "学员管理",
      "children": [
        {
          "id": 1,
          "code": "student:create",
          "name": "创建学员",
          ...
        },
        ...
      ]
    },
    ...
  ]
}
```

### 5.2 角色管理接口

#### 5.2.1 获取所有角色

```
GET /api/roles
```

**权限要求**：`role:manage`

**响应示例**：
```json
{
  "code": 200,
  "msg": "成功",
  "data": [
    {
      "id": 1,
      "code": "admin",
      "name": "管理员",
      "description": "系统管理员",
      "is_system": true,
      "is_active": true,
      "created_at": "2024-01-01T00:00:00Z"
    },
    ...
  ]
}
```

#### 5.2.2 创建角色

```
POST /api/roles
```

**权限要求**：`role:manage`

**请求体**：
```json
{
  "code": "manager",
  "name": "经理",
  "description": "部门经理"
}
```

#### 5.2.3 更新角色

```
PUT /api/roles/:id
```

**权限要求**：`role:manage`

**请求体**：
```json
{
  "name": "部门经理",
  "description": "部门经理角色"
}
```

**注意**：`code` 和 `is_system` 不可修改

#### 5.2.4 删除角色

```
DELETE /api/roles/:id
```

**权限要求**：`role:manage`

**验证**：系统角色不可删除

#### 5.2.5 获取角色权限

```
GET /api/roles/:id/permissions
```

**权限要求**：`permission:read`

**响应示例**：
```json
{
  "code": 200,
  "msg": "成功",
  "data": [1, 2, 3, 5, 8]  // 权限ID数组
}
```

#### 5.2.6 分配角色权限

```
POST /api/roles/:id/permissions
```

**权限要求**：`permission:assign`

**请求体**：
```json
{
  "permission_ids": [1, 2, 3, 5, 8]  // 权限ID数组
}
```

### 5.3 用户角色管理接口

#### 5.3.1 获取用户角色

```
GET /api/users/:id/roles
```

**权限要求**：`user:read` 或 `permission:read`

**响应示例**：
```json
{
  "code": 200,
  "msg": "成功",
  "data": [
    {
      "id": 1,
      "code": "admin",
      "name": "管理员",
      ...
    },
    ...
  ]
}
```

#### 5.3.2 分配用户角色

```
POST /api/users/:id/roles
```

**权限要求**：`permission:assign`

**请求体**：
```json
{
  "role_ids": [1, 2]  // 角色ID数组
}
```

#### 5.3.3 移除用户角色

```
DELETE /api/users/:id/roles/:roleId
```

**权限要求**：`permission:assign`

### 5.4 权限检查接口

#### 5.4.1 获取当前用户权限

```
GET /api/auth/permissions
```

**权限要求**：已登录用户

**响应示例**：
```json
{
  "code": 200,
  "msg": "成功",
  "data": [
    "student:create",
    "student:read",
    "order:read",
    ...
  ]
}
```

#### 5.4.2 检查当前用户权限

```
POST /api/auth/check-permission
```

**权限要求**：已登录用户

**请求体**：
```json
{
  "permission_code": "student:create"
}
```

**响应示例**：
```json
{
  "code": 200,
  "msg": "成功",
  "data": {
    "has_permission": true
  }
}
```

---

## 6. 前端实现规范

### 6.1 权限树构建

**文件**：`client/src/utils/permissionTree.js`

```javascript
/**
 * 构建权限树
 * @param {Array} permissions - 扁平权限数组
 * @returns {Array} 树形权限结构
 */
export function buildPermissionTree(permissions) {
  // 1. 按 module 分组
  // 2. 每个 module 下，按 parent_code 构建父子关系
  // 3. 返回树形结构
}
```

### 6.2 权限组合式函数

**文件**：`client/src/composables/usePermission.js`

```javascript
import { ref, computed } from 'vue';

export function usePermission() {
  // 从 localStorage 或 store 获取用户权限
  const userPermissions = ref([]);
  
  const hasPermission = (permissionCode) => {
    return userPermissions.value.includes(permissionCode);
  };
  
  const hasAnyPermission = (permissionCodes) => {
    return permissionCodes.some(code => hasPermission(code));
  };
  
  const hasAllPermissions = (permissionCodes) => {
    return permissionCodes.every(code => hasPermission(code));
  };
  
  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions
  };
}
```

### 6.3 权限指令

**文件**：`client/src/directives/permission.js`

```javascript
import { usePermission } from '@/composables/usePermission';

export default {
  mounted(el, binding) {
    const { hasPermission } = usePermission();
    if (!hasPermission(binding.value)) {
      el.remove();
    }
  }
};
```

**使用方式**：
```vue
<el-button v-permission="'student:create'">创建学员</el-button>
```

### 6.4 路由权限守卫

**文件**：`client/src/router/index.js`

```javascript
router.beforeEach((to, from, next) => {
  // 1. 检查是否需要登录
  // 2. 检查路由权限（to.meta.permissions）
  // 3. 使用 usePermission 检查权限
  // 4. 通过/拒绝
});
```

### 6.5 菜单权限控制

**文件**：`client/src/systems/education/layout/EducationLayout.vue`

```vue
<el-menu-item 
  index="/system/orders" 
  v-if="hasPermission('order:read')">
  ...
</el-menu-item>
```

---

## 7. 开发检查清单

### 7.1 数据库检查清单

- [ ] 所有表创建成功
- [ ] 所有索引创建成功
- [ ] 外键约束正确
- [ ] 唯一约束正确
- [ ] 初始化数据导入成功
- [ ] 数据迁移脚本执行成功

### 7.2 后端检查清单

- [ ] 权限服务层实现完整
- [ ] 权限控制器实现完整
- [ ] 权限路由配置正确
- [ ] 权限中间件实现正确
- [ ] 权限常量文件创建
- [ ] 错误处理完善
- [ ] 返回格式统一
- [ ] 权限检查逻辑正确

### 7.3 前端检查清单

- [ ] 权限管理页面实现完整
- [ ] 用户角色分配页面实现完整
- [ ] 权限树构建函数正确
- [ ] 权限组合式函数正确
- [ ] 权限指令正确
- [ ] 路由权限守卫正确
- [ ] 菜单权限控制正确
- [ ] API 服务封装完整
- [ ] 错误提示友好
- [ ] UI 风格一致

### 7.4 集成检查清单

- [ ] 现有路由权限检查替换完成
- [ ] 现有中间件替换完成
- [ ] 登录接口返回用户权限
- [ ] 前端存储用户权限
- [ ] 所有菜单项权限控制完成
- [ ] 所有按钮权限控制完成

### 7.5 测试检查清单

- [ ] 权限配置功能测试通过
- [ ] 角色管理功能测试通过
- [ ] 用户角色分配测试通过
- [ ] 权限验证测试通过
- [ ] 权限绕过测试通过
- [ ] 未授权访问测试通过
- [ ] 性能测试通过

---

## 8. 测试要求

### 8.1 功能测试

#### 8.1.1 权限配置测试

1. **角色创建测试**
   - 创建新角色
   - 验证角色代码唯一性
   - 验证必填字段

2. **权限分配测试**
   - 选择角色，勾选权限
   - 保存权限配置
   - 验证权限保存成功
   - 验证权限树展示正确

3. **角色删除测试**
   - 删除非系统角色
   - 验证系统角色不可删除
   - 验证删除后用户角色关系处理

#### 8.1.2 用户角色分配测试

1. **角色分配测试**
   - 为用户分配角色
   - 验证多角色支持
   - 验证角色移除

2. **权限查看测试**
   - 查看用户最终权限
   - 验证权限合并正确（多角色权限合并）

#### 8.1.3 权限验证测试

1. **后端权限验证**
   - 测试有权限的请求通过
   - 测试无权限的请求被拒绝
   - 测试未登录请求被拒绝

2. **前端权限验证**
   - 测试菜单项根据权限显示/隐藏
   - 测试按钮根据权限显示/隐藏
   - 测试路由权限守卫

### 8.2 安全测试

1. **权限绕过测试**
   - 尝试直接访问无权限的 API
   - 尝试修改前端代码绕过权限检查
   - 验证后端权限检查有效

2. **未授权访问测试**
   - 未登录访问需要权限的页面
   - 验证跳转到登录页

### 8.3 性能测试

1. **权限查询性能**
   - 测试用户权限查询速度
   - 测试角色权限查询速度
   - 测试权限列表查询速度

2. **并发测试**
   - 测试多用户同时查询权限
   - 测试多用户同时修改权限配置

### 8.4 用户体验测试

1. **界面操作流畅性**
   - 测试权限树展开/收起
   - 测试权限复选框勾选
   - 测试保存操作反馈

2. **错误提示友好性**
   - 测试权限不足提示
   - 测试操作失败提示
   - 测试表单验证提示

---

## 9. 注意事项

### 9.1 开发注意事项

1. **权限代码一致性**
   - 前后端权限代码必须一致
   - 使用常量文件管理权限代码
   - 避免硬编码权限代码

2. **权限检查完整性**
   - 所有需要权限的操作都必须检查
   - 前端检查仅用于 UI，后端检查必须存在
   - 敏感操作必须记录日志（可选）

3. **数据一致性**
   - 删除角色时处理用户角色关系
   - 删除权限时处理角色权限关系
   - 系统角色和权限不可删除

4. **性能优化**
   - 权限查询考虑缓存（后续优化）
   - 避免 N+1 查询问题
   - 大量数据使用分页

### 9.2 部署注意事项

1. **数据库迁移**
   - 先执行表创建脚本
   - 再执行初始化数据脚本
   - 最后执行数据迁移脚本

2. **权限初始化**
   - 确保默认角色和权限已创建
   - 确保管理员用户已分配 admin 角色

3. **向后兼容**
   - 保留现有 `users.role` 字段（兼容性）
   - 新系统使用 `user_roles` 表
   - 逐步迁移现有用户

---

## 10. 后续优化建议

### 10.1 性能优化

1. **权限缓存**
   - 实现 Redis 缓存用户权限
   - 缓存 TTL: 5-10 分钟
   - 权限变更时清除缓存

2. **查询优化**
   - 优化权限查询 SQL
   - 使用批量查询减少数据库访问

### 10.2 功能扩展

1. **权限模板**
   - 预设常用角色权限模板
   - 快速创建角色

2. **权限使用统计**
   - 记录权限使用情况
   - 分析权限使用频率
   - 优化权限配置

3. **权限审批流程**（可选）
   - 权限变更需要审批
   - 记录权限变更历史

---

## 11. 参考资料

### 11.1 相关文档

- [数据库表结构说明.md](./数据库表结构说明.md)
- [技术架构与开发规范手册.md](./技术架构与开发规范手册.md)

### 11.2 技术文档

- [Element Plus 文档](https://element-plus.org/)
- [Vue 3 文档](https://vuejs.org/)
- [Express 文档](https://expressjs.com/)
- [PostgreSQL 文档](https://www.postgresql.org/docs/)

---

## 12. 版本历史

| 版本 | 日期 | 说明 | 作者 |
|------|------|------|------|
| v1.0 | 2024 | 初始版本 | - |

---

**文档结束**

