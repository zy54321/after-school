-- ============================================
-- RBAC 权限体系初始化脚本
-- 执行时机：系统首次部署或权限体系重建
-- 命令示例：psql -U your_user -d your_database -f 001_init_rbac.sql
-- ============================================

-- ============================================
-- 1. 创建 RBAC 相关表（如不存在）
-- ============================================

-- 角色表
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT FALSE,  -- 系统角色不可删除
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 权限表
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,  -- 权限代码，如 'user:read'
  name VARCHAR(100) NOT NULL,         -- 权限名称，如 '查看用户'
  module VARCHAR(50) NOT NULL,        -- 模块名称，如 '用户管理'
  resource VARCHAR(50),               -- 资源类型，如 'user'
  action VARCHAR(50),                 -- 操作类型，如 'read'
  description TEXT,
  parent_code VARCHAR(100),           -- 父权限代码（用于树形展示）
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 角色-权限关联表
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id)
);

-- 用户-角色关联表
CREATE TABLE IF NOT EXISTS user_roles (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_permissions_code ON permissions(code);
CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module);
CREATE INDEX IF NOT EXISTS idx_roles_code ON roles(code);

-- ============================================
-- 2. 初始化角色数据
-- ============================================

INSERT INTO roles (code, name, description, is_system, is_active) VALUES
  ('admin', '管理员', '系统管理员，拥有所有权限', TRUE, TRUE),
  ('teacher', '教师', '普通教师，拥有教学相关权限', TRUE, TRUE),
  ('finance', '财务', '财务人员，拥有财务相关权限', FALSE, TRUE),
  ('viewer', '访客', '只读访客，只能查看数据', FALSE, TRUE)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_system = EXCLUDED.is_system,
  is_active = TRUE;

-- ============================================
-- 3. 初始化权限数据
-- ⚠️ 权限代码必须与 server/src/shared/constants/permissions.js 完全一致
-- ============================================

-- 用户管理权限
INSERT INTO permissions (code, name, module, resource, action, description, sort_order) VALUES
  ('user:read', '查看用户', '用户管理', 'user', 'read', '查看用户列表和详情', 1),
  ('user:create', '创建用户', '用户管理', 'user', 'create', '创建新用户', 2),
  ('user:update', '编辑用户', '用户管理', 'user', 'update', '编辑用户信息', 3),
  ('user:delete', '删除用户', '用户管理', 'user', 'delete', '删除用户', 4),
  ('user:reset_password', '重置密码', '用户管理', 'user', 'reset_password', '重置用户密码', 5)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  module = EXCLUDED.module,
  resource = EXCLUDED.resource,
  action = EXCLUDED.action,
  description = EXCLUDED.description,
  is_active = TRUE;

-- 学员管理权限
INSERT INTO permissions (code, name, module, resource, action, description, sort_order) VALUES
  ('student:read', '查看学员', '学员管理', 'student', 'read', '查看学员列表和详情', 1),
  ('student:create', '创建学员', '学员管理', 'student', 'create', '创建新学员', 2),
  ('student:update', '编辑学员', '学员管理', 'student', 'update', '编辑学员信息', 3),
  ('student:delete', '删除学员', '学员管理', 'student', 'delete', '删除学员', 4)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  module = EXCLUDED.module,
  resource = EXCLUDED.resource,
  action = EXCLUDED.action,
  description = EXCLUDED.description,
  is_active = TRUE;

-- 班级管理权限
INSERT INTO permissions (code, name, module, resource, action, description, sort_order) VALUES
  ('class:read', '查看班级', '班级管理', 'class', 'read', '查看班级列表和详情', 1),
  ('class:create', '创建班级', '班级管理', 'class', 'create', '创建新班级', 2),
  ('class:update', '编辑班级', '班级管理', 'class', 'update', '编辑班级信息', 3),
  ('class:delete', '删除班级', '班级管理', 'class', 'delete', '删除班级', 4)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  module = EXCLUDED.module,
  resource = EXCLUDED.resource,
  action = EXCLUDED.action,
  description = EXCLUDED.description,
  is_active = TRUE;

