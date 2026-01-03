-- 为 family_rewards 表添加 description 字段（用于竞拍品描述）
-- 如果字段已存在，此脚本会报错，可以忽略

ALTER TABLE family_rewards 
ADD COLUMN IF NOT EXISTS description TEXT;

-- 添加注释
COMMENT ON COLUMN family_rewards.description IS '竞拍品描述，支持换行';

