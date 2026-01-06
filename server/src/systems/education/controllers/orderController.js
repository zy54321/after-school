const pool = require('../../../shared/config/db');

// 创建订单（报名/续费）
const createOrder = async (req, res) => {
  const { student_id, class_id, quantity, amount, remark, fee_type } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. 记流水 (Orders)
    const insertOrderText = `
      INSERT INTO orders (student_id, class_id, quantity, amount, remark, fee_type)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;
    await client.query(insertOrderText, [
      student_id,
      class_id,
      quantity,
      amount,
      remark,
      fee_type || 'tuition',
    ]);

    // 2. 获取班级信息（包含计费类型和排课信息）
    const classInfo = await client.query(`
      SELECT billing_type, start_date, schedule_days 
      FROM classes 
      WHERE id = $1
    `, [class_id]);

    if (classInfo.rows.length === 0) {
      throw new Error('课程不存在');
    }

    const type = classInfo.rows[0]?.billing_type || 'time'; // 默认按期
    const classStartDate = classInfo.rows[0].start_date;

    let upsertBalanceText = '';
    const params = [];

    if (type === 'time') {
      // === ⏰ 按期模式：按月延期 ===
      // 先检查是否已有记录（续费情况）
      const existingBalance = await client.query(
        `
        SELECT expired_at FROM student_course_balance 
        WHERE student_id = $1 AND class_id = $2
      `,
        [student_id, class_id]
      );

      if (existingBalance.rows.length > 0 && existingBalance.rows[0].expired_at) {
        // 续费：从现有有效期开始延期
        upsertBalanceText = `
          INSERT INTO student_course_balance (student_id, class_id, expired_at)
          VALUES ($1, $2, CURRENT_DATE + ($3 * 30 * INTERVAL '1 day'))
          ON CONFLICT (student_id, class_id) 
          DO UPDATE SET 
            expired_at = GREATEST(student_course_balance.expired_at, CURRENT_DATE) + ($3 * 30 * INTERVAL '1 day'),
            updated_at = CURRENT_TIMESTAMP;
        `;
        params.push(student_id, class_id, quantity);
      } else {
        // 新报名：从当前日期或课程开始日期（取较晚的）开始计算
        const startDate = classStartDate ? new Date(classStartDate) : new Date();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const actualStartDate = today > startDate ? today : startDate;
        const startDateStr = actualStartDate.toISOString().split('T')[0];

        upsertBalanceText = `
          INSERT INTO student_course_balance (student_id, class_id, expired_at)
          VALUES ($1, $2, $3::date + ($4 * 30 * INTERVAL '1 day'))
          ON CONFLICT (student_id, class_id) 
          DO UPDATE SET 
            expired_at = GREATEST(student_course_balance.expired_at, CURRENT_DATE) + ($4 * 30 * INTERVAL '1 day'),
            updated_at = CURRENT_TIMESTAMP;
        `;
        params.push(student_id, class_id, startDateStr, quantity);
      }
    } else {
      // === 🔢 按次模式：统一为有效期（简化：每周1节课 = 7天） ===
      // 先检查是否已有记录（续费情况）
      const existingBalance = await client.query(
        `
        SELECT expired_at FROM student_course_balance 
        WHERE student_id = $1 AND class_id = $2
      `,
        [student_id, class_id]
      );

      let startDate;
      if (
        existingBalance.rows.length > 0 &&
        existingBalance.rows[0].expired_at
      ) {
        // 续费：从现有有效期开始累加
        startDate = new Date(existingBalance.rows[0].expired_at);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // 如果现有有效期已过期，从今天开始
        if (startDate < today) {
          startDate = today;
        }
      } else {
        // 新报名：从当前日期或课程开始日期（取较晚的）开始计算
        startDate = classStartDate ? new Date(classStartDate) : new Date();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (today > startDate) {
          startDate = today;
        }
      }

      // 简化计算：quantity 节课 = quantity * 7 天（每周1节课）
      const expiredAt = new Date(startDate);
      expiredAt.setDate(expiredAt.getDate() + quantity * 7);
      const expiredAtStr = expiredAt.toISOString().split('T')[0];

      upsertBalanceText = `
        INSERT INTO student_course_balance (student_id, class_id, expired_at)
        VALUES ($1, $2, $3::date)
        ON CONFLICT (student_id, class_id) 
        DO UPDATE SET 
          expired_at = $3::date,
          updated_at = CURRENT_TIMESTAMP;
      `;
      params.push(student_id, class_id, expiredAtStr);
    }

    // 执行 SQL
    await client.query(upsertBalanceText, params);

    await client.query('COMMIT');
    res.json({ code: 200, msg: '报名成功' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('交易失败:', err);
    res
      .status(500)
      .json({ code: 500, msg: '交易失败，系统已自动回滚', error: err.message });
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
      data: result.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, msg: '获取订单失败' });
  }
};

module.exports = {
  createOrder,
  getOrders,
};
