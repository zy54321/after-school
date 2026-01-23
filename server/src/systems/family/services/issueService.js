/**
 * Issue Service Layer
 * Issue Tracker 业务逻辑层
 * 
 * 核心功能：
 * - recordOccurrence(): 记录问题发生 + attention_score 增加
 * - decayAttentionScore(): 关注度衰减
 * - executeIntervention(): 执行干预措施（可生成 bounty_task）
 */
const issueRepo = require('../repos/issueRepo');
const bountyRepo = require('../repos/bountyRepo');
const walletRepo = require('../repos/walletRepo');

/**
 * 关注度配置
 */
const ATTENTION_CONFIG = {
  // 每次发生增加的基础分数
  baseOccurrenceScore: 1,
  
  // 根据严重程度的加成系数
  severityMultiplier: {
    low: 0.5,
    medium: 1,
    high: 2,
    critical: 3,
  },
  
  // 每日衰减量
  dailyDecay: 1,
  
  // 连续无发生天数奖励
  streakBonusThreshold: 7,  // 7天连续无发生
  streakBonusDecay: 2,      // 额外衰减2点
};

/**
 * 记录问题发生 (事务)
 * 
 * 流程：
 * 1. 创建发生记录
 * 2. 更新 attention_score (+K)
 * 3. 记录关注度事件
 * 4. 检查并执行自动干预
 * 
 * @param {number} issueId - 问题ID
 * @param {object} occurrenceData - 发生数据
 * @returns {object} 结果
 */
