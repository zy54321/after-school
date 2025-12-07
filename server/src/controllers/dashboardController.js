const pool = require('../config/db');

const getSummary = async (req, res) => {
  try {
    const client = await pool.connect();
    
    // 1. 在读学员总数 (状态正常的)
    const studentRes = await client.query('SELECT COUNT(*) FROM students WHERE status = 1');
    
    // 2. 今日签到人数 (去重，一个人签两节课算一次还是两次？这里算人次)
    const checkinRes = await client.query(`
      SELECT COUNT(*) FROM attendance 
      WHERE DATE(sign_in_time) = CURRENT_DATE
    `);

    // 3. 今日营收 (分 -> 元)
    const incomeRes = await client.query(`
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM orders 
      WHERE DATE(created_at) = CURRENT_DATE
    `);

    // 4. 续费预警 (修复版)
    // 逻辑升级：
    // A. 如果是按次课 (expired_at IS NULL)：看剩余次数是否 < 3
    // B. 如果是包月课 (expired_at IS NOT NULL)：只看有效期是否 < 7天，无视 remaining_lessons
    const warningRes = await client.query(`
      SELECT COUNT(*) FROM student_course_balance
      WHERE 
        (expired_at IS NULL AND remaining_lessons < 3) 
        OR 
        (expired_at IS NOT NULL AND expired_at < CURRENT_DATE + INTERVAL '7 days')
    `);

    // 5. (可选) 获取最新的 5 条动态 (签到 + 订单)
    // 这里为了偷懒 MVP 先只查签到记录
    const activityRes = await client.query(`
      SELECT 
        a.sign_in_time as time,
        s.name || ' - 签到成功 (' || c.class_name || ')' as content
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      JOIN classes c ON a.class_id = c.id
      ORDER BY a.sign_in_time DESC
      LIMIT 5
    `);

    client.release();

    res.json({
      code: 200,
      data: {
        totalStudents: parseInt(studentRes.rows[0].count),
        todayCheckins: parseInt(checkinRes.rows[0].count),
        todayIncome: parseInt(incomeRes.rows[0].total), // 单位：分
        lowBalanceCount: parseInt(warningRes.rows[0].count),
        activities: activityRes.rows
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, msg: '获取数据失败' });
  }
};

module.exports = { getSummary };