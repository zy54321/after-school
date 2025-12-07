const pool = require('../config/db');

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

module.exports = { getAllClasses, getActiveClasses, createClass, updateClass };