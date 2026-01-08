-- ============================================
-- RBAC 权限管理系统 - 初始化数据脚本
-- 文件：002_init_rbac_data.sql
-- 说明：插入默认权限、默认角色和默认角色权限分配
-- ============================================

-- 1. 插入默认权限列表
INSERT INTO permissions (code, name, module, resource, action, description, parent_code, sort_order) VALUES
-- 学员管理模块
('student', '学员管理', 'student', 'student', 'manage', '学员管理模块', NULL, 1),
('student:create', '创建学员', 'student', 'student', 'create', '创建新学员', 'student', 1),
('student:read', '查看学员', 'student', 'student', 'read', '查看学员信息', 'student', 2),
('student:update', '更新学员', 'student', 'student', 'update', '更新学员信息', 'student', 3),
('student:delete', '删除学员', 'student', 'student', 'delete', '删除学员', 'student', 4),
('student:export', '导出学员', 'student', 'student', 'export', '导出学员数据', 'student', 5),

-- 订单管理模块
('order', '订单管理', 'order', 'order', 'manage', '订单管理模块', NULL, 2),
('order:create', '创建订单', 'order', 'order', 'create', '创建新订单', 'order', 1),
('order:read', '查看订单', 'order', 'order', 'read', '查看订单信息', 'order', 2),
('order:update', '更新订单', 'order', 'order', 'update', '更新订单信息', 'order', 3),
('order:delete', '删除订单', 'order', 'order', 'delete', '删除订单', 'order', 4),
('order:refund', '退费', 'order', 'order', 'refund', '订单退费', 'order', 5),

-- 用户管理模块
('user', '用户管理', 'user', 'user', 'manage', '用户管理模块', NULL, 3),
('user:create', '创建用户', 'user', 'user', 'create', '创建新用户', 'user', 1),
('user:read', '查看用户', 'user', 'user', 'read', '查看用户信息', 'user', 2),
('user:update', '更新用户', 'user', 'user', 'update', '更新用户信息', 'user', 3),
('user:delete', '删除用户', 'user', 'user', 'delete', '删除用户', 'user', 4),
('user:resetPassword', '重置密码', 'user', 'user', 'resetPassword', '重置用户密码', 'user', 5),

-- 课程管理模块
('class', '课程管理', 'class', 'class', 'manage', '课程管理模块', NULL, 4),
('class:create', '创建课程', 'class', 'class', 'create', '创建新课程', 'class', 1),
('class:read', '查看课程', 'class', 'class', 'read', '查看课程信息', 'class', 2),
('class:update', '更新课程', 'class', 'class', 'update', '更新课程信息', 'class', 3),
('class:delete', '删除课程', 'class', 'class', 'delete', '删除课程', 'class', 4),

-- 签到管理模块
('attendance', '签到管理', 'attendance', 'attendance', 'manage', '签到管理模块', NULL, 5),
('attendance:create', '创建签到', 'attendance', 'attendance', 'create', '创建签到记录', 'attendance', 1),
('attendance:read', '查看签到', 'attendance', 'attendance', 'read', '查看签到记录', 'attendance', 2),
('attendance:update', '更新签到', 'attendance', 'attendance', 'update', '更新签到记录', 'attendance', 3),
('attendance:delete', '删除签到', 'attendance', 'attendance', 'delete', '删除签到记录', 'attendance', 4),

-- 仪表盘模块
('dashboard', '仪表盘', 'dashboard', 'dashboard', 'manage', '仪表盘模块', NULL, 6),
('dashboard:read', '查看仪表盘', 'dashboard', 'dashboard', 'read', '查看仪表盘数据', 'dashboard', 1),

-- 报表管理模块
('report', '报表管理', 'report', 'report', 'manage', '报表管理模块', NULL, 7),
('report:read', '查看报表', 'report', 'report', 'read', '查看报表数据', 'report', 1),
('report:export', '导出报表', 'report', 'report', 'export', '导出报表数据', 'report', 2),

