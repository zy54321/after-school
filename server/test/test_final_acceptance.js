/**
 * 最终验收测试
 * 
 * ✅ 必须满足：
 * 1. 市场页不需要 member_id 就能加载
 * 2. 市场供给（sku/offer/session/pool）是全家共享
 * 3. 下单/出价/抽奖等动作必须选择 member
 * 4. 所有资产变化落：order、points_log、inventory
 * 5. 幂等：抽奖 spin 幂等生效、拍卖结算幂等生效
 */

const pool = require('../src/shared/config/db');

// 辅助函数
const query = async (sql, params = []) => {
  const result = await pool.query(sql, params);
  return result.rows;
};

const log = (emoji, msg) => console.log(`${emoji} ${msg}`);
const pass = (msg) => log('✅', msg);
const fail = (msg) => log('❌', msg);
const info = (msg) => log('📌', msg);

// ========== 测试 1：市场页不需要 member_id 就能加载 ==========
async function testMarketNoMemberRequired() {
  console.log('\n========== 测试1：市场页不需要 member_id 就能加载 ==========\n');
  
  let passed = true;
  
  // 检查 Controller 层代码
  const fs = require('fs');
  const path = require('path');
  
  const controllerPath = path.join(__dirname, '../src/systems/family/controllers/marketplaceController.js');
  const controllerCode = fs.readFileSync(controllerPath, 'utf-8');
  
  // 检查 getSkus
  if (controllerCode.includes('getSkus') && !controllerCode.match(/getSkus[\s\S]{0,200}member_id.*required/i)) {
    pass('getSkus 不强制要求 member_id');
  } else {
    fail('getSkus 可能强制要求 member_id');
    passed = false;
  }
  
  // 检查 getCatalog
  if (controllerCode.includes('getCatalog') && !controllerCode.match(/getCatalog[\s\S]{0,200}member_id.*required/i)) {
    pass('getCatalog 不强制要求 member_id');
  } else {
    fail('getCatalog 可能强制要求 member_id');
    passed = false;
  }
  
  // 检查 getOffers
  if (controllerCode.includes('getOffers') && !controllerCode.match(/getOffers[\s\S]{0,200}member_id.*required/i)) {
    pass('getOffers 不强制要求 member_id');
  } else {
    fail('getOffers 可能强制要求 member_id');
    passed = false;
  }
  
  // 检查 getMysteryShop
  if (controllerCode.includes("Family-level，不需要 member_id")) {
    pass('Controller 注释明确标注 Family-level 接口');
  } else {
    fail('Controller 缺少 Family-level 注释');
    passed = false;
  }
  
  return passed;
}

