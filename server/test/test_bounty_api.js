/**
 * 悬赏任务 API 测试脚本
 * 测试完整流程：发布 → 领取 → 提交 → 审核 → 奖励发放
 * 
 * 运行方式：
 * cd server && node test/test_bounty_api.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const bountyService = require('../src/systems/family/services/bountyService');
const bountyRepo = require('../src/systems/family/repos/bountyRepo');
const walletService = require('../src/systems/family/services/walletService');
const walletRepo = require('../src/systems/family/repos/walletRepo');

let TEST_USER_ID = null;
let TEST_MEMBERS = [];
let TEST_TASK = null;
let TEST_CLAIM = null;

// ========== 测试函数 ==========
async function setup() {
  console.log('\n🔧 设置测试环境...\n');
  
  const pool = bountyRepo.getPool();
  
  // 获取测试用户
  const userResult = await pool.query('SELECT id, username FROM users WHERE is_active = TRUE LIMIT 1');
  if (userResult.rows.length === 0) {
    throw new Error('没有找到测试用户');
  }
  TEST_USER_ID = userResult.rows[0].id;
  console.log(`  用户: ${userResult.rows[0].username} (ID: ${TEST_USER_ID})`);
  
  // 获取该用户的成员
  const memberResult = await pool.query(
    'SELECT id, name FROM family_members WHERE parent_id = $1 ORDER BY id LIMIT 2',
    [TEST_USER_ID]
  );
  
  if (memberResult.rows.length < 2) {
    throw new Error('需要至少2个成员');
  }
  
  TEST_MEMBERS = memberResult.rows;
  console.log(`  发布者: ${TEST_MEMBERS[0].name} (ID: ${TEST_MEMBERS[0].id})`);
  console.log(`  领取者: ${TEST_MEMBERS[1].name} (ID: ${TEST_MEMBERS[1].id})`);
  
  // 确保成员有足够积分
  for (const member of TEST_MEMBERS) {
    const balance = await walletService.getBalance(member.id);
    console.log(`  ${member.name} 余额: ${balance} 积分`);
    
    if (balance < 100) {
      await walletRepo.createPointsLog({
        memberId: member.id,
        parentId: TEST_USER_ID,
        description: 'API测试积分充值',
        pointsChange: 200,
        reasonCode: 'manual',
      });
      console.log(`    -> 充值 200 积分`);
    }
  }
  console.log('');
}

async function testFullFlow() {
  const publisher = TEST_MEMBERS[0];
  const claimer = TEST_MEMBERS[1];
  
  // ========== 1. 发布任务 ==========
  console.log('📝 步骤 1: 发布悬赏任务');
  
  const publisherBalanceBefore = await walletService.getBalance(publisher.id);
  console.log(`   发布者余额 (前): ${publisherBalanceBefore}`);
  
  const bountyPoints = 40;
  const publishResult = await bountyService.publishTask({
    parentId: TEST_USER_ID,
    publisherMemberId: publisher.id,
    title: 'API测试任务 - ' + Date.now(),
    description: '这是一个完整流程测试任务',
    bountyPoints,
    dueAt: new Date(Date.now() + 86400000 * 3),
    acceptCriteria: '完成测试步骤',
  });
  
  TEST_TASK = publishResult.task;
  console.log(`   ✅ 任务发布成功: ID=${TEST_TASK.id}`);
  
  const publisherBalanceAfter = await walletService.getBalance(publisher.id);
  console.log(`   发布者余额 (后): ${publisherBalanceAfter} (托管 -${bountyPoints})`);
  
  if (publisherBalanceBefore - publisherBalanceAfter !== bountyPoints) {
    throw new Error('托管扣分不正确');
  }
  console.log(`   ✅ 托管扣分正确\n`);
  
  // ========== 2. 领取任务 ==========
  console.log('🙋 步骤 2: 领取任务');
  
  const claimResult = await bountyService.claimTask(TEST_TASK.id, claimer.id);
  TEST_CLAIM = claimResult.claim;
  console.log(`   ✅ 领取成功: 领取ID=${TEST_CLAIM.id}`);
  
  const taskAfterClaim = await bountyService.getTaskDetail(TEST_TASK.id);
  console.log(`   任务状态: ${taskAfterClaim.status}`);
  
  if (taskAfterClaim.status !== 'claimed') {
    throw new Error('任务状态应为 claimed');
  }
  console.log(`   ✅ 状态正确\n`);
  
  // ========== 3. 提交任务 ==========
  console.log('📤 步骤 3: 提交任务');
  
  const submitResult = await bountyService.submitTask(TEST_CLAIM.id, '已完成所有测试步骤！');
  console.log(`   ✅ ${submitResult.msg}`);
  
  const taskAfterSubmit = await bountyService.getTaskDetail(TEST_TASK.id);
  console.log(`   任务状态: ${taskAfterSubmit.status}`);
  
  if (taskAfterSubmit.status !== 'submitted') {
    throw new Error('任务状态应为 submitted');
  }
  console.log(`   ✅ 状态正确\n`);
  
  // ========== 4. 审核通过 ==========
  console.log('✅ 步骤 4: 审核通过');
  
  const claimerBalanceBefore = await walletService.getBalance(claimer.id);
  console.log(`   领取者余额 (前): ${claimerBalanceBefore}`);
  
  const reviewResult = await bountyService.reviewTask(
    TEST_TASK.id,
    publisher.id,
    'approved',
    '完成得很好！'
  );
  
  console.log(`   ✅ ${reviewResult.msg}`);
  
  const claimerBalanceAfter = await walletService.getBalance(claimer.id);
  console.log(`   领取者余额 (后): ${claimerBalanceAfter} (+${claimerBalanceAfter - claimerBalanceBefore})`);
  
  if (claimerBalanceAfter - claimerBalanceBefore !== bountyPoints) {
    throw new Error('奖励发放不正确');
  }
  console.log(`   ✅ 奖励发放正确\n`);
  
  // ========== 5. 验证最终状态 ==========
  console.log('🔍 步骤 5: 验证最终状态');
  
  const finalTask = await bountyService.getTaskDetail(TEST_TASK.id);
  console.log(`   任务状态: ${finalTask.status}`);
  console.log(`   托管积分: ${finalTask.escrow_points}`);
  
  if (finalTask.status !== 'approved') {
    throw new Error('最终状态应为 approved');
  }
  if (finalTask.escrow_points !== 0) {
    throw new Error('托管积分应为 0');
  }
  console.log(`   ✅ 最终状态正确\n`);
  
  // ========== 6. 验证订单和流水 ==========
  console.log('📊 步骤 6: 验证订单和流水');
  
  const pool = bountyRepo.getPool();
  
  const orderResult = await pool.query(`
    SELECT * FROM family_market_order 
    WHERE idempotency_key LIKE 'bounty_%' AND idempotency_key LIKE '%${TEST_TASK.id}%'
    ORDER BY created_at
  `);
  
  console.log(`   订单记录: ${orderResult.rows.length} 条`);
  orderResult.rows.forEach(o => {
    console.log(`     - ${o.sku_name}`);
  });
  
  const logResult = await pool.query(`
    SELECT * FROM family_points_log 
    WHERE idempotency_key LIKE '%bounty%' AND idempotency_key LIKE '%${TEST_TASK.id}%'
    ORDER BY created_at
  `);
  
  console.log(`   积分流水: ${logResult.rows.length} 条`);
  logResult.rows.forEach(l => {
    console.log(`     - ${l.description}: ${l.points_change > 0 ? '+' : ''}${l.points_change} (${l.reason_code})`);
  });
  
  // 验证 escrow 和 bounty 流水都存在
  const hasEscrow = logResult.rows.some(l => l.reason_code === 'escrow');
  const hasBounty = logResult.rows.some(l => l.reason_code === 'bounty');
  
  if (!hasEscrow) throw new Error('缺少 escrow 流水');
  if (!hasBounty) throw new Error('缺少 bounty 流水');
  
  console.log(`   ✅ escrow 流水存在`);
  console.log(`   ✅ bounty 流水存在`);
}

// ========== 主测试流程 ==========
async function runTest() {
  console.log('='.repeat(60));
  console.log('🧪 悬赏任务 API 完整流程测试');
  console.log('='.repeat(60));

  try {
    await setup();
    await testFullFlow();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ 完整流程测试通过!');
    console.log('   发布 → 领取 → 提交 → 审核 → 奖励发放');
    console.log('='.repeat(60));
    
    process.exit(0);
  } catch (err) {
    console.error('\n❌ 测试失败:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runTest();
