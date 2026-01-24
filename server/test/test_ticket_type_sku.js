/**
 * 抽奖券类型规范化测试
 * 验证 ticket_type.sku_id 显式关联正常工作
 */

const pool = require('../src/shared/config/db');
const lotteryRepo = require('../src/systems/family/repos/lotteryRepo');

async function runTests() {
  console.log('🧪 开始测试抽奖券类型规范化...\n');
  
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
  
  // 测试 1: ticket_type 表有 sku_id 字段
  await test('ticket_type 表有 sku_id 字段', async () => {
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ticket_type' AND column_name = 'sku_id'
    `);
    if (result.rows.length === 0) throw new Error('字段不存在');
    console.log(`      字段类型: ${result.rows[0].data_type}`);
  })();
  
  // 测试 2: family_sku 有 ticket 类型的记录
  await test('family_sku 有 ticket 类型的记录', async () => {
    const result = await pool.query(`
      SELECT id, name, type FROM family_sku 
      WHERE type = 'ticket' AND is_active = TRUE
      LIMIT 5
    `);
    if (result.rows.length === 0) throw new Error('没有找到 ticket 类型的 SKU');
    console.log(`      找到 ${result.rows.length} 个 ticket SKU:`);
    result.rows.forEach(row => {
      console.log(`        - ID: ${row.id}, 名称: ${row.name}`);
    });
  })();
  
  // 测试 3: findAvailableTicketInventoryBySkuId 方法存在
  await test('lotteryRepo.findAvailableTicketInventoryBySkuId 方法存在', async () => {
    if (typeof lotteryRepo.findAvailableTicketInventoryBySkuId !== 'function') {
      throw new Error('方法不存在');
    }
    console.log('      方法已定义 ✓');
  })();
  
  // 测试 4: getMemberTicketStats 使用 sku_id 关联
  await test('getMemberTicketStats 返回 sku_id 字段', async () => {
    // 获取测试数据
    const userResult = await pool.query('SELECT id FROM users LIMIT 1');
    if (userResult.rows.length === 0) throw new Error('没有可用的用户');
    const parentId = userResult.rows[0].id;
    
    const memberResult = await pool.query(
      'SELECT id FROM family_members WHERE parent_id = $1 LIMIT 1', 
      [parentId]
    );
    if (memberResult.rows.length === 0) throw new Error('没有可用的成员');
    const memberId = memberResult.rows[0].id;
    
    // 检查是否有 ticket_type
    const ticketTypeResult = await pool.query(
      'SELECT COUNT(*) FROM ticket_type WHERE parent_id = $1',
      [parentId]
    );
    
    if (parseInt(ticketTypeResult.rows[0].count) === 0) {
      console.log('      ⚠️ 没有 ticket_type 记录，跳过详细测试');
      return;
    }
    
    const stats = await lotteryRepo.getMemberTicketStats(memberId, parentId);
    
    if (stats.length === 0) {
      console.log('      ⚠️ 没有统计数据，跳过字段检查');
      return;
    }
    
    // 检查返回的字段包含 sku_id
    const firstStat = stats[0];
    if (!('sku_id' in firstStat)) {
      throw new Error('返回结果缺少 sku_id 字段');
    }
    
    console.log(`      返回 ${stats.length} 条记录，包含 sku_id 字段 ✓`);
    stats.forEach(s => {
      console.log(`        - ${s.ticket_type_name}: sku_id=${s.sku_id}, 数量=${s.quantity}`);
    });
  })();
  
  // 测试 5: 模拟通过 sku_id 查找库存
  await test('通过 sku_id 查找库存正常', async () => {
    // 获取一个 ticket 类型的 SKU
    const skuResult = await pool.query(`
      SELECT id FROM family_sku WHERE type = 'ticket' LIMIT 1
    `);
    
    if (skuResult.rows.length === 0) {
      console.log('      ⚠️ 没有 ticket SKU，跳过测试');
      return;
    }
    
    const skuId = skuResult.rows[0].id;
    
    // 获取一个成员
    const memberResult = await pool.query('SELECT id FROM family_members LIMIT 1');
    if (memberResult.rows.length === 0) throw new Error('没有可用的成员');
    const memberId = memberResult.rows[0].id;
    
    // 调用方法（可能返回 null，但不应报错）
    const inventory = await lotteryRepo.findAvailableTicketInventoryBySkuId(memberId, skuId);
    
    console.log(`      查询结果: ${inventory ? `找到库存，数量: ${inventory.quantity}` : '无库存'}`);
  })();
  
  // 测试 6: family_sku.type 注释包含 ticket
  await test('family_sku.type 注释包含 ticket', async () => {
    const result = await pool.query(`
      SELECT col_description(
        (SELECT oid FROM pg_class WHERE relname = 'family_sku'),
        (SELECT ordinal_position FROM information_schema.columns 
         WHERE table_name = 'family_sku' AND column_name = 'type')
      ) as comment
    `);
    
    const comment = result.rows[0]?.comment || '';
    if (!comment.toLowerCase().includes('ticket')) {
      throw new Error(`注释中不包含 ticket: "${comment}"`);
    }
    
    console.log(`      注释: ${comment}`);
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
