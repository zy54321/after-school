const pool = require('../../../shared/config/db');
const crypto = require('crypto'); // 引入加密库生成随机 Token

// 获取特训工作台数据
exports.getDailyWorkflowData = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // 1. 获取菜单
    const menuRes = await pool.query(
      'SELECT * FROM daily_menus WHERE report_date = $1',
      [today]
    );

    // 2. 获取学生及今日日报状态
    const studentsRes = await pool.query(
      `
      SELECT 
        s.id, s.name, s.habit_goals, s.allergies, s.grade,
        dr.focus_minutes, dr.distraction_count, dr.meal_status, dr.homework_rating, dr.homework_tags,
        dr.token -- 把 Token 也查出来，如果已经生成过，前端可以显示链接
      FROM students s
      LEFT JOIN daily_reports dr ON s.id = dr.student_id AND dr.report_date = $1
      WHERE s.status = 1
      ORDER BY s.id ASC
    `,
      [today]
    );

    res.json({
      code: 200,
      data: {
        date: today,
        menu: menuRes.rows[0] || { menu_content: '', evidence_photo_url: '' },
        students: studentsRes.rows,
      },
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ code: 500, msg: '获取数据失败', error: err.message });
  }
};

// 保存日报数据 (生成 Token)
exports.saveDailyWorkflow = async (req, res) => {
  const { date, menu, students } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. 保存菜单
    const checkMenu = await client.query(
      'SELECT 1 FROM daily_menus WHERE report_date = $1',
      [date]
    );
    if (checkMenu.rowCount > 0) {
      await client.query(
        'UPDATE daily_menus SET menu_content=$1, evidence_photo_url=$2 WHERE report_date=$3',
        [menu.menu_content, menu.evidence_photo_url, date]
      );
    } else {
      await client.query(
        'INSERT INTO daily_menus (report_date, menu_content, evidence_photo_url) VALUES ($1, $2, $3)',
        [date, menu.menu_content, menu.evidence_photo_url]
      );
    }

    // 2. 保存学生日报
    const generatedLinks = []; // 用于返回给前端展示

    for (const student of students) {
      // 生成随机 Token (如果之前没有)
      // 逻辑：尝试读取旧 Token，如果没有传过来，就新生成一个
      let token = student.token;
      if (!token) {
        token = crypto.randomBytes(16).toString('hex'); // 生成 32位 随机字符
      }

      const upsertQuery = `
        INSERT INTO daily_reports (
          student_id, report_date, focus_minutes, distraction_count, 
          meal_status, homework_rating, homework_tags, token
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (student_id, report_date) 
        DO UPDATE SET 
          focus_minutes = EXCLUDED.focus_minutes,
          distraction_count = EXCLUDED.distraction_count,
          meal_status = EXCLUDED.meal_status,
          homework_rating = EXCLUDED.homework_rating,
          homework_tags = EXCLUDED.homework_tags,
          -- 👇 如果是旧数据(Token为空)，就用新的；否则保持原样
          token = COALESCE(daily_reports.token, EXCLUDED.token)
        RETURNING token;
      `;

      const res = await client.query(upsertQuery, [
        student.id,
        date,
        student.focus_minutes,
        student.distraction_count,
        student.meal_status,
        student.homework_rating,
        student.homework_tags,
        token,
      ]);

      // 收集生成好的 Token
      generatedLinks.push({
        student_id: student.id,
        name: student.name || '学生', // 这里最好前端传name过来，或者只传id
        token: res.rows[0].token,
      });
    }

    await client.query('COMMIT');

    // ⭐ 返回生成的 Token 列表，方便前端生成链接
    res.json({ code: 200, msg: '保存成功', data: generatedLinks });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ code: 500, msg: '保存失败' });
  } finally {
    client.release();
  }
};

// ⭐ 新增：公开查询接口 (凭 Token 查日报)
exports.getStudentReportByToken = async (req, res) => {
  const { token } = req.query;

  if (!token) return res.status(400).json({ code: 400, msg: '凭证无效' });

  try {
    const reportQuery = `
      SELECT 
        dr.*, 
        s.name as student_name, s.grade, s.habit_goals,
        dm.menu_content, dm.evidence_photo_url
      FROM daily_reports dr
      JOIN students s ON dr.student_id = s.id
      LEFT JOIN daily_menus dm ON dr.report_date = dm.report_date
      WHERE dr.token = $1
    `;
    const reportRes = await pool.query(reportQuery, [token]);

    if (reportRes.rows.length === 0) {
      return res.status(404).json({ code: 404, msg: '日报不存在或链接错误' });
    }

    const data = reportRes.rows[0];

    // 自动生成评语逻辑
    if (!data.teacher_comment) {
      if (data.distraction_count === 0 && data.homework_rating === 'A') {
        data.teacher_comment = `今天${data.student_name}表现完美！专注力全开，作业质量全优！🌟`;
      } else if (data.distraction_count > 3) {
        data.teacher_comment = `今天走神${data.distraction_count}次，需要重点训练抗干扰能力。`;
      } else if (data.homework_rating === 'C') {
        data.teacher_comment = `今日作业暴露出${
          data.homework_tags?.join(',') || '一些'
        }问题，建议回家复盘。`;
      } else {
        data.teacher_comment = `表现平稳，继续保持！💪`;
      }
    }

    res.json({ code: 200, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, msg: '查询失败' });
  }
};
