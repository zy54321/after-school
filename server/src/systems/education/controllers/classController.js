const pool = require('../../../shared/config/db');

// 1. 获取所有班级 (管理列表用，包含已停办的)
const getAllClasses = async (req, res) => {
  try {
    const query = `
      SELECT * FROM classes 
      ORDER BY is_active DESC, id DESC
    `;
    const result = await pool.query(query);
    res.json({ code: 200, data: result.rows });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// 2. 获取激活的班级 (给报名下拉框用)
const getActiveClasses = async (req, res) => {
  try {
    const query = `
      SELECT * FROM classes 
      WHERE is_active = true 
      ORDER BY id ASC
    `;
    const result = await pool.query(query);
    res.json({ code: 200, data: result.rows });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// 3. 新增班级/课程
const createClass = async (req, res) => {
  const { 
    class_name, tuition_fee, billing_type, teacher_name, description,
    // ⭐ 新增字段
    start_date, end_date, schedule_days, time_range, duration_value 
  } = req.body;
  
  try {
    const query = `
      INSERT INTO classes 
      (class_name, tuition_fee, billing_type, teacher_name, description, is_active,
       start_date, end_date, schedule_days, time_range, duration_value)
      VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    
    // schedule_days 前端传数组，这里转字符串存库
    const daysStr = Array.isArray(schedule_days) ? schedule_days.join(',') : schedule_days;

    const values = [
      class_name, tuition_fee, billing_type, teacher_name, description,
      start_date, end_date, daysStr, time_range, duration_value
    ];
    
    const result = await pool.query(query, values);
    res.json({ code: 200, msg: '课程创建成功', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: '创建失败', error: err.message });
  }
};

// 4. 编辑/停办班级
const updateClass = async (req, res) => {
  const { id } = req.params;
  const { 
    class_name, tuition_fee, billing_type, teacher_name, description, is_active,
    // ⭐ 新增字段
    start_date, end_date, schedule_days, time_range, duration_value
  } = req.body;

  try {
    const query = `
      UPDATE classes 
      SET class_name=$1, tuition_fee=$2, billing_type=$3, teacher_name=$4, description=$5, is_active=$6,
          start_date=$7, end_date=$8, schedule_days=$9, time_range=$10, duration_value=$11
      WHERE id=$12
      RETURNING *
    `;
    
    const daysStr = Array.isArray(schedule_days) ? schedule_days.join(',') : schedule_days;

    const values = [
      class_name, tuition_fee, billing_type, teacher_name, description, is_active,
      start_date, end_date, daysStr, time_range, duration_value,
      id
    ];
    
    const result = await pool.query(query, values);
    res.json({ code: 200, msg: '更新成功', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: '更新失败' });
  }
};

// 5. 删除课程/班级
const deleteClass = async (req, res) => {
  const { id } = req.params;

  try {
    // 检查是否有学员报名（有效的课程余额）
    const checkBalance = await pool.query(`
      SELECT COUNT(*) as count FROM student_course_balance
      WHERE class_id = $1 
      AND (expired_at IS NULL OR expired_at >= CURRENT_DATE)
    `, [id]);

    if (parseInt(checkBalance.rows[0].count) > 0) {
      return res.json({ 
        code: 400, 
        msg: '该课程还有在读学员，无法删除。请先处理学员的课程余额后再删除。' 
      });
    }

    // 检查是否有订单记录
    const checkOrders = await pool.query(`
      SELECT COUNT(*) as count FROM orders WHERE class_id = $1
    `, [id]);

    if (parseInt(checkOrders.rows[0].count) > 0) {
      return res.json({ 
        code: 400, 
        msg: '该课程存在历史订单记录，无法删除。建议使用"停用"功能。' 
      });
    }

    // 检查是否有签到记录
    const checkAttendance = await pool.query(`
      SELECT COUNT(*) as count FROM attendance WHERE class_id = $1
    `, [id]);

    if (parseInt(checkAttendance.rows[0].count) > 0) {
      return res.json({ 
        code: 400, 
        msg: '该课程存在历史签到记录，无法删除。建议使用"停用"功能。' 
      });
    }

    // 如果没有任何关联数据，可以删除
    const query = `DELETE FROM classes WHERE id = $1 RETURNING *;`;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.json({ code: 404, msg: '课程不存在' });
    }

    res.json({
      code: 200,
      msg: '删除成功',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('删除课程失败:', err);
    res.status(500).json({ code: 500, msg: '删除失败', error: err.message });
  }
};

module.exports = { getAllClasses, getActiveClasses, createClass, updateClass, deleteClass };

