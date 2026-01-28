-- ============================================
-- 为 family_members 表添加个性签名字段
-- 执行时机：成员信息编辑功能上线前
-- 命令示例：psql -U your_user -d your_database -f 017_add_member_bio.sql
-- ============================================

-- 添加 bio 字段（个性签名）
ALTER TABLE family_members 
ADD COLUMN IF NOT EXISTS bio VARCHAR(200) DEFAULT NULL;

COMMENT ON COLUMN family_members.bio IS '成员个性签名';