-- 订单管理权限
INSERT INTO permissions (code, name, module, resource, action, description, sort_order) VALUES
  ('order:read', '查看订单', '订单管理', 'order', 'read', '查看订单列表和详情', 1),
  ('order:create', '创建订单', '订单管理', 'order', 'create', '创建新订单', 2),
  ('order:update', '编辑订单', '订单管理', 'order', 'update', '编辑订单信息', 3),
  ('order:delete', '删除订单', '订单管理', 'order', 'delete', '删除订单', 4),
  ('order:refund', '办理退款', '订单管理', 'order', 'refund', '办理退课退款', 5)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  module = EXCLUDED.module,
  resource = EXCLUDED.resource,
  action = EXCLUDED.action,
  description = EXCLUDED.description,
  is_active = TRUE;

-- 考勤管理权限
INSERT INTO permissions (code, name, module, resource, action, description, sort_order) VALUES
  ('attendance:read', '查看考勤', '考勤管理', 'attendance', 'read', '查看考勤记录', 1),
  ('attendance:create', '签到消课', '考勤管理', 'attendance', 'create', '为学员签到消课', 2),
  ('attendance:update', '编辑考勤', '考勤管理', 'attendance', 'update', '编辑考勤记录', 3),
  ('attendance:delete', '删除考勤', '考勤管理', 'attendance', 'delete', '删除考勤记录', 4)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  module = EXCLUDED.module,
  resource = EXCLUDED.resource,
  action = EXCLUDED.action,
  description = EXCLUDED.description,
  is_active = TRUE;

-- 日报管理权限
INSERT INTO permissions (code, name, module, resource, action, description, sort_order) VALUES
  ('report:read', '查看日报', '日报管理', 'report', 'read', '查看日报', 1),
  ('report:create', '创建日报', '日报管理', 'report', 'create', '创建日报', 2),
  ('report:update', '编辑日报', '日报管理', 'report', 'update', '编辑日报', 3),
  ('report:delete', '删除日报', '日报管理', 'report', 'delete', '删除日报', 4)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  module = EXCLUDED.module,
  resource = EXCLUDED.resource,
  action = EXCLUDED.action,
  description = EXCLUDED.description,
  is_active = TRUE;

-- 餐饮管理权限
INSERT INTO permissions (code, name, module, resource, action, description, sort_order) VALUES
  ('catering:read', '查看餐饮', '餐饮管理', 'catering', 'read', '查看食材、菜品、食谱', 1),
  ('catering:create', '创建餐饮', '餐饮管理', 'catering', 'create', '创建食材、菜品、食谱', 2),
  ('catering:update', '编辑餐饮', '餐饮管理', 'catering', 'update', '编辑食材、菜品、食谱', 3),
  ('catering:delete', '删除餐饮', '餐饮管理', 'catering', 'delete', '删除食材、菜品、食谱', 4)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  module = EXCLUDED.module,
  resource = EXCLUDED.resource,
  action = EXCLUDED.action,
  description = EXCLUDED.description,
  is_active = TRUE;

-- 地图/字典管理权限
INSERT INTO permissions (code, name, module, resource, action, description, sort_order) VALUES
  ('map:read', '查看地图', '地图管理', 'map', 'read', '查看地图数据', 1),
  ('map:manage', '管理地图', '地图管理', 'map', 'manage', '管理地图字典和配置', 2)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  module = EXCLUDED.module,
  resource = EXCLUDED.resource,
  action = EXCLUDED.action,
  description = EXCLUDED.description,
  is_active = TRUE;

-- 权限管理权限
INSERT INTO permissions (code, name, module, resource, action, description, sort_order) VALUES
  ('permission:read', '查看权限', '权限管理', 'permission', 'read', '查看权限和角色配置', 1),
  ('permission:manage', '管理权限', '权限管理', 'permission', 'manage', '管理权限和角色分配', 2)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  module = EXCLUDED.module,
  resource = EXCLUDED.resource,
  action = EXCLUDED.action,
  description = EXCLUDED.description,
  is_active = TRUE;

