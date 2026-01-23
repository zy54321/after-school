/**
 * 提醒系统表迁移测试
 * 验证 008_reminder_system.sql 迁移是否正确执行
 */

const pool = require('../src/shared/config/db');

async function runTests() {
  console.log('🧪 开始测试提醒系统表迁移...\n');
  
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
  
  // 测试 1: reminder_policy 表存在
  await test('reminder_policy 表存在', async () => {
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'reminder_policy'
      ORDER BY ordinal_position
    `);
    if (result.rows.length === 0) throw new Error('表不存在');
    console.log(`      列数: ${result.rows.length}`);
  })();
  
  // 测试 2: reminder_event 表存在
  await test('reminder_event 表存在', async () => {
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'reminder_event'
      ORDER BY ordinal_position
    `);
    if (result.rows.length === 0) throw new Error('表不存在');
    console.log(`      列数: ${result.rows.length}`);
  })();
  
  // 测试 3: reminder_policy 外键约束
  await test('reminder_policy 外键约束存在', async () => {
    const result = await pool.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'reminder_policy' 
        AND constraint_type = 'FOREIGN KEY'
    `);
    if (result.rows.length === 0) throw new Error('外键约束不存在');
    console.log(`      外键数: ${result.rows.length}`);
  })();
  
  // 测试 4: reminder_event 外键约束
  await test('reminder_event 外键约束存在', async () => {
    const result = await pool.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'reminder_event' 
        AND constraint_type = 'FOREIGN KEY'
    `);
    if (result.rows.length < 2) throw new Error('外键约束不完整');
    console.log(`      外键数: ${result.rows.length}`);
  })();
  
  // 测试 5: 可以插入 reminder_policy
  await test('可以插入 reminder_policy', async () => {
    // 首先获取一个有效的 parent_id
    const userResult = await pool.query('SELECT id FROM users LIMIT 1');
    if (userResult.rows.length === 0) throw new Error('没有可用的用户');
    const parentId = userResult.rows[0].id;
    
    const result = await pool.query(`
      INSERT INTO reminder_policy (parent_id, name, policy_type, config, channels, status)
      VALUES ($1, '测试策略-' || NOW(), 'custom', '{"test": true}'::jsonb, ARRAY['app'], 'active')
      RETURNING id, name
    `, [parentId]);
    
    if (result.rows.length === 0) throw new Error('插入失败');
    console.log(`      新策略ID: ${result.rows[0].id}, 名称: ${result.rows[0].name}`);
  })();
  
  // 测试 6: 可以插入 reminder_event
  await test('可以插入 reminder_event', async () => {
    // 获取有效的 parent_id 和 member_id
    const userResult = await pool.query('SELECT id FROM users LIMIT 1');
    if (userResult.rows.length === 0) throw new Error('没有可用的用户');
    const parentId = userResult.rows[0].id;
    
    const memberResult = await pool.query('SELECT id FROM family_members WHERE parent_id = $1 LIMIT 1', [parentId]);
    const memberId = memberResult.rows.length > 0 ? memberResult.rows[0].id : null;
    
    const result = await pool.query(`
      INSERT INTO reminder_event (parent_id, member_id, target_type, target_id, title, message, fire_at, channel, status)
      VALUES ($1, $2, 'task', 1, '测试提醒', '这是一条测试提醒消息', NOW() + INTERVAL '1 hour', 'app', 'pending')
      RETURNING id, title, status
    `, [parentId, memberId]);
    
    if (result.rows.length === 0) throw new Error('插入失败');
    console.log(`      新事件ID: ${result.rows[0].id}, 标题: ${result.rows[0].title}, 状态: ${result.rows[0].status}`);
  })();
  
  // 测试 7: 可以更新 reminder_event 状态
  await test('可以更新 reminder_event 状态', async () => {
    const result = await pool.query(`
      UPDATE reminder_event 
      SET status = 'sent', fired_at = NOW()
      WHERE title = '测试提醒' 
      RETURNING id, status, fired_at
    `);
    
    if (result.rows.length === 0) throw new Error('更新失败');
    console.log(`      更新后状态: ${result.rows[0].status}`);
  })();
  
  // 测试 8: 索引存在
  await test('索引存在', async () => {
    const result = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename IN ('reminder_policy', 'reminder_event')
    `);
    if (result.rows.length < 5) throw new Error('索引数量不足');
    console.log(`      索引数: ${result.rows.length}`);
  })();
  
  // 测试 9: 待发送提醒视图
  await test('v_pending_reminders 视图存在', async () => {
    const result = await pool.query(`
      SELECT * FROM v_pending_reminders LIMIT 1
    `);
    console.log(`      视图查询成功`);
  })();
  
  // 测试 10: 提醒统计视图
  await test('v_reminder_stats 视图存在', async () => {
    const result = await pool.query(`
      SELECT * FROM v_reminder_stats LIMIT 1
    `);
    console.log(`      视图查询成功`);
  })();
  
  // 测试 11: 种子数据验证
  await test('种子数据存在', async () => {
    const policyResult = await pool.query('SELECT COUNT(*) as count FROM reminder_policy');
    const eventResult = await pool.query('SELECT COUNT(*) as count FROM reminder_event');
    
    console.log(`      策略数: ${policyResult.rows[0].count}, 事件数: ${eventResult.rows[0].count}`);
  })();
  
  // 测试 12: 可以按状态查询 reminder_event
  await test('可以按状态查询 reminder_event', async () => {
    const result = await pool.query(`
      SELECT status, COUNT(*) as count 
      FROM reminder_event 
      GROUP BY status
    `);
    console.log(`      状态分布: ${result.rows.map(r => `${r.status}:${r.count}`).join(', ')}`);
  })();
  
  // 测试 13: 可以关联策略和事件
  await test('策略与事件关联正确', async () => {
    const result = await pool.query(`
      SELECT re.id as event_id, rp.name as policy_name
      FROM reminder_event re
      JOIN reminder_policy rp ON re.policy_id = rp.id
      LIMIT 3
    `);
    console.log(`      关联事件数: ${result.rows.length}`);
  })();
  
  // 清理测试数据
  await test('清理测试数据', async () => {
    await pool.query(`DELETE FROM reminder_event WHERE title = '测试提醒'`);
    await pool.query(`DELETE FROM reminder_policy WHERE name LIKE '测试策略-%'`);
    console.log(`      已清理`);
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