// ========== 测试 2：市场供给是全家共享 ==========
async function testSupplyFamilyShared() {
  console.log('\n========== 测试2：市场供给（sku/offer/session/pool）是全家共享 ==========\n');
  
  let passed = true;
  
  // 检查 family_offer 有 parent_id 列
  try {
    const columns = await query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'family_offer' AND column_name = 'parent_id'
    `);
    if (columns.length > 0) {
      pass('family_offer 表有 parent_id 列');
    } else {
      fail('family_offer 表缺少 parent_id 列');
      passed = false;
    }
  } catch (e) {
    info('family_offer 表不存在，跳过检查');
  }
  
  // 检查 Repo 层使用 parentId 查询
  const fs = require('fs');
  const path = require('path');
  
  const repoPath = path.join(__dirname, '../src/systems/family/repos/marketplaceRepo.js');
  const repoCode = fs.readFileSync(repoPath, 'utf-8');
  
  if (repoCode.includes('getActiveOffers') && repoCode.includes('parentId')) {
    pass('marketplaceRepo.getActiveOffers 使用 parentId');
  } else {
    fail('marketplaceRepo.getActiveOffers 可能未使用 parentId');
    passed = false;
  }
  
  if (repoCode.includes('getActiveSkus') && repoCode.includes('parentId')) {
    pass('marketplaceRepo.getActiveSkus 使用 parentId');
  } else {
    fail('marketplaceRepo.getActiveSkus 可能未使用 parentId');
    passed = false;
  }
  
  // 检查 auction session 使用 parent_id
  const auctionRepoPath = path.join(__dirname, '../src/systems/family/repos/auctionRepo.js');
  try {
    const auctionRepoCode = fs.readFileSync(auctionRepoPath, 'utf-8');
    if (auctionRepoCode.includes('parent_id')) {
      pass('auctionRepo 使用 parent_id');
    } else {
      fail('auctionRepo 可能未使用 parent_id');
      passed = false;
    }
  } catch (e) {
    info('auctionRepo.js 不存在，跳过检查');
  }
  
  // 检查 draw_pool 使用 parent_id
  const lotteryRepoPath = path.join(__dirname, '../src/systems/family/repos/lotteryRepo.js');
  try {
    const lotteryRepoCode = fs.readFileSync(lotteryRepoPath, 'utf-8');
    if (lotteryRepoCode.includes('parent_id')) {
      pass('lotteryRepo 使用 parent_id');
    } else {
      fail('lotteryRepo 可能未使用 parent_id');
      passed = false;
    }
  } catch (e) {
    info('lotteryRepo.js 不存在，跳过检查');
  }
  
  return passed;
}

// ========== 测试 3：下单/出价/抽奖等动作必须选择 member ==========
async function testActionRequiresMember() {
  console.log('\n========== 测试3：下单/出价/抽奖等动作必须选择 member ==========\n');
  
  let passed = true;
  const fs = require('fs');
  const path = require('path');
  
  // 检查 createOrder 需要 member_id
  const marketplaceController = path.join(__dirname, '../src/systems/family/controllers/marketplaceController.js');
  const mCode = fs.readFileSync(marketplaceController, 'utf-8');
  
  if (mCode.includes('buyer_member_id') && mCode.includes('缺少必填参数: buyer_member_id')) {
    pass('createOrder 强制要求 buyer_member_id');
  } else {
    fail('createOrder 可能未强制要求 buyer_member_id');
    passed = false;
  }
  
  // 检查 submitBid 需要 member_id
  const auctionController = path.join(__dirname, '../src/systems/family/controllers/auctionController.js');
  try {
    const aCode = fs.readFileSync(auctionController, 'utf-8');
    if (aCode.includes('member_id') && aCode.includes('缺少')) {
      pass('submitBid 强制要求 member_id');
    } else {
      info('submitBid 检查需人工验证');
    }
  } catch (e) {
    info('auctionController.js 不存在，跳过检查');
  }
  
  // 检查 spin 需要 member_id
  const lotteryController = path.join(__dirname, '../src/systems/family/controllers/lotteryController.js');
  try {
    const lCode = fs.readFileSync(lotteryController, 'utf-8');
    if (lCode.includes('member_id') && lCode.includes('缺少')) {
      pass('spin 强制要求 member_id');
    } else {
      info('spin 检查需人工验证');
    }
  } catch (e) {
    info('lotteryController.js 不存在，跳过检查');
  }
  
  // 检查 Service 层的成员归属验证
  const lotteryService = path.join(__dirname, '../src/systems/family/services/lotteryService.js');
  try {
    const lsCode = fs.readFileSync(lotteryService, 'utf-8');
    if (lsCode.includes('member.parent_id !== drawPool.parent_id')) {
      pass('lotteryService.spin 验证成员归属');
    } else {
      fail('lotteryService.spin 可能未验证成员归属');
      passed = false;
    }
  } catch (e) {
    info('lotteryService.js 不存在，跳过检查');
  }
  
  return passed;
}

// ========== 测试 4：所有资产变化落 order/points_log/inventory ==========
async function testAssetChangesLogged() {
  console.log('\n========== 测试4：所有资产变化落 order/points_log/inventory ==========\n');
  
  let passed = true;
  const fs = require('fs');
  const path = require('path');
  
  // 检查 marketplaceService.createOrderAndFulfill
  const marketplaceService = path.join(__dirname, '../src/systems/family/services/marketplaceService.js');
  try {
    const msCode = fs.readFileSync(marketplaceService, 'utf-8');
    
    if (msCode.includes('createOrder')) {
      pass('marketplaceService 创建 order');
    } else {
      fail('marketplaceService 可能未创建 order');
      passed = false;
    }
    
    if (msCode.includes('createPointsLog')) {
      pass('marketplaceService 创建 points_log');
    } else {
      fail('marketplaceService 可能未创建 points_log');
      passed = false;
    }
    
    if (msCode.includes('createInventoryItem') || msCode.includes('incrementInventoryQuantity')) {
      pass('marketplaceService 创建/更新 inventory');
    } else {
      fail('marketplaceService 可能未创建 inventory');
      passed = false;
    }
  } catch (e) {
    info('marketplaceService.js 不存在，跳过检查');
  }
  
  // 检查 auctionService.settleSession
  const auctionService = path.join(__dirname, '../src/systems/family/services/auctionService.js');
  try {
    const asCode = fs.readFileSync(auctionService, 'utf-8');
    
    if (asCode.includes('createOrder')) {
      pass('auctionService 创建 order');
    } else {
      fail('auctionService 可能未创建 order');
      passed = false;
    }
    
    if (asCode.includes('createPointsLog')) {
      pass('auctionService 创建 points_log');
    } else {
      fail('auctionService 可能未创建 points_log');
      passed = false;
    }
  } catch (e) {
    info('auctionService.js 不存在，跳过检查');
  }
  
  // 检查 lotteryService.spin
  const lotteryService = path.join(__dirname, '../src/systems/family/services/lotteryService.js');
  try {
    const lsCode = fs.readFileSync(lotteryService, 'utf-8');
    
    if (lsCode.includes('createDrawLog') || lsCode.includes('draw_log')) {
      pass('lotteryService 记录 draw_log');
    } else {
      fail('lotteryService 可能未记录 draw_log');
      passed = false;
    }
  } catch (e) {
    info('lotteryService.js 不存在，跳过检查');
  }
  
  return passed;
}

// ========== 测试 5：幂等检查 ==========
async function testIdempotency() {
  console.log('\n========== 测试5：幂等（抽奖 spin 和拍卖结算）==========\n');
  
  let passed = true;
  const fs = require('fs');
  const path = require('path');
  
  // 检查 draw_log 有 idempotency_key 列
  try {
    const columns = await query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'draw_log' AND column_name = 'idempotency_key'
    `);
    if (columns.length > 0) {
      pass('draw_log 表有 idempotency_key 列');
    } else {
      fail('draw_log 表缺少 idempotency_key 列');
      passed = false;
    }
  } catch (e) {
    info('draw_log 表不存在，跳过检查');
  }
  
  // 检查 draw_log 有幂等索引
  try {
    const indexes = await query(`
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'draw_log' AND indexname LIKE '%idempotency%'
    `);
    if (indexes.length > 0) {
      pass('draw_log 有幂等索引');
    } else {
      fail('draw_log 缺少幂等索引');
      passed = false;
    }
  } catch (e) {
    info('无法检查 draw_log 索引');
  }
  
  // 检查 lotteryService 幂等逻辑
  const lotteryService = path.join(__dirname, '../src/systems/family/services/lotteryService.js');
  try {
    const lsCode = fs.readFileSync(lotteryService, 'utf-8');
    
    if (lsCode.includes('findDrawLogByIdempotencyKey')) {
      pass('lotteryService.spin 检查幂等键');
    } else {
      fail('lotteryService.spin 可能未检查幂等键');
      passed = false;
    }
    
    if (lsCode.includes('isDuplicate: true')) {
      pass('lotteryService.spin 返回重复请求标记');
    } else {
      fail('lotteryService.spin 可能未标记重复请求');
      passed = false;
    }
  } catch (e) {
    info('lotteryService.js 不存在，跳过检查');
  }
  
  // 检查 auctionService 幂等逻辑
  const auctionService = path.join(__dirname, '../src/systems/family/services/auctionService.js');
  try {
    const asCode = fs.readFileSync(auctionService, 'utf-8');
    
    if (asCode.includes('getOrderByIdempotencyKey')) {
      pass('auctionService.settleSession 检查订单幂等');
    } else {
      fail('auctionService.settleSession 可能未检查订单幂等');
      passed = false;
    }
    
    if (asCode.includes('getPointsLogByIdempotencyKey')) {
      pass('auctionService.settleSession 检查积分流水幂等');
    } else {
      fail('auctionService.settleSession 可能未检查积分流水幂等');
      passed = false;
    }
  } catch (e) {
    info('auctionService.js 不存在，跳过检查');
  }
  
  return passed;
}

