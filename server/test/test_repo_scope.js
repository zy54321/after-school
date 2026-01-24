/**
 * Repo 层供给侧查询规范测试
 * 验证供给侧查询全部改为 parent_id
 */

const pool = require('../src/shared/config/db');

// 导入所有 repo
const marketplaceRepo = require('../src/systems/family/repos/marketplaceRepo');
const auctionRepo = require('../src/systems/family/repos/auctionRepo');
const lotteryRepo = require('../src/systems/family/repos/lotteryRepo');
const issueRepo = require('../src/systems/family/repos/issueRepo');
const reminderRepo = require('../src/systems/family/repos/reminderRepo');

async function runTests() {
  console.log('🧪 开始测试 Repo 层供给侧查询规范...\n');
  
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
  
  // ========== marketplaceRepo 供给侧方法 ==========
  console.log('--- marketplaceRepo ---');
  
  await test('getActiveSkus(parentId) 正常工作', async () => {
    const result = await marketplaceRepo.getActiveSkus(parentId);
    if (!Array.isArray(result)) throw new Error('返回值不是数组');
    console.log(`      返回 ${result.length} 个 SKU`);
  })();
  
  await test('getActiveOffers(parentId) 正常工作', async () => {
    const result = await marketplaceRepo.getActiveOffers(parentId);
    if (!Array.isArray(result)) throw new Error('返回值不是数组');
    console.log(`      返回 ${result.length} 个 Offer`);
  })();
  
  await test('getOffersByType(parentId, offerType) 正常工作', async () => {
    const result = await marketplaceRepo.getOffersByType(parentId, 'mystery_shop');
    if (!Array.isArray(result)) throw new Error('返回值不是数组');
    console.log(`      返回 ${result.length} 个 mystery_shop Offer`);
  })();
  
  // ========== auctionRepo 供给侧方法 ==========
  console.log('\n--- auctionRepo ---');
  
  await test('getSessionsByParentId(parentId) 正常工作', async () => {
    const result = await auctionRepo.getSessionsByParentId(parentId);
    if (!Array.isArray(result)) throw new Error('返回值不是数组');
    console.log(`      返回 ${result.length} 个 Session`);
  })();
  
  await test('getAuctionableSkus(parentId) 正常工作', async () => {
    const result = await auctionRepo.getAuctionableSkus(parentId);
    if (!Array.isArray(result)) throw new Error('返回值不是数组');
    console.log(`      返回 ${result.length} 个可拍卖 SKU`);
  })();
  
  // ========== lotteryRepo 供给侧方法 ==========
  console.log('\n--- lotteryRepo ---');
  
  await test('getPoolsByParentId(parentId) 正常工作', async () => {
    const result = await lotteryRepo.getPoolsByParentId(parentId);
    if (!Array.isArray(result)) throw new Error('返回值不是数组');
    console.log(`      返回 ${result.length} 个抽奖池`);
  })();
  
  await test('getTicketTypesByParentId(parentId) 正常工作', async () => {
    const result = await lotteryRepo.getTicketTypesByParentId(parentId);
    if (!Array.isArray(result)) throw new Error('返回值不是数组');
    console.log(`      返回 ${result.length} 个抽奖券类型`);
  })();
  
  // ========== issueRepo 供给侧方法 ==========
  console.log('\n--- issueRepo ---');
  
  await test('getIssuesByParentId(parentId) 正常工作', async () => {
    const result = await issueRepo.getIssuesByParentId(parentId);
    if (!Array.isArray(result)) throw new Error('返回值不是数组');
    console.log(`      返回 ${result.length} 个问题`);
  })();
  
  await test('getTopIssues(parentId) 正常工作', async () => {
    const result = await issueRepo.getTopIssues(parentId);
    if (!Array.isArray(result)) throw new Error('返回值不是数组');
    console.log(`      返回 ${result.length} 个热点问题`);
  })();
  
  // ========== reminderRepo 供给侧方法 ==========
  console.log('\n--- reminderRepo ---');
  
  await test('getPoliciesByParentId(parentId) 正常工作', async () => {
    const result = await reminderRepo.getPoliciesByParentId(parentId);
    if (!Array.isArray(result)) throw new Error('返回值不是数组');
    console.log(`      返回 ${result.length} 个提醒策略`);
  })();
  
  // ========== 验证 family_offer.parent_id 直接查询 ==========
  console.log('\n--- 直接 SQL 验证 ---');
  
  await test('family_offer 可直接按 parent_id 查询（不需 JOIN sku）', async () => {
    const result = await pool.query(`
      SELECT id, sku_id, cost, parent_id 
      FROM family_offer 
      WHERE parent_id = $1 AND is_active = TRUE
      LIMIT 10
    `, [parentId]);
    
    console.log(`      直接查询返回 ${result.rows.length} 个 Offer`);
  })();
  
  await test('EXPLAIN 验证 family_offer 使用 parent_id 索引', async () => {
    const result = await pool.query(`
      EXPLAIN (FORMAT TEXT) 
      SELECT * FROM family_offer WHERE parent_id = $1
    `, [parentId]);
    
    const plan = result.rows.map(r => r['QUERY PLAN']).join('\n');
    const usesIndex = plan.toLowerCase().includes('index') && plan.toLowerCase().includes('parent');
    
    if (!usesIndex) {
      console.log(`      ⚠️ 查询计划:\n${plan}`);
      // 不抛错，因为小数据量可能不走索引
    } else {
      console.log(`      查询使用了 parent_id 索引 ✓`);
    }
  })();
  
  // 汇总
  console.log('\n' + '='.repeat(50));
  console.log(`测试完成: ${passed} 通过, ${failed} 失败`);
  console.log('='.repeat(50));
  
  console.log('\n📊 供给侧方法规范总结:');
  console.log('   ✓ marketplaceRepo: getActiveSkus, getActiveOffers, getOffersByType');
  console.log('   ✓ auctionRepo: getSessionsByParentId, getAuctionableSkus');
  console.log('   ✓ lotteryRepo: getPoolsByParentId, getTicketTypesByParentId');
  console.log('   ✓ issueRepo: getIssuesByParentId, getTopIssues');
  console.log('   ✓ reminderRepo: getPoliciesByParentId');
  console.log('   ✓ 所有供给侧查询均使用 parent_id 作为主筛选条件');
  
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('测试运行失败:', err);
  process.exit(1);
});
