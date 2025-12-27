const pool = require('../../../shared/config/db');
const crypto = require('crypto');

// 获取特训工作台数据
exports.getDailyWorkflowData = async (req, res) => {
  try {
    // 1. 修正时区：强制使用北京时间 (UTC+8)
    const now = new Date();
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const today = beijingTime.toISOString().split('T')[0];

    // 2. 获取今日实录菜单
    let menuRes = await pool.query(
      'SELECT * FROM daily_menus WHERE report_date = $1',
      [today]
    );

    let menuData = menuRes.rows[0];

    // ⭐⭐⭐ 核心修复逻辑 ⭐⭐⭐
    // 触发同步的条件：(1) 完全没记录 OR (2) 有记录但内容是空的
    // 这样即使数据库里有空行，也会强制去拉取食谱
    const shouldSync = !menuData || !menuData.menu_content || menuData.menu_content.trim() === '';

    if (shouldSync) {
      // 查询 weekly_menus 表
      const planRes = await pool.query(`
        SELECT wm.meal_type, d.name 
        FROM weekly_menus wm
        JOIN dishes d ON wm.dish_id = d.id
        WHERE to_char(wm.plan_date, 'YYYY-MM-DD') = $1
        ORDER BY wm.meal_type
      `, [today]);
      
      if (planRes.rows.length > 0) {
        const meals = {};
        planRes.rows.forEach(row => {
          const typeName = { lunch: '午餐', dinner: '晚餐', snack: '加餐' }[row.meal_type] || row.meal_type;
          if (!meals[typeName]) meals[typeName] = [];
          meals[typeName].push(row.name);
        });

        const autoContent = Object.entries(meals)
          .map(([type, dishes]) => `【${type}】${dishes.join('、')}`)
          .join(' ');

        // 构造数据：使用自动生成的文案，但保留原有的图片(如果有)
        menuData = { 
          menu_content: autoContent, 
          evidence_photo_url: menuData ? menuData.evidence_photo_url : '' 
        };
      } else {
        // 如果都没数据，给默认值
        if (!menuData) menuData = { menu_content: '', evidence_photo_url: '' };
      }
    }

    // 3. 获取学生数据
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
        menu: menuData, 
        students: studentsRes.rows,
      },
    });
  } catch (err) {
    console.error('Workflow Error:', err);
    res.status(500).json({ code: 500, msg: '获取数据失败', error: err.message });
  }
};

// ... saveDailyWorkflow 和 getStudentReportByToken 保持不变 ...
// (为了节省篇幅，这里省略，您只需要保留原来的即可，或者我可以再次提供完整版)
// 下面是这两个函数的引用，您无需改动它们
exports.saveDailyWorkflow = async (req, res) => {
    // ... 原有逻辑 ...
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
      const generatedLinks = []; 
  
      for (const student of students) {
        let token = student.token;
        if (!token) {
          token = crypto.randomBytes(16).toString('hex'); 
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
  
        generatedLinks.push({
          student_id: student.id,
          name: student.name || '学生', 
          token: res.rows[0].token,
        });
      }
  
      await client.query('COMMIT');
      res.json({ code: 200, msg: '保存成功', data: generatedLinks });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      res.status(500).json({ code: 500, msg: '保存失败' });
    } finally {
      client.release();
    }
};

exports.getStudentReportByToken = async (req, res) => {
    // ... 原有逻辑 ...
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
  
      const currentReport = reportRes.rows[0];
  
      const historyQuery = `
        SELECT report_date, focus_minutes, homework_rating
        FROM daily_reports
        WHERE student_id = $1 
        AND report_date <= $2
        ORDER BY report_date ASC
        LIMIT 7
      `;
      const historyRes = await pool.query(historyQuery, [
        currentReport.student_id,
        currentReport.report_date,
      ]);
  
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
          history: historyRes.rows,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ code: 500, msg: '查询失败' });
    }
};