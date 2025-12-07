const pool = require('../config/db');

// 提交签到
const checkIn = async (req, res) => {
  const { student_id, class_id, operator_id } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // === 🛑 新增：重复签到检查 ===
    // 逻辑：查询 attendance 表，看今天是否已经有一条记录
    const checkDuplicateQuery = `
      SELECT id FROM attendance 
      WHERE student_id = $1 
      AND class_id = $2 
      AND DATE(sign_in_time) = CURRENT_DATE
    `;
    const duplicateRes = await client.query(checkDuplicateQuery, [student_id, class_id]);

    if (duplicateRes.rows.length > 0) {
      throw new Error('该学员今日已签到，请勿重复操作');
    }
    // === 🛑 检查结束 ===


    // ... 下面是原来的扣费逻辑 (保持不变) ...
    
    // 1. 判断班级计费类型
    const classResult = await client.query('SELECT billing_type FROM classes WHERE id = $1', [class_id]);
    const billingType = classResult.rows[0].billing_type;

    let remaining = 0;

    if (billingType === 'time') {
      // ... 包月逻辑 ...
      const checkTimeText = `
        SELECT expired_at FROM student_course_balance 
        WHERE student_id = $1 AND class_id = $2 
        AND expired_at >= CURRENT_DATE
      `;
      const timeRes = await client.query(checkTimeText, [student_id, class_id]);
      if (timeRes.rows.length === 0) throw new Error('该包月课程已过期，请续费');
      remaining = -1; 

    } else {
      // ... 按次逻辑 ...
      const updateBalanceText = `
        UPDATE student_course_balance
        SET remaining_lessons = remaining_lessons - 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE student_id = $1 AND class_id = $2 AND remaining_lessons > 0
        RETURNING remaining_lessons;
      `;
      const countRes = await client.query(updateBalanceText, [student_id, class_id]);
      if (countRes.rows.length === 0) throw new Error('剩余课时不足，请续费');
      remaining = countRes.rows[0].remaining_lessons;
    }

    // 2. 写入签到记录
    const insertLogText = `
      INSERT INTO attendance (student_id, class_id, operator_id, status)
      VALUES ($1, $2, $3, 'present')
    `;
    await client.query(insertLogText, [student_id, class_id, operator_id || 1]);

    await client.query('COMMIT');

    res.json({
      code: 200,
      msg: '签到成功',
      data: { remaining: remaining }
    });

  } catch (err) {
    await client.query('ROLLBACK');
    // 返回 400，前端会弹出错误提示
    res.json({ code: 400, msg: err.message });
  } finally {
    client.release();
  }
};

module.exports = {
  checkIn
};