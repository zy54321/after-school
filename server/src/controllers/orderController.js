const pool = require('../config/db');

// 创建订单（报名/续费）
const createOrder = async (req, res) => {
  const { student_id, class_id, quantity, amount, remark } = req.body;

  console.log('收到报名请求:', { student_id, class_id, quantity, amount });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. 记流水 (Orders)
    const insertOrderText = `
      INSERT INTO orders (student_id, class_id, quantity, amount, remark)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    await client.query(insertOrderText, [student_id, class_id, quantity, amount, remark]);

    // 2. 判断班级计费类型
    // 注意：确保你的数据库 classes 表有 billing_type 字段，否则会报错
    // 如果没有这个字段，请先去数据库执行: ALTER TABLE classes ADD COLUMN billing_type VARCHAR(20) DEFAULT 'count';
    const classInfo = await client.query('SELECT billing_type FROM classes WHERE id = $1', [class_id]);
    const type = classInfo.rows[0]?.billing_type || 'count'; // 默认按次

    // ⭐ 核心修复点：这里必须用 let，不能用 const
    let upsertBalanceText = ''; 
    const params = [];

    if (type === 'time') {
      // === ⏰ 包月模式 (按时间延期) ===
      upsertBalanceText = `
        INSERT INTO student_course_balance (student_id, class_id, expired_at)
        VALUES ($1, $2, CURRENT_DATE + ($3 * 30 * INTERVAL '1 day'))
        ON CONFLICT (student_id, class_id) 
        DO UPDATE SET 
          expired_at = GREATEST(student_course_balance.expired_at, CURRENT_DATE) + ($3 * 30 * INTERVAL '1 day'),
          updated_at = CURRENT_TIMESTAMP;
      `;
      // 参数顺序：student_id($1), class_id($2), quantity($3)
      params.push(student_id, class_id, quantity);

    } else {
      // === 🔢 按次模式 (默认) ===
      upsertBalanceText = `
        INSERT INTO student_course_balance (student_id, class_id, remaining_lessons)
        VALUES ($1, $2, $3)
        ON CONFLICT (student_id, class_id) 
        DO UPDATE SET 
          remaining_lessons = student_course_balance.remaining_lessons + EXCLUDED.remaining_lessons,
          updated_at = CURRENT_TIMESTAMP;
      `;
      // 参数顺序：同上
      params.push(student_id, class_id, quantity);
    }

    // 执行 SQL
    await client.query(upsertBalanceText, params);

    await client.query('COMMIT');
    console.log('✅ 交易成功');
    res.json({ code: 200, msg: '报名成功' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ 交易失败:', err);
    res.status(500).json({ code: 500, msg: '交易失败，系统已自动回滚', error: err.message });
  } finally {
    client.release();
  }
};

// 新增：获取订单列表
const getOrders = async (req, res) => {
  try {
    // 联表查询：查订单 + 学生名 + 班级名
    const query = `
      SELECT 
        o.id,
        o.amount,
        o.quantity,
        o.remark,
        o.created_at,
        s.name as student_name,
        c.class_name,
        c.billing_type
      FROM orders o
      JOIN students s ON o.student_id = s.id
      JOIN classes c ON o.class_id = c.id
      ORDER BY o.created_at DESC
    `;
    const result = await pool.query(query);
    
    res.json({
      code: 200,
      data: result.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, msg: '获取订单失败' });
  }
};

module.exports = {
  createOrder,
  getOrders
};