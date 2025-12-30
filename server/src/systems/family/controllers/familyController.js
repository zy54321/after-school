const pool = require('../../../shared/config/db');
const dayjs = require('dayjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// === 📦 配置图片上传 ===
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // 确保 uploads 目录存在
    const dir = 'uploads/';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    // 文件名: timestamp-随机数.ext
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });
exports.uploadMiddleware = upload.single('avatar'); // 导出给路由用

// === 👨‍👩‍👧‍👦 成员管理接口 (新增) ===

// 1. 创建成员
exports.createMember = async (req, res) => {
  const { name } = req.body;
  const userId = req.session.user.id;
  const avatar = req.file ? `/uploads/${req.file.filename}` : ''; // 获取上传后的路径

  try {
    await pool.query(
      'INSERT INTO family_members (parent_id, name, avatar) VALUES ($1, $2, $3)',
      [userId, name, avatar]
    );
    res.json({ code: 200, msg: '添加成员成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: '添加失败' });
  }
};

// 2. 更新成员
exports.updateMember = async (req, res) => {
  const { id, name } = req.body;
  let avatarSql = '';
  const params = [name, id];

  // 如果上传了新头像，才更新 avatar 字段
  if (req.file) {
    avatarSql = ', avatar=$3';
    params.push(`/uploads/${req.file.filename}`);
  }

  try {
    await pool.query(
      `UPDATE family_members SET name=$1 ${avatarSql} WHERE id=$2`,
      params
    );
    res.json({ code: 200, msg: '更新成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: '更新失败' });
  }
};

// 3. 删除成员
exports.deleteMember = async (req, res) => {
  const { id } = req.body;
  try {
    // 级联删除该成员的所有积分记录
    await pool.query('DELETE FROM family_points_log WHERE member_id=$1', [id]);
    await pool.query('DELETE FROM family_members WHERE id=$1', [id]);
    res.json({ code: 200, msg: '已删除成员' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: '删除失败' });
  }
};

// === 📋 原有业务接口 (保持不变) ===

exports.getInitData = async (req, res) => {
  const userId = req.session.user.id;
  try {
    let membersRes = await pool.query(
      'SELECT * FROM family_members WHERE parent_id = $1 ORDER BY id',
      [userId]
    );
    // 如果没有任何成员，初始化一个默认的
    if (membersRes.rows.length === 0) {
      const newMember = await pool.query(
        'INSERT INTO family_members (parent_id, name) VALUES ($1, $2) RETURNING *',
        [userId, '宝贝']
      );
      membersRes = { rows: [newMember.rows[0]] };
    }

    // 分类
    const catsRes = await pool.query(
      'SELECT * FROM family_categories WHERE parent_id = 0 OR parent_id = $1 ORDER BY sort_order, id',
      [userId]
    );
    // 任务 & 奖品
    const tasksRes = await pool.query(
      'SELECT * FROM family_tasks WHERE parent_id = $1 OR parent_id = 0 ORDER BY id',
      [userId]
    );
    const rewardsRes = await pool.query(
      'SELECT * FROM family_rewards WHERE parent_id = $1 OR parent_id = 0 ORDER BY cost',
      [userId]
    );

    res.json({
      code: 200,
      data: {
        members: membersRes.rows,
        categories: catsRes.rows,
        tasks: tasksRes.rows,
        rewards: rewardsRes.rows,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: '初始化失败' });
  }
};

exports.getMemberDashboard = async (req, res) => {
  const { memberId } = req.query;
  try {
    const balanceRes = await pool.query(
      'SELECT SUM(points_change) as total FROM family_points_log WHERE member_id = $1',
      [memberId]
    );
    const totalPoints = parseInt(balanceRes.rows[0].total || 0);
    const historyRes = await pool.query(
      'SELECT * FROM family_points_log WHERE member_id = $1 ORDER BY created_at DESC LIMIT 50',
      [memberId]
    );
    const usageRes = await pool.query(
      `SELECT reward_id, COUNT(*) as usage_count FROM family_points_log 
       WHERE member_id = $1 AND points_change < 0 AND reward_id IS NOT NULL GROUP BY reward_id`,
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

exports.logAction = async (req, res) => {
  const { memberId, taskId, customTitle, points } = req.body;
  try {
    let title = customTitle;
    if (!title && taskId) {
      const t = await pool.query('SELECT title FROM family_tasks WHERE id=$1', [
        taskId,
      ]);
      if (t.rows.length > 0) title = t.rows[0].title;
    }
    await pool.query(
      'INSERT INTO family_points_log (member_id, task_id, description, points_change) VALUES ($1, $2, $3, $4)',
      [memberId, taskId || null, title || '手动记录', points]
    );
    res.json({ code: 200, msg: '记录成功' });
  } catch (err) {
    res.status(500).json({ msg: '操作失败' });
  }
};

exports.redeemReward = async (req, res) => {
  const { memberId, rewardId } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rewardRes = await client.query(
      'SELECT * FROM family_rewards WHERE id = $1',
      [rewardId]
    );
    if (rewardRes.rows.length === 0) throw new Error('商品不存在');
    const reward = rewardRes.rows[0];

    const balanceRes = await client.query(
      'SELECT SUM(points_change) as total FROM family_points_log WHERE member_id = $1',
      [memberId]
    );
    if ((parseInt(balanceRes.rows[0].total) || 0) < reward.cost)
      throw new Error('积分不足');

    if (reward.limit_type !== 'unlimited') {
      let startTime = dayjs();
      if (reward.limit_type === 'daily') startTime = startTime.startOf('day');
      if (reward.limit_type === 'weekly')
        startTime = startTime.startOf('week').add(1, 'day');
      if (reward.limit_type === 'monthly')
        startTime = startTime.startOf('month');
      const count = await client.query(
        'SELECT COUNT(*) FROM family_points_log WHERE member_id=$1 AND reward_id=$2 AND created_at >= $3',
        [memberId, rewardId, startTime.toDate()]
      );
      if (parseInt(count.rows[0].count) >= reward.limit_max)
        throw new Error('已达兑换上限');
    }
    await client.query(
      'INSERT INTO family_points_log (member_id, reward_id, description, points_change) VALUES ($1, $2, $3, $4)',
      [memberId, rewardId, `兑换：${reward.name}`, -reward.cost]
    );
    await client.query('COMMIT');
    res.json({ code: 200, msg: '兑换成功' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.json({ code: 400, msg: err.message });
  } finally {
    client.release();
  }
};

exports.createItem = async (req, res) => {
  // 🟢 新增 targetMembers 参数
  const { type, name, points, category, limitType, limitMax, targetMembers } =
    req.body;
  const userId = req.session.user.id;

  // 处理空数组转为 null (数据库存 null 更省空间且逻辑清晰)
  const targets =
    targetMembers && targetMembers.length > 0 ? targetMembers : null;

  try {
    if (type === 'task') {
      await pool.query(
        // 🟢 插入 target_members
        'INSERT INTO family_tasks (parent_id, title, category, points, icon, target_members) VALUES ($1, $2, $3, $4, $5, $6)',
        [userId, name, category, points, '🌟', targets]
      );
    } else {
      await pool.query(
        // 🟢 插入 target_members
        'INSERT INTO family_rewards (parent_id, name, cost, limit_type, limit_max, target_members) VALUES ($1, $2, $3, $4, $5, $6)',
        [userId, name, points, limitType || 'unlimited', limitMax || 0, targets]
      );
    }
    res.json({ code: 200, msg: '创建成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: '创建失败' });
  }
};

exports.updateItem = async (req, res) => {
  // 🟢 新增 targetMembers 参数
  const {
    id,
    type,
    name,
    points,
    category,
    limitType,
    limitMax,
    targetMembers,
  } = req.body;
  const targets =
    targetMembers && targetMembers.length > 0 ? targetMembers : null;

  try {
    if (type === 'task') {
      await pool.query(
        // 🟢 更新 target_members
        'UPDATE family_tasks SET title=$1, category=$2, points=$3, target_members=$4 WHERE id=$5',
        [name, category, points, targets, id]
      );
    } else {
      await pool.query(
        // 🟢 更新 target_members
        'UPDATE family_rewards SET name=$1, cost=$2, limit_type=$3, limit_max=$4, target_members=$5 WHERE id=$6',
        [name, points, limitType, limitMax, targets, id]
      );
    }
    res.json({ code: 200, msg: '更新成功' });
  } catch (err) {
    res.status(500).json({ msg: '更新失败' });
  }
};

exports.deleteItem = async (req, res) => {
  const { id, type } = req.body;
  try {
    const table = type === 'task' ? 'family_tasks' : 'family_rewards';
    await pool.query(`DELETE FROM ${table} WHERE id=$1`, [id]);
    res.json({ code: 200, msg: '删除成功' });
  } catch (err) {
    res.status(500).json({ msg: '删除失败' });
  }
};

exports.revokeLog = async (req, res) => {
  const { logId, logIds } = req.body; // logIds 预期为数组 [1, 2, 3]
  try {
    if (logIds && Array.isArray(logIds) && logIds.length > 0) {
      // 批量删除：使用 PostgreSQL 的 ANY 语法
      await pool.query('DELETE FROM family_points_log WHERE id = ANY($1)', [logIds]);
    } else if (logId) {
      // 单个删除
      await pool.query('DELETE FROM family_points_log WHERE id=$1', [logId]);
    }
    res.json({ code: 200, msg: '已撤销' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: '撤销失败' });
  }
};

exports.createCategory = async (req, res) => {
  const { name } = req.body;
  const userId = req.session.user.id;
  const key = 'cat_' + Date.now();
  try {
    await pool.query(
      'INSERT INTO family_categories (parent_id, name, key, sort_order) VALUES ($1, $2, $3, 99)',
      [userId, name, key]
    );
    res.json({ code: 200, msg: '添加成功' });
  } catch (err) {
    res.status(500).json({ msg: '添加失败' });
  }
};

exports.deleteCategory = async (req, res) => {
  const { id } = req.body;
  try {
    await pool.query('DELETE FROM family_categories WHERE id=$1', [id]);
    res.json({ code: 200, msg: '删除成功' });
  } catch (err) {
    res.status(500).json({ msg: '删除失败' });
  }
};
