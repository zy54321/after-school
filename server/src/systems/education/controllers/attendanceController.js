const pool = require('../../../shared/config/db');

// 提交签到
const checkIn = async (req, res) => {
  const { student_id, class_id, operator_id } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // === 1. 检查学员状态 ===
    const studentRes = await client.query(
      'SELECT status FROM students WHERE id = $1',
      [student_id]
    );
    if (!studentRes.rows[0] || studentRes.rows[0].status !== 'active') {
      throw new Error('该学员已删除或未激活，无法签到');
    }

    // === 2. 检查课程状态 ===
    const classRes = await client.query(
      'SELECT is_active, deactivated_at FROM classes WHERE id = $1',
      [class_id]
    );
    if (!classRes.rows[0]) {
      throw new Error('课程不存在');
    }
    const classInfo = classRes.rows[0];
    
    // 如果课程已停用，检查停用时间
    if (!classInfo.is_active) {
      if (classInfo.deactivated_at) {
        const deactivatedDate = new Date(classInfo.deactivated_at);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (deactivatedDate <= today) {
          throw new Error('该课程已停用，无法签到');
        }
      } else {
        // 如果没有停用时间，默认不允许签到
        throw new Error('该课程已停用，无法签到');
      }
    }

    // === 3. 检查重复签到 ===
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

    // === 4. 检查课程余额（统一使用有效期） ===
    const checkExpiredText = `
      SELECT expired_at FROM student_course_balance 
      WHERE student_id = $1 AND class_id = $2 
      AND expired_at >= CURRENT_DATE
    `;
    const expiredRes = await client.query(checkExpiredText, [student_id, class_id]);
    
    if (expiredRes.rows.length === 0) {
      throw new Error('该课程已过期，请续费');
    }

    // === 5. 写入签到记录 ===
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
    res.json({ code: 400, msg: err.message });
  } finally {
    client.release();
  }
};

module.exports = {
  checkIn
};

