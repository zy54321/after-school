/**
 * Schema 强化测试
 * 验证供给侧表都有 parent_id 字段和索引
 */

const pool = require('../src/shared/config/db');

async function runTests() {
  console.log('🧪 开始测试 Schema 强化（家庭配置 vs 成员参与）...\n');
  
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
  
  // 测试 1: family_offer 有 parent_id 字段
  await test('family_offer 有 parent_id 字段', async () => {
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'family_offer' AND column_name = 'parent_id'
    `);
    if (result.rows.length === 0) throw new Error('字段不存在');
    console.log(`      类型: ${result.rows[0].data_type}, 可空: ${result.rows[0].is_nullable}`);
  })();
  
  // 测试 2: family_offer 可以直接按 parent_id 查询
  await test('family_offer 可以直接按 parent_id 查询', async () => {
    const userResult = await pool.query('SELECT id FROM users LIMIT 1');
    if (userResult.rows.length === 0) throw new Error('没有可用的用户');
    const parentId = userResult.rows[0].id;
    
    // 直接按 parent_id 查询，不需要 JOIN sku
    const result = await pool.query(`
      SELECT id, sku_id, cost, parent_id
      FROM family_offer
      WHERE parent_id = $1
      LIMIT 5
    `, [parentId]);
    
    console.log(`      找到 ${result.rows.length} 个 offer 属于 parent_id=${parentId}`);
  })();
  
  // 测试 3: family_offer.parent_id 有索引
  await test('family_offer(parent_id) 索引存在', async () => {
    const result = await pool.query(`
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'family_offer' AND indexname LIKE '%parent%'
    `);
    if (result.rows.length === 0) throw new Error('索引不存在');
    console.log(`      索引: ${result.rows.map(r => r.indexname).join(', ')}`);
  })();
  
  // 测试 4-8: 检查所有供给侧表的 parent_id 索引
  const supplyTables = [
    'family_sku',
    'auction_session',
    'draw_pool',
    'reminder_policy',
    'ticket_type'
  ];
  
  for (const table of supplyTables) {
    await test(`${table}(parent_id) 索引存在`, async () => {
      // 先检查表是否存在
      const tableExists = await pool.query(`
        SELECT 1 FROM information_schema.tables WHERE table_name = $1
      `, [table]);
      
      if (tableExists.rows.length === 0) {
        console.log(`      ⚠️ 表不存在，跳过`);
        return;
      }
      
      const result = await pool.query(`
        SELECT indexname FROM pg_indexes 
        WHERE tablename = $1 AND indexname LIKE '%parent%'
      `, [table]);
      
      if (result.rows.length === 0) throw new Error('索引不存在');
      console.log(`      索引: ${result.rows.map(r => r.indexname).join(', ')}`);
    })();
  }
  
  // 测试 9: 验证 family_offer 的 parent_id 数据完整性
  await test('family_offer.parent_id 数据完整（无 NULL）', async () => {
    const result = await pool.query(`
      SELECT COUNT(*) as total, 
             COUNT(parent_id) as with_parent,
             COUNT(*) - COUNT(parent_id) as null_count
      FROM family_offer
    `);
    
    const { total, with_parent, null_count } = result.rows[0];
    
    if (parseInt(null_count) > 0) {
      throw new Error(`有 ${null_count} 条记录的 parent_id 为空`);
    }
    
    console.log(`      总数: ${total}, 有 parent_id: ${with_parent}, 空值: ${null_count}`);
  })();
  
  // 测试 10: 验证回填正确性（offer.parent_id 应该等于 sku.parent_id）
  await test('family_offer.parent_id 与 sku.parent_id 一致', async () => {
    const result = await pool.query(`
      SELECT COUNT(*) as mismatch_count
      FROM family_offer o
      JOIN family_sku s ON o.sku_id = s.id
      WHERE o.parent_id != s.parent_id
    `);
    
    const mismatchCount = parseInt(result.rows[0].mismatch_count);
    
    if (mismatchCount > 0) {
      throw new Error(`有 ${mismatchCount} 条记录的 parent_id 与 sku 不一致`);
    }
    
    console.log(`      所有 offer 的 parent_id 与对应 sku 一致 ✓`);
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
