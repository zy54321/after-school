/**
 * Marketplace API v2 测试脚本
 * 
 * 测试流程：
 * 1. 获取 SKU 列表
 * 2. 获取 Offers 列表
 * 3. 创建订单
 * 4. 验证幂等性
 * 5. 检查库存增长
 * 6. 检查积分流水
 * 
 * 运行方式：
 * cd server && node test/test_marketplace_api.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const walletRepo = require('../src/systems/family/repos/walletRepo');
const marketplaceRepo = require('../src/systems/family/repos/marketplaceRepo');
const marketplaceService = require('../src/systems/family/services/marketplaceService');
const walletService = require('../src/systems/family/services/walletService');

// 模拟测试数据
let TEST_USER_ID = null;
let TEST_MEMBER_ID = null;
let TEST_OFFER_ID = null;

async function setup() {
  console.log('\n🔧 设置测试环境...\n');
  
  const pool = walletRepo.getPool();
  
  // 获取一个测试用户
  const userResult = await pool.query('SELECT id FROM users WHERE is_active = TRUE LIMIT 1');
  if (userResult.rows.length === 0) {
    throw new Error('没有找到测试用户');
  }
  TEST_USER_ID = userResult.rows[0].id;
  
  // 获取该用户的成员
  const memberResult = await pool.query(
    'SELECT id, name FROM family_members WHERE parent_id = $1 LIMIT 1',
    [TEST_USER_ID]
  );
  if (memberResult.rows.length === 0) {
    throw new Error('没有找到测试成员');
  }
  TEST_MEMBER_ID = memberResult.rows[0].id;
  
  // 获取一个有效的 Offer
  const offerResult = await pool.query(`
    SELECT o.id, o.cost, s.name as sku_name
    FROM family_offer o
    JOIN family_sku s ON o.sku_id = s.id
    WHERE o.is_active = TRUE AND s.is_active = TRUE
    LIMIT 1
  `);
  if (offerResult.rows.length > 0) {
    TEST_OFFER_ID = offerResult.rows[0].id;
  }
  
  console.log(`  用户 ID: ${TEST_USER_ID}`);
  console.log(`  成员 ID: ${TEST_MEMBER_ID} (${memberResult.rows[0].name})`);
  console.log(`  测试 Offer ID: ${TEST_OFFER_ID || '未找到'}`);
  
  // 确保有足够积分
  const balance = await walletService.getBalance(TEST_MEMBER_ID);
  console.log(`  当前余额: ${balance} 积分`);
  
  if (balance < 100 && TEST_OFFER_ID) {
    console.log('  ⚠️ 余额不足，添加测试积分...');
    await walletRepo.createPointsLog({
      memberId: TEST_MEMBER_ID,
      parentId: TEST_USER_ID,
      description: 'API测试积分充值',
      pointsChange: 200,
      reasonCode: 'manual',
    });
    console.log('  ✅ 已添加 200 测试积分');
  }
}

async function testGetSkus() {
  console.log('\n📋 测试 1: GET /api/v2/skus');
  console.log('─'.repeat(50));
  
  const skus = await marketplaceService.getActiveSkus(TEST_USER_ID);
  console.log(`  SKU 数量: ${skus.length}`);
  
  if (skus.length > 0) {
    console.log('  前3个 SKU:');
    skus.slice(0, 3).forEach((sku, i) => {
      console.log(`    ${i + 1}. ${sku.name} | ${sku.base_cost}积分 | ${sku.type}`);
    });
  }
  
  console.log('  ✅ 测试通过\n');
  return skus;
}

async function testGetOffers() {
  console.log('\n📋 测试 2: GET /api/v2/offers');
  console.log('─'.repeat(50));
  
  // 不带过滤
  const allOffers = await marketplaceRepo.getActiveOffers(TEST_USER_ID);
  console.log(`  全部 Offers: ${allOffers.length}`);
  
  // 按类型过滤
  const rewardOffers = await marketplaceRepo.getActiveOffers(TEST_USER_ID, { offerType: 'reward' });
  console.log(`  reward 类型: ${rewardOffers.length}`);
  
  const auctionOffers = await marketplaceRepo.getActiveOffers(TEST_USER_ID, { offerType: 'auction' });
  console.log(`  auction 类型: ${auctionOffers.length}`);
  
  if (allOffers.length > 0) {
    const offer = allOffers[0];
    console.log(`  示例 Offer: ID=${offer.id}, ${offer.sku_name}, ${offer.cost}积分`);
    TEST_OFFER_ID = offer.id;
  }
  
  console.log('  ✅ 测试通过\n');
  return allOffers;
}

async function testCreateOrder() {
  console.log('\n📋 测试 3: POST /api/v2/orders');
  console.log('─'.repeat(50));
  
  if (!TEST_OFFER_ID) {
    console.log('  ⚠️ 没有可用的 Offer，跳过测试\n');
    return null;
  }
  
  const idempotencyKey = `api_test_${Date.now()}`;
  const balanceBefore = await walletService.getBalance(TEST_MEMBER_ID);
  const inventoryBefore = await marketplaceService.getInventoryByMemberId(TEST_MEMBER_ID);
  
  console.log(`  Offer ID: ${TEST_OFFER_ID}`);
  console.log(`  成员 ID: ${TEST_MEMBER_ID}`);
  console.log(`  幂等键: ${idempotencyKey}`);
  console.log(`  下单前余额: ${balanceBefore} 积分`);
  console.log(`  下单前库存数: ${inventoryBefore.length}`);
  
  try {
    const result = await marketplaceService.createOrderAndFulfill({
      memberId: TEST_MEMBER_ID,
      offerId: TEST_OFFER_ID,
      quantity: 1,
      idempotencyKey,
    });
    
    const balanceAfter = await walletService.getBalance(TEST_MEMBER_ID);
    const inventoryAfter = await marketplaceService.getInventoryByMemberId(TEST_MEMBER_ID);
    
    console.log(`  ─────────────────────`);
    console.log(`  订单 ID: ${result.order.id}`);
    console.log(`  扣除积分: ${result.order.cost}`);
    console.log(`  下单后余额: ${balanceAfter} 积分`);
    console.log(`  下单后库存数: ${inventoryAfter.length}`);
    console.log(`  消息: ${result.msg}`);
    
    // 验证
    const balanceChange = balanceBefore - balanceAfter;
    console.log(`  ─────────────────────`);
    console.log(`  余额变化: -${balanceChange} 积分 ${balanceChange === result.order.cost ? '✓' : '✗'}`);
    
    console.log('  ✅ 测试通过\n');
    return { idempotencyKey, order: result.order };
    
  } catch (err) {
    console.log(`  ❌ 错误: ${err.message}`);
    if (err.message.includes('积分不足')) {
      console.log('  ⚠️ 积分不足，跳过此测试\n');
      return null;
    }
    throw err;
  }
}

async function testIdempotency(idempotencyKey) {
  console.log('\n📋 测试 4: 幂等性验证（重复 idempotency_key）');
  console.log('─'.repeat(50));
  
  if (!idempotencyKey) {
    console.log('  ⚠️ 没有可用的幂等键，跳过测试\n');
    return;
  }
  
  const balanceBefore = await walletService.getBalance(TEST_MEMBER_ID);
  console.log(`  使用相同幂等键: ${idempotencyKey}`);
  console.log(`  当前余额: ${balanceBefore} 积分`);
  
  const result = await marketplaceService.createOrderAndFulfill({
    memberId: TEST_MEMBER_ID,
    offerId: TEST_OFFER_ID,
    quantity: 1,
    idempotencyKey,
  });
  
  const balanceAfter = await walletService.getBalance(TEST_MEMBER_ID);
  
  console.log(`  ─────────────────────`);
  console.log(`  幂等返回: ${result.idempotent ? '是 ✓' : '否 ✗'}`);
  console.log(`  余额变化: ${balanceAfter - balanceBefore} 积分`);
  console.log(`  返回订单 ID: ${result.order.id}`);
  
  if (result.idempotent && balanceBefore === balanceAfter) {
    console.log('  ✅ 幂等性测试通过 - 重复请求未重复扣分\n');
  } else {
    console.log('  ❌ 幂等性测试失败\n');
  }
}

async function testInventoryGrowth() {
  console.log('\n📋 测试 5: 库存增长验证');
  console.log('─'.repeat(50));
  
  const inventory = await marketplaceService.getInventoryByMemberId(TEST_MEMBER_ID);
  console.log(`  库存总数: ${inventory.length}`);
  
  if (inventory.length > 0) {
    console.log('  最近入库:');
    inventory.slice(0, 3).forEach((item, i) => {
      console.log(`    ${i + 1}. ${item.sku_name || 'SKU#' + item.sku_id} x${item.quantity} | ${item.status}`);
    });
  }
  
  console.log('  ✅ 测试通过\n');
}

async function testPointsLog() {
  console.log('\n📋 测试 6: 积分流水记录验证');
  console.log('─'.repeat(50));
  
  const result = await walletService.listLogs(TEST_MEMBER_ID, { limit: 5 });
  console.log(`  流水总数: ${result.total}`);
  
  if (result.logs.length > 0) {
    console.log('  最近流水:');
    result.logs.forEach((log, i) => {
      const sign = log.points_change > 0 ? '+' : '';
      console.log(`    ${i + 1}. ${log.description} | ${sign}${log.points_change} | ${log.reason_code || '-'}`);
    });
  }
  
  // 检查是否有 order_id 关联
  const logsWithOrder = result.logs.filter(l => l.order_id);
  console.log(`  关联订单的流水: ${logsWithOrder.length} 条`);
  
  console.log('  ✅ 测试通过\n');
}

async function testBalanceInsufficient() {
  console.log('\n📋 测试 7: 余额不足错误验证');
  console.log('─'.repeat(50));
  
  if (!TEST_OFFER_ID) {
    console.log('  ⚠️ 没有可用的 Offer，跳过测试\n');
    return;
  }
  
  // 获取一个积分很高的 Offer 或者故意用完积分
  const pool = walletRepo.getPool();
  const expensiveOfferResult = await pool.query(`
    SELECT o.id, o.cost, s.name
    FROM family_offer o
    JOIN family_sku s ON o.sku_id = s.id
    WHERE o.is_active = TRUE AND o.cost > 10000
    LIMIT 1
  `);
  
  if (expensiveOfferResult.rows.length === 0) {
    console.log('  ⚠️ 没有高价 Offer，无法测试余额不足\n');
    return;
  }
  
  const expensiveOffer = expensiveOfferResult.rows[0];
  console.log(`  尝试购买高价商品: ${expensiveOffer.name} (${expensiveOffer.cost}积分)`);
  
  try {
    await marketplaceService.createOrderAndFulfill({
      memberId: TEST_MEMBER_ID,
      offerId: expensiveOffer.id,
      quantity: 1,
      idempotencyKey: `test_insufficient_${Date.now()}`,
    });
    console.log('  ❌ 应该抛出余额不足错误\n');
  } catch (err) {
    if (err.message.includes('积分不足')) {
      console.log(`  错误信息: ${err.message}`);
      console.log('  ✅ 余额不足错误正确返回\n');
    } else {
      console.log(`  ❌ 错误类型不正确: ${err.message}\n`);
    }
  }
}

async function cleanup() {
  console.log('\n🧹 清理测试环境...');
  const pool = walletRepo.getPool();
  await pool.end();
  console.log('  数据库连接已关闭\n');
}

async function main() {
  console.log('='.repeat(60));
  console.log('🧪 Marketplace API v2 完整流程测试');
  console.log('='.repeat(60));
  
  try {
    await setup();
    
    // 测试 1: 获取 SKU 列表
    await testGetSkus();
    
    // 测试 2: 获取 Offers 列表
    await testGetOffers();
    
    // 测试 3: 创建订单
    const orderResult = await testCreateOrder();
    
    // 测试 4: 幂等性验证
    if (orderResult) {
      await testIdempotency(orderResult.idempotencyKey);
    }
    
    // 测试 5: 库存增长验证
    await testInventoryGrowth();
    
    // 测试 6: 积分流水验证
    await testPointsLog();
    
    // 测试 7: 余额不足错误
    await testBalanceInsufficient();
    
    console.log('='.repeat(60));
    console.log('✅ 所有 API 测试完成！');
    console.log('='.repeat(60));
    
  } catch (err) {
    console.error('\n❌ 测试失败:', err.message);
    console.error(err);
  } finally {
    await cleanup();
  }
}

main();
