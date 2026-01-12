const pool = require('../../../shared/config/db');
const crypto = require('crypto');
const { generateComment } = require('../utils/commentGenerator');
const { analyzeCorrelationsWithData } = require('../utils/correlationAnalyzer');
const { generateAlerts } = require('../utils/alertGenerator');

// 获取特训工作台数据
exports.getDailyWorkflowData = async (req, res) => {
  try {
    const now = new Date();
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const today = beijingTime.toISOString().split('T')[0];

    // 获取今日实录菜单
    let menuRes = await pool.query(
      'SELECT * FROM daily_menus WHERE report_date = $1',
      [today]
    );

    let menuData = menuRes.rows[0];

    // 同步逻辑
    const shouldSync =
      !menuData ||
      !menuData.menu_content ||
      menuData.menu_content.trim() === '';

    if (shouldSync) {
      const planRes = await pool.query(
        `
        SELECT wm.meal_type, d.name 
        FROM weekly_menus wm
        JOIN dishes d ON wm.dish_id = d.id
        WHERE to_char(wm.plan_date, 'YYYY-MM-DD') = $1
        ORDER BY wm.meal_type
      `,
        [today]
      );

      if (planRes.rows.length > 0) {
        const meals = {};
        planRes.rows.forEach((row) => {
          const typeName =
            { lunch: '午餐', dinner: '晚餐', snack: '加餐' }[row.meal_type] ||
            row.meal_type;
          if (!meals[typeName]) meals[typeName] = [];
          meals[typeName].push(row.name);
        });

        const autoContent = Object.entries(meals)
          .map(([type, dishes]) => `【${type}】${dishes.join('、')}`)
          .join(' ');

        menuData = {
          menu_content: autoContent,
          evidence_photo_url: menuData ? menuData.evidence_photo_url : '',
        };
      } else {
        if (!menuData) menuData = { menu_content: '', evidence_photo_url: '' };
      }
    }

    // 获取学生数据（只显示今天已签到的学员）
    // 修复：使用简单的日期比较，确保能正确匹配签到记录
    const studentsRes = await pool.query(
      `
      SELECT 
        s.id, s.name, s.habit_goals, s.allergies, s.grade,
        dr.focus_minutes, dr.distraction_count, dr.meal_status, dr.homework_rating, dr.homework_tags,
        dr.token,
        dr.discipline_rating,
        dr.habit_rating,
        true as has_signed_today
      FROM students s
      INNER JOIN attendance a ON s.id = a.student_id 
        AND DATE(a.sign_in_time) = $1::date
      LEFT JOIN daily_reports dr ON s.id = dr.student_id AND dr.report_date = $1
      WHERE s.status = 'active' 
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
    res
      .status(500)
      .json({ code: 500, msg: '获取数据失败', error: err.message });
  }
};

// 保存日报
exports.saveDailyWorkflow = async (req, res) => {
  const { date, menu, students } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

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

    const generatedLinks = [];

    for (const student of students) {
      // 检查是否有签到记录（可选，只记录警告，不阻止保存）
      const attendanceCheck = await client.query(
        `SELECT 1 FROM attendance 
         WHERE student_id = $1 
         AND DATE(sign_in_time) = $2`,
        [student.id, date]
      );
      
      if (attendanceCheck.rows.length === 0) {
        console.warn(`学员 ${student.name || student.id} 今天未签到，但仍保存了日报`);
      }

      let token = student.token;
      if (!token) {
        token = crypto.randomBytes(16).toString('hex');
      }

      // 生成评语：如果前端传入了 teacher_comment，优先使用；否则自动生成
      let teacherComment = student.teacher_comment;
      
      if (!teacherComment) {
        try {
          // 获取学员姓名
          const studentInfoRes = await client.query(
            'SELECT name FROM students WHERE id = $1',
            [student.id]
          );
          const studentName = studentInfoRes.rows[0]?.name || '学员';

          // 获取最近7天的历史数据用于生成个性化评语
          const historyRes = await client.query(
            `SELECT report_date, focus_minutes, homework_rating, distraction_count
             FROM daily_reports
             WHERE student_id = $1 
             AND report_date < $2
             ORDER BY report_date DESC
             LIMIT 7`,
            [student.id, date]
          );

          // 准备当前数据
          const currentData = {
            focus_minutes: student.focus_minutes,
            homework_rating: student.homework_rating,
            distraction_count: student.distraction_count,
            meal_status: student.meal_status,
            discipline_rating: student.discipline_rating || 'A',
            habit_rating: student.habit_rating || 'A',
          };

          // 准备历史数据（反转顺序，从早到晚）
          const historyData = historyRes.rows.reverse();

          // 生成个性化评语
          teacherComment = generateComment(
            currentData,
            historyData,
            student.id,
            studentName,
            date
          );
        } catch (err) {
          console.error(`生成评语失败（学员ID: ${student.id}）:`, err);
          // 如果生成失败，使用默认评语
          teacherComment = `今天表现${student.homework_rating === 'A' ? '优秀' : student.homework_rating === 'B' ? '良好' : '需要继续努力'}，继续保持！💪`;
        }
      }

      const upsertQuery = `
        INSERT INTO daily_reports (
          student_id, report_date, focus_minutes, distraction_count, 
          meal_status, homework_rating, homework_tags, token,
          discipline_rating, habit_rating, teacher_comment
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (student_id, report_date) 
        DO UPDATE SET 
          focus_minutes = EXCLUDED.focus_minutes,
          distraction_count = EXCLUDED.distraction_count,
          meal_status = EXCLUDED.meal_status,
          homework_rating = EXCLUDED.homework_rating,
          homework_tags = EXCLUDED.homework_tags,
          discipline_rating = EXCLUDED.discipline_rating,
          habit_rating = EXCLUDED.habit_rating,
          teacher_comment = COALESCE(EXCLUDED.teacher_comment, daily_reports.teacher_comment),
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
        student.habit_rating || 'A',
        teacherComment,
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
    console.error('saveDailyWorkflow 错误:', err);
    console.error('请求参数:', { date, menu, studentsCount: students?.length });
    
    // 处理主键冲突错误（序列未同步）
    if (err.code === '23505') {
      const tableName = err.table || '未知表';
      console.error(`⚠️ 检测到 ${tableName} 表序列未同步问题，请执行修复所有表序列脚本.sql`);
      return res.status(500).json({ 
        code: 500, 
        msg: `数据库序列未同步（${tableName}），请联系管理员执行修复序列脚本`, 
        error: '主键冲突：序列值需要修复'
      });
    }
    
    res.status(500).json({ code: 500, msg: '保存失败', error: err.message });
  } finally {
    client.release();
  }
};

// 家长查看日报接口
exports.getStudentReportByToken = async (req, res) => {
  const { token } = req.query;

  if (!token) return res.status(400).json({ code: 400, msg: '凭证无效' });

  try {
    // ⭐ 修复点：显式列出 dr 的所有字段，确保 focus_minutes 被选中
    // 之前使用 dr.* 可能导致字段隐式丢失或冲突
    const reportQuery = `
      SELECT 
        dr.id, dr.student_id, dr.report_date, dr.token,
        dr.focus_minutes, dr.distraction_count, dr.meal_status, 
        dr.homework_rating, dr.homework_tags, dr.discipline_rating, dr.habit_rating, dr.teacher_comment,
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

    // 查询最近7天的历史数据（包含今天），确保包含当前报告的数据
    // 先查询最近7条记录（可能包含今天），包含关联分析和预警检测所需的所有字段
    const historyQuery = `
      SELECT report_date, focus_minutes, homework_rating, distraction_count, meal_status, 
             discipline_rating, habit_rating
      FROM daily_reports
      WHERE student_id = $1 
      AND report_date <= $2
      ORDER BY report_date DESC
      LIMIT 7
    `;
    const historyRes = await pool.query(historyQuery, [
      currentReport.student_id,
      currentReport.report_date,
    ]);
    
    // 确保当前报告的数据在历史中，并使用最新的数据
    let historyRows = historyRes.rows;
    
    // 格式化日期用于比较（统一为 YYYY-MM-DD 格式）
    const formatDateForCompare = (date) => {
      if (!date) return '';
      const d = date instanceof Date ? date : new Date(date);
      return d.toISOString().split('T')[0];
    };
    
    const currentDateStr = formatDateForCompare(currentReport.report_date);
    const hasCurrentDate = historyRows.some(h => 
      formatDateForCompare(h.report_date) === currentDateStr
    );
    
    if (!hasCurrentDate) {
      // 如果历史中没有今天的数据，添加当前报告的数据
      historyRows.unshift({
        report_date: currentReport.report_date,
        focus_minutes: currentReport.focus_minutes,
        homework_rating: currentReport.homework_rating,
        distraction_count: currentReport.distraction_count,
        meal_status: currentReport.meal_status,
        discipline_rating: currentReport.discipline_rating,
        habit_rating: currentReport.habit_rating,
      });
      // 如果超过7条，移除最旧的
      if (historyRows.length > 7) {
        historyRows = historyRows.slice(0, 7);
      }
    } else {
      // 如果历史中有今天的数据，确保使用最新的（当前报告的）数据
      const todayIndex = historyRows.findIndex(h => 
        formatDateForCompare(h.report_date) === currentDateStr
      );
      if (todayIndex >= 0) {
        historyRows[todayIndex] = {
          report_date: currentReport.report_date,
          focus_minutes: currentReport.focus_minutes,
          homework_rating: currentReport.homework_rating,
          distraction_count: currentReport.distraction_count,
          meal_status: currentReport.meal_status,
          discipline_rating: currentReport.discipline_rating,
          habit_rating: currentReport.habit_rating,
        };
      }
    }
    
    // 反转数组，使日期按升序排列（从早到晚），用于图表显示
    historyRows = historyRows.reverse();

    const sourcingQuery = `
      SELECT DISTINCT
        i.name,
        i.source,
        i.category
      FROM weekly_menus wm
      JOIN dish_ingredients di ON wm.dish_id = di.dish_id
      JOIN ingredients i ON di.ingredient_id = i.id
      WHERE wm.plan_date = $1
      ORDER BY i.source, i.name
    `;
    const sourcingRes = await pool.query(sourcingQuery, [
      currentReport.report_date,
    ]);

    // 如果评语为空，使用新的评语生成器自动生成
    if (!currentReport.teacher_comment) {
      try {
        // 准备当前数据
        const currentData = {
          focus_minutes: currentReport.focus_minutes,
          homework_rating: currentReport.homework_rating,
          distraction_count: currentReport.distraction_count,
          meal_status: currentReport.meal_status,
          discipline_rating: currentReport.discipline_rating || 'A',
          habit_rating: currentReport.habit_rating || 'A',
        };

        // 准备历史数据（排除今天的数据）
        const historyData = historyRows.filter(
          (h) => formatDateForCompare(h.report_date) !== currentDateStr
        );

        // 生成个性化评语
        currentReport.teacher_comment = generateComment(
          currentData,
          historyData,
          currentReport.student_id,
          currentReport.student_name,
          currentReport.report_date
        );
      } catch (err) {
        console.error('生成评语失败:', err);
        // 如果生成失败，使用默认评语
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
    }

    // 执行关联分析
    let correlations = {};
    try {
      // 准备历史数据（包含今天，用于关联分析）
      const analysisData = historyRows.map((h) => ({
        focus_minutes: h.focus_minutes,
        homework_rating: h.homework_rating,
        distraction_count: h.distraction_count,
        meal_status: h.meal_status,
      }));

      // 调用关联分析函数
      correlations = analyzeCorrelationsWithData(
        analysisData,
        {}, // 使用默认配置
        currentReport.student_name
      );
    } catch (err) {
      console.error('关联分析失败:', err);
      // 如果分析失败，返回空对象，不影响其他功能
      correlations = {};
    }

    // 执行预警检测
    let alerts = [];
    try {
      // 准备当前数据
      const currentData = {
        report_date: currentReport.report_date,
        focus_minutes: currentReport.focus_minutes,
        homework_rating: currentReport.homework_rating,
        distraction_count: currentReport.distraction_count,
        discipline_rating: currentReport.discipline_rating,
        habit_rating: currentReport.habit_rating,
      };

      // 准备历史数据（排除今天，用于预警检测）
      const alertHistoryData = historyRows
        .filter((h) => formatDateForCompare(h.report_date) !== currentDateStr)
        .map((h) => ({
          report_date: h.report_date,
          focus_minutes: h.focus_minutes,
          homework_rating: h.homework_rating,
          distraction_count: h.distraction_count,
          discipline_rating: h.discipline_rating,
          habit_rating: h.habit_rating,
        }));

      // 调用预警生成函数
      alerts = generateAlerts(currentData, alertHistoryData);
    } catch (err) {
      console.error('预警检测失败:', err);
      // 如果检测失败，返回空数组，不影响其他功能
      alerts = [];
    }

    res.json({
      code: 200,
      data: {
        ...currentReport,
        history: historyRows,
        sourcing_data: sourcingRes.rows,
        correlations,
        alerts,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, msg: '查询失败' });
  }
};
