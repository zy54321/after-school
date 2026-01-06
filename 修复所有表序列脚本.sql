-- ==========================================
-- 修复所有表的序列问题（完整版）
-- 问题：序列值落后于表中实际的最大 ID，导致主键冲突
-- 适用场景：数据库迁移、数据导入后序列未同步
-- ==========================================

-- ==========================================
-- 教务系统表
-- ==========================================

-- 1. 修复 daily_reports 表序列
DO $$
DECLARE
    max_id INTEGER;
    seq_name TEXT := 'daily_reports_id_seq';
BEGIN
    SELECT COALESCE(MAX(id), 0) INTO max_id FROM daily_reports;
    PERFORM setval(seq_name, max_id + 1, false);
    RAISE NOTICE '修复 %: 当前最大ID=%, 序列已设置为 %', seq_name, max_id, max_id + 1;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '警告: % 序列不存在或已修复', seq_name;
END $$;

-- 2. 修复 daily_menus 表序列
DO $$
DECLARE
    max_id INTEGER;
    seq_name TEXT := 'daily_menus_id_seq';
BEGIN
    SELECT COALESCE(MAX(id), 0) INTO max_id FROM daily_menus;
    PERFORM setval(seq_name, max_id + 1, false);
    RAISE NOTICE '修复 %: 当前最大ID=%, 序列已设置为 %', seq_name, max_id, max_id + 1;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '警告: % 序列不存在或已修复', seq_name;
END $$;

-- 3. 修复 students 表序列
DO $$
DECLARE
    max_id INTEGER;
    seq_name TEXT := 'students_id_seq';
BEGIN
    SELECT COALESCE(MAX(id), 0) INTO max_id FROM students;
    PERFORM setval(seq_name, max_id + 1, false);
    RAISE NOTICE '修复 %: 当前最大ID=%, 序列已设置为 %', seq_name, max_id, max_id + 1;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '警告: % 序列不存在或已修复', seq_name;
END $$;

-- 4. 修复 orders 表序列
DO $$
DECLARE
    max_id INTEGER;
    seq_name TEXT := 'orders_id_seq';
BEGIN
    SELECT COALESCE(MAX(id), 0) INTO max_id FROM orders;
    PERFORM setval(seq_name, max_id + 1, false);
    RAISE NOTICE '修复 %: 当前最大ID=%, 序列已设置为 %', seq_name, max_id, max_id + 1;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '警告: % 序列不存在或已修复', seq_name;
END $$;

-- 5. 修复 student_course_balance 表序列
DO $$
DECLARE
    max_id INTEGER;
    seq_name TEXT := 'student_course_balance_id_seq';
BEGIN
    SELECT COALESCE(MAX(id), 0) INTO max_id FROM student_course_balance;
    PERFORM setval(seq_name, max_id + 1, false);
    RAISE NOTICE '修复 %: 当前最大ID=%, 序列已设置为 %', seq_name, max_id, max_id + 1;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '警告: % 序列不存在或已修复', seq_name;
END $$;

-- 6. 修复 attendance 表序列
DO $$
DECLARE
    max_id INTEGER;
    seq_name TEXT := 'attendance_id_seq';
BEGIN
    SELECT COALESCE(MAX(id), 0) INTO max_id FROM attendance;
    PERFORM setval(seq_name, max_id + 1, false);
    RAISE NOTICE '修复 %: 当前最大ID=%, 序列已设置为 %', seq_name, max_id, max_id + 1;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '警告: % 序列不存在或已修复', seq_name;
END $$;

-- 7. 修复 classes 表序列
DO $$
DECLARE
    max_id INTEGER;
    seq_name TEXT := 'classes_id_seq';
BEGIN
    SELECT COALESCE(MAX(id), 0) INTO max_id FROM classes;
    PERFORM setval(seq_name, max_id + 1, false);
    RAISE NOTICE '修复 %: 当前最大ID=%, 序列已设置为 %', seq_name, max_id, max_id + 1;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '警告: % 序列不存在或已修复', seq_name;
END $$;

-- ==========================================
-- 商业分析系统表
-- ==========================================

-- 8. 修复 ingredients 表序列
DO $$
DECLARE
    max_id INTEGER;
    seq_name TEXT := 'ingredients_id_seq';
BEGIN
    SELECT COALESCE(MAX(id), 0) INTO max_id FROM ingredients;
    PERFORM setval(seq_name, max_id + 1, false);
    RAISE NOTICE '修复 %: 当前最大ID=%, 序列已设置为 %', seq_name, max_id, max_id + 1;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '警告: % 序列不存在或已修复', seq_name;
END $$;

-- 9. 修复 dishes 表序列
DO $$
DECLARE
    max_id INTEGER;
    seq_name TEXT := 'dishes_id_seq';
BEGIN
    SELECT COALESCE(MAX(id), 0) INTO max_id FROM dishes;
    PERFORM setval(seq_name, max_id + 1, false);
    RAISE NOTICE '修复 %: 当前最大ID=%, 序列已设置为 %', seq_name, max_id, max_id + 1;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '警告: % 序列不存在或已修复', seq_name;
END $$;

-- 10. 修复 dish_ingredients 表序列
DO $$
DECLARE
    max_id INTEGER;
    seq_name TEXT := 'dish_ingredients_id_seq';
