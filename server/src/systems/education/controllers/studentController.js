const pool = require('../../../shared/config/db');

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
        WHERE (
          (c.billing_type = 'time' AND scb.expired_at >= CURRENT_DATE)
          OR
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
      -- ⭐ 修复点：status = 'active'
      WHERE s.status = 'active'
      GROUP BY s.id
      ORDER BY s.joined_at DESC;
    `;

    const result = await pool.query(query);

    res.json({ code: 200, msg: 'success', data: result.rows });
  } catch (err) {
    console.error('获取学员列表失败:', err);
    res
      .status(500)
      .json({ code: 500, msg: '获取列表失败', error: err.message });
  }
};

// 新增学员
const createStudent = async (req, res) => {
  const {
    name,
    gender,
    parent_name,
    parent_phone,
    balance,
    address,
    longitude,
    latitude,
    allergies,
    authorized_pickups,
    habit_goals,
    agreements_signed,
  } = req.body;

  try {
    // 插入时使用默认值 'active' (数据库已设默认值，无需显式插入)
    const query = `
      INSERT INTO students (
        name, gender, grade, parent_name, parent_phone, balance, address, longitude, latitude,
        allergies, authorized_pickups, habit_goals, agreements_signed
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *;
    `;
    const values = [
      name,
      gender,
      req.body.grade || null,
      parent_name,
      parent_phone,
      balance || 0,
      address || null,
      longitude || null,
      latitude || null,
      allergies || null,
      authorized_pickups || null,
      habit_goals || [],
      agreements_signed || false,
    ];

    const result = await pool.query(query, values);

    res.json({
      code: 200,
      msg: '新增成功',
      data: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ code: 500, msg: '新增学员失败', error: err.message });
  }
};

// 更新学员信息
const updateStudent = async (req, res) => {
  const { id } = req.params;
  const {
    name,
    gender,
    parent_name,
    parent_phone,
    balance,
    address,
    longitude,
    latitude,
    allergies,
    authorized_pickups,
    habit_goals,
    agreements_signed,
  } = req.body;

  try {
    // ⭐ 修复点：status = 'active'
    const query = `
      UPDATE students 
      SET name = $1, gender = $2, grade = $3, parent_name = $4, parent_phone = $5, balance = $6, 
          address = $7, longitude = $8, latitude = $9,
          allergies = $10, authorized_pickups = $11, habit_goals = $12, agreements_signed = $13
      WHERE id = $14 AND status = 'active'
      RETURNING *;
    `;
    const values = [
      name,
      gender,
      req.body.grade || null,
      parent_name,
      parent_phone,
      balance || 0,
      address || null,
      longitude || null,
      latitude || null,
      allergies || null,
      authorized_pickups || null,
      habit_goals || [],
      agreements_signed || false,
      id,
    ];

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.json({ code: 404, msg: '学员不存在或已被删除' });
    }

    res.json({
      code: 200,
      msg: '更新成功',
      data: result.rows[0],
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
    const checkRelations = await pool.query(
      `
      SELECT COUNT(*) as count FROM student_course_balance
      WHERE student_id = $1 
      AND (expired_at IS NULL OR expired_at >= CURRENT_DATE)
    `,
      [id]
    );

    if (parseInt(checkRelations.rows[0].count) > 0) {
      return res.json({
        code: 400,
        msg: '该学员还有有效的课程余额，无法删除。请先处理课程余额后再删除。',
      });
    }

    // ⭐ 修复点：软删除改为 status = 'inactive'
    const query = `
      UPDATE students 
      SET status = 'inactive' 
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
      data: result.rows[0],
    });
  } catch (err) {
    console.error('删除学员失败:', err);
    res.status(500).json({ code: 500, msg: '删除失败', error: err.message });
  }
};

// 获取单个学员详情
const getStudentDetail = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    const studentRes = await client.query(
      'SELECT * FROM students WHERE id = $1',
      [id]
    );
    if (studentRes.rows.length === 0) {
      return res.status(404).json({ code: 404, msg: '学员不存在' });
    }
    const student = studentRes.rows[0];

    const courseRes = await client.query(
      `
      SELECT scb.*, c.class_name, c.tuition_fee
      FROM student_course_balance scb
      JOIN classes c ON scb.class_id = c.id
      WHERE scb.student_id = $1
      AND (
        (c.billing_type = 'time' AND scb.expired_at >= CURRENT_DATE)
        OR
        (COALESCE(c.billing_type, 'count') != 'time' AND scb.remaining_lessons > 0)
      )
    `,
      [id]
    );

    const attendanceRes = await client.query(
      `
      SELECT a.*, c.class_name, u.real_name as operator_name
      FROM attendance a
      LEFT JOIN classes c ON a.class_id = c.id
      LEFT JOIN users u ON a.operator_id = u.id
      WHERE a.student_id = $1
      ORDER BY a.sign_in_time DESC
      LIMIT 50
    `,
      [id]
    );

    const orderRes = await client.query(
      `
      SELECT o.*, c.class_name
      FROM orders o
      LEFT JOIN classes c ON o.class_id = c.id
      WHERE o.student_id = $1
      ORDER BY o.created_at DESC
    `,
      [id]
    );

    res.json({
      code: 200,
      data: {
        info: student,
        courses: courseRes.rows,
        attendanceLogs: attendanceRes.rows,
        orders: orderRes.rows,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, msg: '获取详情失败' });
  } finally {
    client.release();
  }
};

