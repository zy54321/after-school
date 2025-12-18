const pool = require('../../../shared/config/db');

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

    // 4. 续费预警 (统一按有效期判断)
    // 逻辑：有效期小于7天的课程需要续费
    const warningRes = await client.query(`
      SELECT COUNT(*) FROM student_course_balance
      WHERE expired_at IS NOT NULL 
        AND expired_at < CURRENT_DATE + INTERVAL '7 days'
        AND expired_at >= CURRENT_DATE
    `);
    
    // 5. 获取需要续费的学员列表（有效期小于7天）
    const lowBalanceListRes = await client.query(`
      SELECT 
        s.name,
        c.class_name,
        scb.expired_at
      FROM student_course_balance scb
      JOIN students s ON scb.student_id = s.id
      JOIN classes c ON scb.class_id = c.id
      WHERE scb.expired_at IS NOT NULL 
        AND scb.expired_at < CURRENT_DATE + INTERVAL '7 days'
        AND scb.expired_at >= CURRENT_DATE
      ORDER BY scb.expired_at ASC
      LIMIT 10
    `);

    // 6. (可选) 获取最新的 5 条动态 (签到 + 订单)
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
        lowBalanceList: lowBalanceListRes.rows.map(row => ({
          name: row.name,
          className: row.class_name,
          expired_at: row.expired_at
        })),
        activities: activityRes.rows
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, msg: '获取数据失败' });
  }
};

module.exports = { getSummary };

