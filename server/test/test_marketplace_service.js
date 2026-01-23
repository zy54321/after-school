/**
 * Marketplace Service 测试脚本
 * 
 * 测试内容：
 * 1. 获取余额
 * 2. 获取流水列表
 * 3. 创建订单并履约
 * 4. 幂等性测试（重复请求不重复扣分）
 * 
 * 运行方式：
 * cd server && node test/test_marketplace_service.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const marketplaceService = require('../src/systems/family/services/marketplaceService');
const walletService = require('../src/systems/family/services/walletService');
const walletRepo = require('../src/systems/family/repos/walletRepo');
const marketplaceRepo = require('../src/systems/family/repos/marketplaceRepo');

// 测试用的成员ID（根据实际数据调整）
let TEST_MEMBER_ID = null;
let TEST_SKU_ID = 1;

async function setup() {
  console.log('\n🔧 设置测试环境...\n');
  
  // 获取一个测试成员
  const pool = walletRepo.getPool();
  const result = await pool.query('SELECT id, name, parent_id FROM family_members LIMIT 1');
  
  if (result.rows.length === 0) {
    throw new Error('没有找到测试成员，请先运行 seed');
  }
  
  TEST_MEMBER_ID = result.rows[0].id;
  console.log(`  测试成员: ${result.rows[0].name} (ID: ${TEST_MEMBER_ID})`);
  
  // 检查是否有测试 SKU
  const skuResult = await pool.query('SELECT id, name FROM family_sku WHERE is_active = TRUE LIMIT 1');
  if (skuResult.rows.length > 0) {
    TEST_SKU_ID = skuResult.rows[0].id;
    console.log(`  测试 SKU: ${skuResult.rows[0].name} (ID: ${TEST_SKU_ID})`);
  }
  
  // 为测试添加一些积分（如果余额不足）
  const balance = await walletService.getBalance(TEST_MEMBER_ID);
  console.log(`  当前余额: ${balance} 积分`);
  
  if (balance < 100) {
    console.log('  ⚠️ 余额不足，添加测试积分...');
    const member = await walletRepo.getMemberById(TEST_MEMBER_ID);
    await walletRepo.createPointsLog({
      memberId: TEST_MEMBER_ID,
      parentId: member.parent_id,
      description: '测试积分充值',
      pointsChange: 200,
      reasonCode: 'manual',
    });
    console.log('  ✅ 已添加 200 测试积分');
  }
}

async function testGetBalance() {
  console.log('\n📋 测试 1: walletService.getBalance()');
  console.log('─'.repeat(50));
  
  const balance = await walletService.getBalance(TEST_MEMBER_ID);
  console.log(`  余额: ${balance} 积分`);
  console.log('  ✅ 测试通过\n');
  
  return balance;
}

async function testListLogs() {
  console.log('\n📋 测试 2: walletService.listLogs()');
  console.log('─'.repeat(50));
  
  const result = await walletService.listLogs(TEST_MEMBER_ID, { limit: 5 });
  console.log(`  总记录数: ${result.total}`);
  console.log(`  本次返回: ${result.logs.length} 条`);
  
  if (result.logs.length > 0) {
    console.log('  最近流水:');
    result.logs.slice(0, 3).forEach((log, i) => {
      console.log(`    ${i + 1}. ${log.description} | ${log.points_change > 0 ? '+' : ''}${log.points_change} | ${log.reason_code || '-'}`);
    });
  }
  
  console.log('  ✅ 测试通过\n');
  return result;
}

async function testCreateOrderAndFulfill() {
  console.log('\n📋 测试 3: marketplaceService.createOrderAndFulfill()');
  console.log('─'.repeat(50));
  
  const idempotencyKey = `test_order_${Date.now()}`;
  const balanceBefore = await walletService.getBalance(TEST_MEMBER_ID);
  
  console.log(`  兑换前余额: ${balanceBefore} 积分`);
  console.log(`  幂等键: ${idempotencyKey}`);
  
  try {
    const result = await marketplaceService.createOrderAndFulfill({
      memberId: TEST_MEMBER_ID,
      skuId: TEST_SKU_ID,
      quantity: 1,
      idempotencyKey,
    });
    
    const balanceAfter = await walletService.getBalance(TEST_MEMBER_ID);
    
    console.log(`  订单ID: ${result.order.id}`);
    console.log(`  订单状态: ${result.order.status}`);
    console.log(`  扣除积分: ${result.order.cost}`);
    console.log(`  兑换后余额: ${balanceAfter} 积分`);
    console.log(`  消息: ${result.msg}`);
    console.log('  ✅ 测试通过\n');
    
    return { success: true, idempotencyKey, order: result.order };
  } catch (err) {
    console.log(`  ❌ 错误: ${err.message}`);
    
    // 如果是积分不足，继续其他测试
    if (err.message.includes('积分不足')) {
      console.log('  ⚠️ 积分不足，跳过此测试\n');
      return { success: false, error: err.message };
    }
    
    throw err;
  }
}

async function testIdempotency(idempotencyKey) {
  console.log('\n📋 测试 4: 幂等性测试（重复请求）');
  console.log('─'.repeat(50));
  
  if (!idempotencyKey) {
    console.log('  ⚠️ 没有可用的幂等键，跳过测试\n');
    return;
  }
  
  const balanceBefore = await walletService.getBalance(TEST_MEMBER_ID);
  console.log(`  使用相同幂等键: ${idempotencyKey}`);
  console.log(`  当前余额: ${balanceBefore} 积分`);
  
  try {
    const result = await marketplaceService.createOrderAndFulfill({
      memberId: TEST_MEMBER_ID,
      skuId: TEST_SKU_ID,
      quantity: 1,
      idempotencyKey,
    });
    
    const balanceAfter = await walletService.getBalance(TEST_MEMBER_ID);
    
    console.log(`  幂等返回: ${result.idempotent ? '是' : '否'}`);
    console.log(`  请求后余额: ${balanceAfter} 积分`);
    
    if (result.idempotent && balanceBefore === balanceAfter) {
      console.log('  ✅ 幂等性测试通过 - 重复请求未重复扣分\n');
    } else if (result.idempotent) {
      console.log('  ⚠️ 返回幂等但余额有变化，需检查\n');
    } else {
      console.log('  ❌ 幂等性测试失败 - 重复请求创建了新订单\n');
    }
  } catch (err) {
    console.log(`  ❌ 错误: ${err.message}\n`);
  }
}

async function testWalletOverview() {
  console.log('\n📋 测试 5: walletService.getWalletOverview()');
  console.log('─'.repeat(50));
  
  const overview = await walletService.getWalletOverview(TEST_MEMBER_ID);
  console.log(`  当前余额: ${overview.balance} 积分`);
  console.log(`  累计获得: ${overview.totalEarned} 积分`);
  console.log(`  累计消费: ${overview.totalSpent} 积分`);
  console.log('  ✅ 测试通过\n');
}

async function cleanup() {
  console.log('\n🧹 清理测试环境...');
  const pool = walletRepo.getPool();
  await pool.end();
  console.log('  数据库连接已关闭\n');
}

async function main() {
  console.log('='.repeat(60));
  console.log('🧪 Marketplace & Wallet Service 测试');
  console.log('='.repeat(60));
  
  try {
    await setup();
    
    // 测试 1: 获取余额
    await testGetBalance();
    
    // 测试 2: 获取流水列表
    await testListLogs();
    
    // 测试 3: 创建订单
    const orderResult = await testCreateOrderAndFulfill();
    
    // 测试 4: 幂等性测试
    if (orderResult.success) {
      await testIdempotency(orderResult.idempotencyKey);
    }
    
    // 测试 5: 钱包概览
    await testWalletOverview();
    
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
