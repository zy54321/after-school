const pool = require('../../../shared/config/db');

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
    
    // 1. 统一检查有效期（包月和按次都使用有效期）
    const checkExpiredText = `
      SELECT expired_at FROM student_course_balance 
      WHERE student_id = $1 AND class_id = $2 
      AND expired_at >= CURRENT_DATE
    `;
    const expiredRes = await client.query(checkExpiredText, [student_id, class_id]);
    
    if (expiredRes.rows.length === 0) {
      throw new Error('该课程已过期，请续费');
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
      data: { expired_at: expiredRes.rows[0].expired_at }
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

