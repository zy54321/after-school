const pool = require('../config/db');

// 获取学员列表
const getStudents = async (req, res) => {
  try {
    // ⭐ 使用 CTE (WITH语句) 先把课程和签到状态查出来，避免嵌套过深报错
    const query = `
      WITH course_data AS (
        SELECT 
          scb.student_id,
          c.id as class_id,
          c.class_name, 
          scb.remaining_lessons,
          scb.expired_at,
          -- 在这里提前计算好“今日是否已签到”
          EXISTS (
             SELECT 1 
             FROM attendance a 
             WHERE a.student_id = scb.student_id 
             AND a.class_id = c.id 
             AND DATE(a.sign_in_time) = CURRENT_DATE
          ) as has_signed_today
        FROM student_course_balance scb
        JOIN classes c ON scb.class_id = c.id
      )
      SELECT 
        s.*,
        COALESCE(
          json_agg(
            json_build_object(
              'class_id', cd.class_id,
              'class_name', cd.class_name, 
              'remaining', cd.remaining_lessons,
              'expired_at', cd.expired_at,
              'has_signed_today', cd.has_signed_today
            )
          ) FILTER (WHERE cd.class_id IS NOT NULL), 
          '[]'
        ) as courses
      FROM students s
      LEFT JOIN course_data cd ON s.id = cd.student_id
      GROUP BY s.id
      ORDER BY s.joined_at DESC;
    `;
    
    const result = await pool.query(query);
    
    res.json({
      code: 200,
      msg: 'success',
      data: result.rows
    });
  } catch (err) {
    console.error('获取学员列表失败:', err);
    res.status(500).json({ code: 500, msg: '获取列表失败', error: err.message });
  }
};

// 新增学员
const createStudent = async (req, res) => {
  const { name, gender, parent_name, parent_phone, balance } = req.body;

  try {
    const query = `
      INSERT INTO students (name, gender, parent_name, parent_phone, balance)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const values = [name, gender, parent_name, parent_phone, balance || 0];
    
    const result = await pool.query(query, values);

    res.json({
      code: 200,
      msg: '新增成功',
      data: result.rows[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, msg: '新增学员失败' });
  }
};

module.exports = {
  getStudents,
  createStudent
};