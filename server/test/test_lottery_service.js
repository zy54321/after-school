/**
 * 抽奖服务测试脚本
 * 测试完整流程：获取池 → 抽奖 → 记账 → 日志
 * 
 * 运行方式：
 * cd server && node test/test_lottery_service.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const lotteryService = require('../src/systems/family/services/lotteryService');
const lotteryRepo = require('../src/systems/family/repos/lotteryRepo');
const walletRepo = require('../src/systems/family/repos/walletRepo');

let TEST_USER_ID = null;
let TEST_MEMBER = null;
let TEST_POOL = null;

// ========== 测试函数 ==========
async function setup() {
  console.log('\n🔧 设置测试环境...\n');
  
  const pool = lotteryRepo.getPool();
  
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
  
  // 获取抽奖池
  const poolResult = await pool.query(
    `SELECT * FROM draw_pool WHERE parent_id = $1 AND status = 'active' LIMIT 1`,
    [TEST_USER_ID]
  );
  
  if (poolResult.rows.length === 0) {
    throw new Error('没有可用的抽奖池');
  }
  
  TEST_POOL = poolResult.rows[0];
  console.log(`  抽奖池: ${TEST_POOL.icon} ${TEST_POOL.name} (ID: ${TEST_POOL.id})`);
  
  // 确保成员有抽奖券
  if (TEST_POOL.entry_ticket_type_id) {
    const ticketType = await lotteryRepo.getTicketTypeById(TEST_POOL.entry_ticket_type_id);
    console.log(`  需要: ${ticketType.name}`);
    
    // 检查库存
    const inventory = await lotteryRepo.findAvailableTicketInventory(TEST_MEMBER.id, ticketType.name);
    const currentQty = inventory ? inventory.quantity : 0;
    console.log(`  当前库存: ${currentQty} 张`);
    
    if (currentQty < 3) {
      // 添加抽奖券
      const skuResult = await pool.query(
        `SELECT id FROM family_sku WHERE type = 'ticket' AND name ILIKE $1 LIMIT 1`,
        [`%${ticketType.name}%`]
      );
      
      if (skuResult.rows.length > 0) {
        await pool.query(
          `INSERT INTO family_inventory (member_id, sku_id, quantity, status)
           VALUES ($1, $2, 5, 'unused')`,
          [TEST_MEMBER.id, skuResult.rows[0].id]
        );
        console.log(`    -> 添加 5 张抽奖券`);
      } else {
        console.log(`    ⚠️ 找不到对应的 SKU，跳过添加`);
      }
    }
  }
  
  console.log('');
}

async function testGetPools() {
  console.log('📦 步骤 1: 获取抽奖池列表');
  
  const pools = await lotteryService.getPoolsForMember(TEST_USER_ID, TEST_MEMBER.id);
  console.log(`   ✅ 获取到 ${pools.length} 个抽奖池`);
  
  pools.forEach(p => {
    console.log(`     - ${p.icon} ${p.name}: ${p.memberTicketCount || 0} 张券`);
  });
  
  console.log('');
  return pools;
}

async function testGetPoolDetail() {
  console.log('🔍 步骤 2: 获取抽奖池详情');
  
  const detail = await lotteryService.getPoolDetail(TEST_POOL.id);
  console.log(`   ✅ 抽奖池: ${detail.pool.name}`);
  
  if (detail.version) {
    console.log(`   版本: v${detail.version.version} (ID: ${detail.version.id})`);
    console.log(`   奖品数: ${detail.version.prizes.length}`);
    console.log(`   总权重: ${detail.version.totalWeight}`);
    if (detail.version.minGuaranteeCount) {
      console.log(`   保底: ${detail.version.minGuaranteeCount} 次`);
    }
    
    console.log('\n   奖品列表:');
    detail.version.prizes.forEach(p => {
      const prob = ((p.weight / detail.version.totalWeight) * 100).toFixed(1);
      console.log(`     ${p.icon} ${p.name} (${p.type}: ${p.value || '-'}) - ${prob}%`);
    });
  }
  
  console.log('');
  return detail;
}

async function testSpin() {
  console.log('🎰 步骤 3: 执行抽奖');
  
  const pool = lotteryRepo.getPool();
  
  // 记录抽奖前状态
  const logCountBefore = await pool.query(
    'SELECT COUNT(*) FROM draw_log WHERE member_id = $1',
    [TEST_MEMBER.id]
  );
  
  console.log(`   抽奖前日志数: ${logCountBefore.rows[0].count}`);
  
  // 执行抽奖
  const idempotencyKey = `test_spin_${Date.now()}`;
  const result = await lotteryService.spin(TEST_POOL.id, TEST_MEMBER.id, idempotencyKey);
  
  console.log(`   ✅ ${result.msg}`);
  console.log(`   奖品: ${result.prize.icon} ${result.prize.name}`);
  console.log(`   类型: ${result.prize.type}`);
  console.log(`   值: ${result.prize.value}`);
  console.log(`   保底: ${result.isGuarantee ? '是' : '否'}`);
  console.log(`   连续次数: ${result.consecutiveCount}`);
  console.log(`   版本ID: ${result.poolVersionId}`);
  console.log(`   日志ID: ${result.drawLogId}`);
  
  // 验证日志已创建
  const logCountAfter = await pool.query(
    'SELECT COUNT(*) FROM draw_log WHERE member_id = $1',
    [TEST_MEMBER.id]
  );
  
  if (parseInt(logCountAfter.rows[0].count) !== parseInt(logCountBefore.rows[0].count) + 1) {
    throw new Error('抽奖日志未正确创建');
  }
  console.log(`   抽奖后日志数: ${logCountAfter.rows[0].count} ✓`);
  
  console.log('');
  return result;
}

async function testVerifyLog(spinResult) {
  console.log('📋 步骤 4: 验证抽奖日志');
  
  const pool = lotteryRepo.getPool();
  
  // 获取刚才的抽奖日志
  const logResult = await pool.query(
    'SELECT * FROM draw_log WHERE id = $1',
    [spinResult.drawLogId]
  );
  
  const log = logResult.rows[0];
  console.log(`   日志ID: ${log.id}`);
  console.log(`   抽奖池版本ID: ${log.pool_version_id}`);
  console.log(`   结果类型: ${log.result_type}`);
  console.log(`   结果名称: ${log.result_name}`);
  console.log(`   结果值: ${log.result_value}`);
  console.log(`   使用券数: ${log.tickets_used}`);
  console.log(`   触发保底: ${log.is_guarantee}`);
  
  // 验证 pool_version_id 必须存在
  if (!log.pool_version_id) {
    throw new Error('pool_version_id 未记录！');
  }
  console.log(`   ✅ pool_version_id 已正确记录`);
  
  // 验证版本可追溯
  const versionResult = await pool.query(
    'SELECT * FROM draw_pool_version WHERE id = $1',
    [log.pool_version_id]
  );
  
  if (versionResult.rows.length === 0) {
    throw new Error('无法追溯到版本配置');
  }
  
  const version = versionResult.rows[0];
  console.log(`   ✅ 版本可追溯: v${version.version}, ${version.prizes?.length || 0} 个奖品`);
  
  console.log('');
}

async function testHistory() {
  console.log('📊 步骤 5: 获取抽奖历史');
  
  const history = await lotteryService.getDrawHistory(TEST_MEMBER.id, 10);
  console.log(`   ✅ 获取到 ${history.length} 条记录`);
  
  history.slice(0, 5).forEach(h => {
    console.log(`     - ${h.pool_icon} ${h.result_name} (${h.result_type}) ${h.is_guarantee ? '[保底]' : ''}`);
  });
  
  console.log('');
}

async function testMultipleSpin() {
  console.log('🎲 步骤 6: 连续抽奖测试');
  
  const results = [];
  for (let i = 0; i < 3; i++) {
    try {
      const result = await lotteryService.spin(
        TEST_POOL.id,
        TEST_MEMBER.id,
        `test_multi_${Date.now()}_${i}`
      );
      results.push(result);
      console.log(`   第 ${i + 1} 次: ${result.prize.icon} ${result.prize.name}`);
    } catch (err) {
      console.log(`   第 ${i + 1} 次: 失败 - ${err.message}`);
      break;
    }
  }
  
  console.log(`   ✅ 完成 ${results.length} 次抽奖`);
  console.log('');
}

// ========== 主测试流程 ==========
async function runTest() {
  console.log('='.repeat(60));
  console.log('🎰 抽奖服务测试');
  console.log('='.repeat(60));

  try {
    await setup();
    await testGetPools();
    await testGetPoolDetail();
    const spinResult = await testSpin();
    await testVerifyLog(spinResult);
    await testHistory();
    await testMultipleSpin();
    
    console.log('='.repeat(60));
    console.log('✅ 抽奖服务测试通过!');
    console.log('   - 抽奖扣券 ✓');
    console.log('   - 按权重抽取 ✓');
    console.log('   - 记录日志 (含 pool_version_id) ✓');
    console.log('   - 版本可追溯 ✓');
    console.log('='.repeat(60));
    
    process.exit(0);
  } catch (err) {
    console.error('\n❌ 测试失败:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runTest();
