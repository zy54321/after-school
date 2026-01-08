-- ============================================
-- RBAC 权限管理系统 - 数据库表创建脚本
-- 文件：001_create_rbac_tables.sql
-- 说明：创建权限管理相关的4张核心表
-- ============================================

-- 1. 权限资源表 (permissions)
CREATE TABLE IF NOT EXISTS permissions (
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

-- 权限表索引
CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module);
CREATE INDEX IF NOT EXISTS idx_permissions_parent_code ON permissions(parent_code);
CREATE INDEX IF NOT EXISTS idx_permissions_code ON permissions(code);

-- 2. 角色表 (roles)
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,      -- 角色代码，如 'admin', 'teacher'
  name VARCHAR(100) NOT NULL,            -- 角色名称，如 '管理员', '教师'
  description TEXT,                      -- 角色描述
  is_system BOOLEAN DEFAULT FALSE,        -- 是否系统角色（不可删除）
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 角色表索引
CREATE INDEX IF NOT EXISTS idx_roles_code ON roles(code);

-- 3. 角色权限关联表 (role_permissions)
CREATE TABLE IF NOT EXISTS role_permissions (
  id SERIAL PRIMARY KEY,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

-- 角色权限关联表索引
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);

-- 4. 用户角色关联表 (user_roles)
CREATE TABLE IF NOT EXISTS user_roles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

-- 用户角色关联表索引
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);

-- 添加表注释
COMMENT ON TABLE permissions IS '权限资源表，存储系统中的所有权限';
COMMENT ON TABLE roles IS '角色表，存储系统中的所有角色';
COMMENT ON TABLE role_permissions IS '角色权限关联表，存储角色与权限的多对多关系';
COMMENT ON TABLE user_roles IS '用户角色关联表，存储用户与角色的多对多关系';

-- 添加字段注释
COMMENT ON COLUMN permissions.code IS '权限代码，格式：资源:操作，如 student:create';
COMMENT ON COLUMN permissions.parent_code IS '父权限代码，用于前端构建权限树';
COMMENT ON COLUMN roles.is_system IS '是否系统角色，系统角色不可删除';
COMMENT ON COLUMN role_permissions.role_id IS '角色ID';
COMMENT ON COLUMN role_permissions.permission_id IS '权限ID';
COMMENT ON COLUMN user_roles.user_id IS '用户ID';
COMMENT ON COLUMN user_roles.role_id IS '角色ID';

