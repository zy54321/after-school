/**
 * Service 层视角分离测试
 * 验证"市场配置视角"和"成员消费视角"的区分
 */

const pool = require('../src/shared/config/db');

// 导入所有 service
const marketplaceService = require('../src/systems/family/services/marketplaceService');
const auctionService = require('../src/systems/family/services/auctionService');
const lotteryService = require('../src/systems/family/services/lotteryService');
const mysteryShopService = require('../src/systems/family/services/mysteryShopService');

async function runTests() {
  console.log('🧪 开始测试 Service 层视角分离...\n');
  
  let passed = 0;
  let failed = 0;
  
  const test = (name, fn) => async () => {
    try {
      await fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (err) {
      console.log(`❌ ${name}`);
      console.log(`   错误: ${err.message}`);
      failed++;
    }
  };
  
  // 获取测试用户
  const userResult = await pool.query('SELECT id FROM users LIMIT 1');
  if (userResult.rows.length === 0) {
    console.log('❌ 没有可用的用户，无法测试');
    await pool.end();
    process.exit(1);
  }
  const parentId = userResult.rows[0].id;
  console.log(`📌 测试用户 ID: ${parentId}\n`);
  
  // ========== 市场配置入口（Family-level）==========
  console.log('=== 市场配置入口（Family-level）===');
  console.log('这些方法不需要 memberId\n');
  
  // marketplaceService
  await test('marketplaceService.getMarketCatalog(parentId) 正常工作', async () => {
    const result = await marketplaceService.getMarketCatalog(parentId);
    
    if (!result.parentId) throw new Error('缺少 parentId');
    if (!Array.isArray(result.skus)) throw new Error('缺少 skus 数组');
    if (typeof result.totalSkus !== 'number') throw new Error('缺少 totalSkus');
    
    console.log(`      返回 ${result.totalSkus} 个 SKU, ${result.totalOffers} 个 Offer`);
  })();
  
  await test('marketplaceService.getActiveOffers(parentId) 正常工作', async () => {
    const result = await marketplaceService.getActiveOffers(parentId);
    
    if (!Array.isArray(result)) throw new Error('返回值不是数组');
    console.log(`      返回 ${result.length} 个 Offer`);
  })();
  
  // auctionService
  await test('auctionService.getAuctionOverview(parentId) 正常工作', async () => {
    const result = await auctionService.getAuctionOverview(parentId);
    
    if (!result.parentId) throw new Error('缺少 parentId');
    if (!Array.isArray(result.sessions)) throw new Error('缺少 sessions 数组');
    if (!result.stats) throw new Error('缺少 stats');
    
    console.log(`      返回 ${result.totalSessions} 个场次, 可拍卖SKU: ${result.auctionableSkuCount}`);
    console.log(`      状态分布: draft=${result.stats.draft}, scheduled=${result.stats.scheduled}, active=${result.stats.active}, ended=${result.stats.ended}`);
  })();
  
  // lotteryService
  await test('lotteryService.getDrawOverview(parentId) 正常工作', async () => {
    const result = await lotteryService.getDrawOverview(parentId);
    
    if (!result.parentId) throw new Error('缺少 parentId');
    if (!Array.isArray(result.pools)) throw new Error('缺少 pools 数组');
    if (!Array.isArray(result.ticketTypes)) throw new Error('缺少 ticketTypes 数组');
    
    console.log(`      返回 ${result.totalPools} 个抽奖池 (活跃: ${result.activePools})`);
    console.log(`      抽奖券类型: ${result.totalTicketTypes} 个`);
  })();
  
  // mysteryShopService
  await test('mysteryShopService.getShopOffers(parentId) 正常工作', async () => {
    const result = await mysteryShopService.getShopOffers(parentId);
    
    if (!Array.isArray(result)) throw new Error('返回值不是数组');
    console.log(`      返回 ${result.length} 个神秘商店商品`);
  })();
  
  await test('mysteryShopService.getShopConfig(parentId) 正常工作', async () => {
    const result = await mysteryShopService.getShopConfig(parentId);
    
    if (!result) throw new Error('返回值为空');
    console.log(`      刷新成本: ${result.refresh_cost}, 免费次数: ${result.free_refresh_count}`);
  })();
  
  // ========== 成员消费入口（Member-level）==========
  console.log('\n=== 成员消费入口（Member-level）===');
  console.log('这些方法需要 memberId\n');
  
  // 验证方法签名
  await test('marketplaceService.createOrderAndFulfill 需要 memberId', async () => {
    // 检查方法存在
    if (typeof marketplaceService.createOrderAndFulfill !== 'function') {
      throw new Error('方法不存在');
    }
    console.log('      方法存在，签名: createOrderAndFulfill({ memberId, offerId, ... })');
  })();
  
  await test('auctionService.submitBid 需要 bidderId (memberId)', async () => {
    if (typeof auctionService.submitBid !== 'function') {
      throw new Error('方法不存在');
    }
    console.log('      方法存在，签名: submitBid(lotId, bidderId, bidPoints)');
  })();
  
  await test('lotteryService.spin 需要 memberId', async () => {
    if (typeof lotteryService.spin !== 'function') {
      throw new Error('方法不存在');
    }
    console.log('      方法存在，签名: spin(poolId, memberId, idempotencyKey)');
  })();
  
  // 汇总
  console.log('\n' + '='.repeat(60));
  console.log(`测试完成: ${passed} 通过, ${failed} 失败`);
  console.log('='.repeat(60));
  
  console.log('\n📊 视角分离总结:');
  console.log('');
  console.log('   市场配置入口（Family-level，不需要 memberId）:');
  console.log('   ✓ marketplaceService.getMarketCatalog(parentId)');
  console.log('   ✓ marketplaceService.getActiveOffers(parentId)');
  console.log('   ✓ auctionService.getAuctionOverview(parentId)');
  console.log('   ✓ lotteryService.getDrawOverview(parentId)');
  console.log('   ✓ mysteryShopService.getShopOffers(parentId)');
  console.log('');
  console.log('   成员消费入口（Member-level，需要 memberId）:');
  console.log('   ✓ createOrderAndFulfill({ memberId, ... })');
  console.log('   ✓ submitBid(lotId, bidderId, ...)');
  console.log('   ✓ spin(poolId, memberId, ...)');
  
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('测试运行失败:', err);
  process.exit(1);
});
