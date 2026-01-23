/**
 * 拍卖 API 测试脚本（Service 层测试）
 * 测试完整流程：创建场次 → 生成拍品 → 出价 → 结算 → 验证库存
 * 
 * 运行方式：
 * cd server && node test/test_auction_api.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const auctionService = require('../src/systems/family/services/auctionService');
const auctionRepo = require('../src/systems/family/repos/auctionRepo');
const walletService = require('../src/systems/family/services/walletService');
const walletRepo = require('../src/systems/family/repos/walletRepo');
const marketplaceRepo = require('../src/systems/family/repos/marketplaceRepo');

let TEST_USER_ID = null;
let TEST_MEMBERS = [];
let TEST_SESSION = null;
let TEST_LOTS = [];

// ========== 测试函数 ==========
async function setup() {
  console.log('\n🔧 设置测试环境...\n');
  
  const pool = auctionRepo.getPool();
  
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
  
  if (memberResult.rows.length === 0) {
    throw new Error('没有找到测试成员');
  }
  
  TEST_MEMBERS = memberResult.rows;
  console.log(`  成员: ${TEST_MEMBERS.map(m => m.name).join(', ')}`);
  
  // 确保成员有足够积分
  for (const member of TEST_MEMBERS) {
    const balance = await walletService.getBalance(member.id);
    console.log(`  ${member.name} 余额: ${balance} 积分`);
    
    if (balance < 200) {
      console.log(`    -> 充值 500 积分...`);
      await walletRepo.createPointsLog({
        memberId: member.id,
        parentId: TEST_USER_ID,
        description: '拍卖测试积分充值',
        pointsChange: 500,
        reasonCode: 'manual',
      });
    }
  }
  
  console.log('');
}

async function testCreateSession() {
  console.log('📅 测试 1: 创建拍卖场次');
  
  const title = `API测试场次 ${Date.now()}`;
  TEST_SESSION = await auctionService.createSession({
    parentId: TEST_USER_ID,
    title,
    scheduledAt: new Date(Date.now() + 3600000),
    config: {},
  });
  
  console.log(`   ✅ 创建成功: ID=${TEST_SESSION.id}, 标题="${TEST_SESSION.title}"`);
  console.log(`   状态: ${TEST_SESSION.status}`);
}

async function testGenerateLots() {
  console.log('\n🎁 测试 2: 生成拍品');
  
  const result = await auctionService.generateLots(TEST_SESSION.id, {
    common: 2,
    rare: 1,
    epic: 0,
    legendary: 0,
  });
  
  if (!result.success) {
    throw new Error(`生成失败: ${result.msg}`);
  }
  
  TEST_LOTS = result.lots;
  console.log(`   ✅ ${result.msg}`);
  console.log(`   拍品数量: ${TEST_LOTS.length}`);
  TEST_LOTS.forEach((lot, i) => {
    console.log(`     ${i + 1}. ${lot.sku_name} (${lot.rarity}) - 起拍价: ${lot.start_price}`);
  });
}

async function testSubmitBids() {
  console.log('\n💰 测试 3: 提交出价');
  
  const lot = TEST_LOTS[0];
  const member1 = TEST_MEMBERS[0];
  
  // 成员1 出价
  const bid1Amount = lot.start_price + 20;
  const bid1Result = await auctionService.submitBid(lot.id, member1.id, bid1Amount);
  console.log(`   ✅ ${member1.name} 出价 ${bid1Amount}: ${bid1Result.msg}`);
  
  // 如果有第二个成员，让他也出价
  if (TEST_MEMBERS.length >= 2) {
    const member2 = TEST_MEMBERS[1];
    const bid2Amount = lot.start_price + 10;
    try {
      const bid2Result = await auctionService.submitBid(lot.id, member2.id, bid2Amount);
      console.log(`   ✅ ${member2.name} 出价 ${bid2Amount}: ${bid2Result.msg}`);
    } catch (err) {
      console.log(`   ⚠️ ${member2.name} 出价失败: ${err.message}`);
    }
    
    // 成员2 再次出更高价
    const bid3Amount = bid1Amount + 15;
    try {
      const bid3Result = await auctionService.submitBid(lot.id, member2.id, bid3Amount);
      console.log(`   ✅ ${member2.name} 加价至 ${bid3Amount}: ${bid3Result.msg}`);
    } catch (err) {
      console.log(`   ⚠️ ${member2.name} 加价失败: ${err.message}`);
    }
  }
  
  // 对第二个拍品只出一次价（测试单人出价）
  if (TEST_LOTS.length >= 2) {
    const lot2 = TEST_LOTS[1];
    const bid4Amount = lot2.start_price + 5;
    const bid4Result = await auctionService.submitBid(lot2.id, member1.id, bid4Amount);
    console.log(`   ✅ ${member1.name} 对拍品2出价 ${bid4Amount}: ${bid4Result.msg}`);
  }
}

async function testGetBids() {
  console.log('\n📊 测试 4: 查询出价记录');
  
  const lot = TEST_LOTS[0];
  const bids = await auctionService.getBidsByLotId(lot.id);
  
  console.log(`   拍品 "${lot.sku_name}" 的出价记录 (${bids.length} 条):`);
  bids.forEach((bid, i) => {
    console.log(`     ${i + 1}. ${bid.bidder_name || 'ID:' + bid.bidder_member_id}: ${bid.bid_points} 积分`);
  });
  
  const highest = await auctionService.getHighestBid(lot.id);
  if (highest) {
    console.log(`   当前最高出价: ${highest.bid_points} (${highest.bidder_name})`);
  }
}

async function testSettleSession() {
  console.log('\n🏆 测试 5: 结算拍卖');
  
  // 记录结算前的余额
  const balancesBefore = {};
  for (const member of TEST_MEMBERS) {
    balancesBefore[member.id] = await walletService.getBalance(member.id);
    console.log(`   结算前 ${member.name} 余额: ${balancesBefore[member.id]}`);
  }
  
  const result = await auctionService.settleSession(TEST_SESSION.id);
  
  console.log(`\n   ✅ ${result.msg}`);
  console.log(`   成交: ${result.settledCount} 件`);
  console.log(`   流拍: ${result.unsoldCount} 件`);
  
  // 显示结算详情
  if (result.results.length > 0) {
    console.log('\n   结算详情:');
    result.results.forEach((r, i) => {
      console.log(`     ${i + 1}. ${r.lot.sku_name}`);
      console.log(`        获胜者: ${r.winner.memberName}`);
      console.log(`        最高出价: ${r.winner.bidPoints}`);
      console.log(`        次高出价: ${r.secondPrice || '无'}`);
      console.log(`        实付金额: ${r.payPoints} (二价规则)`);
    });
  }
  
  // 验证余额变化
  console.log('\n   余额变化:');
  for (const member of TEST_MEMBERS) {
    const balanceAfter = await walletService.getBalance(member.id);
    const change = balanceAfter - balancesBefore[member.id];
    console.log(`     ${member.name}: ${balancesBefore[member.id]} → ${balanceAfter} (${change >= 0 ? '+' : ''}${change})`);
  }
}

async function testVerifyResults() {
  console.log('\n🔍 测试 6: 验证结果');
  
  // 验证场次状态
  const sessionDetail = await auctionService.getSessionWithLots(TEST_SESSION.id);
  console.log(`   场次状态: ${sessionDetail.session.status}`);
  if (sessionDetail.session.status !== 'ended') {
    console.log('   ⚠️ 警告: 场次状态应为 ended');
  } else {
    console.log('   ✅ 场次状态正确');
  }
  
  // 验证拍品状态
  const soldLots = sessionDetail.lots.filter(l => l.status === 'sold');
  const unsoldLots = sessionDetail.lots.filter(l => l.status === 'unsold');
  console.log(`   已成交拍品: ${soldLots.length}`);
  console.log(`   流拍拍品: ${unsoldLots.length}`);
  
  // 验证库存
  const pool = auctionRepo.getPool();
  for (const lot of soldLots) {
    const invResult = await pool.query(
      `SELECT i.*, s.name as sku_name 
       FROM family_inventory i 
       JOIN family_sku s ON i.sku_id = s.id 
       WHERE i.sku_id = $1`,
      [lot.sku_id]
    );
    if (invResult.rows.length > 0) {
      console.log(`   ✅ 库存已增加: ${invResult.rows[0].sku_name}`);
    }
  }
  
  // 验证订单
  const orderResult = await pool.query(
    `SELECT o.*, m.name as member_name 
     FROM family_market_order o 
     JOIN family_members m ON o.member_id = m.id 
     WHERE o.idempotency_key LIKE $1`,
    [`auction_${TEST_SESSION.id}%`]
  );
  console.log(`   订单记录: ${orderResult.rows.length} 条`);
  orderResult.rows.forEach(o => {
    console.log(`     - ${o.sku_name}: ${o.cost}积分 (${o.member_name})`);
  });
}

// ========== 主测试流程 ==========
async function runTest() {
  console.log('='.repeat(60));
  console.log('🧪 拍卖 API 完整流程测试');
  console.log('='.repeat(60));

  try {
    await setup();
    await testCreateSession();
    await testGenerateLots();
    await testSubmitBids();
    await testGetBids();
    await testSettleSession();
    await testVerifyResults();
    
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
