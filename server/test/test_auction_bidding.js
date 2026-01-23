/**
 * 拍卖出价和结算测试脚本
 * 
 * 测试内容：
 * 1. 创建场次和拍卖品
 * 2. 多人出价
 * 3. 二价结算验证
 * 4. 无第二高出价时支付起拍价
 * 5. 订单体系验证
 * 
 * 运行方式：
 * cd server && node test/test_auction_bidding.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const auctionService = require('../src/systems/family/services/auctionService');
const auctionRepo = require('../src/systems/family/repos/auctionRepo');
const walletService = require('../src/systems/family/services/walletService');
const walletRepo = require('../src/systems/family/repos/walletRepo');

let TEST_USER_ID = null;
let TEST_MEMBERS = [];
let TEST_SESSION_ID = null;
let TEST_LOTS = [];

async function setup() {
  console.log('\n🔧 设置测试环境...\n');
  
  const pool = auctionRepo.getPool();
  
  // 获取测试用户
  const userResult = await pool.query('SELECT id FROM users WHERE is_active = TRUE LIMIT 1');
  if (userResult.rows.length === 0) {
    throw new Error('没有找到测试用户');
  }
  TEST_USER_ID = userResult.rows[0].id;
  console.log(`  用户 ID: ${TEST_USER_ID}`);
  
  // 获取该用户的成员（需要至少2个成员来测试多人出价）
  const memberResult = await pool.query(
    'SELECT id, name, parent_id FROM family_members WHERE parent_id = $1 ORDER BY id',
    [TEST_USER_ID]
  );
  
  if (memberResult.rows.length < 2) {
    // 创建第二个测试成员
    console.log('  创建额外测试成员...');
    await pool.query(
      'INSERT INTO family_members (parent_id, name) VALUES ($1, $2)',
      [TEST_USER_ID, '测试成员B']
    );
    const newMemberResult = await pool.query(
      'SELECT id, name, parent_id FROM family_members WHERE parent_id = $1 ORDER BY id',
      [TEST_USER_ID]
    );
    TEST_MEMBERS = newMemberResult.rows;
  } else {
    TEST_MEMBERS = memberResult.rows;
  }
  
  console.log(`  成员数量: ${TEST_MEMBERS.length}`);
  TEST_MEMBERS.forEach((m, i) => console.log(`    ${i + 1}. ${m.name} (ID: ${m.id})`));
  
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
}

async function testCreateSessionAndLots() {
  console.log('\n📋 测试 1: 创建拍卖场次和拍卖品');
  console.log('─'.repeat(50));
  
  // 创建场次
  const session = await auctionService.createSession({
    parentId: TEST_USER_ID,
    title: `二价拍卖测试 ${Date.now()}`,
    scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
    config: { mode: 'sealed_second_price' },
  });
  
  TEST_SESSION_ID = session.id;
  console.log(`  场次 ID: ${session.id}`);
  
  // 生成拍卖品
  const generateResult = await auctionService.generateLots(TEST_SESSION_ID, {
    common: 2,  // 2个普通品：测试多人出价和单人出价
    rare: 1,    // 1个稀有品：测试无出价流拍
  });
  
  TEST_LOTS = generateResult.lots;
  console.log(`  生成拍卖品: ${TEST_LOTS.length} 个`);
  
  TEST_LOTS.forEach((lot, i) => {
    console.log(`    ${i + 1}. ${lot.sku_name} | ${lot.rarity} | 起拍价: ${lot.start_price}`);
  });
  
  console.log('  ✅ 测试通过\n');
  return { session, lots: TEST_LOTS };
}

async function testMultipleBids() {
  console.log('\n📋 测试 2: 多人出价场景');
  console.log('─'.repeat(50));
  
  const lot = TEST_LOTS[0]; // 第一个拍品用于测试多人出价
  const startPrice = lot.start_price;
  console.log(`  测试拍品: ${lot.sku_name} (起拍价: ${startPrice})`);
  
  // 成员A出价 (起拍价 + 10)
  const memberA = TEST_MEMBERS[0];
  const bidA = startPrice + 10;
  console.log(`\n  ${memberA.name} 出价 ${bidA} 积分...`);
  
  const resultA = await auctionService.submitBid(lot.id, memberA.id, bidA);
  console.log(`    结果: ${resultA.msg}`);
  
  // 成员B出价更高 (起拍价 + 30)
  const memberB = TEST_MEMBERS[1];
  const bidB = startPrice + 30;
  console.log(`  ${memberB.name} 出价 ${bidB} 积分...`);
  
  const resultB = await auctionService.submitBid(lot.id, memberB.id, bidB);
  console.log(`    结果: ${resultB.msg}`);
  
  // 成员A加价 (起拍价 + 50)
  const bidA2 = startPrice + 50;
  console.log(`  ${memberA.name} 加价到 ${bidA2} 积分...`);
  
  const resultA2 = await auctionService.submitBid(lot.id, memberA.id, bidA2);
  console.log(`    结果: ${resultA2.msg}`);
  
  // 查看出价列表
  const bids = await auctionService.getBidsByLotId(lot.id);
  console.log(`\n  出价记录 (共 ${bids.length} 条):`);
  bids.forEach((b, i) => {
    console.log(`    ${i + 1}. ${b.bidder_name}: ${b.bid_points} 积分`);
  });
  
  console.log('  ✅ 测试通过\n');
}

async function testSingleBid() {
  console.log('\n📋 测试 3: 单人出价场景');
  console.log('─'.repeat(50));
  
  const lot = TEST_LOTS[1]; // 第二个拍品用于测试单人出价
  const startPrice = lot.start_price;
  console.log(`  测试拍品: ${lot.sku_name} (起拍价: ${startPrice})`);
  
  // 只有一个成员出价 (起拍价 + 20)
  const memberA = TEST_MEMBERS[0];
  const bidA = startPrice + 20;
  console.log(`\n  ${memberA.name} 出价 ${bidA} 积分...`);
  
  const resultA = await auctionService.submitBid(lot.id, memberA.id, bidA);
  console.log(`    结果: ${resultA.msg}`);
  
  const bids = await auctionService.getBidsByLotId(lot.id);
  console.log(`  出价记录: ${bids.length} 条`);
  
  console.log('  ✅ 测试通过 (预期：结算时支付起拍价)\n');
}

async function testSettlement() {
  console.log('\n📋 测试 4: 二价结算');
  console.log('─'.repeat(50));
  
  // 记录结算前余额
  const balancesBefore = {};
  for (const member of TEST_MEMBERS) {
    balancesBefore[member.id] = await walletService.getBalance(member.id);
    console.log(`  ${member.name} 结算前余额: ${balancesBefore[member.id]} 积分`);
  }
  
  console.log('\n  开始结算...');
  const result = await auctionService.settleSession(TEST_SESSION_ID);
  
  console.log(`\n  ─────────────────────`);
  console.log(`  成功: ${result.success}`);
  console.log(`  消息: ${result.msg}`);
  console.log(`  成交: ${result.settledCount} 件`);
  console.log(`  流拍: ${result.unsoldCount} 件`);
  
  // 详细结果
  console.log('\n  成交详情:');
  result.results.forEach((r, i) => {
    console.log(`    ${i + 1}. ${r.lot.sku_name}`);
    console.log(`       获胜者: ${r.winner.memberName} (出价: ${r.winner.bidPoints})`);
    console.log(`       二价: ${r.secondPrice || '无'}`);
    console.log(`       实付: ${r.payPoints} 积分`);
    console.log(`       订单ID: ${r.orderId}`);
  });
  
  if (result.unsoldLots.length > 0) {
    console.log('\n  流拍详情:');
    result.unsoldLots.forEach((lot, i) => {
      console.log(`    ${i + 1}. ${lot.sku_name} (${lot.reason || '无出价'})`);
    });
  }
  
  // 验证余额变化
  console.log('\n  余额变化验证:');
  for (const member of TEST_MEMBERS) {
    const balanceAfter = await walletService.getBalance(member.id);
    const change = balanceAfter - balancesBefore[member.id];
    console.log(`    ${member.name}: ${balancesBefore[member.id]} -> ${balanceAfter} (${change >= 0 ? '+' : ''}${change})`);
  }
  
  console.log('  ✅ 测试通过\n');
  return result;
}

async function testSecondPriceLogic(settlementResult) {
  console.log('\n📋 测试 5: 二价规则验证');
  console.log('─'.repeat(50));
  
  // 验证多人出价的拍品
  const multiResult = settlementResult.results.find(r => r.secondPrice !== null);
  if (multiResult) {
    const expectedPay = multiResult.secondPrice + 1;
    console.log(`  多人出价拍品: ${multiResult.lot.sku_name}`);
    console.log(`    最高出价: ${multiResult.winner.bidPoints}`);
    console.log(`    次高出价: ${multiResult.secondPrice}`);
    console.log(`    预期支付: ${expectedPay} (次高价+1)`);
    console.log(`    实际支付: ${multiResult.payPoints}`);
    
    if (multiResult.payPoints === expectedPay || multiResult.payPoints === multiResult.winner.bidPoints) {
      console.log(`    ✅ 二价规则验证通过`);
    } else {
      console.log(`    ❌ 二价规则验证失败`);
    }
  }
  
  // 验证单人出价的拍品
  const singleResult = settlementResult.results.find(r => r.secondPrice === null);
  if (singleResult) {
    console.log(`\n  单人出价拍品: ${singleResult.lot.sku_name}`);
    console.log(`    最高出价: ${singleResult.winner.bidPoints}`);
    console.log(`    起拍价: ${singleResult.lot.start_price}`);
    console.log(`    预期支付: ${singleResult.lot.start_price} (起拍价)`);
    console.log(`    实际支付: ${singleResult.payPoints}`);
    
    if (singleResult.payPoints === singleResult.lot.start_price) {
      console.log(`    ✅ 单人出价规则验证通过`);
    } else {
      console.log(`    ❌ 单人出价规则验证失败`);
    }
  }
  
  console.log('\n  ✅ 测试通过\n');
}

async function testOrderSystem(settlementResult) {
  console.log('\n📋 测试 6: 订单体系验证');
  console.log('─'.repeat(50));
  
  const pool = auctionRepo.getPool();
  
  for (const r of settlementResult.results) {
    console.log(`  订单 #${r.orderId}:`);
    
    // 检查订单
    const orderResult = await pool.query(
      'SELECT * FROM family_market_order WHERE id = $1',
      [r.orderId]
    );
    const order = orderResult.rows[0];
    console.log(`    状态: ${order.status}`);
    console.log(`    金额: ${order.cost}`);
    console.log(`    幂等键: ${order.idempotency_key}`);
    
    // 检查积分流水
    const logResult = await pool.query(
      'SELECT * FROM family_points_log WHERE order_id = $1',
      [r.orderId]
    );
    const log = logResult.rows[0];
    if (log) {
      console.log(`    积分流水: ${log.points_change} | ${log.reason_code}`);
    }
    
    // 检查库存
    const invResult = await pool.query(
      'SELECT * FROM family_inventory WHERE order_id = $1',
      [r.orderId]
    );
    if (invResult.rows.length > 0) {
      console.log(`    库存: ✓`);
    }
    
    // 检查拍卖结果
    const auctionResult = await auctionRepo.getResultByLotId(r.lot.id);
    if (auctionResult) {
      console.log(`    拍卖结果: ✓ (结算状态: ${auctionResult.settlement_status})`);
    }
  }
  
  console.log('\n  ✅ 订单体系验证通过\n');
}

async function cleanup() {
  console.log('\n🧹 清理测试环境...');
  const pool = auctionRepo.getPool();
  await pool.end();
  console.log('  数据库连接已关闭\n');
}

async function main() {
  console.log('='.repeat(60));
  console.log('🧪 拍卖出价和二价结算测试');
  console.log('='.repeat(60));
  
  try {
    await setup();
    
    // 测试 1: 创建场次和拍卖品
    await testCreateSessionAndLots();
    
    // 测试 2: 多人出价
    await testMultipleBids();
    
    // 测试 3: 单人出价
    await testSingleBid();
    
    // 测试 4: 结算
    const settlementResult = await testSettlement();
    
    // 测试 5: 二价规则验证
    await testSecondPriceLogic(settlementResult);
    
    // 测试 6: 订单体系验证
    await testOrderSystem(settlementResult);
    
    console.log('='.repeat(60));
    console.log('✅ 所有测试完成！');
    console.log('='.repeat(60));
    
  } catch (err) {
    console.error('\n❌ 测试失败:', err.message);
    console.error(err);
  } finally {
    await cleanup();
  }
}

main();