exports.recordOccurrence = async (issueId, occurrenceData) => {
  const pool = issueRepo.getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. 获取问题信息
    const issue = await issueRepo.getIssueById(issueId, client);
    if (!issue) {
      throw new Error('问题不存在');
    }
    
    // 2. 创建发生记录
    const occurrence = await issueRepo.createOccurrence({
      issueId,
      occurredAt: occurrenceData.occurredAt || new Date(),
      note: occurrenceData.note,
      context: occurrenceData.context,
      reporterMemberId: occurrenceData.reporterMemberId,
    }, client);
    
    // 3. 计算关注度增量
    const multiplier = ATTENTION_CONFIG.severityMultiplier[issue.severity] || 1;
    const scoreIncrease = Math.ceil(ATTENTION_CONFIG.baseOccurrenceScore * multiplier);
    const scoreBefore = issue.attention_score;
    
    // 4. 更新关注度
    const updatedIssue = await issueRepo.updateAttentionScore(issueId, scoreIncrease, client);
    const scoreAfter = updatedIssue.attention_score;
    
    // 5. 记录关注度事件
    await issueRepo.createAttentionEvent({
      issueId,
      eventType: 'occurrence',
      scoreChange: scoreIncrease,
      scoreBefore,
      scoreAfter,
      note: occurrenceData.note || '问题发生',
      relatedOccurrenceId: occurrence.id,
    }, client);
    
    // 6. 检查并执行自动干预
    const interventionResults = [];
    const interventions = await issueRepo.getInterventionsByIssueId(issueId, 'active', client);
    
    for (const intervention of interventions) {
      if (intervention.trigger_type === 'auto_on_occurrence') {
        const result = await executeInterventionInternal(intervention, issue, occurrence, client);
        if (result) {
          interventionResults.push(result);
          
          // 更新发生记录的干预信息
          await client.query(
            `UPDATE issue_occurrence SET auto_intervention_id = $1, points_deducted = $2 WHERE id = $3`,
            [intervention.id, result.pointsDeducted || 0, occurrence.id]
          );
        }
      }
      
      // 检查阈值触发
      if (intervention.trigger_type === 'threshold') {
        const config = intervention.trigger_config || {};
        if (config.min_occurrences && updatedIssue.occurrence_count >= config.min_occurrences) {
          // 检查冷却时间
          if (!intervention.last_executed_at || 
              (Date.now() - new Date(intervention.last_executed_at).getTime()) > (config.cooldown_hours || 24) * 3600000) {
            const result = await executeInterventionInternal(intervention, issue, occurrence, client);
            if (result) {
              interventionResults.push(result);
            }
          }
        }
      }
    }
    
    // 7. 检查是否触发警报（超过阈值）
    const isAlert = scoreAfter >= issue.attention_threshold;
    
    await client.query('COMMIT');
    
    return {
      success: true,
      msg: `问题发生已记录，关注度 ${scoreBefore} → ${scoreAfter}`,
      occurrence,
      issue: updatedIssue,
      attentionChange: {
        before: scoreBefore,
        after: scoreAfter,
        change: scoreIncrease,
      },
      isAlert,
      interventions: interventionResults,
    };
    
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * 衰减问题关注度
 * 
 * @param {number} issueId - 问题ID（可选，不传则衰减所有）
 * @param {number} decayAmount - 衰减量
 * @returns {object} 结果
 */
exports.decayAttentionScore = async (issueId, decayAmount = ATTENTION_CONFIG.dailyDecay) => {
  const pool = issueRepo.getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    if (issueId) {
      // 衰减单个问题
      const issue = await issueRepo.getIssueById(issueId, client);
      if (!issue) {
        throw new Error('问题不存在');
      }
      
      const scoreBefore = issue.attention_score;
      if (scoreBefore <= 0) {
        await client.query('COMMIT');
        return { success: true, msg: '关注度已为0，无需衰减', issues: [] };
      }
      
      const updatedIssue = await issueRepo.updateAttentionScore(issueId, -decayAmount, client);
      
      // 记录事件
      await issueRepo.createAttentionEvent({
        issueId,
        eventType: 'decay',
        scoreChange: -decayAmount,
        scoreBefore,
        scoreAfter: updatedIssue.attention_score,
        note: '自然衰减',
      }, client);
      
      // 检查并增加连续天数
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const lastOccurred = issue.last_occurred_at ? new Date(issue.last_occurred_at) : null;
      
      if (!lastOccurred || lastOccurred < today) {
        await issueRepo.incrementStreakDays(issueId, client);
      }
      
      await client.query('COMMIT');
      
      return {
        success: true,
        msg: `关注度衰减: ${scoreBefore} → ${updatedIssue.attention_score}`,
        issues: [updatedIssue],
      };
      
    } else {
      // 获取所有活跃问题的 parentId
      const result = await client.query('SELECT DISTINCT parent_id FROM issue WHERE status IN ($1, $2)', ['active', 'monitoring']);
      const parentIds = result.rows.map(r => r.parent_id);
      
      const allDecayed = [];
      
      for (const parentId of parentIds) {
        const decayed = await issueRepo.decayAllAttentionScores(parentId, decayAmount, client);
        allDecayed.push(...decayed);
        
        // 为每个衰减的问题记录事件
        for (const issue of decayed) {
          await issueRepo.createAttentionEvent({
            issueId: issue.id,
            eventType: 'decay',
            scoreChange: -decayAmount,
            scoreBefore: issue.attention_score + decayAmount,
            scoreAfter: issue.attention_score,
            note: '每日自然衰减',
          }, client);
        }
      }
      
      await client.query('COMMIT');
      
      return {
        success: true,
        msg: `已衰减 ${allDecayed.length} 个问题的关注度`,
        issues: allDecayed,
      };
    }
    
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * 执行干预措施
 * 
 * @param {number} interventionId - 干预措施ID
 * @param {number} issueId - 问题ID
 * @returns {object} 执行结果
 */
exports.executeIntervention = async (interventionId, issueId) => {
  const pool = issueRepo.getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const intervention = await issueRepo.getInterventionById(interventionId, client);
    if (!intervention) {
      throw new Error('干预措施不存在');
    }
    
    const issue = await issueRepo.getIssueById(issueId, client);
    if (!issue) {
      throw new Error('问题不存在');
    }
    
    const result = await executeInterventionInternal(intervention, issue, null, client);
    
    await client.query('COMMIT');
    
    return {
      success: true,
      msg: result.msg,
      ...result,
    };
    
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * 创建问题
 */
exports.createIssue = async (issueData) => {
  return await issueRepo.createIssue(issueData);
};

/**
 * 获取问题详情
 */
exports.getIssueDetail = async (issueId) => {
  const issue = await issueRepo.getIssueById(issueId);
  if (!issue) {
    throw new Error('问题不存在');
  }
  
  const occurrences = await issueRepo.getOccurrencesByIssueId(issueId, 10);
  const interventions = await issueRepo.getInterventionsByIssueId(issueId);
  const attentionEvents = await issueRepo.getAttentionEventsByIssueId(issueId, 20);
  
  return {
    issue,
    occurrences,
    interventions,
    attentionEvents,
  };
};

/**
 * 获取 Top Issues
 */
exports.getTopIssues = async (parentId, limit = 10) => {
  return await issueRepo.getTopIssues(parentId, limit);
};

/**
 * 获取成员的问题
 */
exports.getMemberIssues = async (memberId, status = null) => {
  return await issueRepo.getIssuesByMemberId(memberId, status);
};

/**
 * 获取用户的所有问题
 */
exports.getAllIssues = async (parentId, status = null) => {
  return await issueRepo.getIssuesByParentId(parentId, status);
};

/**
 * 获取最近的发生记录
 */
exports.getRecentOccurrences = async (parentId, limit = 20) => {
  return await issueRepo.getRecentOccurrences(parentId, limit);
};

/**
 * 创建干预措施
 */
exports.createIntervention = async (interventionData) => {
  return await issueRepo.createIntervention(interventionData);
};

/**
 * 更新问题状态
 */
exports.updateIssueStatus = async (issueId, status) => {
  return await issueRepo.updateIssueStatus(issueId, status);
};

// ========== 内部辅助函数 ==========

/**
 * 执行干预措施（内部）
 */
async function executeInterventionInternal(intervention, issue, occurrence, client) {
  const template = intervention.template || {};
  let result = {
    interventionId: intervention.id,
    interventionName: intervention.name,
    actionType: intervention.action_type,
  };
  
  switch (intervention.action_type) {
    case 'deduct_points':
      // 扣积分
      const points = template.points || 10;
      
      await walletRepo.createPointsLog({
        memberId: issue.owner_member_id,
        parentId: issue.parent_id,
        description: `问题惩罚: ${issue.title}`,
        pointsChange: -points,
        reasonCode: 'issue_penalty',
        idempotencyKey: `issue_penalty_${issue.id}_${occurrence?.id || Date.now()}`,
      }, client);
      
      result.msg = `扣除 ${points} 积分`;
      result.pointsDeducted = points;
      break;
      
    case 'create_task':
      // 创建悬赏任务
      const taskTitle = template.task_title || `改正问题: ${issue.title}`;
      const bounty = template.bounty || 20;
      
      // 检查余额
      const balance = await walletRepo.getBalance(issue.owner_member_id, client);
      
      if (balance >= bounty) {
        // 由家长（parent）发布任务给孩子
        const task = await bountyRepo.createTask({
          parentId: issue.parent_id,
          publisherMemberId: issue.owner_member_id, // 实际应该是家长的 member_id，这里简化
          title: taskTitle,
          description: template.task_description || `针对「${issue.title}」的改正任务`,
          bountyPoints: bounty,
          escrowPoints: 0, // 不托管，由系统奖励
          dueAt: template.due_days ? new Date(Date.now() + template.due_days * 86400000) : null,
          status: 'open',
          issueId: issue.id,
        }, client);
        
        result.msg = `创建悬赏任务: ${taskTitle} (${bounty}积分)`;
        result.taskId = task.id;
      } else {
        result.msg = `积分不足，无法创建任务`;
        result.skipped = true;
      }
      break;
      
    case 'send_reminder':
      // 发送提醒（简化：仅记录）
      result.msg = `发送提醒: ${template.message || '请注意改正'}`;
      break;
      
    case 'lock_reward':
      // 锁定奖励（简化：仅记录）
      result.msg = `锁定奖励: ${template.reward_name || '待定'}`;
      break;
      
    default:
      result.msg = `执行自定义干预`;
  }
  
  // 更新执行记录
  await issueRepo.updateInterventionExecution(intervention.id, client);
  
  // 记录关注度事件
  await issueRepo.createAttentionEvent({
    issueId: issue.id,
    eventType: 'intervention',
    scoreChange: 0,
    scoreBefore: issue.attention_score,
    scoreAfter: issue.attention_score,
    note: result.msg,
    relatedOccurrenceId: occurrence?.id,
    relatedInterventionId: intervention.id,
  }, client);
  
  return result;
}
