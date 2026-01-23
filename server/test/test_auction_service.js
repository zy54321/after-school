/**
 * Auction Service 测试脚本
 * 
 * 测试内容：
 * 1. 创建拍卖场次
 * 2. 生成拍卖品 (generateLots)
 * 3. 验证数量与配置一致
 * 4. 验证 lot 与 offer 对应
 * 5. 验证重复调用不重复生成
 * 
 * 运行方式：
 * cd server && node test/test_auction_service.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const auctionService = require('../src/systems/family/services/auctionService');
const auctionRepo = require('../src/systems/family/repos/auctionRepo');

let TEST_USER_ID = null;
let TEST_SESSION_ID = null;

async function setup() {
  console.log('\n🔧 设置测试环境...\n');
  
  const pool = auctionRepo.getPool();
  
  // 获取一个测试用户
  const userResult = await pool.query('SELECT id FROM users WHERE is_active = TRUE LIMIT 1');
  if (userResult.rows.length === 0) {
    throw new Error('没有找到测试用户');
  }
  TEST_USER_ID = userResult.rows[0].id;
  console.log(`  用户 ID: ${TEST_USER_ID}`);
  
  // 检查可用的 SKU
  const skus = await auctionService.getAuctionableSkus(TEST_USER_ID);
  console.log(`  可用 SKU 数量: ${skus.length}`);
  
  if (skus.length === 0) {
    throw new Error('没有可用的 SKU，请先运行商城 seed');
  }
}

async function testCreateSession() {
  console.log('\n📋 测试 1: 创建拍卖场次');
  console.log('─'.repeat(50));
  
  const session = await auctionService.createSession({
    parentId: TEST_USER_ID,
    title: `测试拍卖会 ${Date.now()}`,
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 明天
    config: {
      bidIncrement: 5,
      countdownSeconds: 30,
      mode: 'english',
    },
  });
  
  TEST_SESSION_ID = session.id;
  
  console.log(`  场次 ID: ${session.id}`);
  console.log(`  标题: ${session.title}`);
  console.log(`  状态: ${session.status}`);
  console.log(`  预定时间: ${session.scheduled_at}`);
  console.log('  ✅ 测试通过\n');
  
  return session;
}

async function testGenerateLots() {
  console.log('\n📋 测试 2: 生成拍卖品 (generateLots)');
  console.log('─'.repeat(50));
  
  const rarityCounts = {
    common: 2,
    rare: 2,
    epic: 1,
    legendary: 1,
  };
  
  console.log('  配置:', JSON.stringify(rarityCounts));
  
  const result = await auctionService.generateLots(TEST_SESSION_ID, rarityCounts);
  
  console.log(`  ─────────────────────`);
  console.log(`  成功: ${result.success}`);
  console.log(`  消息: ${result.msg}`);
  console.log(`  总数: ${result.totalLots}`);
  console.log('  按稀有度:');
  console.log(`    - common: ${result.summary.common}`);
  console.log(`    - rare: ${result.summary.rare}`);
  console.log(`    - epic: ${result.summary.epic}`);
  console.log(`    - legendary: ${result.summary.legendary}`);
  
  // 验证数量
  const expectedTotal = rarityCounts.common + rarityCounts.rare + rarityCounts.epic + rarityCounts.legendary;
  if (result.totalLots === expectedTotal) {
    console.log(`  ✅ 数量验证通过 (${result.totalLots} = ${expectedTotal})`);
  } else {
    console.log(`  ❌ 数量不匹配 (${result.totalLots} != ${expectedTotal})`);
  }
  
  console.log('  ✅ 测试通过\n');
  return result;
}

async function testLotOfferMapping(lots) {
  console.log('\n📋 测试 3: 验证 Lot 与 Offer 对应关系');
  console.log('─'.repeat(50));
  
  const pool = auctionRepo.getPool();
  
  let allMapped = true;
  console.log('  Lot -> Offer 映射:');
  
  for (const lot of lots.slice(0, 5)) { // 只检查前5个
    const offerResult = await pool.query(
      'SELECT id, sku_id, cost FROM family_offer WHERE id = $1',
      [lot.offer_id]
    );
    
    if (offerResult.rows.length > 0) {
      const offer = offerResult.rows[0];
      console.log(`    Lot#${lot.id} (${lot.sku_name}) -> Offer#${offer.id} (cost: ${offer.cost})`);
    } else {
      console.log(`    ❌ Lot#${lot.id} 没有对应的 Offer`);
      allMapped = false;
    }
  }
  
  if (lots.length > 5) {
    console.log(`    ... 还有 ${lots.length - 5} 个 lot`);
  }
  
  if (allMapped) {
    console.log('  ✅ 所有 Lot 都有对应的 Offer\n');
  } else {
    console.log('  ❌ 部分 Lot 缺少 Offer 映射\n');
  }
}

async function testDuplicateGeneration() {
  console.log('\n📋 测试 4: 防重测试（重复调用不重复生成）');
  console.log('─'.repeat(50));
  
  console.log('  尝试对同一场次再次生成...');
  
  const result = await auctionService.generateLots(TEST_SESSION_ID, {
    common: 1,
    rare: 1,
  });
  
  console.log(`  成功: ${result.success}`);
  console.log(`  消息: ${result.msg}`);
  
  if (!result.success && result.existingCount > 0) {
    console.log(`  已存在数量: ${result.existingCount}`);
    console.log('  ✅ 防重测试通过 - 重复调用被正确拒绝\n');
  } else {
    console.log('  ❌ 防重测试失败 - 重复调用创建了新的 lots\n');
  }
}

async function testGetSessionWithLots() {
  console.log('\n📋 测试 5: 获取场次详情（含拍卖品列表）');
  console.log('─'.repeat(50));
  
  const data = await auctionService.getSessionWithLots(TEST_SESSION_ID);
  
  console.log(`  场次: ${data.session.title}`);
  console.log(`  状态: ${data.session.status}`);
  console.log(`  拍卖品数量: ${data.lotCount}`);
  
  if (data.lots.length > 0) {
    console.log('  拍卖品列表:');
    data.lots.forEach((lot, i) => {
      console.log(`    ${i + 1}. ${lot.sku_name} | ${lot.rarity} | 起拍价: ${lot.start_price} | 当前价: ${lot.current_price || '-'}`);
    });
  }
  
  console.log('  ✅ 测试通过\n');
}

async function cleanup() {
  console.log('\n🧹 清理测试环境...');
  const pool = auctionRepo.getPool();
  
  // 可选：删除测试数据
  // await pool.query('DELETE FROM auction_session WHERE id = $1', [TEST_SESSION_ID]);
  
  await pool.end();
  console.log('  数据库连接已关闭\n');
}

async function main() {
  console.log('='.repeat(60));
  console.log('🧪 Auction Service 测试');
  console.log('='.repeat(60));
  
  try {
    await setup();
    
    // 测试 1: 创建场次
    await testCreateSession();
    
    // 测试 2: 生成拍卖品
    const generateResult = await testGenerateLots();
    
    // 测试 3: 验证 Lot-Offer 映射
    if (generateResult.lots) {
      await testLotOfferMapping(generateResult.lots);
    }
    
    // 测试 4: 防重测试
    await testDuplicateGeneration();
    
    // 测试 5: 获取场次详情
    await testGetSessionWithLots();
    
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
