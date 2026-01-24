/**
 * 抽奖幂等性测试
 * 验证重复请求不会重复扣券/发奖
 */

const pool = require('../src/shared/config/db');
const lotteryRepo = require('../src/systems/family/repos/lotteryRepo');

async function runTests() {
  console.log('🧪 开始测试抽奖幂等性...\n');
  
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
  
  // 测试 1: draw_log 表有 idempotency_key 字段
  await test('draw_log 表有 idempotency_key 字段', async () => {
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'draw_log' AND column_name = 'idempotency_key'
    `);
    if (result.rows.length === 0) throw new Error('字段不存在');
    console.log(`      字段类型: ${result.rows[0].data_type}`);
  })();
  
  // 测试 2: 唯一索引存在
  await test('唯一索引 idx_draw_log_idempotency 存在', async () => {
    const result = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'draw_log' AND indexname = 'idx_draw_log_idempotency'
    `);
    if (result.rows.length === 0) throw new Error('索引不存在');
    console.log(`      索引名: ${result.rows[0].indexname}`);
  })();
  
  // 测试 3: 可以插入带 idempotency_key 的记录
  await test('可以插入带 idempotency_key 的记录', async () => {
    // 获取测试数据
    const userResult = await pool.query('SELECT id FROM users LIMIT 1');
    if (userResult.rows.length === 0) throw new Error('没有可用的用户');
    const parentId = userResult.rows[0].id;
    
    const memberResult = await pool.query('SELECT id FROM family_members WHERE parent_id = $1 LIMIT 1', [parentId]);
    if (memberResult.rows.length === 0) throw new Error('没有可用的成员');
    const memberId = memberResult.rows[0].id;
    
    const poolResult = await pool.query('SELECT id FROM draw_pool LIMIT 1');
    if (poolResult.rows.length === 0) throw new Error('没有可用的抽奖池');
    const poolId = poolResult.rows[0].id;
    
    const versionResult = await pool.query('SELECT id FROM draw_pool_version WHERE pool_id = $1 LIMIT 1', [poolId]);
    if (versionResult.rows.length === 0) throw new Error('没有可用的抽奖池版本');
    const versionId = versionResult.rows[0].id;
    
    const idempotencyKey = `test_idempotency_${Date.now()}`;
    
    const result = await pool.query(`
      INSERT INTO draw_log (
        parent_id, member_id, pool_id, pool_version_id,
        result_type, result_name, result_value, idempotency_key
      ) VALUES ($1, $2, $3, $4, 'points', '测试奖品', 10, $5)
      RETURNING id, idempotency_key
    `, [parentId, memberId, poolId, versionId, idempotencyKey]);
    
    if (result.rows.length === 0) throw new Error('插入失败');
    console.log(`      记录ID: ${result.rows[0].id}, 幂等键: ${result.rows[0].idempotency_key}`);
    
    // 清理
    await pool.query('DELETE FROM draw_log WHERE idempotency_key = $1', [idempotencyKey]);
  })();
  
  // 测试 4: 重复 idempotency_key 会被拒绝
  await test('重复 idempotency_key 被唯一约束拒绝', async () => {
    // 获取测试数据
    const userResult = await pool.query('SELECT id FROM users LIMIT 1');
    const parentId = userResult.rows[0].id;
    
    const memberResult = await pool.query('SELECT id FROM family_members WHERE parent_id = $1 LIMIT 1', [parentId]);
    const memberId = memberResult.rows[0].id;
    
    const poolResult = await pool.query('SELECT id FROM draw_pool LIMIT 1');
    const poolId = poolResult.rows[0].id;
    
    const versionResult = await pool.query('SELECT id FROM draw_pool_version WHERE pool_id = $1 LIMIT 1', [poolId]);
    const versionId = versionResult.rows[0].id;
    
    const idempotencyKey = `test_duplicate_${Date.now()}`;
    
    // 第一次插入
    await pool.query(`
      INSERT INTO draw_log (
        parent_id, member_id, pool_id, pool_version_id,
        result_type, result_name, result_value, idempotency_key
      ) VALUES ($1, $2, $3, $4, 'points', '测试奖品', 10, $5)
    `, [parentId, memberId, poolId, versionId, idempotencyKey]);
    
    // 第二次插入相同 key 应该失败
    let duplicateFailed = false;
    try {
      await pool.query(`
        INSERT INTO draw_log (
          parent_id, member_id, pool_id, pool_version_id,
          result_type, result_name, result_value, idempotency_key
        ) VALUES ($1, $2, $3, $4, 'points', '测试奖品2', 20, $5)
      `, [parentId, memberId, poolId, versionId, idempotencyKey]);
    } catch (err) {
      if (err.code === '23505') { // 唯一约束违反
        duplicateFailed = true;
      }
    }
    
    // 清理
    await pool.query('DELETE FROM draw_log WHERE idempotency_key = $1', [idempotencyKey]);
    
    if (!duplicateFailed) throw new Error('重复插入未被拒绝');
    console.log('      重复请求被唯一约束正确拒绝');
  })();
  
  // 测试 5: findDrawLogByIdempotencyKey 方法工作正常
  await test('findDrawLogByIdempotencyKey 方法正常', async () => {
    // 获取测试数据
    const userResult = await pool.query('SELECT id FROM users LIMIT 1');
    const parentId = userResult.rows[0].id;
    
    const memberResult = await pool.query('SELECT id FROM family_members WHERE parent_id = $1 LIMIT 1', [parentId]);
    const memberId = memberResult.rows[0].id;
    
    const poolResult = await pool.query('SELECT id FROM draw_pool LIMIT 1');
    const poolId = poolResult.rows[0].id;
    
    const versionResult = await pool.query('SELECT id FROM draw_pool_version WHERE pool_id = $1 LIMIT 1', [poolId]);
    const versionId = versionResult.rows[0].id;
    
    const idempotencyKey = `test_find_${Date.now()}`;
    
    // 插入记录
    await pool.query(`
      INSERT INTO draw_log (
        parent_id, member_id, pool_id, pool_version_id,
        result_type, result_name, result_value, idempotency_key
      ) VALUES ($1, $2, $3, $4, 'points', '查询测试', 15, $5)
    `, [parentId, memberId, poolId, versionId, idempotencyKey]);
    
    // 使用 repo 方法查找
    const found = await lotteryRepo.findDrawLogByIdempotencyKey(parentId, idempotencyKey);
    
    // 清理
    await pool.query('DELETE FROM draw_log WHERE idempotency_key = $1', [idempotencyKey]);
    
    if (!found) throw new Error('未找到记录');
    if (found.result_name !== '查询测试') throw new Error('查询结果不正确');
    console.log(`      找到记录: ${found.result_name}, 值: ${found.result_value}`);
  })();
  
  // 测试 6: 不存在的 idempotency_key 返回 null
  await test('不存在的 idempotency_key 返回 null', async () => {
    const userResult = await pool.query('SELECT id FROM users LIMIT 1');
    const parentId = userResult.rows[0].id;
    
    const found = await lotteryRepo.findDrawLogByIdempotencyKey(parentId, `not_exist_${Date.now()}`);
    
    if (found !== null && found !== undefined) throw new Error('应返回 null');
    console.log('      正确返回 null');
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
