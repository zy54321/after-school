-- ==========================================
-- 诊断时区问题脚本
-- 用于排查特训工作台显示所有学员的问题
-- ==========================================

-- 1. 查看数据库时区设置
SHOW timezone;

-- 2. 查看当前日期和时间（数据库时区）
SELECT 
    CURRENT_DATE as db_current_date,
    CURRENT_TIMESTAMP as db_current_timestamp,
    NOW() as db_now;

-- 3. 查看当前日期和时间（北京时间）
SELECT 
    (CURRENT_DATE AT TIME ZONE 'Asia/Shanghai')::date as beijing_date,
    (NOW() AT TIME ZONE 'Asia/Shanghai') as beijing_timestamp;

-- 4. 查看最近的签到记录及其日期提取结果
SELECT 
    id,
    student_id,
    sign_in_time,
    DATE(sign_in_time) as extracted_date_utc,
    DATE(sign_in_time AT TIME ZONE 'Asia/Shanghai') as extracted_date_beijing,
    sign_in_time AT TIME ZONE 'Asia/Shanghai' as beijing_time
FROM attendance
ORDER BY sign_in_time DESC
LIMIT 10;

-- 5. 测试日期匹配（使用当前日期）
-- 如果这个查询返回空，说明时区不匹配
SELECT 
    COUNT(*) as matched_count,
    '使用 UTC 日期提取' as method
FROM attendance
WHERE DATE(sign_in_time) = CURRENT_DATE

UNION ALL

SELECT 
    COUNT(*) as matched_count,
    '使用北京时间提取' as method
FROM attendance
WHERE DATE(sign_in_time AT TIME ZONE 'Asia/Shanghai') = (CURRENT_DATE AT TIME ZONE 'Asia/Shanghai')::date;

-- 6. 查看今天的签到记录（两种方式对比）
SELECT 
    'UTC方式' as method,
    COUNT(*) as count
FROM attendance
WHERE DATE(sign_in_time) = CURRENT_DATE

UNION ALL

SELECT 
    '北京时间方式' as method,
    COUNT(*) as count
FROM attendance
WHERE DATE(sign_in_time AT TIME ZONE 'Asia/Shanghai') = (CURRENT_DATE AT TIME ZONE 'Asia/Shanghai')::date;

-- ==========================================
-- 执行说明：
-- 1. 执行此脚本查看时区设置和日期提取结果
-- 2. 如果 "UTC方式" 和 "北京时间方式" 的 count 不同，说明存在时区问题
-- 3. 根据结果决定使用哪种日期提取方式
-- ==========================================

