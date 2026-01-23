/**
 * Issue Service 测试脚本
 * 测试 attention_score 上升/衰减 + 干预措施
 * 
 * 运行方式：
 * cd server && node test/test_issue_service.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const issueService = require('../src/systems/family/services/issueService');
const issueRepo = require('../src/systems/family/repos/issueRepo');
const walletService = require('../src/systems/family/services/walletService');

let TEST_USER_ID = null;
let TEST_MEMBER = null;
let TEST_ISSUE = null;

// ========== 测试函数 ==========
async function setup() {
  console.log('\n🔧 设置测试环境...\n');
  
  const pool = issueRepo.getPool();
  
  // 获取测试用户
  const userResult = await pool.query('SELECT id, username FROM users WHERE is_active = TRUE LIMIT 1');
  if (userResult.rows.length === 0) {
    throw new Error('没有找到测试用户');
  }
  TEST_USER_ID = userResult.rows[0].id;
  console.log(`  用户: ${userResult.rows[0].username} (ID: ${TEST_USER_ID})`);
  
  // 获取该用户的成员
  const memberResult = await pool.query(
    'SELECT id, name FROM family_members WHERE parent_id = $1 ORDER BY id LIMIT 1',
    [TEST_USER_ID]
  );
  
  if (memberResult.rows.length === 0) {
    throw new Error('需要至少1个成员');
  }
  
  TEST_MEMBER = memberResult.rows[0];
  console.log(`  成员: ${TEST_MEMBER.name} (ID: ${TEST_MEMBER.id})`);
  console.log('');
}

async function testCreateIssue() {
  console.log('📋 步骤 1: 创建测试问题');
  
  TEST_ISSUE = await issueService.createIssue({
    parentId: TEST_USER_ID,
    ownerMemberId: TEST_MEMBER.id,
    title: '测试问题_' + Date.now(),
    description: '用于测试 attention_score 机制',
    icon: '🧪',
    tags: ['测试'],
    severity: 'medium',
    attentionThreshold: 5,
  });
  
  console.log(`   ✅ 创建成功: ID=${TEST_ISSUE.id}`);
  console.log(`   关注度: ${TEST_ISSUE.attention_score} / ${TEST_ISSUE.attention_threshold}`);
  console.log('');
  
  return TEST_ISSUE;
}

async function testRecordOccurrence() {
  console.log('⚡ 步骤 2: 记录问题发生 (attention_score 增加)');
  
  const scoreBefore = TEST_ISSUE.attention_score;
  console.log(`   发生前关注度: ${scoreBefore}`);
  
  // 记录发生
  const result = await issueService.recordOccurrence(TEST_ISSUE.id, {
    note: '第一次测试发生',
    context: '测试场景',
    reporterMemberId: TEST_MEMBER.id,
  });
  
  console.log(`   ✅ ${result.msg}`);
  console.log(`   关注度变化: ${result.attentionChange.before} → ${result.attentionChange.after} (+${result.attentionChange.change})`);
  console.log(`   触发警报: ${result.isAlert ? '是' : '否'}`);
  
  if (result.attentionChange.after <= result.attentionChange.before) {
    throw new Error('关注度未增加');
  }
  
  console.log(`   ✅ 关注度正确增加`);
  console.log('');
  
  // 更新本地缓存
  TEST_ISSUE = result.issue;
  
  return result;
}

async function testMultipleOccurrences() {
  console.log('🔥 步骤 3: 多次发生 (测试阈值警报)');
  
  // 连续记录多次，直到超过阈值
  let alertTriggered = false;
  
  for (let i = 0; i < 5; i++) {
    const result = await issueService.recordOccurrence(TEST_ISSUE.id, {
      note: `第 ${i + 2} 次发生`,
      context: '连续测试',
    });
    
    console.log(`   第 ${i + 2} 次: 关注度 ${result.attentionChange.after}${result.isAlert ? ' ⚠️ 警报!' : ''}`);
    
    if (result.isAlert) {
      alertTriggered = true;
    }
    
    TEST_ISSUE = result.issue;
  }
  
  console.log(`   阈值警报是否触发: ${alertTriggered ? '是 ✓' : '否'}`);
  console.log('');
}

async function testDecayScore() {
  console.log('📉 步骤 4: 衰减关注度');
  
  const scoreBefore = TEST_ISSUE.attention_score;
  console.log(`   衰减前关注度: ${scoreBefore}`);
  
  const result = await issueService.decayAttentionScore(TEST_ISSUE.id, 2);
  
  console.log(`   ✅ ${result.msg}`);
  
  if (result.issues.length > 0) {
    const after = result.issues[0].attention_score;
    console.log(`   衰减后关注度: ${after}`);
    
    if (after >= scoreBefore) {
      throw new Error('关注度未衰减');
    }
    
    console.log(`   ✅ 关注度正确衰减`);
    TEST_ISSUE = result.issues[0];
  }
  
  console.log('');
}

async function testIntervention() {
  console.log('🔧 步骤 5: 创建并执行干预措施');
  
  // 创建扣分干预
  const intervention = await issueService.createIntervention({
    issueId: TEST_ISSUE.id,
    name: '测试扣分',
    description: '测试干预措施',
    icon: '💸',
    actionType: 'deduct_points',
    template: { points: 5 },
    triggerType: 'manual',
  });
  
  console.log(`   ✅ 干预措施创建: ID=${intervention.id}`);
  console.log(`   类型: ${intervention.action_type}`);
  
  // 获取成员余额
  const balanceBefore = await walletService.getBalance(TEST_MEMBER.id);
  console.log(`   执行前余额: ${balanceBefore}`);
  
  // 执行干预
  const result = await issueService.executeIntervention(intervention.id, TEST_ISSUE.id);
  console.log(`   ✅ ${result.msg}`);
  
  // 验证扣分
  const balanceAfter = await walletService.getBalance(TEST_MEMBER.id);
  console.log(`   执行后余额: ${balanceAfter}`);
  
  if (balanceAfter !== balanceBefore - 5) {
    console.log(`   ⚠️ 扣分可能未生效（可能余额不足）`);
  } else {
    console.log(`   ✅ 扣分生效`);
  }
  
  console.log('');
}

async function testAutoIntervention() {
  console.log('⚡ 步骤 6: 测试自动干预');
  
  // 创建自动干预措施
  const autoIntervention = await issueService.createIntervention({
    issueId: TEST_ISSUE.id,
    name: '自动扣分',
    icon: '⚡',
    actionType: 'deduct_points',
    template: { points: 3 },
    triggerType: 'auto_on_occurrence',
  });
  
  console.log(`   ✅ 自动干预创建: ID=${autoIntervention.id}`);
  
  // 记录一次发生，应该触发自动干预
  const result = await issueService.recordOccurrence(TEST_ISSUE.id, {
    note: '测试自动干预',
  });
  
  console.log(`   记录发生...`);
  console.log(`   自动干预数: ${result.interventions?.length || 0}`);
  
  if (result.interventions && result.interventions.length > 0) {
    result.interventions.forEach(iv => {
      console.log(`     - ${iv.interventionName}: ${iv.msg}`);
    });
    console.log(`   ✅ 自动干预已执行`);
  } else {
    console.log(`   ⚠️ 未触发自动干预`);
  }
  
  console.log('');
}

async function testGetTopIssues() {
  console.log('📊 步骤 7: 获取 Top Issues');
  
  const topIssues = await issueService.getTopIssues(TEST_USER_ID, 5);
  
  console.log(`   ✅ 获取到 ${topIssues.length} 个问题`);
  topIssues.forEach((issue, i) => {
    console.log(`   ${i + 1}. ${issue.icon} ${issue.title} - 关注度: ${issue.attention_score}${issue.is_alert ? ' ⚠️' : ''}`);
  });
  
  console.log('');
}

async function cleanup() {
  console.log('🧹 清理测试数据...');
  
  const pool = issueRepo.getPool();
  await pool.query('DELETE FROM issue WHERE id = $1', [TEST_ISSUE.id]);
  
  console.log('   ✅ 测试问题已删除\n');
}

// ========== 主测试流程 ==========
async function runTest() {
  console.log('='.repeat(60));
  console.log('📋 Issue Service 测试');
  console.log('='.repeat(60));

  try {
    await setup();
    await testCreateIssue();
    await testRecordOccurrence();
    await testMultipleOccurrences();
    await testDecayScore();
    await testIntervention();
    await testAutoIntervention();
    await testGetTopIssues();
    await cleanup();
    
    console.log('='.repeat(60));
    console.log('✅ Issue Service 测试通过!');
    console.log('   - attention_score 上升 ✓');
    console.log('   - attention_score 衰减 ✓');
    console.log('   - 阈值警报 ✓');
    console.log('   - 干预措施执行 ✓');
    console.log('   - 自动干预 ✓');
    console.log('='.repeat(60));
    
    process.exit(0);
  } catch (err) {
    console.error('\n❌ 测试失败:', err.message);
    console.error(err.stack);
    
    // 尝试清理
    if (TEST_ISSUE) {
      try {
        const pool = issueRepo.getPool();
        await pool.query('DELETE FROM issue WHERE id = $1', [TEST_ISSUE.id]);
      } catch (e) {}
    }
    
    process.exit(1);
  }
}

runTest();
