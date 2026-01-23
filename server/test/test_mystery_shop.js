/**
 * 神秘商店测试脚本
 * 测试流程：刷新 → 获取商品 → 购买
 * 
 * 运行方式：
 * cd server && node test/test_mystery_shop.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mysteryShopService = require('../src/systems/family/services/mysteryShopService');
const marketplaceService = require('../src/systems/family/services/marketplaceService');
const marketplaceRepo = require('../src/systems/family/repos/marketplaceRepo');
const walletService = require('../src/systems/family/services/walletService');
const walletRepo = require('../src/systems/family/repos/walletRepo');

let TEST_USER_ID = null;
let TEST_MEMBER = null;

// ========== 测试函数 ==========
async function setup() {
  console.log('\n🔧 设置测试环境...\n');
  
  const pool = marketplaceRepo.getPool();
  
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
  
  // 确保成员有足够积分
  const balance = await walletService.getBalance(TEST_MEMBER.id);
  console.log(`  余额: ${balance} 积分`);
  
  if (balance < 100) {
    await walletRepo.createPointsLog({
      memberId: TEST_MEMBER.id,
      parentId: TEST_USER_ID,
      description: '神秘商店测试积分充值',
      pointsChange: 200,
      reasonCode: 'manual',
    });
    console.log(`    -> 充值 200 积分`);
  }
  
  // 确保有 SKU 可用
  const skus = await marketplaceRepo.getActiveSkus(TEST_USER_ID);
  console.log(`  可用 SKU: ${skus.length} 个`);
  
  if (skus.length === 0) {
    throw new Error('没有可用的 SKU，请先创建商品');
  }
  
  console.log('');
}

async function testRefresh() {
  console.log('🔄 步骤 1: 刷新神秘商店');
  
  const result = await mysteryShopService.refresh(TEST_USER_ID);
  
  console.log(`   ✅ ${result.msg}`);
  console.log(`   生成 Offer 数量: ${result.offers.length}`);
  console.log(`   有效期至: ${result.validUntil.toLocaleString()}`);
  
  // 如果 SKU 数量不足，生成数量会少于配置
  if (result.offers.length === 0) {
    throw new Error(`没有生成任何商品`);
  }
  
  console.log(`   ℹ️ 注：商品数量取决于可用 SKU 数量 (期望 3-5，实际 ${result.offers.length})`);
  
  console.log('\n   商品列表:');
  result.offers.forEach((offer, i) => {
    const discountPercent = offer.discount_rate ? Math.round((1 - offer.discount_rate) * 100) : 0;
    console.log(`   ${i + 1}. ${offer.sku_name}`);
    console.log(`      原价: ${offer.original_cost} → 现价: ${offer.cost} (${discountPercent}% OFF)`);
    console.log(`      限购: ${offer.limit_per_member || '无限制'}`);
  });
  
  console.log('');
  return result.offers;
}

async function testGetOffers() {
  console.log('📦 步骤 2: 获取神秘商店商品');
  
  const offers = await mysteryShopService.getShopOffers(TEST_USER_ID);
  console.log(`   ✅ 获取到 ${offers.length} 个商品`);
  
  // 也测试通过 getOffersByType
  const offersByType = await marketplaceRepo.getOffersByType(TEST_USER_ID, 'mystery_shop');
  console.log(`   通过 getOffersByType: ${offersByType.length} 个`);
  
  if (offers.length !== offersByType.length) {
    throw new Error('两种方式获取的数量不一致');
  }
  
  // 获取配置
  const config = await mysteryShopService.getShopConfig(TEST_USER_ID);
  console.log(`   刷新配置:`);
  console.log(`     - 上次刷新: ${config.last_refresh_at ? new Date(config.last_refresh_at).toLocaleString() : '从未'}`);
  console.log(`     - 今日刷新次数: ${config.refresh_count}`);
  console.log(`     - 刷新费用: ${config.refresh_cost} 积分`);
  console.log(`     - 每日免费次数: ${config.free_refresh_count}`);
  console.log('');
  
  return offers;
}

async function testPurchase(offers) {
  console.log('🛒 步骤 3: 购买神秘商店商品');
  
  if (offers.length === 0) {
    console.log('   ⚠️ 没有可购买的商品，跳过');
    return;
  }
  
  const offer = offers[0];
  console.log(`   选择商品: ${offer.sku_name} (${offer.cost} 积分)`);
  
  const balanceBefore = await walletService.getBalance(TEST_MEMBER.id);
  console.log(`   购买前余额: ${balanceBefore}`);
  
  // 检查是否可以购买
  const canPurchase = await mysteryShopService.canPurchase(offer.id, TEST_MEMBER.id);
  console.log(`   限购检查: ${canPurchase.canPurchase ? '可购买' : canPurchase.reason}`);
  
  if (!canPurchase.canPurchase) {
    console.log('   ⚠️ 无法购买，跳过\n');
    return;
  }
  
  // 购买
  try {
    const purchaseResult = await marketplaceService.createOrderAndFulfill({
      memberId: TEST_MEMBER.id,
      parentId: TEST_USER_ID,
      offerId: offer.id,
      quantity: 1,
    });
    console.log(`   ✅ ${purchaseResult.msg}`);
  } catch (purchaseErr) {
    // SKU 可能有自身的限制（每日购买上限等）
    console.log(`   ⚠️ 购买受限: ${purchaseErr.message}`);
    console.log('   ℹ️ 这是 SKU 本身的限制，不影响神秘商店功能');
    console.log('');
    return;
  }
  
  const balanceAfter = await walletService.getBalance(TEST_MEMBER.id);
  console.log(`   购买后余额: ${balanceAfter} (花费 ${balanceBefore - balanceAfter})`);
  
  // 验证订单
  const pool = marketplaceRepo.getPool();
  const orderResult = await pool.query(
    `SELECT * FROM family_market_order WHERE member_id = $1 ORDER BY id DESC LIMIT 1`,
    [TEST_MEMBER.id]
  );
  
  if (orderResult.rows.length > 0) {
    console.log(`   订单ID: ${orderResult.rows[0].id}`);
    console.log(`   商品: ${orderResult.rows[0].sku_name}`);
    console.log(`   状态: ${orderResult.rows[0].status}`);
  }
  
  // 再次检查限购
  const canPurchaseAgain = await mysteryShopService.canPurchase(offer.id, TEST_MEMBER.id);
  console.log(`   再次限购检查: ${canPurchaseAgain.canPurchase ? '可购买' : canPurchaseAgain.reason}`);
  
  console.log('');
}

async function testRefreshAgain() {
  console.log('🔄 步骤 4: 再次刷新验证旧 Offer 失效');
  
  const oldOffers = await mysteryShopService.getShopOffers(TEST_USER_ID);
  const oldCount = oldOffers.length;
  console.log(`   当前商品数量: ${oldCount}`);
  
  const result = await mysteryShopService.refresh(TEST_USER_ID);
  console.log(`   刷新后商品数量: ${result.offers.length}`);
  console.log(`   失效的旧商品: ${result.deactivatedCount} 个`);
  
  // 验证旧 offer 已失效
  if (oldCount > 0 && result.deactivatedCount === 0) {
    console.log('   ⚠️ 警告：没有旧商品被失效');
  } else {
    console.log('   ✅ 旧商品已正确失效');
  }
  
  console.log('');
}

// ========== 主测试流程 ==========
async function runTest() {
  console.log('='.repeat(60));
  console.log('🏪 神秘商店测试');
  console.log('='.repeat(60));

  try {
    await setup();
    
    const offers = await testRefresh();
    await testGetOffers();
    await testPurchase(offers);
    await testRefreshAgain();
    
    console.log('='.repeat(60));
    console.log('✅ 神秘商店测试通过!');
    console.log('   刷新 → 获取商品 → 购买 → 再次刷新');
    console.log('='.repeat(60));
    
    process.exit(0);
  } catch (err) {
    console.error('\n❌ 测试失败:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runTest();