-- 家庭积分系统权限
INSERT INTO permissions (code, name, module, resource, action, description, sort_order) VALUES
  ('family:read', '查看家庭系统', '家庭成长银行', 'family', 'read', '查看家庭积分数据', 1),
  ('family:manage', '管理家庭系统', '家庭成长银行', 'family', 'manage', '管理家庭积分规则和奖励', 2)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  module = EXCLUDED.module,
  resource = EXCLUDED.resource,
  action = EXCLUDED.action,
  description = EXCLUDED.description,
  is_active = TRUE;

-- ============================================
-- 4. 为 admin 角色分配所有权限
-- ============================================

-- 清空 admin 现有权限（可选，确保权限完整）
DELETE FROM role_permissions 
WHERE role_id = (SELECT id FROM roles WHERE code = 'admin');

-- 为 admin 分配所有权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE code = 'admin'),
  p.id
FROM permissions p
WHERE p.is_active = TRUE
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================
-- 5. 为 teacher 角色分配基础权限
-- ============================================

-- 清空 teacher 现有权限
DELETE FROM role_permissions 
WHERE role_id = (SELECT id FROM roles WHERE code = 'teacher');

-- teacher 角色权限：可以查看和操作学员、考勤、日报，但不能删除敏感数据
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE code = 'teacher'),
  p.id
FROM permissions p
WHERE p.code IN (
  -- 学员：查看、创建、编辑（无删除）
  'student:read', 'student:create', 'student:update',
  -- 班级：只读
  'class:read',
  -- 订单：只读
  'order:read',
  -- 考勤：全部
  'attendance:read', 'attendance:create', 'attendance:update',
  -- 日报：全部
  'report:read', 'report:create', 'report:update',
  -- 餐饮：只读
  'catering:read',
  -- 地图：只读
  'map:read',
  -- 家庭系统：只读
  'family:read'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================
-- 6. 为现有管理员用户分配 admin 角色
-- ============================================

-- 将 users 表中 role='admin' 的用户自动分配 admin 角色
INSERT INTO user_roles (user_id, role_id)
SELECT 
  u.id,
  (SELECT id FROM roles WHERE code = 'admin')
FROM users u
WHERE u.role = 'admin' AND u.is_active = TRUE
ON CONFLICT (user_id, role_id) DO NOTHING;

-- 将 users 表中 role='teacher' 的用户自动分配 teacher 角色
INSERT INTO user_roles (user_id, role_id)
SELECT 
  u.id,
  (SELECT id FROM roles WHERE code = 'teacher')
FROM users u
WHERE u.role = 'teacher' AND u.is_active = TRUE
ON CONFLICT (user_id, role_id) DO NOTHING;

-- ============================================
-- 7. 验证结果（可选，用于调试）
-- ============================================

-- 查看所有权限
-- SELECT code, name, module FROM permissions ORDER BY module, sort_order;

-- 查看 admin 角色的权限
-- SELECT r.code as role_code, p.code as permission_code, p.name
-- FROM role_permissions rp 
-- JOIN roles r ON rp.role_id = r.id 
-- JOIN permissions p ON rp.permission_id = p.id 
-- WHERE r.code = 'admin'
-- ORDER BY p.module, p.sort_order;

-- 查看用户-角色分配
-- SELECT u.username, u.real_name, r.code as role_code, r.name as role_name
-- FROM user_roles ur
-- JOIN users u ON ur.user_id = u.id
-- JOIN roles r ON ur.role_id = r.id
-- ORDER BY u.id;

-- ============================================
-- ✅ 初始化完成
-- ============================================
SELECT 
  '✅ RBAC 初始化完成' as status,
  (SELECT COUNT(*) FROM roles WHERE is_active = TRUE) as roles_count,
  (SELECT COUNT(*) FROM permissions WHERE is_active = TRUE) as permissions_count,
  (SELECT COUNT(*) FROM role_permissions) as role_permissions_count,
  (SELECT COUNT(*) FROM user_roles) as user_roles_count;
