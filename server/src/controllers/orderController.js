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

    // 2. 获取班级信息（包含计费类型和排课信息）
    const classInfo = await client.query(`
      SELECT billing_type, start_date, schedule_days 
      FROM classes 
      WHERE id = $1
    `, [class_id]);
    
    if (classInfo.rows.length === 0) {
      throw new Error('课程不存在');
    }
    
    const type = classInfo.rows[0]?.billing_type || 'count'; // 默认按次
    const classStartDate = classInfo.rows[0].start_date;
    const scheduleDays = classInfo.rows[0].schedule_days; // 格式: "1,3,5" 或数组

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
      params.push(student_id, class_id, quantity);

    } else {
      // === 🔢 按次模式：统一改为按有效期计算 ===
      // 先检查是否已有记录（续费情况）
      const existingBalance = await client.query(`
        SELECT expired_at FROM student_course_balance 
        WHERE student_id = $1 AND class_id = $2
      `, [student_id, class_id]);
      
      let startDate;
      if (existingBalance.rows.length > 0 && existingBalance.rows[0].expired_at) {
        // 续费：从现有有效期开始计算
        startDate = new Date(existingBalance.rows[0].expired_at);
        // 如果现有有效期已过期，从今天开始
        const today = new Date();
        today.setHours(0, 0, 0, 0);
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
      
      // 解析上课周期（格式: "1,3,5" -> [1,3,5]）
      const targetDays = scheduleDays 
        ? (typeof scheduleDays === 'string' ? scheduleDays.split(',').map(d => parseInt(d.trim())) : scheduleDays)
        : [1, 2, 3, 4, 5]; // 默认周一到周五
      
      // 计算有效期：从开始日期往后数，直到凑够 quantity 节课
      let lessonsFound = 0;
      let currentDate = new Date(startDate);
      let safeGuard = 0;
      
      while (lessonsFound < quantity && safeGuard < 3650) {
        const dayOfWeek = currentDate.getDay(); // 0(周日) - 6(周六)
        
        if (targetDays.includes(dayOfWeek)) {
          lessonsFound++;
        }
        
        if (lessonsFound < quantity) {
          currentDate.setDate(currentDate.getDate() + 1);
        }
        safeGuard++;
      }
      
      const expiredAt = currentDate.toISOString().split('T')[0];
      
      // 统一使用 expired_at 字段
      upsertBalanceText = `
        INSERT INTO student_course_balance (student_id, class_id, expired_at)
        VALUES ($1, $2, $3::date)
        ON CONFLICT (student_id, class_id) 
        DO UPDATE SET 
          expired_at = $3::date,
          updated_at = CURRENT_TIMESTAMP;
      `;
      params.push(student_id, class_id, expiredAt);
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