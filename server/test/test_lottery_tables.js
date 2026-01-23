/**
 * 抽奖系统核心表测试脚本
 * 验证表结构和基本 CRUD
 * 
 * 运行方式：
 * cd server && node test/test_lottery_tables.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = require('../src/shared/config/db');

async function testTableStructure() {
  console.log('📋 验证表结构...\n');
  
  // 1. ticket_type
  const ticketTypeCols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'ticket_type'
    ORDER BY ordinal_position
  `);
  console.log(`  ticket_type: ${ticketTypeCols.rows.length} 列`);
  if (ticketTypeCols.rows.length < 10) {
    throw new Error('ticket_type 列数不足');
  }
  
  // 2. draw_pool
  const drawPoolCols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'draw_pool'
    ORDER BY ordinal_position
  `);
  console.log(`  draw_pool: ${drawPoolCols.rows.length} 列`);
  if (drawPoolCols.rows.length < 10) {
    throw new Error('draw_pool 列数不足');
  }
  
  // 3. draw_pool_version
  const versionCols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'draw_pool_version'
    ORDER BY ordinal_position
  `);
  console.log(`  draw_pool_version: ${versionCols.rows.length} 列`);
  if (versionCols.rows.length < 8) {
    throw new Error('draw_pool_version 列数不足');
  }
  
  // 4. draw_log
  const logCols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'draw_log'
    ORDER BY ordinal_position
  `);
  console.log(`  draw_log: ${logCols.rows.length} 列`);
  if (logCols.rows.length < 15) {
    throw new Error('draw_log 列数不足');
  }
  
  console.log('  ✅ 表结构验证通过\n');
}

async function testForeignKeys() {
  console.log('🔗 验证外键约束...\n');
  
  const fkResult = await pool.query(`
    SELECT 
      tc.constraint_name,
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name IN ('ticket_type', 'draw_pool', 'draw_pool_version', 'draw_log')
    ORDER BY tc.table_name
  `);
  
  console.log(`  找到 ${fkResult.rows.length} 个外键约束:`);
  fkResult.rows.forEach(fk => {
    console.log(`    ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
  });
  
  // draw_log 必须有 pool_version_id 外键
  const hasVersionFK = fkResult.rows.some(
    fk => fk.table_name === 'draw_log' && fk.column_name === 'pool_version_id'
  );
  if (!hasVersionFK) {
    throw new Error('draw_log 缺少 pool_version_id 外键');
  }
  
  console.log('  ✅ 外键约束验证通过\n');
}

async function testSeedData() {
  console.log('📊 验证种子数据...\n');
  
  // ticket_type
  const ticketTypes = await pool.query('SELECT * FROM ticket_type');
  console.log(`  抽奖券类型: ${ticketTypes.rows.length} 条`);
  ticketTypes.rows.forEach(t => {
    console.log(`    - ${t.icon} ${t.name} (价值: ${t.point_value})`);
  });
  
  // draw_pool
  const pools = await pool.query(`
    SELECT dp.*, tt.name as ticket_name 
    FROM draw_pool dp
    LEFT JOIN ticket_type tt ON dp.entry_ticket_type_id = tt.id
  `);
  console.log(`  抽奖池: ${pools.rows.length} 个`);
  pools.rows.forEach(p => {
    console.log(`    - ${p.icon} ${p.name} (入场券: ${p.ticket_name || '无'})`);
  });
  
  // draw_pool_version
  const versions = await pool.query(`
    SELECT dpv.*, dp.name as pool_name 
    FROM draw_pool_version dpv
    JOIN draw_pool dp ON dpv.pool_id = dp.id
    WHERE dpv.is_current = TRUE
  `);
  console.log(`  当前版本: ${versions.rows.length} 个`);
  versions.rows.forEach(v => {
    const prizes = v.prizes || [];
    console.log(`    - ${v.pool_name} v${v.version}: ${prizes.length} 个奖品, 总权重 ${v.total_weight}`);
  });
  
  // draw_log
  const logs = await pool.query('SELECT * FROM draw_log');
  console.log(`  抽奖记录: ${logs.rows.length} 条`);
  
  console.log('  ✅ 种子数据验证通过\n');
}

async function testCRUD() {
  console.log('🔧 测试基本 CRUD 操作...\n');
  
  // 获取测试用户
  const userResult = await pool.query('SELECT id FROM users WHERE is_active = TRUE LIMIT 1');
  const parentId = userResult.rows[0].id;
  
  // 获取测试成员
  const memberResult = await pool.query('SELECT id FROM family_members WHERE parent_id = $1 LIMIT 1', [parentId]);
  const memberId = memberResult.rows[0].id;
  
  // 1. 创建新的抽奖券类型
  console.log('  创建测试抽奖券类型...');
  const newTicketType = await pool.query(`
    INSERT INTO ticket_type (parent_id, name, icon, point_value, status)
    VALUES ($1, '测试券_' || $2, '🧪', 10, 'active')
    RETURNING *
  `, [parentId, Date.now()]);
  console.log(`    ✅ 创建成功: ID=${newTicketType.rows[0].id}`);
  
  // 2. 创建新的抽奖池
  console.log('  创建测试抽奖池...');
  const newPool = await pool.query(`
    INSERT INTO draw_pool (parent_id, name, icon, entry_ticket_type_id, status, pool_type)
    VALUES ($1, '测试转盘_' || $2, '🎯', $3, 'active', 'wheel')
    RETURNING *
  `, [parentId, Date.now(), newTicketType.rows[0].id]);
  console.log(`    ✅ 创建成功: ID=${newPool.rows[0].id}`);
  
  // 3. 创建版本
  console.log('  创建测试版本...');
  const newVersion = await pool.query(`
    INSERT INTO draw_pool_version (pool_id, version, is_current, prizes, total_weight)
    VALUES ($1, 1, TRUE, $2::jsonb, 100)
    RETURNING *
  `, [
    newPool.rows[0].id,
    JSON.stringify([
      { id: 1, name: '测试奖品A', type: 'points', value: 10, weight: 50 },
      { id: 2, name: '测试奖品B', type: 'empty', value: 0, weight: 50 }
    ])
  ]);
  console.log(`    ✅ 创建成功: ID=${newVersion.rows[0].id}`);
  
  // 4. 创建抽奖记录
  console.log('  创建测试抽奖记录...');
  const newLog = await pool.query(`
    INSERT INTO draw_log (
      parent_id, member_id, pool_id, pool_version_id, 
      ticket_type_id, ticket_point_value, tickets_used,
      result_prize_id, result_type, result_name, result_value
    )
    VALUES ($1, $2, $3, $4, $5, 10, 1, 1, 'points', '测试奖品A', 10)
    RETURNING *
  `, [parentId, memberId, newPool.rows[0].id, newVersion.rows[0].id, newTicketType.rows[0].id]);
  console.log(`    ✅ 创建成功: ID=${newLog.rows[0].id}`);
  
  // 5. 验证 pool_version_id 必填
  console.log('  验证 pool_version_id 必填...');
  try {
    await pool.query(`
      INSERT INTO draw_log (parent_id, member_id, pool_id, result_type, result_value)
      VALUES ($1, $2, $3, 'empty', 0)
    `, [parentId, memberId, newPool.rows[0].id]);
    throw new Error('应该失败但没有失败');
  } catch (err) {
    if (err.message.includes('null') || err.code === '23502') {
      console.log('    ✅ pool_version_id 不能为 NULL');
    } else {
      throw err;
    }
  }
  
  // 6. 清理测试数据
  console.log('  清理测试数据...');
  await pool.query('DELETE FROM draw_log WHERE id = $1', [newLog.rows[0].id]);
  await pool.query('DELETE FROM draw_pool_version WHERE id = $1', [newVersion.rows[0].id]);
  await pool.query('DELETE FROM draw_pool WHERE id = $1', [newPool.rows[0].id]);
  await pool.query('DELETE FROM ticket_type WHERE id = $1', [newTicketType.rows[0].id]);
  console.log('    ✅ 测试数据已清理\n');
}

async function testStatsView() {
  console.log('📈 验证统计视图...\n');
  
  const stats = await pool.query('SELECT * FROM v_draw_stats LIMIT 5');
  console.log(`  v_draw_stats: ${stats.rows.length} 条记录`);
  
  if (stats.rows.length > 0) {
    const s = stats.rows[0];
    console.log(`    成员: ${s.member_name}`);
    console.log(`    抽奖池: ${s.pool_name}`);
    console.log(`    总抽奖次数: ${s.total_draws}`);
    console.log(`    中奖次数: ${s.wins}`);
    console.log(`    触发保底: ${s.guarantees}`);
  }
  
  console.log('  ✅ 统计视图验证通过\n');
}

async function runTest() {
  console.log('='.repeat(60));
  console.log('🎰 抽奖系统核心表测试');
  console.log('='.repeat(60));

  try {
    await testTableStructure();
    await testForeignKeys();
    await testSeedData();
    await testCRUD();
    await testStatsView();
    
    console.log('='.repeat(60));
    console.log('✅ 抽奖系统核心表测试通过!');
    console.log('   - ticket_type: 抽奖券类型 ✓');
    console.log('   - draw_pool: 抽奖池 ✓');
    console.log('   - draw_pool_version: 版本配置 ✓');
    console.log('   - draw_log: 抽奖记录 (必须记录 pool_version_id) ✓');
    console.log('='.repeat(60));
    
    process.exit(0);
  } catch (err) {
    console.error('\n❌ 测试失败:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runTest();
