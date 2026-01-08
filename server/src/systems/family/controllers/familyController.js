const pool = require('../../../shared/config/db');
const dayjs = require('dayjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// === 📦 配置图片上传 ===
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'uploads/';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });
exports.uploadMiddleware = upload.single('avatar');

// === 👨‍👩‍👧‍👦 成员管理接口 ===
exports.createMember = async (req, res) => {
  const { name } = req.body;
  const userId = req.session.user.id;
  const avatar = req.file ? `/uploads/${req.file.filename}` : '';
  try {
    await pool.query(
      'INSERT INTO family_members (parent_id, name, avatar) VALUES ($1, $2, $3)',
      [userId, name, avatar]
    );
    res.json({ code: 200, msg: '添加成员成功' });
  } catch (err) {
    console.error('createMember 错误:', err);
    console.error('请求参数:', { name, userId, avatar });
    
    // 处理主键冲突错误（序列未同步）
    if (err.code === '23505' && err.constraint === 'family_members_pkey') {
      console.error('⚠️ 检测到 family_members 表序列未同步问题，请执行修复序列脚本.sql');
      return res.status(500).json({ 
        code: 500, 
        msg: '数据库序列未同步，请联系管理员执行修复序列脚本', 
        error: '主键冲突：序列值需要修复'
      });
    }
    
    res.status(500).json({ code: 500, msg: '添加失败', error: err.message });
  }
};