// 办理退课/退费
const dropClass = async (req, res) => {
  const { id } = req.params;
  const { class_id, refund_amount, remark } = req.body;

  if (!class_id) {
    return res.status(400).json({ code: 400, msg: '请选择要退出的课程' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (refund_amount && refund_amount > 0) {
      const amountInCents = -Math.abs(parseFloat(refund_amount) * 100);

      await client.query(
        `
        INSERT INTO orders (student_id, class_id, amount, quantity, remark)
        VALUES ($1, $2, $3, 0, $4)
      `,
        [id, class_id, amountInCents, `办理退课退费: ${remark || ''}`]
      );
    }

    const updateRes = await client.query(
      `
      UPDATE student_course_balance
      SET remaining_lessons = 0, 
          expired_at = CURRENT_DATE - INTERVAL '1 day',
          updated_at = CURRENT_TIMESTAMP
      WHERE student_id = $1 AND class_id = $2
      RETURNING *
    `,
      [id, class_id]
    );

    if (updateRes.rowCount === 0) {
      throw new Error('未找到该学员的该课程记录');
    }

    const checkOther = await client.query(
      `
      SELECT count(*) FROM student_course_balance 
      WHERE student_id = $1 
      AND class_id != $2
      AND (expired_at >= CURRENT_DATE OR remaining_lessons > 0)
    `,
      [id, class_id]
    );

    const hasOtherCourses = parseInt(checkOther.rows[0].count) > 0;

    await client.query('COMMIT');

    res.json({
      code: 200,
      msg: '退课办理成功' + (refund_amount > 0 ? '，退费记录已生成' : ''),
      data: {
        hasOtherCourses,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('退课失败:', err);
    res.status(500).json({ code: 500, msg: '操作失败', error: err.message });
  } finally {
    client.release();
  }
};

// 获取学员位置数据
const getStudentLocations = async (req, res) => {
  try {
    // ⭐ 修复点：status = 'active'
    const query = `
      SELECT id, name, longitude, latitude 
      FROM students 
      WHERE status = 'active' 
      AND longitude IS NOT NULL 
      AND latitude IS NOT NULL
    `;
    const result = await pool.query(query);

    const geoJsonData = {
      type: 'FeatureCollection',
      features: result.rows.map((student) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [
            parseFloat(student.longitude),
            parseFloat(student.latitude),
          ],
        },
        properties: {
          id: student.id,
          name: student.name,
          weight: 1,
        },
      })),
    };

    res.json({
      code: 200,
      msg: 'success',
      data: geoJsonData,
    });
  } catch (err) {
    console.error('获取热力图数据失败:', err);
    res.status(500).json({ code: 500, msg: '获取数据失败' });
  }
};

// 获取周边生源
const getNearbyStudents = async (req, res) => {
  const { lng, lat, radius } = req.query;

  if (!lng || !lat || !radius) {
    return res
      .status(400)
      .json({ code: 400, msg: '缺少必要参数 (lng, lat, radius)' });
  }

  try {
    // ⭐ 修复点：status = 'active'
    const query = `
      SELECT 
        id, name, gender, parent_name, parent_phone, address, longitude, latitude,
        ROUND(ST_DistanceSphere(
          ST_MakePoint($1, $2),
          ST_MakePoint(longitude, latitude)
        )) as distance
      FROM students
      WHERE status = 'active' 
        AND longitude IS NOT NULL 
        AND latitude IS NOT NULL
        AND ST_DistanceSphere(
          ST_MakePoint($1, $2),
          ST_MakePoint(longitude, latitude)
        ) <= $3
      ORDER BY distance ASC;
    `;

    const values = [parseFloat(lng), parseFloat(lat), parseFloat(radius)];
    const result = await pool.query(query, values);

    res.json({
      code: 200,
      msg: 'success',
      data: result.rows,
      meta: {
        center: { lng, lat },
        radius: radius,
        count: result.rowCount,
      },
    });
  } catch (err) {
    console.error('周边搜索失败:', err);
    res.status(500).json({ code: 500, msg: '搜索失败', error: err.message });
  }
};

module.exports = {
  getStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  getStudentDetail,
  dropClass,
  getStudentLocations,
  getNearbyStudents,
};