BEGIN
    SELECT COALESCE(MAX(id), 0) INTO max_id FROM dish_ingredients;
    PERFORM setval(seq_name, max_id + 1, false);
    RAISE NOTICE '修复 %: 当前最大ID=%, 序列已设置为 %', seq_name, max_id, max_id + 1;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '警告: % 序列不存在或已修复', seq_name;
END $$;

-- 11. 修复 weekly_menus 表序列
DO $$
DECLARE
    max_id INTEGER;
    seq_name TEXT := 'weekly_menus_id_seq';
BEGIN
    SELECT COALESCE(MAX(id), 0) INTO max_id FROM weekly_menus;
    PERFORM setval(seq_name, max_id + 1, false);
    RAISE NOTICE '修复 %: 当前最大ID=%, 序列已设置为 %', seq_name, max_id, max_id + 1;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '警告: % 序列不存在或已修复', seq_name;
END $$;

-- ==========================================
-- 家庭系统表
-- ==========================================

-- 12. 修复 family_points_log 表序列
DO $$
DECLARE
    max_id INTEGER;
    seq_name TEXT := 'family_points_log_id_seq';
BEGIN
    SELECT COALESCE(MAX(id), 0) INTO max_id FROM family_points_log;
    PERFORM setval(seq_name, max_id + 1, false);
    RAISE NOTICE '修复 %: 当前最大ID=%, 序列已设置为 %', seq_name, max_id, max_id + 1;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '警告: % 序列不存在或已修复', seq_name;
END $$;

-- 13. 修复 family_tasks 表序列
DO $$
DECLARE
    max_id INTEGER;
    seq_name TEXT := 'family_tasks_id_seq';
BEGIN
    SELECT COALESCE(MAX(id), 0) INTO max_id FROM family_tasks;
    PERFORM setval(seq_name, max_id + 1, false);
    RAISE NOTICE '修复 %: 当前最大ID=%, 序列已设置为 %', seq_name, max_id, max_id + 1;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '警告: % 序列不存在或已修复', seq_name;
END $$;

-- 14. 修复 family_rewards 表序列
DO $$
DECLARE
    max_id INTEGER;
    seq_name TEXT := 'family_rewards_id_seq';
BEGIN
    SELECT COALESCE(MAX(id), 0) INTO max_id FROM family_rewards;
    PERFORM setval(seq_name, max_id + 1, false);
    RAISE NOTICE '修复 %: 当前最大ID=%, 序列已设置为 %', seq_name, max_id, max_id + 1;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '警告: % 序列不存在或已修复', seq_name;
END $$;

-- 15. 修复 family_members 表序列
DO $$
DECLARE
    max_id INTEGER;
    seq_name TEXT := 'family_members_id_seq';
BEGIN
    SELECT COALESCE(MAX(id), 0) INTO max_id FROM family_members;
    PERFORM setval(seq_name, max_id + 1, false);
    RAISE NOTICE '修复 %: 当前最大ID=%, 序列已设置为 %', seq_name, max_id, max_id + 1;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '警告: % 序列不存在或已修复', seq_name;
END $$;

-- 16. 修复 family_categories 表序列
DO $$
DECLARE
    max_id INTEGER;
    seq_name TEXT := 'family_categories_id_seq';
BEGIN
    SELECT COALESCE(MAX(id), 0) INTO max_id FROM family_categories;
    PERFORM setval(seq_name, max_id + 1, false);
    RAISE NOTICE '修复 %: 当前最大ID=%, 序列已设置为 %', seq_name, max_id, max_id + 1;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '警告: % 序列不存在或已修复', seq_name;
END $$;

-- ==========================================
-- 系统表
-- ==========================================

-- 17. 修复 users 表序列
DO $$
DECLARE
    max_id INTEGER;
    seq_name TEXT := 'users_id_seq';
BEGIN
    SELECT COALESCE(MAX(id), 0) INTO max_id FROM users;
    PERFORM setval(seq_name, max_id + 1, false);
    RAISE NOTICE '修复 %: 当前最大ID=%, 序列已设置为 %', seq_name, max_id, max_id + 1;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '警告: % 序列不存在或已修复', seq_name;
END $$;

-- ==========================================
-- 验证所有序列修复结果
-- ==========================================
SELECT 
    schemaname,
    sequencename,
    last_value as current_value
FROM pg_sequences
WHERE sequencename IN (
    'daily_reports_id_seq',
    'daily_menus_id_seq',
    'students_id_seq',
    'orders_id_seq',
    'student_course_balance_id_seq',
    'attendance_id_seq',
    'classes_id_seq',
    'ingredients_id_seq',
    'dishes_id_seq',
    'dish_ingredients_id_seq',
    'weekly_menus_id_seq',
    'family_points_log_id_seq',
    'family_tasks_id_seq',
    'family_rewards_id_seq',
    'family_members_id_seq',
    'family_categories_id_seq',
    'users_id_seq'
)
ORDER BY sequencename;

-- ==========================================
-- 执行完成
-- ==========================================
-- 说明：
-- 1. 此脚本使用 DO 块，即使某个序列不存在也不会中断执行
-- 2. 每个表的序列都会被修复为：MAX(id) + 1
-- 3. 如果表为空，序列会被设置为 1
-- 4. 执行后，所有插入操作不会再出现主键冲突
-- 5. 建议在数据库迁移或数据导入后执行此脚本

