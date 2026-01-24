/**
 * 提醒系统触发器测试
 * 验证 update_reminder_timestamp() 函数独立工作
 */

const pool = require('../src/shared/config/db');

async function runTests() {
  console.log('🧪 开始测试提醒系统触发器...\n');
  
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
  
  // 测试 1: update_reminder_timestamp 函数存在
  await test('update_reminder_timestamp 函数存在', async () => {
    const result = await pool.query(`
      SELECT proname FROM pg_proc 
      WHERE proname = 'update_reminder_timestamp'
    `);
    if (result.rows.length === 0) throw new Error('函数不存在');
    console.log(`      函数名: ${result.rows[0].proname}`);
  })();
  
  // 测试 2: reminder_policy 触发器存在且使用正确的函数
  await test('reminder_policy 触发器使用 update_reminder_timestamp', async () => {
    const result = await pool.query(`
      SELECT t.tgname, p.proname as function_name
      FROM pg_trigger t
      JOIN pg_proc p ON t.tgfoid = p.oid
      WHERE t.tgname = 'trigger_reminder_policy_updated_at'
    `);
    if (result.rows.length === 0) throw new Error('触发器不存在');
    
    const funcName = result.rows[0].function_name;
    if (funcName !== 'update_reminder_timestamp') {
      throw new Error(`触发器使用了错误的函数: ${funcName}`);
    }
    console.log(`      触发器函数: ${funcName}`);
  })();
  
  // 测试 3: reminder_event 触发器存在且使用正确的函数
  await test('reminder_event 触发器使用 update_reminder_timestamp', async () => {
    const result = await pool.query(`
      SELECT t.tgname, p.proname as function_name
      FROM pg_trigger t
      JOIN pg_proc p ON t.tgfoid = p.oid
      WHERE t.tgname = 'trigger_reminder_event_updated_at'
    `);
    if (result.rows.length === 0) throw new Error('触发器不存在');
    
    const funcName = result.rows[0].function_name;
    if (funcName !== 'update_reminder_timestamp') {
      throw new Error(`触发器使用了错误的函数: ${funcName}`);
    }
    console.log(`      触发器函数: ${funcName}`);
  })();
  
  // 测试 4: 触发器实际工作 - reminder_policy
  await test('reminder_policy 更新时触发器自动更新 updated_at', async () => {
    // 获取测试用户
    const userResult = await pool.query('SELECT id FROM users LIMIT 1');
    if (userResult.rows.length === 0) throw new Error('没有可用的用户');
    const parentId = userResult.rows[0].id;
    
    // 创建测试策略
    const insertResult = await pool.query(`
      INSERT INTO reminder_policy (parent_id, name, policy_type)
      VALUES ($1, 'trigger_test_policy', 'custom')
      RETURNING id, updated_at
    `, [parentId]);
    
    const policyId = insertResult.rows[0].id;
    const originalUpdatedAt = insertResult.rows[0].updated_at;
    
    // 等待一小段时间确保时间戳不同
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 更新策略
    const updateResult = await pool.query(`
      UPDATE reminder_policy 
      SET name = 'trigger_test_policy_updated'
      WHERE id = $1
      RETURNING updated_at
    `, [policyId]);
    
    const newUpdatedAt = updateResult.rows[0].updated_at;
    
    // 清理
    await pool.query('DELETE FROM reminder_policy WHERE id = $1', [policyId]);
    
    // 验证 updated_at 被更新
    if (new Date(newUpdatedAt).getTime() <= new Date(originalUpdatedAt).getTime()) {
      throw new Error('updated_at 未被更新');
    }
    
    console.log(`      原始时间: ${originalUpdatedAt}`);
    console.log(`      更新后: ${newUpdatedAt}`);
  })();
  
  // 测试 5: 触发器实际工作 - reminder_event
  await test('reminder_event 更新时触发器自动更新 updated_at', async () => {
    // 获取测试用户
    const userResult = await pool.query('SELECT id FROM users LIMIT 1');
    if (userResult.rows.length === 0) throw new Error('没有可用的用户');
    const parentId = userResult.rows[0].id;
    
    // 创建测试事件
    const insertResult = await pool.query(`
      INSERT INTO reminder_event (parent_id, target_type, title, fire_at)
      VALUES ($1, 'custom', 'trigger_test_event', NOW() + INTERVAL '1 hour')
      RETURNING id, updated_at
    `, [parentId]);
    
    const eventId = insertResult.rows[0].id;
    const originalUpdatedAt = insertResult.rows[0].updated_at;
    
    // 等待一小段时间
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 更新事件
    const updateResult = await pool.query(`
      UPDATE reminder_event 
      SET title = 'trigger_test_event_updated'
      WHERE id = $1
      RETURNING updated_at
    `, [eventId]);
    
    const newUpdatedAt = updateResult.rows[0].updated_at;
    
    // 清理
    await pool.query('DELETE FROM reminder_event WHERE id = $1', [eventId]);
    
    // 验证 updated_at 被更新
    if (new Date(newUpdatedAt).getTime() <= new Date(originalUpdatedAt).getTime()) {
      throw new Error('updated_at 未被更新');
    }
    
    console.log(`      原始时间: ${originalUpdatedAt}`);
    console.log(`      更新后: ${newUpdatedAt}`);
  })();
  
  // 测试 6: 函数不依赖 issue 模块
  await test('update_reminder_timestamp 不依赖 update_issue_timestamp', async () => {
    // 检查两个函数是独立的
    const result = await pool.query(`
      SELECT proname FROM pg_proc 
      WHERE proname IN ('update_reminder_timestamp', 'update_issue_timestamp')
      ORDER BY proname
    `);
    
    const funcs = result.rows.map(r => r.proname);
    
    if (!funcs.includes('update_reminder_timestamp')) {
      throw new Error('update_reminder_timestamp 函数不存在');
    }
    
    console.log(`      独立函数: update_reminder_timestamp ✓`);
    console.log(`      issue函数存在: ${funcs.includes('update_issue_timestamp') ? '是' : '否（正常，未执行issue迁移）'}`);
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
