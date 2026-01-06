-- ==========================================
-- 教务系统优化改造 - 数据库执行脚本
-- 执行日期：请填写执行日期
-- 执行人：请填写执行人
-- ==========================================

-- ==========================================
-- 操作1：删除按次模式的测试数据
-- ==========================================

-- 1.1 查看需要删除的数据（先执行，确认数据）
SELECT 
  COUNT(*) as balance_count,
  'student_course_balance' as table_name
FROM student_course_balance
WHERE class_id IN (
  SELECT id FROM classes WHERE billing_type = 'count'
);

SELECT 
  COUNT(*) as attendance_count,
  'attendance' as table_name
FROM attendance
WHERE class_id IN (
  SELECT id FROM classes WHERE billing_type = 'count'
);

SELECT 
  COUNT(*) as orders_count,
  'orders' as table_name
FROM orders
WHERE class_id IN (
  SELECT id FROM classes WHERE billing_type = 'count'
);

-- 1.2 删除按次模式的课程余额数据
DELETE FROM student_course_balance
WHERE class_id IN (
  SELECT id FROM classes WHERE billing_type = 'count'
);

-- 1.3 删除相关的签到记录
DELETE FROM attendance
WHERE class_id IN (
  SELECT id FROM classes WHERE billing_type = 'count'
);

-- 1.4 删除相关的订单记录
DELETE FROM orders
WHERE class_id IN (
  SELECT id FROM classes WHERE billing_type = 'count'
);

-- ==========================================
-- 操作2：添加课程停用时间字段
-- ==========================================

-- 2.1 添加 deactivated_at 字段
ALTER TABLE classes
ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP NULL;

-- 2.2 添加字段注释
COMMENT ON COLUMN classes.deactivated_at IS '课程停用时间，NULL表示未停用';

-- 2.3 验证字段添加成功
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'classes' 
  AND column_name = 'deactivated_at';

-- ==========================================
-- 执行完成
-- ==========================================

