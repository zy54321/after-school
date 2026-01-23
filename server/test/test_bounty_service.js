/**
 * 悬赏任务服务测试脚本
 * 
 * 测试完整流程：
 * 1. 发布任务（托管扣分）
 * 2. 领取任务
 * 3. 提交任务
 * 4. 审核通过（发放奖励）
 * 5. 验证积分变化
 * 
 * 运行方式：
 * cd server && node test/test_bounty_service.js
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
  
  // 获取该用户的成员（至少需要2个）
  const memberResult = await pool.query(
    'SELECT id, name FROM family_members WHERE parent_id = $1 ORDER BY id LIMIT 2',
    [TEST_USER_ID]
  );
  
  if (memberResult.rows.length < 2) {
    throw new Error('需要至少2个成员来测试（发布者 + 领取者）');
  }
  
  TEST_MEMBERS = memberResult.rows;
  console.log(`  发布者: ${TEST_MEMBERS[0].name} (ID: ${TEST_MEMBERS[0].id})`);
  console.log(`  领取者: ${TEST_MEMBERS[1].name} (ID: ${TEST_MEMBERS[1].id})`);
  
  // 确保成员有足够积分
  for (const member of TEST_MEMBERS) {
    const balance = await walletService.getBalance(member.id);
    console.log(`  ${member.name} 余额: ${balance} 积分`);
    
    if (balance < 100) {
      console.log(`    -> 充值 200 积分...`);
      await walletRepo.createPointsLog({
        memberId: member.id,
        parentId: TEST_USER_ID,
        description: '悬赏测试积分充值',
        pointsChange: 200,
        reasonCode: 'manual',
      });
    }
  }
  
  console.log('');
}

async function testPublishTask() {
  console.log('📝 测试 1: 发布悬赏任务');
  
  const publisher = TEST_MEMBERS[0];
  const balanceBefore = await walletService.getBalance(publisher.id);
  console.log(`   发布者余额 (前): ${balanceBefore}`);
  
  const bountyPoints = 50;
  
  const result = await bountyService.publishTask({
    parentId: TEST_USER_ID,
    publisherMemberId: publisher.id,
    title: '测试悬赏任务 - ' + Date.now(),
    description: '这是一个测试任务，需要完成以下步骤：\n1. 步骤一\n2. 步骤二',
    bountyPoints,
    dueAt: new Date(Date.now() + 86400000 * 3), // 3天后
    acceptCriteria: '完成所有步骤并提交证明',
  });
  
  TEST_TASK = result.task;
  
  console.log(`   ✅ ${result.msg}`);
  console.log(`      任务ID: ${TEST_TASK.id}`);
  console.log(`      标题: ${TEST_TASK.title}`);
  console.log(`      悬赏: ${TEST_TASK.bounty_points} 积分`);
  console.log(`      托管: ${TEST_TASK.escrow_points} 积分`);
  
  const balanceAfter = await walletService.getBalance(publisher.id);
  console.log(`   发布者余额 (后): ${balanceAfter}`);
  console.log(`   ✅ 积分变化: ${balanceBefore} → ${balanceAfter} (${balanceAfter - balanceBefore})`);
  
  if (balanceBefore - balanceAfter !== bountyPoints) {
    throw new Error(`托管扣分不正确！预期: -${bountyPoints}, 实际: ${balanceAfter - balanceBefore}`);
  }
}

async function testClaimTask() {
  console.log('\n🙋 测试 2: 领取任务');
  
  const claimer = TEST_MEMBERS[1];
  
  const result = await bountyService.claimTask(TEST_TASK.id, claimer.id);
  
  TEST_CLAIM = result.claim;
  
  console.log(`   ✅ ${result.msg}`);
  console.log(`      领取ID: ${TEST_CLAIM.id}`);
  console.log(`      领取者: ${claimer.name}`);
  
  // 验证任务状态
  const task = await bountyService.getTaskDetail(TEST_TASK.id);
  console.log(`   任务状态: ${task.status}`);
  
  if (task.status !== 'claimed') {
    throw new Error(`任务状态不正确！预期: claimed, 实际: ${task.status}`);
  }
}

async function testCannotClaimOwnTask() {
  console.log('\n🚫 测试 2.1: 不能领取自己的任务');
  
  const publisher = TEST_MEMBERS[0];
  
  // 创建另一个任务
  const result = await bountyService.publishTask({
    parentId: TEST_USER_ID,
    publisherMemberId: publisher.id,
    title: '自我领取测试任务',
    description: '测试',
    bountyPoints: 10,
  });
  
  try {
    await bountyService.claimTask(result.task.id, publisher.id);
    throw new Error('应该抛出错误！');
  } catch (err) {
    if (err.message.includes('不能领取自己')) {
      console.log(`   ✅ 正确拒绝: ${err.message}`);
    } else {
      throw err;
    }
  }
  
  // 取消这个测试任务
  await bountyService.cancelTask(result.task.id, publisher.id);
}

async function testSubmitTask() {
  console.log('\n📤 测试 3: 提交任务');
  
  const result = await bountyService.submitTask(
    TEST_CLAIM.id,
    '我已经完成了所有步骤，请审核！'
  );
  
  console.log(`   ✅ ${result.msg}`);
  console.log(`      提交说明: ${result.claim.submission_note}`);
  
  // 验证任务状态
  const task = await bountyService.getTaskDetail(TEST_TASK.id);
  console.log(`   任务状态: ${task.status}`);
  
  if (task.status !== 'submitted') {
    throw new Error(`任务状态不正确！预期: submitted, 实际: ${task.status}`);
  }
}

async function testReviewApprove() {
  console.log('\n✅ 测试 4: 审核通过');
  
  const publisher = TEST_MEMBERS[0];
  const claimer = TEST_MEMBERS[1];
  
  const claimerBalanceBefore = await walletService.getBalance(claimer.id);
  console.log(`   领取者余额 (前): ${claimerBalanceBefore}`);
  
  const result = await bountyService.reviewTask(
    TEST_TASK.id,
    publisher.id,
    'approved',
    '任务完成得很好！'
  );
  
  console.log(`   ✅ ${result.msg}`);
  console.log(`      奖励积分: ${result.pointsAwarded}`);
  
  const claimerBalanceAfter = await walletService.getBalance(claimer.id);
  console.log(`   领取者余额 (后): ${claimerBalanceAfter}`);
  console.log(`   ✅ 积分变化: ${claimerBalanceBefore} → ${claimerBalanceAfter} (+${claimerBalanceAfter - claimerBalanceBefore})`);
  
  if (claimerBalanceAfter - claimerBalanceBefore !== TEST_TASK.bounty_points) {
    throw new Error(`奖励发放不正确！预期: +${TEST_TASK.bounty_points}, 实际: +${claimerBalanceAfter - claimerBalanceBefore}`);
  }
  
  // 验证任务状态
  const task = await bountyService.getTaskDetail(TEST_TASK.id);
  console.log(`   任务状态: ${task.status}`);
  console.log(`   托管积分: ${task.escrow_points}`);
  
  if (task.status !== 'approved') {
    throw new Error(`任务状态不正确！预期: approved, 实际: ${task.status}`);
  }
  
  if (task.escrow_points !== 0) {
    throw new Error(`托管积分应该为0！实际: ${task.escrow_points}`);
  }
}

async function testReviewReject() {
  console.log('\n❌ 测试 5: 审核拒绝（带退款）');
  
  const publisher = TEST_MEMBERS[0];
  const claimer = TEST_MEMBERS[1];
  
  // 发布新任务
  const publisherBalanceBefore = await walletService.getBalance(publisher.id);
  
  const publishResult = await bountyService.publishTask({
    parentId: TEST_USER_ID,
    publisherMemberId: publisher.id,
    title: '测试拒绝任务',
    description: '这个任务会被拒绝',
    bountyPoints: 30,
  });
  
  const rejectTask = publishResult.task;
  console.log(`   创建测试任务: ID=${rejectTask.id}, 悬赏=${rejectTask.bounty_points}`);
  
  // 领取
  const claimResult = await bountyService.claimTask(rejectTask.id, claimer.id);
  console.log(`   领取任务: 领取者=${claimer.name}`);
  
  // 提交
  await bountyService.submitTask(claimResult.claim.id, '完成了');
  console.log(`   提交任务`);
  
  // 拒绝（不允许重新领取）
  const publisherBalanceBeforeReject = await walletService.getBalance(publisher.id);
  
  const rejectResult = await bountyService.reviewTask(
    rejectTask.id,
    publisher.id,
    'rejected',
    '完成质量不达标',
    false // 不允许重新领取
  );
  
  console.log(`   ✅ ${rejectResult.msg}`);
  console.log(`      退还积分: ${rejectResult.refundedPoints}`);
  
  const publisherBalanceAfter = await walletService.getBalance(publisher.id);
  console.log(`   发布者余额: ${publisherBalanceBeforeReject} → ${publisherBalanceAfter} (+${publisherBalanceAfter - publisherBalanceBeforeReject})`);
  
  if (publisherBalanceAfter - publisherBalanceBeforeReject !== rejectTask.bounty_points) {
    throw new Error(`退款不正确！预期: +${rejectTask.bounty_points}, 实际: +${publisherBalanceAfter - publisherBalanceBeforeReject}`);
  }
}

async function testCancelTask() {
  console.log('\n🚫 测试 6: 取消任务');
  
  const publisher = TEST_MEMBERS[0];
  
  const publisherBalanceBefore = await walletService.getBalance(publisher.id);
  
  // 发布新任务
  const publishResult = await bountyService.publishTask({
    parentId: TEST_USER_ID,
    publisherMemberId: publisher.id,
    title: '测试取消任务',
    description: '这个任务会被取消',
    bountyPoints: 20,
  });
  
  const cancelTask = publishResult.task;
  console.log(`   创建测试任务: ID=${cancelTask.id}, 托管=${cancelTask.escrow_points}`);
  
  const publisherBalanceAfterPublish = await walletService.getBalance(publisher.id);
  console.log(`   发布后余额: ${publisherBalanceAfterPublish}`);
  
  // 取消
  const cancelResult = await bountyService.cancelTask(cancelTask.id, publisher.id);
  
  console.log(`   ✅ ${cancelResult.msg}`);
  
  const publisherBalanceAfterCancel = await walletService.getBalance(publisher.id);
  console.log(`   取消后余额: ${publisherBalanceAfterCancel}`);
  
  // 验证退款
  if (publisherBalanceAfterCancel - publisherBalanceAfterPublish !== cancelTask.bounty_points) {
    throw new Error(`取消退款不正确！`);
  }
  console.log(`   ✅ 退款正确: +${cancelTask.bounty_points}`);
}

async function testVerifyOrdersAndLogs() {
  console.log('\n📊 测试 7: 验证订单和流水');
  
  const pool = bountyRepo.getPool();
  
  // 查询悬赏相关订单
  const orderResult = await pool.query(`
    SELECT * FROM family_market_order 
    WHERE idempotency_key LIKE 'bounty_%'
    ORDER BY created_at DESC
    LIMIT 10
  `);
  
  console.log(`   悬赏订单: ${orderResult.rows.length} 条`);
  orderResult.rows.forEach(o => {
    console.log(`     - ${o.sku_name}: ID=${o.id}`);
  });
  
  // 查询悬赏相关流水
  const logResult = await pool.query(`
    SELECT * FROM family_points_log 
    WHERE reason_code IN ('escrow', 'bounty', 'refund')
    ORDER BY created_at DESC
    LIMIT 10
  `);
  
  console.log(`   悬赏流水: ${logResult.rows.length} 条`);
  logResult.rows.forEach(l => {
    console.log(`     - ${l.description}: ${l.points_change > 0 ? '+' : ''}${l.points_change} (${l.reason_code})`);
  });
  
  // 验证 escrow、bounty、refund 流水都存在
  const reasonCodes = new Set(logResult.rows.map(l => l.reason_code));
  
  if (reasonCodes.has('escrow')) {
    console.log('   ✅ escrow 流水存在');
  } else {
    console.log('   ⚠️ escrow 流水不存在');
  }
  
  if (reasonCodes.has('bounty')) {
    console.log('   ✅ bounty 流水存在');
  } else {
    console.log('   ⚠️ bounty 流水不存在');
  }
  
  if (reasonCodes.has('refund')) {
    console.log('   ✅ refund 流水存在');
  } else {
    console.log('   ⚠️ refund 流水不存在');
  }
}

// ========== 主测试流程 ==========
async function runTest() {
  console.log('='.repeat(60));
  console.log('🧪 悬赏任务服务完整流程测试');
  console.log('='.repeat(60));

  try {
    await setup();
    await testPublishTask();
    await testClaimTask();
    await testCannotClaimOwnTask();
    await testSubmitTask();
    await testReviewApprove();
    await testReviewReject();
    await testCancelTask();
    await testVerifyOrdersAndLogs();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ 所有测试通过!');
    console.log('='.repeat(60));
    
    process.exit(0);
  } catch (err) {
    console.error('\n❌ 测试失败:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runTest();
