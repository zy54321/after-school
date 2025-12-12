const pool = require('../config/db');

// 获取学员列表
const getStudents = async (req, res) => {
  try {
    const query = `
      WITH course_data AS (
        SELECT 
          scb.student_id,
          c.id as class_id,
          c.class_name, 
          scb.remaining_lessons,
          scb.expired_at,
          EXISTS (
             SELECT 1 
             FROM attendance a 
             WHERE a.student_id = scb.student_id 
             AND a.class_id = c.id 
             AND DATE(a.sign_in_time) = CURRENT_DATE
          ) as has_signed_today
        FROM student_course_balance scb
        JOIN classes c ON scb.class_id = c.id
        -- ⭐ 核心修改：增加过滤条件，排除掉无效课程
        WHERE (
          -- 情况A: 包月课，必须没过期
          (c.billing_type = 'time' AND scb.expired_at >= CURRENT_DATE)
          OR
          -- 情况B: 按次课，必须还有剩余次数 (即使有效期没到，次数用完了也不算在读)
          (COALESCE(c.billing_type, 'count') != 'time' AND scb.remaining_lessons > 0)
        )
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
    
    res.json({ code: 200, msg: 'success', data: result.rows });
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

// 获取单个学员详情 (聚合查询)
const getStudentDetail = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    // 1. 查基本信息
    const studentRes = await client.query('SELECT * FROM students WHERE id = $1', [id]);
    if (studentRes.rows.length === 0) {
      return res.status(404).json({ code: 404, msg: '学员不存在' });
    }
    const student = studentRes.rows[0];

    // 2. 查在读课程 (关联班级表)
    // ⭐ 核心修改：同样增加过滤条件
    const courseRes = await client.query(`
      SELECT scb.*, c.class_name, c.tuition_fee
      FROM student_course_balance scb
      JOIN classes c ON scb.class_id = c.id
      WHERE scb.student_id = $1
      AND (
        (c.billing_type = 'time' AND scb.expired_at >= CURRENT_DATE)
        OR
        (COALESCE(c.billing_type, 'count') != 'time' AND scb.remaining_lessons > 0)
      )
    `, [id]);

    // 3. 查最近 50 条签到记录
    const attendanceRes = await client.query(`
      SELECT a.*, c.class_name, u.real_name as operator_name
      FROM attendance a
      LEFT JOIN classes c ON a.class_id = c.id
      LEFT JOIN users u ON a.operator_id = u.id
      WHERE a.student_id = $1
      ORDER BY a.sign_in_time DESC
      LIMIT 50
    `, [id]);

    // 4. 查缴费记录
    const orderRes = await client.query(`
      SELECT o.*, c.class_name
      FROM orders o
      LEFT JOIN classes c ON o.class_id = c.id
      WHERE o.student_id = $1
      ORDER BY o.created_at DESC
    `, [id]);

    res.json({
      code: 200,
      data: {
        info: student,
        courses: courseRes.rows,
        attendanceLogs: attendanceRes.rows,
        orders: orderRes.rows
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, msg: '获取详情失败' });
  } finally {
    client.release();
  }
};

// ⭐ 新增/替换：办理退课/退费
const dropClass = async (req, res) => {
  const { id } = req.params; // 学生ID
  const { class_id, refund_amount, remark } = req.body;

  if (!class_id) {
    return res.status(400).json({ code: 400, msg: '请选择要退出的课程' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. 如果有退费金额，插入一条负数订单 (财务平账)
    if (refund_amount && refund_amount > 0) {
      // 前端传的是“元”，转成“分”存库，并取负数
      const amountInCents = -Math.abs(parseFloat(refund_amount) * 100);
      
      await client.query(`
        INSERT INTO orders (student_id, class_id, amount, quantity, remark)
        VALUES ($1, $2, $3, 0, $4)
      `, [id, class_id, amountInCents, `办理退课退费: ${remark || ''}`]);
    }

    // 2. 清理该课程的余额 (设为 0 且过期)
    const updateRes = await client.query(`
      UPDATE student_course_balance
      SET remaining_lessons = 0, 
          expired_at = CURRENT_DATE - INTERVAL '1 day',
          updated_at = CURRENT_TIMESTAMP
      WHERE student_id = $1 AND class_id = $2
      RETURNING *
    `, [id, class_id]);

    if (updateRes.rowCount === 0) {
      throw new Error('未找到该学员的该课程记录');
    }

    // 3. 检查该学员是否还有其他在读课程
    // 如果没有其他课程了，是否要把 student.status 改为 0 (退学)？
    // 这里建议保留 status=1，因为只要档案还在，随时可能报新班。
    // 我们只返回一个标志位给前端提示即可。
    const checkOther = await client.query(`
      SELECT count(*) FROM student_course_balance 
      WHERE student_id = $1 
      AND class_id != $2
      AND (expired_at >= CURRENT_DATE OR remaining_lessons > 0)
    `, [id, class_id]);
    
    const hasOtherCourses = parseInt(checkOther.rows[0].count) > 0;

    await client.query('COMMIT');

    res.json({
      code: 200,
      msg: '退课办理成功' + (refund_amount > 0 ? '，退费记录已生成' : ''),
      data: {
        hasOtherCourses // 告诉前端他是否还有别的课
      }
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('退课失败:', err);
    res.status(500).json({ code: 500, msg: '操作失败', error: err.message });
  } finally {
    client.release();
  }
};

// ⭐ 获取学员位置数据 (GeoJSON 格式)
const getStudentLocations = async (req, res) => {
  try {
    // 只查询状态正常且有坐标的学员
    const query = `
      SELECT id, name, longitude, latitude 
      FROM students 
      WHERE status = 1 
      AND longitude IS NOT NULL 
      AND latitude IS NOT NULL
    `;
    const result = await pool.query(query);

    // 转换为 GeoJSON FeatureCollection 格式
    // 这是 GIS 地图库（OpenLayers/Mapbox/Leaflet）通用的数据格式
    const geoJsonData = {
      type: 'FeatureCollection',
      features: result.rows.map(student => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [parseFloat(student.longitude), parseFloat(student.latitude)] // 注意：GeoJSON 是 [经度, 纬度]
        },
        properties: {
          id: student.id,
          name: student.name,
          weight: 1 // 权重，未来可以根据"剩余课时"或"消费金额"来调整热力权重
        }
      }))
    };

    res.json({
      code: 200,
      msg: 'success',
      data: geoJsonData
    });
  } catch (err) {
    console.error('获取热力图数据失败:', err);
    res.status(500).json({ code: 500, msg: '获取数据失败' });
  }
};

module.exports = {
  getStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  getStudentDetail,
  dropClass,
  getStudentLocations
};