exports.updateMember = async (req, res) => {
  const { id, name } = req.body;
  let avatarSql = '';
  const params = [name, id];
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

exports.deleteMember = async (req, res) => {
  const { id } = req.body;
  try {
    await pool.query('DELETE FROM family_points_log WHERE member_id=$1', [id]);
    await pool.query('DELETE FROM family_members WHERE id=$1', [id]);
    res.json({ code: 200, msg: '已删除成员' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: '删除失败' });
  }
};

// === 📋 业务接口 ===

exports.getInitData = async (req, res) => {
  const userId = req.session.user.id;
  try {
    let membersRes = await pool.query(
      'SELECT * FROM family_members WHERE parent_id = $1 ORDER BY id',
      [userId]
    );
    if (membersRes.rows.length === 0) {
      const newMember = await pool.query(
        'INSERT INTO family_members (parent_id, name) VALUES ($1, $2) RETURNING *',
        [userId, '宝贝']
      );
      membersRes = { rows: [newMember.rows[0]] };
    }
    const catsRes = await pool.query(
      'SELECT * FROM family_categories WHERE parent_id = 0 OR parent_id = $1 ORDER BY sort_order, id',
      [userId]
    );
    const tasksRes = await pool.query(
      'SELECT * FROM family_tasks WHERE parent_id = $1 OR parent_id = 0 ORDER BY id',
      [userId]
    );
    // 获取 type 字段
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
  // 🟢 更新：支持 month 参数 (格式 YYYY-MM)
  const { memberId, month } = req.query;
  try {
    const balanceRes = await pool.query(
      'SELECT SUM(points_change) as total FROM family_points_log WHERE member_id = $1',
      [memberId]
    );
    const totalPoints = parseInt(balanceRes.rows[0].total || 0);

    let historyQuery = 'SELECT * FROM family_points_log WHERE member_id = $1';
    let params = [memberId];

    if (month) {
      // 如果有月份参数，查询整月数据
      const start = dayjs(month).startOf('month').toDate();
      const end = dayjs(month).endOf('month').toDate();
      historyQuery +=
        ' AND created_at >= $2 AND created_at <= $3 ORDER BY created_at DESC';
      params.push(start, end);
    } else {
      // 默认只查最近 50 条 (保持兼容)
      historyQuery += ' ORDER BY created_at DESC LIMIT 50';
    }

    const historyRes = await pool.query(historyQuery, params);
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
    // 参数验证
    if (!memberId) {
      return res.status(400).json({ code: 400, msg: '成员ID不能为空' });
    }
    if (points === undefined || points === null) {
      return res.status(400).json({ code: 400, msg: '积分值不能为空' });
    }

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
    console.error('logAction 错误:', err);
    console.error('请求参数:', { memberId, taskId, customTitle, points });
    
    // 处理主键冲突错误（序列未同步）
    if (err.code === '23505' && err.constraint === 'family_points_log_pkey') {
      console.error('⚠️ 检测到序列未同步问题，请执行修复序列脚本.sql');
      return res.status(500).json({ 
        code: 500, 
        msg: '数据库序列未同步，请联系管理员执行修复序列脚本', 
        error: '主键冲突：序列值需要修复'
      });
    }
    
    res.status(500).json({ code: 500, msg: '操作失败', error: err.message });
  }
};

// 🎒 辅助函数：存入背包（支持合并数量）
const addToBackpack = async (client, memberId, rewardId, pointsLogId) => {
  // 检查是否已存在相同的未使用物品
  const existingRes = await client.query(
    'SELECT id, quantity FROM family_backpack WHERE member_id=$1 AND reward_id=$2 AND status=$3',
    [memberId, rewardId, 'unused']
  );

  if (existingRes.rows.length > 0) {
    // 如果存在，增加数量
    await client.query(
      'UPDATE family_backpack SET quantity=quantity+1, updated_at=CURRENT_TIMESTAMP WHERE id=$1',
      [existingRes.rows[0].id]
    );
  } else {
    // 如果不存在，创建新记录
    await client.query(
      'INSERT INTO family_backpack (member_id, reward_id, points_log_id, quantity, status, obtained_at) VALUES ($1, $2, $3, 1, $4, CURRENT_TIMESTAMP)',
      [memberId, rewardId, pointsLogId, 'unused']
    );
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
    
    // 记录积分流水
    const logRes = await client.query(
      'INSERT INTO family_points_log (member_id, reward_id, description, points_change) VALUES ($1, $2, $3, $4) RETURNING id',
      [memberId, rewardId, `兑换：${reward.name}`, -reward.cost]
    );
    const pointsLogId = logRes.rows[0].id;
    
    // 🎒 存入背包
    await addToBackpack(client, memberId, rewardId, pointsLogId);
    
    await client.query('COMMIT');
    res.json({ code: 200, msg: '兑换成功！物品已存入背包 🎒' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.json({ code: 400, msg: err.message });
  } finally {
    client.release();
  }
};

// 转赠背包物品
exports.transferBackpackItem = async (req, res) => {
  const { backpackId, fromMemberId, toMemberId, quantity } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (!backpackId || !fromMemberId || !toMemberId) {
      throw new Error('参数不完整');
    }

    if (fromMemberId === toMemberId) {
      throw new Error('不能转赠给自己');
    }

    const transferQuantity = quantity || 1;

    // 查询源背包物品
    const backpackRes = await client.query(
      'SELECT * FROM family_backpack WHERE id = $1 AND member_id = $2',
      [backpackId, fromMemberId]
    );

    if (backpackRes.rows.length === 0) {
      throw new Error('背包物品不存在或不属于该成员');
    }

    const backpackItem = backpackRes.rows[0];

    if (backpackItem.status !== 'unused') {
      throw new Error('只能转赠未使用的物品');
    }

    if (backpackItem.quantity < transferQuantity) {
      throw new Error(`数量不足，当前数量：${backpackItem.quantity}`);
    }

    // 验证目标成员是否存在（必须是同一家庭的成员）
    const fromMemberRes = await client.query(
      'SELECT parent_id FROM family_members WHERE id = $1',
      [fromMemberId]
    );
    const toMemberRes = await client.query(
      'SELECT parent_id FROM family_members WHERE id = $1',
      [toMemberId]
    );

    if (fromMemberRes.rows.length === 0 || toMemberRes.rows.length === 0) {
      throw new Error('成员不存在');
    }

    if (fromMemberRes.rows[0].parent_id !== toMemberRes.rows[0].parent_id) {
      throw new Error('只能转赠给同一家庭的成员');
    }

    // 更新源背包物品
    if (backpackItem.quantity === transferQuantity) {
      // 如果全部转赠，更新成员ID
      await client.query(
        'UPDATE family_backpack SET member_id=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2',
        [toMemberId, backpackId]
      );
    } else {
      // 如果部分转赠，减少源数量并创建目标记录
      await client.query(
        'UPDATE family_backpack SET quantity=quantity-$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2',
        [transferQuantity, backpackId]
      );
      
      // 检查目标成员是否已有相同物品
      const existingRes = await client.query(
        'SELECT id, quantity FROM family_backpack WHERE member_id=$1 AND reward_id=$2 AND status=$3',
        [toMemberId, backpackItem.reward_id, 'unused']
      );

      if (existingRes.rows.length > 0) {
        // 如果存在，增加数量
        await client.query(
          'UPDATE family_backpack SET quantity=quantity+$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2',
          [transferQuantity, existingRes.rows[0].id]
        );
      } else {
        // 如果不存在，创建新记录
        await client.query(
          `INSERT INTO family_backpack (member_id, reward_id, points_log_id, quantity, status, obtained_at) 
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
          [
            toMemberId,
            backpackItem.reward_id,
            backpackItem.points_log_id,
            transferQuantity,
            'unused',
          ]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ code: 200, msg: '转赠成功' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('transferBackpackItem 错误:', err);
    res.json({ code: 400, msg: err.message });
  } finally {
    client.release();
  }
};

// 获取使用记录
exports.getUsageHistory = async (req, res) => {
  const { memberId, rewardId, limit } = req.query;
  try {
    if (!memberId) {
      return res.status(400).json({ code: 400, msg: '成员ID不能为空' });
    }

    let query = `
      SELECT 
        ul.*,
        r.name as reward_name,
        r.icon as reward_icon,
        r.type as reward_type
      FROM family_backpack_usage_log ul
      LEFT JOIN family_rewards r ON ul.reward_id = r.id
      WHERE ul.member_id = $1
    `;
    const params = [memberId];

    // 如果指定了奖励ID，筛选特定奖励
    if (rewardId) {
      query += ' AND ul.reward_id = $2';
      params.push(rewardId);
    }

    query += ' ORDER BY ul.used_at DESC';

    // 限制返回数量
    if (limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(parseInt(limit) || 50);
    } else {
      query += ' LIMIT 50';
    }

    const result = await pool.query(query, params);

    res.json({
      code: 200,
      data: {
        history: result.rows,
        total: result.rows.length,
      },
    });
  } catch (err) {
    console.error('getUsageHistory 错误:', err);
    res.status(500).json({ code: 500, msg: '获取使用记录失败', error: err.message });
  }
};

// 🟢 竞拍结算接口
exports.settleAuction = async (req, res) => {
  const { auctionId, memberId, bidPoints } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const itemRes = await client.query(
      'SELECT * FROM family_rewards WHERE id = $1',
      [auctionId]
    );
    if (itemRes.rows.length === 0) throw new Error('拍品不存在');
    const item = itemRes.rows[0];

    if (bidPoints < item.cost)
      throw new Error(`出价不能低于起拍价 (${item.cost})`);

    const balanceRes = await client.query(
      'SELECT SUM(points_change) as total FROM family_points_log WHERE member_id = $1',
      [memberId]
    );
    const currentBalance = parseInt(balanceRes.rows[0].total || 0);
    if (currentBalance < bidPoints)
      throw new Error('该成员积分不足以支付此竞拍价');

    // 🟢 添加次数限制检查（与兑换品相同的逻辑）
    if (item.limit_type !== 'unlimited') {
      let startTime = dayjs();
      if (item.limit_type === 'daily') startTime = startTime.startOf('day');
      if (item.limit_type === 'weekly')
        startTime = startTime.startOf('week').add(1, 'day');
      if (item.limit_type === 'monthly')
        startTime = startTime.startOf('month');
      const count = await client.query(
        'SELECT COUNT(*) FROM family_points_log WHERE member_id=$1 AND reward_id=$2 AND created_at >= $3',
        [memberId, auctionId, startTime.toDate()]
      );
      if (parseInt(count.rows[0].count) >= item.limit_max)
        throw new Error('已达竞拍上限');
    }

    // 记录积分流水
    const logRes = await client.query(
      'INSERT INTO family_points_log (member_id, reward_id, description, points_change) VALUES ($1, $2, $3, $4) RETURNING id',
      [memberId, auctionId, `竞拍得标：${item.name}`, -bidPoints]
    );
    const pointsLogId = logRes.rows[0].id;
    
    // 🎒 存入背包
    await addToBackpack(client, memberId, auctionId, pointsLogId);
    
    await client.query('COMMIT');
    res.json({ code: 200, msg: '竞拍结算成功！物品已存入背包 🎒' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.json({ code: 400, msg: err.message });
  } finally {
    client.release();
  }
};

// 转赠背包物品
exports.transferBackpackItem = async (req, res) => {
  const { backpackId, fromMemberId, toMemberId, quantity } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (!backpackId || !fromMemberId || !toMemberId) {
      throw new Error('参数不完整');
    }

    if (fromMemberId === toMemberId) {
      throw new Error('不能转赠给自己');
    }

    const transferQuantity = quantity || 1;

    // 查询源背包物品
    const backpackRes = await client.query(
      'SELECT * FROM family_backpack WHERE id = $1 AND member_id = $2',
      [backpackId, fromMemberId]
    );

    if (backpackRes.rows.length === 0) {
      throw new Error('背包物品不存在或不属于该成员');
    }

    const backpackItem = backpackRes.rows[0];

    if (backpackItem.status !== 'unused') {
      throw new Error('只能转赠未使用的物品');
    }

    if (backpackItem.quantity < transferQuantity) {
      throw new Error(`数量不足，当前数量：${backpackItem.quantity}`);
    }

    // 验证目标成员是否存在（必须是同一家庭的成员）
    const fromMemberRes = await client.query(
      'SELECT parent_id FROM family_members WHERE id = $1',
      [fromMemberId]
    );
    const toMemberRes = await client.query(
      'SELECT parent_id FROM family_members WHERE id = $1',
      [toMemberId]
    );

    if (fromMemberRes.rows.length === 0 || toMemberRes.rows.length === 0) {
      throw new Error('成员不存在');
    }

    if (fromMemberRes.rows[0].parent_id !== toMemberRes.rows[0].parent_id) {
      throw new Error('只能转赠给同一家庭的成员');
    }

    // 更新源背包物品
    if (backpackItem.quantity === transferQuantity) {
      // 如果全部转赠，更新成员ID
      await client.query(
        'UPDATE family_backpack SET member_id=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2',
        [toMemberId, backpackId]
      );
    } else {
      // 如果部分转赠，减少源数量并创建目标记录
      await client.query(
        'UPDATE family_backpack SET quantity=quantity-$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2',
        [transferQuantity, backpackId]
      );
      
      // 检查目标成员是否已有相同物品
      const existingRes = await client.query(
        'SELECT id, quantity FROM family_backpack WHERE member_id=$1 AND reward_id=$2 AND status=$3',
        [toMemberId, backpackItem.reward_id, 'unused']
      );

      if (existingRes.rows.length > 0) {
        // 如果存在，增加数量
        await client.query(
          'UPDATE family_backpack SET quantity=quantity+$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2',
          [transferQuantity, existingRes.rows[0].id]
        );
      } else {
        // 如果不存在，创建新记录
        await client.query(
          `INSERT INTO family_backpack (member_id, reward_id, points_log_id, quantity, status, obtained_at) 
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
          [
            toMemberId,
            backpackItem.reward_id,
            backpackItem.points_log_id,
            transferQuantity,
            'unused',
          ]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ code: 200, msg: '转赠成功' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('transferBackpackItem 错误:', err);
    res.json({ code: 400, msg: err.message });
  } finally {
    client.release();
  }
};

// 获取使用记录
exports.getUsageHistory = async (req, res) => {
  const { memberId, rewardId, limit } = req.query;
  try {
    if (!memberId) {
      return res.status(400).json({ code: 400, msg: '成员ID不能为空' });
    }

    let query = `
      SELECT 
        ul.*,
        r.name as reward_name,
        r.icon as reward_icon,
        r.type as reward_type
      FROM family_backpack_usage_log ul
      LEFT JOIN family_rewards r ON ul.reward_id = r.id
      WHERE ul.member_id = $1
    `;
    const params = [memberId];

    // 如果指定了奖励ID，筛选特定奖励
    if (rewardId) {
      query += ' AND ul.reward_id = $2';
      params.push(rewardId);
    }

    query += ' ORDER BY ul.used_at DESC';

    // 限制返回数量
    if (limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(parseInt(limit) || 50);
    } else {
      query += ' LIMIT 50';
    }

    const result = await pool.query(query, params);

    res.json({
      code: 200,
      data: {
        history: result.rows,
        total: result.rows.length,
      },
    });
  } catch (err) {
    console.error('getUsageHistory 错误:', err);
    res.status(500).json({ code: 500, msg: '获取使用记录失败', error: err.message });
  }
};

exports.createItem = async (req, res) => {
  // 🟢 更新：接收 type 和 description
  const { type, name, points, category, limitType, limitMax, targetMembers, description } =
    req.body;
  const userId = req.session.user.id;
  const targets =
    targetMembers && targetMembers.length > 0 ? targetMembers : null;
  try {
    if (type === 'task') {
      await pool.query(
        'INSERT INTO family_tasks (parent_id, title, category, points, icon, target_members) VALUES ($1, $2, $3, $4, $5, $6)',
        [userId, name, category, points, '🌟', targets]
      );
    } else {
      // 🟢 插入 family_rewards 时带上 type 和 description
      await pool.query(
        'INSERT INTO family_rewards (parent_id, name, cost, limit_type, limit_max, target_members, type, description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [
          userId,
          name,
          points,
          limitType || 'unlimited',
          limitMax || 0,
          targets,
          type || 'reward',
          description || null,
        ]
      );
    }
    res.json({ code: 200, msg: '创建成功' });
  } catch (err) {
    console.error('createItem 错误:', err);
    console.error('请求参数:', { type, name, points, category, limitType, limitMax, targetMembers, description });
    
    // 处理主键冲突错误（序列未同步）
    if (err.code === '23505') {
      const tableName = err.table === 'family_tasks' ? 'family_tasks' : 
                       err.table === 'family_rewards' ? 'family_rewards' : 
                       err.table || '未知表';
      console.error(`⚠️ 检测到 ${tableName} 表序列未同步问题，请执行修复序列脚本.sql`);
      return res.status(500).json({ 
        code: 500, 
        msg: `数据库序列未同步（${tableName}），请联系管理员执行修复序列脚本`, 
        error: '主键冲突：序列值需要修复'
      });
    }
    
    res.status(500).json({ code: 500, msg: '创建失败', error: err.message });
  }
};

exports.updateItem = async (req, res) => {
  // 🟢 更新：接收 type 和 description
  const {
    id,
    type,
    name,
    points,
    category,
    limitType,
    limitMax,
    targetMembers,
    description,
  } = req.body;
  const targets =
    targetMembers && targetMembers.length > 0 ? targetMembers : null;
  try {
    if (type === 'task') {
      await pool.query(
        'UPDATE family_tasks SET title=$1, category=$2, points=$3, target_members=$4 WHERE id=$5',
        [name, category, points, targets, id]
      );
    } else {
      // 🟢 更新 family_rewards 包括 type 和 description
      await pool.query(
        'UPDATE family_rewards SET name=$1, cost=$2, limit_type=$3, limit_max=$4, target_members=$5, type=$6, description=$7 WHERE id=$8',
        [name, points, limitType, limitMax, targets, type, description || null, id]
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
    // 处理 auction 映射
    const table = type === 'task' ? 'family_tasks' : 'family_rewards';
    await pool.query(`DELETE FROM ${table} WHERE id=$1`, [id]);
    res.json({ code: 200, msg: '删除成功' });
  } catch (err) {
    res.status(500).json({ msg: '删除失败' });
  }
};

exports.revokeLog = async (req, res) => {
  const { logId, logIds } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 确定要删除的流水记录ID列表
    let targetLogIds = [];
    if (logIds && Array.isArray(logIds) && logIds.length > 0) {
      targetLogIds = logIds;
    } else if (logId) {
      targetLogIds = [logId];
    } else {
      throw new Error('参数不完整');
    }

    // 🔍 查询这些流水记录是否有关联的背包记录
    const backpackRes = await client.query(
      'SELECT id FROM family_backpack WHERE points_log_id = ANY($1)',
      [targetLogIds]
    );

    const backpackIds = backpackRes.rows.map(row => row.id);

    // 🗑️ 如果有关联的背包记录，先删除使用记录（如果存在）
    if (backpackIds.length > 0) {
      await client.query(
        'DELETE FROM family_backpack_usage_log WHERE backpack_id = ANY($1)',
        [backpackIds]
      );
    }

    // 🗑️ 删除相关的背包记录
    if (backpackIds.length > 0) {
      await client.query(
        'DELETE FROM family_backpack WHERE id = ANY($1)',
        [backpackIds]
      );
    }

    // 🗑️ 最后删除积分流水记录
    await client.query('DELETE FROM family_points_log WHERE id = ANY($1)', [
      targetLogIds,
    ]);

    await client.query('COMMIT');
    res.json({ code: 200, msg: '已撤销' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('revokeLog 错误:', err);
    res.status(500).json({ code: 500, msg: '撤销失败', error: err.message });
  } finally {
    client.release();
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
    console.error('createCategory 错误:', err);
    console.error('请求参数:', { name, userId, key });
    
    // 处理主键冲突错误（序列未同步）
    if (err.code === '23505' && err.constraint === 'family_categories_pkey') {
      console.error('⚠️ 检测到 family_categories 表序列未同步问题，请执行修复序列脚本.sql');
      return res.status(500).json({ 
        code: 500, 
        msg: '数据库序列未同步，请联系管理员执行修复序列脚本', 
        error: '主键冲突：序列值需要修复'
      });
    }
    
    res.status(500).json({ code: 500, msg: '添加失败', error: err.message });
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

// === 🎒 背包功能接口 ===

// 获取背包列表
exports.getBackpack = async (req, res) => {
  const { memberId, status } = req.query; // status: 'unused' / 'used' / 'all'
  try {
    if (!memberId) {
      return res.status(400).json({ code: 400, msg: '成员ID不能为空' });
    }

    let query = `
      SELECT 
        bp.*,
        r.name as reward_name,
        r.icon as reward_icon,
        r.type as reward_type,
        r.description as reward_description
      FROM family_backpack bp
      LEFT JOIN family_rewards r ON bp.reward_id = r.id
      WHERE bp.member_id = $1
    `;
    const params = [memberId];

    // 状态筛选
    if (status && status !== 'all') {
      query += ' AND bp.status = $2';
      params.push(status);
    }

    query += ' ORDER BY bp.obtained_at DESC';

    const result = await pool.query(query, params);

    // 统计信息
    const statsRes = await pool.query(
      `SELECT 
        COUNT(*) as total_items,
        SUM(CASE WHEN status = 'unused' THEN quantity ELSE 0 END) as unused_count,
        SUM(CASE WHEN status = 'used' THEN quantity ELSE 0 END) as used_count
      FROM family_backpack 
      WHERE member_id = $1`,
      [memberId]
    );

    const stats = statsRes.rows[0] || { total_items: 0, unused_count: 0, used_count: 0 };

    res.json({
      code: 200,
      data: {
        items: result.rows,
        stats: {
          total_items: parseInt(stats.total_items || 0),
          unused_count: parseInt(stats.unused_count || 0),
          used_count: parseInt(stats.used_count || 0),
        },
      },
    });
  } catch (err) {
    console.error('getBackpack 错误:', err);
    res.status(500).json({ code: 500, msg: '获取背包失败', error: err.message });
  }
};

// 使用背包物品
exports.useBackpackItem = async (req, res) => {
  const { backpackId, memberId, quantity } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (!backpackId || !memberId) {
      throw new Error('参数不完整');
    }

    const useQuantity = quantity || 1;

    // 查询背包物品
    const backpackRes = await client.query(
      'SELECT * FROM family_backpack WHERE id = $1 AND member_id = $2',
      [backpackId, memberId]
    );

    if (backpackRes.rows.length === 0) {
      throw new Error('背包物品不存在或不属于该成员');
    }

    const backpackItem = backpackRes.rows[0];

    if (backpackItem.status !== 'unused') {
      throw new Error('该物品已使用');
    }

    if (backpackItem.quantity < useQuantity) {
      throw new Error(`数量不足，当前数量：${backpackItem.quantity}`);
    }

    // 更新背包物品
    if (backpackItem.quantity === useQuantity) {
      // 如果全部使用，更新状态
      await client.query(
        'UPDATE family_backpack SET status=$1, used_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=$2',
        ['used', backpackId]
      );
    } else {
      // 如果部分使用，减少数量
      await client.query(
        'UPDATE family_backpack SET quantity=quantity-$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2',
        [useQuantity, backpackId]
      );
    }
    
    // 📝 记录使用历史
    await client.query(
      `INSERT INTO family_backpack_usage_log (backpack_id, member_id, reward_id, quantity, used_at) 
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [backpackId, memberId, backpackItem.reward_id, useQuantity]
    );

    await client.query('COMMIT');
    res.json({ code: 200, msg: '使用成功' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('useBackpackItem 错误:', err);
    res.json({ code: 400, msg: err.message });
  } finally {
    client.release();
  }
};

// 转赠背包物品
exports.transferBackpackItem = async (req, res) => {
  const { backpackId, fromMemberId, toMemberId, quantity } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (!backpackId || !fromMemberId || !toMemberId) {
      throw new Error('参数不完整');
    }

    if (fromMemberId === toMemberId) {
      throw new Error('不能转赠给自己');
    }

    const transferQuantity = quantity || 1;

    // 查询源背包物品
    const backpackRes = await client.query(
      'SELECT * FROM family_backpack WHERE id = $1 AND member_id = $2',
      [backpackId, fromMemberId]
    );

    if (backpackRes.rows.length === 0) {
      throw new Error('背包物品不存在或不属于该成员');
    }

    const backpackItem = backpackRes.rows[0];

    if (backpackItem.status !== 'unused') {
      throw new Error('只能转赠未使用的物品');
    }

    if (backpackItem.quantity < transferQuantity) {
      throw new Error(`数量不足，当前数量：${backpackItem.quantity}`);
    }

    // 验证目标成员是否存在（必须是同一家庭的成员）
    const fromMemberRes = await client.query(
      'SELECT parent_id FROM family_members WHERE id = $1',
      [fromMemberId]
    );
    const toMemberRes = await client.query(
      'SELECT parent_id FROM family_members WHERE id = $1',
      [toMemberId]
    );

    if (fromMemberRes.rows.length === 0 || toMemberRes.rows.length === 0) {
      throw new Error('成员不存在');
    }

    if (fromMemberRes.rows[0].parent_id !== toMemberRes.rows[0].parent_id) {
      throw new Error('只能转赠给同一家庭的成员');
    }

    // 更新源背包物品
    if (backpackItem.quantity === transferQuantity) {
      // 如果全部转赠，更新成员ID
      await client.query(
        'UPDATE family_backpack SET member_id=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2',
        [toMemberId, backpackId]
      );
    } else {
      // 如果部分转赠，减少源数量并创建目标记录
      await client.query(
        'UPDATE family_backpack SET quantity=quantity-$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2',
        [transferQuantity, backpackId]
      );
      
      // 检查目标成员是否已有相同物品
      const existingRes = await client.query(
        'SELECT id, quantity FROM family_backpack WHERE member_id=$1 AND reward_id=$2 AND status=$3',
        [toMemberId, backpackItem.reward_id, 'unused']
      );

      if (existingRes.rows.length > 0) {
        // 如果存在，增加数量
        await client.query(
          'UPDATE family_backpack SET quantity=quantity+$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2',
          [transferQuantity, existingRes.rows[0].id]
        );
      } else {
        // 如果不存在，创建新记录
        await client.query(
          `INSERT INTO family_backpack (member_id, reward_id, points_log_id, quantity, status, obtained_at) 
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
          [
            toMemberId,
            backpackItem.reward_id,
            backpackItem.points_log_id,
            transferQuantity,
            'unused',
          ]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ code: 200, msg: '转赠成功' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('transferBackpackItem 错误:', err);
    res.json({ code: 400, msg: err.message });
  } finally {
    client.release();
  }
};

// 获取使用记录
exports.getUsageHistory = async (req, res) => {
  const { memberId, rewardId, limit } = req.query;
  try {
    if (!memberId) {
      return res.status(400).json({ code: 400, msg: '成员ID不能为空' });
    }

    let query = `
      SELECT 
        ul.*,
        r.name as reward_name,
        r.icon as reward_icon,
        r.type as reward_type
      FROM family_backpack_usage_log ul
      LEFT JOIN family_rewards r ON ul.reward_id = r.id
      WHERE ul.member_id = $1
    `;
    const params = [memberId];

    // 如果指定了奖励ID，筛选特定奖励
    if (rewardId) {
      query += ' AND ul.reward_id = $2';
      params.push(rewardId);
    }

    query += ' ORDER BY ul.used_at DESC';

    // 限制返回数量
    if (limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(parseInt(limit) || 50);
    } else {
      query += ' LIMIT 50';
    }

    const result = await pool.query(query, params);

    res.json({
      code: 200,
      data: {
        history: result.rows,
        total: result.rows.length,
      },
    });
  } catch (err) {
    console.error('getUsageHistory 错误:', err);
    res.status(500).json({ code: 500, msg: '获取使用记录失败', error: err.message });
  }
};
