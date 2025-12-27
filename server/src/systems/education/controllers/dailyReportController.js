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
        dr.token,
        dr.discipline_rating,
        dr.habit_rating
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
          meal_status, homework_rating, homework_tags, token,
          discipline_rating, habit_rating
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (student_id, report_date) 
        DO UPDATE SET 
          focus_minutes = EXCLUDED.focus_minutes,
          distraction_count = EXCLUDED.distraction_count,
          meal_status = EXCLUDED.meal_status,
          homework_rating = EXCLUDED.homework_rating,
          homework_tags = EXCLUDED.homework_tags,
          discipline_rating = EXCLUDED.discipline_rating,
          habit_rating = EXCLUDED.habit_rating,
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
        student.discipline_rating || 'A',
        student.habit_rating || 'A'
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
    // 1. 先查出当前的日报详情 (为了拿到 student_id)
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

    const currentReport = reportRes.rows[0];

    // 2. ⭐ 新增：查询该学生最近 7 天的专注力数据 (用于画折线图)
    const historyQuery = `
      SELECT report_date, focus_minutes, homework_rating
      FROM daily_reports
      WHERE student_id = $1 
      AND report_date <= $2
      ORDER BY report_date ASC -- 按时间正序，方便前端画图
      LIMIT 7
    `;
    const historyRes = await pool.query(historyQuery, [
      currentReport.student_id,
      currentReport.report_date,
    ]);

    // 3. 自动生成评语 (逻辑保持不变)
    if (!currentReport.teacher_comment) {
      if (
        currentReport.distraction_count === 0 &&
        currentReport.homework_rating === 'A'
      ) {
        currentReport.teacher_comment = `今天${currentReport.student_name}表现完美！专注力全开，作业质量全优！🌟`;
      } else if (currentReport.distraction_count > 3) {
        currentReport.teacher_comment = `今天走神${currentReport.distraction_count}次，需要重点训练抗干扰能力。`;
      } else if (currentReport.homework_rating === 'C') {
        currentReport.teacher_comment = `今日作业暴露出${
          currentReport.homework_tags?.join(',') || '一些'
        }问题，建议回家复盘。`;
      } else {
        currentReport.teacher_comment = `表现平稳，继续保持！💪`;
      }
    }

    res.json({
      code: 200,
      data: {
        ...currentReport,
        history: historyRes.rows, // 把历史数据塞进去
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, msg: '查询失败' });
  }
};
