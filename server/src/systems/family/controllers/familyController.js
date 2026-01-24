const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { fixSequenceAsync } = require('../../../shared/utils/sequenceFixer');
const familyService = require('../services/familyService');

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
    await familyService.createMember(userId, name, avatar);
    res.json({ code: 200, msg: '添加成员成功' });
  } catch (err) {
    console.error('createMember 错误:', err);
    
    // 处理主键冲突错误（序列未同步）
    if (err.code === '23505' && err.constraint === 'family_members_pkey') {
      try {
        const fixed = await fixSequenceAsync('family_members');
        if (fixed) {
          return res.status(500).json({ 
            code: 500, 
            msg: '序列已自动修复，请重试操作', 
            error: '序列已修复，请重试',
            autoFixed: true
          });
        }
      } catch (fixError) {
        console.error('自动修复序列失败:', fixError);
      }
      
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
  const avatar = req.file ? `/uploads/${req.file.filename}` : null;
  
  try {
    await familyService.updateMember(id, name, avatar);
    res.json({ code: 200, msg: '更新成功' });
  } catch (err) {
    console.error('updateMember 错误:', err);
    res.status(500).json({ msg: '更新失败' });
  }
};

exports.deleteMember = async (req, res) => {
  const { id } = req.body;
  
  if (!id) {
    return res.status(400).json({ code: 400, msg: '成员ID不能为空' });
  }
  
  try {
    await familyService.deleteMember(id);
    res.json({ code: 200, msg: '已删除成员' });
  } catch (err) {
    console.error('deleteMember 错误:', err);
    res.status(500).json({ msg: '删除失败' });
  }
};

// === 📋 业务接口 ===

exports.getInitData = async (req, res) => {
  const userId = req.session.user.id;
  try {
    const data = await familyService.getInitData(userId);
    res.json({ code: 200, data });
  } catch (err) {
    console.error('getInitData 错误:', err);
    res.status(500).json({ msg: '初始化失败' });
  }
};

exports.getMemberDashboard = async (req, res) => {
  const { memberId, month } = req.query;
  
  if (!memberId) {
    return res.status(400).json({ code: 400, msg: '成员ID不能为空' });
  }
  
  try {
    const data = await familyService.getMemberDashboard(memberId, month);
    res.json({ code: 200, data });
  } catch (err) {
    console.error('getMemberDashboard 错误:', err);
    res.status(500).json({ msg: '获取面板失败' });
  }
};

exports.logAction = async (req, res) => {
  const { memberId, taskId, customTitle, points, reasonCode } = req.body;
  
  if (!memberId) {
    return res.status(400).json({ code: 400, msg: '成员ID不能为空' });
  }
  if (points === undefined || points === null) {
    return res.status(400).json({ code: 400, msg: '积分值不能为空' });
  }

  try {
    await familyService.logAction({ memberId, taskId, customTitle, points, reasonCode });
    res.json({ code: 200, msg: '记录成功' });
  } catch (err) {
    console.error('logAction 错误:', err);
    
    if (err.code === '23505' && err.constraint === 'family_points_log_pkey') {
      try {
        const fixed = await fixSequenceAsync('family_points_log');
        if (fixed) {
          return res.status(500).json({ 
            code: 500, 
            msg: '序列已自动修复，请重试操作', 
            error: '序列已修复，请重试',
            autoFixed: true
          });
        }
      } catch (fixError) {
        console.error('自动修复序列失败:', fixError);
      }
      
      return res.status(500).json({ 
        code: 500, 
        msg: '数据库序列未同步，请联系管理员执行修复序列脚本', 
        error: '主键冲突：序列值需要修复'
      });
    }
    
    res.status(500).json({ code: 500, msg: '操作失败', error: err.message });
  }
};

exports.redeemReward = async (req, res) => {
  const { memberId, rewardId } = req.body;
  
  if (!memberId || !rewardId) {
    return res.status(400).json({ code: 400, msg: '参数不完整' });
  }
  
  try {
    const result = await familyService.redeemReward(memberId, rewardId);
    res.json({ code: 200, msg: result.msg });
  } catch (err) {
    console.error('redeemReward 错误:', err);
    res.json({ code: 400, msg: err.message });
  }
};

// 🟢 竞拍结算接口
exports.settleAuction = async (req, res) => {
  const { auctionId, memberId, bidPoints } = req.body;
  
  if (!auctionId || !memberId || bidPoints === undefined) {
    return res.status(400).json({ code: 400, msg: '参数不完整' });
  }
  
  try {
    const result = await familyService.settleAuction(memberId, auctionId, bidPoints);
    res.json({ code: 200, msg: result.msg });
  } catch (err) {
    console.error('settleAuction 错误:', err);
    res.json({ code: 400, msg: err.message });
  }
};

// === 📝 任务/奖励管理 ===

exports.createItem = async (req, res) => {
  const { type, name, points, category, limitType, limitMax, targetMembers, description } = req.body;
  const userId = req.session.user.id;
  
  try {
    await familyService.createItem(userId, { type, name, points, category, limitType, limitMax, targetMembers, description });
    res.json({ code: 200, msg: '创建成功' });
  } catch (err) {
    console.error('createItem 错误:', err);
    
    if (err.code === '23505') {
      const tableName = type === 'task' ? 'family_tasks' : 'family_rewards';
      try {
        const fixed = await fixSequenceAsync(tableName);
        if (fixed) {
          return res.status(500).json({ 
            code: 500, 
            msg: '序列已自动修复，请重试操作', 
            error: '序列已修复，请重试',
            autoFixed: true
          });
        }
      } catch (fixError) {
        console.error('自动修复序列失败:', fixError);
      }
      
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
  const { id, type, name, points, category, limitType, limitMax, targetMembers, description } = req.body;
  
  try {
    await familyService.updateItem({ id, type, name, points, category, limitType, limitMax, targetMembers, description });
    res.json({ code: 200, msg: '更新成功' });
  } catch (err) {
    console.error('updateItem 错误:', err);
    res.status(500).json({ msg: '更新失败' });
  }
};

exports.deleteItem = async (req, res) => {
  const { id, type } = req.body;
  
  try {
    await familyService.deleteItem(id, type);
    res.json({ code: 200, msg: '删除成功' });
  } catch (err) {
    console.error('deleteItem 错误:', err);
    res.status(500).json({ msg: '删除失败' });
  }
};

// === 📂 分类管理 ===

exports.createCategory = async (req, res) => {
  const { name } = req.body;
  const userId = req.session.user.id;
  
  try {
    await familyService.createCategory(userId, name);
    res.json({ code: 200, msg: '添加成功' });
  } catch (err) {
    console.error('createCategory 错误:', err);
    
    if (err.code === '23505' && err.constraint === 'family_categories_pkey') {
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
    await familyService.deleteCategory(id);
    res.json({ code: 200, msg: '删除成功' });
  } catch (err) {
    console.error('deleteCategory 错误:', err);
    res.status(500).json({ msg: '删除失败' });
  }
};

// === 🔄 撤销流水 ===

exports.revokeLog = async (req, res) => {
  const { logId, logIds } = req.body;
  
  // 确定要删除的流水记录ID列表
  let targetLogIds = [];
  if (logIds && Array.isArray(logIds) && logIds.length > 0) {
    targetLogIds = logIds;
  } else if (logId) {
    targetLogIds = [logId];
  } else {
    return res.status(400).json({ code: 400, msg: '参数不完整' });
  }
  
  try {
    await familyService.revokeLog(targetLogIds);
    res.json({ code: 200, msg: '已撤销' });
  } catch (err) {
    console.error('revokeLog 错误:', err);
    res.status(500).json({ code: 500, msg: '撤销失败', error: err.message });
  }
};

// === 🎒 背包功能接口 ===

exports.getBackpack = async (req, res) => {
  const { memberId, status } = req.query;
  
  if (!memberId) {
    return res.status(400).json({ code: 400, msg: '成员ID不能为空' });
  }
  
  try {
    const data = await familyService.getBackpack(memberId, status);
    res.json({ code: 200, data });
  } catch (err) {
    console.error('getBackpack 错误:', err);
    res.status(500).json({ code: 500, msg: '获取背包失败', error: err.message });
  }
};

exports.useBackpackItem = async (req, res) => {
  const { backpackId, memberId, quantity } = req.body;
  
  if (!backpackId || !memberId) {
    return res.status(400).json({ code: 400, msg: '参数不完整' });
  }
  
  try {
    const result = await familyService.useBackpackItem(memberId, backpackId, quantity || 1);
    res.json({ code: 200, msg: result.msg });
  } catch (err) {
    console.error('useBackpackItem 错误:', err);
    res.json({ code: 400, msg: err.message });
  }
};

exports.transferBackpackItem = async (req, res) => {
  const { backpackId, fromMemberId, toMemberId, quantity } = req.body;
  
  if (!backpackId || !fromMemberId || !toMemberId) {
    return res.status(400).json({ code: 400, msg: '参数不完整' });
  }
  
  if (fromMemberId === toMemberId) {
    return res.status(400).json({ code: 400, msg: '不能转赠给自己' });
  }
  
  try {
    const result = await familyService.transferBackpackItem(backpackId, fromMemberId, toMemberId, quantity || 1);
    res.json({ code: 200, msg: result.msg });
  } catch (err) {
    console.error('transferBackpackItem 错误:', err);
    res.json({ code: 400, msg: err.message });
  }
};

exports.getUsageHistory = async (req, res) => {
  const { memberId, rewardId, limit } = req.query;
  
  if (!memberId) {
    return res.status(400).json({ code: 400, msg: '成员ID不能为空' });
  }
  
  try {
    const data = await familyService.getUsageHistory(memberId, rewardId, limit);
    res.json({ code: 200, data });
  } catch (err) {
    console.error('getUsageHistory 错误:', err);
    res.status(500).json({ code: 500, msg: '获取使用记录失败', error: err.message });
  }
};