-- 日报管理模块
('dailyReport', '日报管理', 'dailyReport', 'dailyReport', 'manage', '日报管理模块', NULL, 8),
('dailyReport:create', '创建日报', 'dailyReport', 'dailyReport', 'create', '创建日报记录', 'dailyReport', 1),
('dailyReport:read', '查看日报', 'dailyReport', 'dailyReport', 'read', '查看日报记录', 'dailyReport', 2),
('dailyReport:update', '更新日报', 'dailyReport', 'dailyReport', 'update', '更新日报记录', 'dailyReport', 3),
('dailyReport:delete', '删除日报', 'dailyReport', 'dailyReport', 'delete', '删除日报记录', 'dailyReport', 4),

-- 地图管理模块
('map', '地图管理', 'map', 'map', 'manage', '地图管理模块', NULL, 9),
('map:read', '查看地图', 'map', 'map', 'read', '查看地图数据', 'map', 1),

-- 餐饮管理模块
('catering', '餐饮管理', 'catering', 'catering', 'manage', '餐饮管理模块', NULL, 10),
('catering:ingredients:read', '查看食材', 'catering', 'ingredients', 'read', '查看食材信息', 'catering', 1),
('catering:ingredients:create', '创建食材', 'catering', 'ingredients', 'create', '创建食材', 'catering', 2),
('catering:ingredients:update', '更新食材', 'catering', 'ingredients', 'update', '更新食材信息', 'catering', 3),
('catering:ingredients:delete', '删除食材', 'catering', 'ingredients', 'delete', '删除食材', 'catering', 4),
('catering:dishes:read', '查看菜品', 'catering', 'dishes', 'read', '查看菜品信息', 'catering', 5),
('catering:dishes:create', '创建菜品', 'catering', 'dishes', 'create', '创建菜品', 'catering', 6),
('catering:dishes:update', '更新菜品', 'catering', 'dishes', 'update', '更新菜品信息', 'catering', 7),
('catering:dishes:delete', '删除菜品', 'catering', 'dishes', 'delete', '删除菜品', 'catering', 8),
('catering:menu:read', '查看食谱', 'catering', 'menu', 'read', '查看食谱信息', 'catering', 9),
('catering:menu:create', '创建食谱', 'catering', 'menu', 'create', '创建食谱', 'catering', 10),
('catering:menu:update', '更新食谱', 'catering', 'menu', 'update', '更新食谱信息', 'catering', 11),
('catering:menu:delete', '删除食谱', 'catering', 'menu', 'delete', '删除食谱', 'catering', 12),

-- 权限管理模块（仅管理员）
('permission', '权限管理', 'permission', 'permission', 'manage', '权限管理模块', NULL, 99),
('permission:read', '查看权限配置', 'permission', 'permission', 'read', '查看权限配置', 'permission', 1),
('permission:assign', '分配权限', 'permission', 'permission', 'assign', '分配角色权限', 'permission', 2),
('role:manage', '角色管理', 'permission', 'role', 'manage', '角色管理（创建、更新、删除角色）', 'permission', 3)

ON CONFLICT (code) DO NOTHING;  -- 如果权限已存在，不重复插入

-- 2. 插入默认角色
INSERT INTO roles (code, name, description, is_system, is_active) VALUES
('admin', '管理员', '系统管理员，拥有所有权限', TRUE, TRUE),
('teacher', '教师', '普通教师，拥有基础权限', TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;  -- 如果角色已存在，不重复插入

-- 3. 为 admin 角色分配所有权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'admin' AND p.is_active = TRUE
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4. 为 teacher 角色分配基础权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'teacher' 
  AND p.is_active = TRUE
  AND (
    -- 学员管理：查看、更新
    p.code IN ('student:read', 'student:update') OR
    -- 订单管理：查看
    p.code IN ('order:read') OR
    -- 课程管理：查看
    p.code IN ('class:read') OR
    -- 签到管理：所有权限
    p.code LIKE 'attendance:%' OR
    -- 仪表盘：查看
    p.code IN ('dashboard:read') OR
    -- 报表管理：查看
    p.code IN ('report:read') OR
    -- 日报管理：所有权限
    p.code LIKE 'dailyReport:%' OR
    -- 地图管理：查看
    p.code IN ('map:read') OR
    -- 餐饮管理：查看权限
    p.code LIKE 'catering:%:read'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

