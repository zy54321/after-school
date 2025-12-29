const pool = require('../../../shared/config/db');
const dayjs = require('dayjs'); // 确保已安装: npm install dayjs

// 1. 获取基础配置（孩子列表、任务库、商品库）
exports.getInitData = async (req, res) => {
  // 🟢 修正：从 session 中获取 ID，而不是 req.user
  const userId = req.session.user.id;

  try {
    // 获取/自动创建成员
    let membersRes = await pool.query(
      'SELECT * FROM family_members WHERE parent_id = $1 ORDER BY id',
      [userId]
    );

    // 如果没有成员，自动创建一个“宝贝”
    if (membersRes.rows.length === 0) {
      const newMember = await pool.query(
        'INSERT INTO family_members (parent_id, name) VALUES ($1, $2) RETURNING *',
        [userId, '宝贝']
      );
      membersRes = { rows: [newMember.rows[0]] };
    }

    // 获取任务 (系统默认 + 自己创建的)
    const tasksRes = await pool.query(
      'SELECT * FROM family_tasks WHERE parent_id = $1 OR parent_id = 0 ORDER BY category, id',
      [userId]
    );

    // 获取奖品 (系统默认 + 自己创建的)
    const rewardsRes = await pool.query(
      'SELECT * FROM family_rewards WHERE parent_id = $1 OR parent_id = 0 ORDER BY cost',
      [userId]
    );

    res.json({
      code: 200,
      data: {
        members: membersRes.rows,
        tasks: tasksRes.rows,
        rewards: rewardsRes.rows,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: '初始化数据失败' });
  }
};

// 2. 获取指定孩子的面板数据 (总分 + 流水 + 奖品兑换状态)
exports.getMemberDashboard = async (req, res) => {
  const { memberId } = req.query;
  // const userId = req.session.user.id; // 这里暂时不需要 userId，但如果是严格权限校验可以加上

  try {
    // 1. 计算当前总积分
    const balanceRes = await pool.query(
      'SELECT SUM(points_change) as total FROM family_points_log WHERE member_id = $1',
      [memberId]
    );
    const totalPoints = parseInt(balanceRes.rows[0].total || 0);

    // 2. 获取最近20条流水
    const historyRes = await pool.query(
      'SELECT * FROM family_points_log WHERE member_id = $1 ORDER BY created_at DESC LIMIT 20',
      [memberId]
    );

    // 3. 计算奖品限制状态 (获取最近兑换记录，供前端判断限购)
    const usageRes = await pool.query(
      `SELECT reward_id, COUNT(*) as usage_count, MAX(created_at) as last_used 
       FROM family_points_log 
       WHERE member_id = $1 AND points_change < 0 AND reward_id IS NOT NULL
       GROUP BY reward_id`,
      [memberId]
    );

    res.json({
      code: 200,
      data: {
        totalPoints,
        history: historyRes.rows,
        usageStats: usageRes.rows,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: '获取面板失败' });
  }
};

// 3. 执行任务/行为 (加分/扣分)
exports.logAction = async (req, res) => {
  const { memberId, taskId, customTitle, points } = req.body;
  // const userId = req.session.user.id;

  try {
    let title = customTitle;
    if (!title && taskId) {
      const taskRes = await pool.query(
        'SELECT title FROM family_tasks WHERE id=$1',
        [taskId]
      );
      if (taskRes.rows.length > 0) {
        title = taskRes.rows[0].title;
      }
    }

    await pool.query(
      'INSERT INTO family_points_log (member_id, task_id, description, points_change) VALUES ($1, $2, $3, $4)',
      [memberId, taskId || null, title || '手动记录', points]
    );
    res.json({ code: 200, msg: '记录成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: '操作失败' });
  }
};

// 4. 兑换奖品 (核心：带库存检查)
exports.redeemReward = async (req, res) => {
  const { memberId, rewardId } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // A. 获取商品详情
    const rewardRes = await client.query(
      'SELECT * FROM family_rewards WHERE id = $1',
      [rewardId]
    );
    if (rewardRes.rows.length === 0) throw new Error('商品不存在');
    const reward = rewardRes.rows[0];

    // B. 检查积分余额
    const balanceRes = await client.query(
      'SELECT SUM(points_change) as total FROM family_points_log WHERE member_id = $1',
      [memberId]
    );
    const total = parseInt(balanceRes.rows[0].total || 0);
    if (total < reward.cost) throw new Error('积分不足');

    // C. 检查周期限制 (Weekly/Monthly)
    if (reward.limit_type !== 'unlimited') {
      let startTime;
      const now = dayjs();

      if (reward.limit_type === 'daily') startTime = now.startOf('day');
      if (reward.limit_type === 'weekly')
        startTime = now.startOf('week').add(1, 'day'); // 视习惯而定
      if (reward.limit_type === 'monthly') startTime = now.startOf('month');

      const countRes = await client.query(
        `SELECT COUNT(*) as count FROM family_points_log 
         WHERE member_id = $1 AND reward_id = $2 AND created_at >= $3`,
        [memberId, rewardId, startTime.toDate()]
      );

      if (parseInt(countRes.rows[0].count) >= reward.limit_max) {
        throw new Error(`本周期已达兑换上限`);
      }
    }

    // D. 扣分并记录
    await client.query(
      'INSERT INTO family_points_log (member_id, reward_id, description, points_change) VALUES ($1, $2, $3, $4)',
      [memberId, rewardId, `兑换：${reward.name}`, -reward.cost]
    );

    // E. 记录到兑换单表 (family_redemptions)
    // 注意：之前数据库设计里如果不包含这张表，可以忽略这步，或者只记 log 即可。
    // 这里为了简单，我们主要依靠 family_points_log 记录即可，或者您可以根据之前的 SQL 补全 redemptions 表的插入。

    await client.query('COMMIT');
    res.json({ code: 200, msg: '兑换成功' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.json({ code: 400, msg: err.message || '兑换失败' });
  } finally {
    client.release();
  }
};

// 5. 新增自定义任务/商品
exports.createItem = async (req, res) => {
  const { type, name, points, category, limitType, limitMax } = req.body;
  // 🟢 修正：从 session 中获取 ID
  const userId = req.session.user.id;

  try {
    if (type === 'task') {
      await pool.query(
        'INSERT INTO family_tasks (parent_id, title, category, points, icon) VALUES ($1, $2, $3, $4, $5)',
        [userId, name, category || 'life', points, '🌟']
      );
    } else {
      await pool.query(
        'INSERT INTO family_rewards (parent_id, name, cost, limit_type, limit_max) VALUES ($1, $2, $3, $4, $5)',
        [userId, name, points, limitType || 'unlimited', limitMax || 0]
      );
    }
    res.json({ code: 200, msg: '添加成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: '添加失败' });
  }
};
