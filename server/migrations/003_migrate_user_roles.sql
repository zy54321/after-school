-- ============================================
-- RBAC 权限管理系统 - 数据迁移脚本
-- 文件：003_migrate_user_roles.sql
-- 说明：将现有用户的 role 字段迁移到 user_roles 表
-- ============================================

-- 迁移现有用户的角色到 user_roles 表
-- 注意：此脚本会跳过已存在的用户角色关系，避免重复插入

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.code = u.role
WHERE u.role IS NOT NULL
  AND u.role IN ('admin', 'teacher')  -- 只迁移已知的角色
  AND NOT EXISTS (
    SELECT 1 
    FROM user_roles ur 
    WHERE ur.user_id = u.id AND ur.role_id = r.id
  )
ON CONFLICT (user_id, role_id) DO NOTHING;

-- 验证迁移结果（可选，用于检查）
-- SELECT 
--   u.id,
--   u.username,
--   u.role as old_role,
--   r.code as new_role_code,
--   r.name as new_role_name
-- FROM users u
-- LEFT JOIN user_roles ur ON ur.user_id = u.id
-- LEFT JOIN roles r ON r.id = ur.role_id
-- ORDER BY u.id;

