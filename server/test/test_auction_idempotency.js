/**
 * 拍卖结算幂等性测试
 * 验证重复结算不会重复扣分/创建订单/库存
 */

const pool = require('../src/shared/config/db');
const marketplaceRepo = require('../src/systems/family/repos/marketplaceRepo');
const walletRepo = require('../src/systems/family/repos/walletRepo');

async function runTests() {
  console.log('🧪 开始测试拍卖结算幂等性...\n');
  
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
  
  // 测试 1: getOrderByIdempotencyKey 方法存在且正常工作
  await test('marketplaceRepo.getOrderByIdempotencyKey 方法正常', async () => {
    const userResult = await pool.query('SELECT id FROM users LIMIT 1');
    if (userResult.rows.length === 0) throw new Error('没有可用的用户');
    const parentId = userResult.rows[0].id;
    
    // 查询不存在的 key
    const result = await marketplaceRepo.getOrderByIdempotencyKey(
      parentId, 
      `not_exist_${Date.now()}`
    );
    
    if (result !== undefined && result !== null) throw new Error('应返回 null/undefined');
    console.log('      不存在的key返回: null ✓');
  })();
  
  // 测试 2: walletRepo.getPointsLogByIdempotencyKey 方法存在且正常工作
  await test('walletRepo.getPointsLogByIdempotencyKey 方法正常', async () => {
    const userResult = await pool.query('SELECT id FROM users LIMIT 1');
    const parentId = userResult.rows[0].id;
    
    const result = await walletRepo.getPointsLogByIdempotencyKey(
      parentId, 
      `not_exist_${Date.now()}`
    );
    
    if (result !== undefined && result !== null) throw new Error('应返回 null/undefined');
    console.log('      不存在的key返回: null ✓');
  })();
  
  // 测试 3: getInventoryByOrderId 方法存在
  await test('marketplaceRepo.getInventoryByOrderId 方法正常', async () => {
    // 查询不存在的订单ID
    const result = await marketplaceRepo.getInventoryByOrderId(-9999);
    
    if (result !== undefined && result !== null) throw new Error('应返回 null/undefined');
    console.log('      不存在的订单ID返回: null ✓');
  })();
  
  // 测试 4: 订单幂等键唯一约束
  await test('订单幂等键唯一约束生效', async () => {
    // 获取测试数据
    const userResult = await pool.query('SELECT id FROM users LIMIT 1');
    const parentId = userResult.rows[0].id;
    
    const memberResult = await pool.query(
      'SELECT id FROM family_members WHERE parent_id = $1 LIMIT 1', 
      [parentId]
    );
    if (memberResult.rows.length === 0) throw new Error('没有可用的成员');
    const memberId = memberResult.rows[0].id;
    
    const skuResult = await pool.query('SELECT id FROM family_sku LIMIT 1');
    if (skuResult.rows.length === 0) throw new Error('没有可用的SKU');
    const skuId = skuResult.rows[0].id;
    
    const idempotencyKey = `test_order_idem_${Date.now()}`;
    
    // 第一次创建
    await pool.query(`
      INSERT INTO family_market_order 
      (parent_id, member_id, sku_id, sku_name, cost, quantity, status, idempotency_key)
      VALUES ($1, $2, $3, '测试商品', 10, 1, 'paid', $4)
    `, [parentId, memberId, skuId, idempotencyKey]);
    
    // 第二次创建应该失败
    let duplicateFailed = false;
    try {
      await pool.query(`
        INSERT INTO family_market_order 
        (parent_id, member_id, sku_id, sku_name, cost, quantity, status, idempotency_key)
        VALUES ($1, $2, $3, '测试商品2', 20, 1, 'paid', $4)
      `, [parentId, memberId, skuId, idempotencyKey]);
    } catch (err) {
      if (err.code === '23505') { // 唯一约束违反
        duplicateFailed = true;
      }
    }
    
    // 清理
    await pool.query('DELETE FROM family_market_order WHERE idempotency_key = $1', [idempotencyKey]);
    
    if (!duplicateFailed) throw new Error('重复插入未被拒绝');
    console.log('      重复订单被唯一约束拒绝 ✓');
  })();
  
  // 测试 5: 积分流水幂等键唯一约束
  await test('积分流水幂等键唯一约束生效', async () => {
    const userResult = await pool.query('SELECT id FROM users LIMIT 1');
    const parentId = userResult.rows[0].id;
    
    const memberResult = await pool.query(
      'SELECT id FROM family_members WHERE parent_id = $1 LIMIT 1', 
      [parentId]
    );
    const memberId = memberResult.rows[0].id;
    
    const idempotencyKey = `test_points_idem_${Date.now()}`;
    
    // 第一次创建
    await pool.query(`
      INSERT INTO family_points_log 
      (member_id, parent_id, description, points_change, reason_code, idempotency_key)
      VALUES ($1, $2, '测试流水', -10, 'auction', $3)
    `, [memberId, parentId, idempotencyKey]);
    
    // 第二次创建应该失败
    let duplicateFailed = false;
    try {
      await pool.query(`
        INSERT INTO family_points_log 
        (member_id, parent_id, description, points_change, reason_code, idempotency_key)
        VALUES ($1, $2, '测试流水2', -20, 'auction', $3)
      `, [memberId, parentId, idempotencyKey]);
    } catch (err) {
      if (err.code === '23505') {
        duplicateFailed = true;
      }
    }
    
    // 清理
    await pool.query('DELETE FROM family_points_log WHERE idempotency_key = $1', [idempotencyKey]);
    
    if (!duplicateFailed) throw new Error('重复插入未被拒绝');
    console.log('      重复积分流水被唯一约束拒绝 ✓');
  })();
  
  // 测试 6: 模拟幂等结算流程
  await test('模拟幂等结算流程：订单复用', async () => {
    const userResult = await pool.query('SELECT id FROM users LIMIT 1');
    const parentId = userResult.rows[0].id;
    
    const memberResult = await pool.query(
      'SELECT id FROM family_members WHERE parent_id = $1 LIMIT 1', 
      [parentId]
    );
    const memberId = memberResult.rows[0].id;
    
    const skuResult = await pool.query('SELECT id FROM family_sku LIMIT 1');
    const skuId = skuResult.rows[0].id;
    
    const sessionId = 99999;
    const lotId = 88888;
    const idempotencyKey = `auction_${sessionId}_lot_${lotId}`;
    
    // 模拟第一次结算：创建订单
    const firstOrder = await pool.query(`
      INSERT INTO family_market_order 
      (parent_id, member_id, sku_id, sku_name, cost, quantity, status, idempotency_key)
      VALUES ($1, $2, $3, '拍卖商品', 50, 1, 'paid', $4)
      RETURNING *
    `, [parentId, memberId, skuId, idempotencyKey]);
    
    const orderId = firstOrder.rows[0].id;
    console.log(`      第一次结算创建订单ID: ${orderId}`);
    
    // 模拟第二次结算：幂等检查，复用订单
    const existingOrder = await marketplaceRepo.getOrderByIdempotencyKey(parentId, idempotencyKey);
    
    if (!existingOrder) throw new Error('应该找到已存在的订单');
    if (existingOrder.id !== orderId) throw new Error('复用的订单ID不匹配');
    
    console.log(`      第二次结算复用订单ID: ${existingOrder.id} ✓`);
    
    // 清理
    await pool.query('DELETE FROM family_market_order WHERE idempotency_key = $1', [idempotencyKey]);
  })();
  
  // 汇总
  console.log('\n' + '='.repeat(50));
  console.log(`测试完成: ${passed} 通过, ${failed} 失败`);
  console.log('='.repeat(50));
  
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('测试运行失败:', err);
  process.exit(1);
});