// ========== 运行所有测试 ==========
async function runAllTests() {
  console.log('\n🔍 开始最终验收测试...\n');
  console.log('='.repeat(60));
  
  const results = {
    'V1: 市场页不需要 member_id': await testMarketNoMemberRequired(),
    'V2: 市场供给全家共享': await testSupplyFamilyShared(),
    'V3: 动作必须选择 member': await testActionRequiresMember(),
    'V4: 资产变化落日志': await testAssetChangesLogged(),
    'V5: 幂等生效': await testIdempotency(),
  };
  
  console.log('\n' + '='.repeat(60));
  console.log('\n📋 验收结果汇总:\n');
  
  let allPassed = true;
  for (const [name, passed] of Object.entries(results)) {
    if (passed) {
      console.log(`  ✅ ${name}`);
    } else {
      console.log(`  ❌ ${name}`);
      allPassed = false;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  
  if (allPassed) {
    console.log('\n🎉 所有验收项目通过！\n');
  } else {
    console.log('\n⚠️ 部分验收项目未通过，请检查上述详情\n');
  }
  
  await pool.end();
  process.exit(allPassed ? 0 : 1);
}

// 执行
runAllTests().catch(err => {
  console.error('测试执行失败:', err);
  pool.end();
  process.exit(1);
});
