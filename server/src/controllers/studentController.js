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
          -- 在这里提前计算好"今日是否已签到"
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
      WHERE s.status = 1
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
  const { name, gender, parent_name, parent_phone, balance, address, longitude, latitude } = req.body;

  try {
    const query = `
      INSERT INTO students (name, gender, parent_name, parent_phone, balance, address, longitude, latitude)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const values = [
      name, 
      gender, 
      parent_name, 
      parent_phone, 
      balance || 0,
      address || null,
      longitude || null,
      latitude || null
    ];
    
    const result = await pool.query(query, values);

    res.json({
      code: 200,
      msg: '新增成功',
      data: result.rows[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, msg: '新增学员失败', error: err.message });
  }
};

// 更新学员信息
const updateStudent = async (req, res) => {
  const { id } = req.params;
  const { name, gender, parent_name, parent_phone, balance, address, longitude, latitude } = req.body;

  try {
    const query = `
      UPDATE students 
      SET name = $1, gender = $2, parent_name = $3, parent_phone = $4, balance = $5, 
          address = $6, longitude = $7, latitude = $8
      WHERE id = $9 AND status = 1
      RETURNING *;
    `;
    const values = [
      name, 
      gender, 
      parent_name, 
      parent_phone, 
      balance || 0,
      address || null,
      longitude || null,
      latitude || null,
      id
    ];
    
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.json({ code: 404, msg: '学员不存在或已被删除' });
    }

    res.json({
      code: 200,
      msg: '更新成功',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('更新学员失败:', err);
    res.status(500).json({ code: 500, msg: '更新失败', error: err.message });
  }
};

// 删除学员（软删除）
const deleteStudent = async (req, res) => {
  const { id } = req.params;

  try {
    // 检查是否有未完成的订单或有效的课程余额
    const checkRelations = await pool.query(`
      SELECT COUNT(*) as count FROM student_course_balance
      WHERE student_id = $1 
      AND (expired_at IS NULL OR expired_at >= CURRENT_DATE)
    `, [id]);

    if (parseInt(checkRelations.rows[0].count) > 0) {
      return res.json({ 
        code: 400, 
        msg: '该学员还有有效的课程余额，无法删除。请先处理课程余额后再删除。' 
      });
    }

    // 软删除：设置 status = 0
    const query = `
      UPDATE students 
      SET status = 0 
      WHERE id = $1
      RETURNING *;
    `;
    
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.json({ code: 404, msg: '学员不存在' });
    }

    res.json({
      code: 200,
      msg: '删除成功',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('删除学员失败:', err);
    res.status(500).json({ code: 500, msg: '删除失败', error: err.message });
  }
};

module.exports = {
  getStudents,
  createStudent,
  updateStudent,
  deleteStudent
};