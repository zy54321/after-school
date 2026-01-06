-- ==========================================
-- 修复家庭系统所有表的序列问题
-- 问题：序列值落后于表中实际的最大 ID，导致主键冲突
-- ==========================================

-- ==========================================
-- 1. 修复 family_points_log 表序列
-- ==========================================
SELECT 
    'family_points_log_id_seq' as sequence_name,
    last_value as current_sequence_value
FROM family_points_log_id_seq;

SELECT 
    'family_points_log' as table_name,
    MAX(id) as max_id,
    COUNT(*) as total_records
FROM family_points_log;

SELECT setval(
    'family_points_log_id_seq', 
    COALESCE((SELECT MAX(id) FROM family_points_log), 0) + 1, 
    false
) as fixed_value;

-- ==========================================
-- 2. 修复 family_tasks 表序列
-- ==========================================
SELECT 
    'family_tasks_id_seq' as sequence_name,
    last_value as current_sequence_value
FROM family_tasks_id_seq;

SELECT 
    'family_tasks' as table_name,
    MAX(id) as max_id,
    COUNT(*) as total_records
FROM family_tasks;

SELECT setval(
    'family_tasks_id_seq', 
    COALESCE((SELECT MAX(id) FROM family_tasks), 0) + 1, 
    false
) as fixed_value;

-- ==========================================
-- 3. 修复 family_rewards 表序列
-- ==========================================
SELECT 
    'family_rewards_id_seq' as sequence_name,
    last_value as current_sequence_value
FROM family_rewards_id_seq;

SELECT 
    'family_rewards' as table_name,
    MAX(id) as max_id,
    COUNT(*) as total_records
FROM family_rewards;

SELECT setval(
    'family_rewards_id_seq', 
    COALESCE((SELECT MAX(id) FROM family_rewards), 0) + 1, 
    false
) as fixed_value;

-- ==========================================
-- 4. 修复 family_members 表序列
-- ==========================================
SELECT 
    'family_members_id_seq' as sequence_name,
    last_value as current_sequence_value
FROM family_members_id_seq;

SELECT 
    'family_members' as table_name,
    MAX(id) as max_id,
    COUNT(*) as total_records
FROM family_members;

SELECT setval(
    'family_members_id_seq', 
    COALESCE((SELECT MAX(id) FROM family_members), 0) + 1, 
    false
) as fixed_value;

-- ==========================================
-- 5. 修复 family_categories 表序列
-- ==========================================
SELECT 
    'family_categories_id_seq' as sequence_name,
    last_value as current_sequence_value
FROM family_categories_id_seq;

SELECT 
    'family_categories' as table_name,
    MAX(id) as max_id,
    COUNT(*) as total_records
FROM family_categories;

SELECT setval(
    'family_categories_id_seq', 
    COALESCE((SELECT MAX(id) FROM family_categories), 0) + 1, 
    false
) as fixed_value;

-- ==========================================
-- 6. 验证所有序列修复结果
-- ==========================================
SELECT 
    'family_points_log_id_seq' as sequence_name,
    last_value as new_sequence_value
FROM family_points_log_id_seq
UNION ALL
SELECT 
    'family_tasks_id_seq' as sequence_name,
    last_value as new_sequence_value
FROM family_tasks_id_seq
UNION ALL
SELECT 
    'family_rewards_id_seq' as sequence_name,
    last_value as new_sequence_value
FROM family_rewards_id_seq
UNION ALL
SELECT 
    'family_members_id_seq' as sequence_name,
    last_value as new_sequence_value
FROM family_members_id_seq
UNION ALL
SELECT 
    'family_categories_id_seq' as sequence_name,
    last_value as new_sequence_value
FROM family_categories_id_seq;

-- ==========================================
-- 执行完成
-- ==========================================
-- 说明：
-- 此脚本会修复家庭系统所有表的序列问题
-- 执行后，所有插入操作不会再出现主键冲突

