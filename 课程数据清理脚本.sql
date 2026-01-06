-- ==========================================
-- 课程数据清理脚本
-- 用途：清理不需要的课程数据
-- 注意：删除操作不可逆，请谨慎执行
-- ==========================================

-- ==========================================
-- 第一步：查看所有课程及其关联数据
-- ==========================================

-- 1.1 查看所有课程列表
SELECT 
  id,
  class_name,
  billing_type,
  is_active,
  deactivated_at,
  (SELECT COUNT(*) FROM student_course_balance WHERE class_id = c.id) as balance_count,
  (SELECT COUNT(*) FROM orders WHERE class_id = c.id) as orders_count,
  (SELECT COUNT(*) FROM attendance WHERE class_id = c.id) as attendance_count
FROM classes c
ORDER BY id DESC;

-- 1.2 查看已停用的课程
SELECT 
  id,
  class_name,
  billing_type,
  is_active,
  deactivated_at,
  (SELECT COUNT(*) FROM student_course_balance WHERE class_id = c.id AND expired_at >= CURRENT_DATE) as active_balance_count,
  (SELECT COUNT(*) FROM student_course_balance WHERE class_id = c.id) as total_balance_count,
  (SELECT COUNT(*) FROM orders WHERE class_id = c.id) as orders_count,
  (SELECT COUNT(*) FROM attendance WHERE class_id = c.id) as attendance_count
FROM classes c
WHERE is_active = false
ORDER BY id DESC;

-- 1.3 查看没有任何关联数据的课程（可以安全删除）
SELECT 
  c.id,
  c.class_name,
  c.billing_type,
  c.is_active,
  c.deactivated_at
FROM classes c
WHERE NOT EXISTS (
  SELECT 1 FROM student_course_balance WHERE class_id = c.id
)
AND NOT EXISTS (
  SELECT 1 FROM orders WHERE class_id = c.id
)
AND NOT EXISTS (
  SELECT 1 FROM attendance WHERE class_id = c.id
)
ORDER BY c.id DESC;

-- ==========================================
-- 第二步：删除课程数据（根据需求选择）
-- ==========================================

-- 方案A：删除指定ID的课程（替换 YOUR_CLASS_ID）
-- 注意：需要先删除关联数据
/*
-- 2.1 删除指定课程的关联数据
DELETE FROM student_course_balance WHERE class_id = YOUR_CLASS_ID;
DELETE FROM attendance WHERE class_id = YOUR_CLASS_ID;
DELETE FROM orders WHERE class_id = YOUR_CLASS_ID;

-- 2.2 删除课程本身
DELETE FROM classes WHERE id = YOUR_CLASS_ID;
*/

-- 方案B：删除所有没有任何关联数据的课程（安全删除）
/*
DELETE FROM classes
WHERE NOT EXISTS (
  SELECT 1 FROM student_course_balance WHERE class_id = classes.id
)
AND NOT EXISTS (
  SELECT 1 FROM orders WHERE class_id = classes.id
)
AND NOT EXISTS (
  SELECT 1 FROM attendance WHERE class_id = classes.id
);
*/

-- 方案C：删除所有已停用且没有有效余额的课程（谨慎使用）
/*
-- 2.1 先删除已停用课程的过期余额
DELETE FROM student_course_balance
WHERE class_id IN (
  SELECT id FROM classes WHERE is_active = false
)
AND expired_at < CURRENT_DATE;

-- 2.2 删除已停用课程的所有签到记录（可选）
DELETE FROM attendance
WHERE class_id IN (
  SELECT id FROM classes WHERE is_active = false
);

-- 2.3 删除已停用课程的所有订单记录（可选，建议保留财务历史）
-- DELETE FROM orders
-- WHERE class_id IN (
--   SELECT id FROM classes WHERE is_active = false
-- );

-- 2.4 删除已停用课程本身（确保没有关联数据）
DELETE FROM classes
WHERE is_active = false
AND NOT EXISTS (
  SELECT 1 FROM student_course_balance WHERE class_id = classes.id
)
AND NOT EXISTS (
  SELECT 1 FROM orders WHERE class_id = classes.id
)
AND NOT EXISTS (
  SELECT 1 FROM attendance WHERE class_id = classes.id
);
*/

-- 方案D：强制删除指定课程及其所有关联数据（危险操作）
/*
-- 警告：此操作会删除课程的所有历史数据，包括订单和签到记录
-- 建议：只在确认是测试数据时使用

-- 替换 YOUR_CLASS_ID 为实际课程ID
BEGIN;

DELETE FROM student_course_balance WHERE class_id = YOUR_CLASS_ID;
DELETE FROM attendance WHERE class_id = YOUR_CLASS_ID;
DELETE FROM orders WHERE class_id = YOUR_CLASS_ID;
DELETE FROM classes WHERE id = YOUR_CLASS_ID;

COMMIT;
*/

-- ==========================================
-- 第三步：批量操作（根据需求选择）
-- ==========================================

-- 3.1 批量删除所有按次模式的课程及其关联数据（如果确认都是测试数据）
/*
BEGIN;

-- 删除关联数据
DELETE FROM student_course_balance WHERE class_id IN (SELECT id FROM classes WHERE billing_type = 'count');
DELETE FROM attendance WHERE class_id IN (SELECT id FROM classes WHERE billing_type = 'count');
DELETE FROM orders WHERE class_id IN (SELECT id FROM classes WHERE billing_type = 'count');

-- 删除课程本身
DELETE FROM classes WHERE billing_type = 'count';

COMMIT;
*/

-- 3.2 批量删除所有已停用且停用时间早于指定日期的课程（可选）
/*
-- 替换 '2024-01-01' 为实际日期
-- 注意：此操作基于 deactivated_at 字段，如果课程没有停用时间则不会删除
BEGIN;

DELETE FROM student_course_balance 
WHERE class_id IN (
  SELECT id FROM classes 
  WHERE is_active = false 
  AND deactivated_at IS NOT NULL
  AND deactivated_at < '2024-01-01'::timestamp
);

DELETE FROM attendance 
WHERE class_id IN (
  SELECT id FROM classes 
  WHERE is_active = false 
  AND deactivated_at IS NOT NULL
  AND deactivated_at < '2024-01-01'::timestamp
);

DELETE FROM orders 
WHERE class_id IN (
  SELECT id FROM classes 
  WHERE is_active = false 
  AND deactivated_at IS NOT NULL
  AND deactivated_at < '2024-01-01'::timestamp
);

DELETE FROM classes 
WHERE is_active = false 
AND deactivated_at IS NOT NULL
AND deactivated_at < '2024-01-01'::timestamp;

COMMIT;
*/

-- ==========================================
-- 使用说明
-- ==========================================
-- 1. 先执行第一步的查询语句，查看课程数据情况
-- 2. 根据查询结果，选择合适的删除方案
-- 3. 取消注释对应的删除语句，替换 YOUR_CLASS_ID 或日期
-- 4. 执行删除操作
-- 5. 建议在业务低峰期执行
-- 6. 重要数据建议先备份

