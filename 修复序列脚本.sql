-- ==========================================
-- 修复 family_points_log 表序列问题
-- 问题：序列值落后于表中实际的最大 ID，导致主键冲突
-- ==========================================

-- 1. 查看当前序列值
SELECT 
    'family_points_log_id_seq' as sequence_name,
    last_value as current_sequence_value
FROM family_points_log_id_seq;

-- 2. 查看表中实际的最大 ID
SELECT 
    'family_points_log' as table_name,
    MAX(id) as max_id,
    COUNT(*) as total_records
FROM family_points_log;

-- 3. 修复序列：将序列值设置为表中最大 ID + 1
-- 如果表为空，则设置为 1
SELECT setval(
    'family_points_log_id_seq', 
    COALESCE((SELECT MAX(id) FROM family_points_log), 0) + 1, 
    false
);

-- 4. 验证修复结果
SELECT 
    'family_points_log_id_seq' as sequence_name,
    last_value as new_sequence_value
FROM family_points_log_id_seq;

-- ==========================================
-- 执行完成
-- ==========================================
-- 说明：
-- 执行此脚本后，序列会指向正确的值，后续插入操作不会再出现主键冲突
-- 如果还有其他表也有类似问题，可以按照相同方式修复

