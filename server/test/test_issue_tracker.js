/**
 * Issue Tracker 表结构测试脚本
 * 验证表结构和基本 CRUD
 * 
 * 运行方式：
 * cd server && node test/test_issue_tracker.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = require('../src/shared/config/db');

async function testTableStructure() {
  console.log('📋 验证表结构...\n');
  
  // 1. issue
  const issueCols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'issue'
    ORDER BY ordinal_position
  `);
  console.log(`  issue: ${issueCols.rows.length} 列`);
  if (issueCols.rows.length < 15) {
    throw new Error('issue 列数不足');
  }
  
  // 2. issue_occurrence
  const occurrenceCols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'issue_occurrence'
    ORDER BY ordinal_position
  `);
  console.log(`  issue_occurrence: ${occurrenceCols.rows.length} 列`);
  if (occurrenceCols.rows.length < 8) {
    throw new Error('issue_occurrence 列数不足');
  }
  
  // 3. intervention
  const interventionCols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'intervention'
    ORDER BY ordinal_position
  `);
  console.log(`  intervention: ${interventionCols.rows.length} 列`);
  if (interventionCols.rows.length < 10) {
    throw new Error('intervention 列数不足');
  }
  
  // 4. issue_attention_event
  const eventCols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'issue_attention_event'
    ORDER BY ordinal_position
  `);
  console.log(`  issue_attention_event: ${eventCols.rows.length} 列`);
  if (eventCols.rows.length < 8) {
    throw new Error('issue_attention_event 列数不足');
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
      AND tc.table_name IN ('issue', 'issue_occurrence', 'intervention', 'issue_attention_event')
    ORDER BY tc.table_name
  `);
  
  console.log(`  找到 ${fkResult.rows.length} 个外键约束:`);
  fkResult.rows.forEach(fk => {
    console.log(`    ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
  });
  
  // 验证关键外键
  const hasIssueFK = fkResult.rows.some(
    fk => fk.table_name === 'issue_occurrence' && fk.column_name === 'issue_id'
  );
  if (!hasIssueFK) {
    throw new Error('issue_occurrence 缺少 issue_id 外键');
  }
  
  console.log('  ✅ 外键约束验证通过\n');
}

async function testSeedData() {
  console.log('📊 验证种子数据...\n');
  
  // issue
  const issues = await pool.query(`
    SELECT i.*, fm.name as member_name 
    FROM issue i
    JOIN family_members fm ON i.owner_member_id = fm.id
  `);
  console.log(`  问题: ${issues.rows.length} 条`);
  issues.rows.forEach(i => {
    console.log(`    - ${i.icon} ${i.title} (${i.severity}) [${i.member_name}]`);
    console.log(`      关注度: ${i.attention_score}/${i.attention_threshold}, 发生: ${i.occurrence_count}次`);
  });
  
  // issue_occurrence
  const occurrences = await pool.query(`
    SELECT io.*, i.title as issue_title 
    FROM issue_occurrence io
    JOIN issue i ON io.issue_id = i.id
    ORDER BY io.occurred_at DESC
    LIMIT 5
  `);
  console.log(`\n  发生记录: ${occurrences.rows.length} 条 (最近5条)`);
  occurrences.rows.forEach(o => {
    console.log(`    - [${o.issue_title}] ${o.note || '无备注'}`);
  });
  
  // intervention
  const interventions = await pool.query(`
    SELECT iv.*, i.title as issue_title 
    FROM intervention iv
    JOIN issue i ON iv.issue_id = i.id
  `);
  console.log(`\n  干预措施: ${interventions.rows.length} 条`);
  interventions.rows.forEach(iv => {
    console.log(`    - ${iv.icon} ${iv.name} (${iv.action_type}) [${iv.trigger_type}]`);
  });
  
  console.log('\n  ✅ 种子数据验证通过\n');
}

async function testCRUD() {
  console.log('🔧 测试基本 CRUD 操作...\n');
  
  // 获取测试用户和成员
  const userResult = await pool.query('SELECT id FROM users WHERE is_active = TRUE LIMIT 1');
  const parentId = userResult.rows[0].id;
  
  const memberResult = await pool.query('SELECT id FROM family_members WHERE parent_id = $1 LIMIT 1', [parentId]);
  const memberId = memberResult.rows[0].id;
  
  // 1. 创建新的 issue
  console.log('  创建测试 Issue...');
  const newIssue = await pool.query(`
    INSERT INTO issue (parent_id, owner_member_id, title, icon, tags, severity, attention_threshold)
    VALUES ($1, $2, '测试问题_' || $3, '🧪', ARRAY['测试'], 'low', 10)
    RETURNING *
  `, [parentId, memberId, Date.now()]);
  const issueId = newIssue.rows[0].id;
  console.log(`    ✅ 创建成功: ID=${issueId}`);
  
  // 2. 创建 occurrence
  console.log('  创建测试 Occurrence...');
  const newOccurrence = await pool.query(`
    INSERT INTO issue_occurrence (issue_id, note, context)
    VALUES ($1, '测试发生记录', '测试场景')
    RETURNING *
  `, [issueId]);
  console.log(`    ✅ 创建成功: ID=${newOccurrence.rows[0].id}`);
  
  // 3. 验证触发器更新了 issue 统计
  const updatedIssue = await pool.query('SELECT * FROM issue WHERE id = $1', [issueId]);
  console.log(`    发生次数: ${updatedIssue.rows[0].occurrence_count}`);
  console.log(`    上次发生: ${updatedIssue.rows[0].last_occurred_at ? '已记录' : '未记录'}`);
  
  if (updatedIssue.rows[0].occurrence_count !== 1) {
    throw new Error('触发器未正确更新 occurrence_count');
  }
  console.log(`    ✅ 触发器正常工作`);
  
  // 4. 创建 intervention
  console.log('  创建测试 Intervention...');
  const newIntervention = await pool.query(`
    INSERT INTO intervention (issue_id, name, action_type, template, trigger_type)
    VALUES ($1, '测试干预', 'deduct_points', '{"points": 5}'::jsonb, 'manual')
    RETURNING *
  `, [issueId]);
  console.log(`    ✅ 创建成功: ID=${newIntervention.rows[0].id}`);
  
  // 5. 创建 attention event
  console.log('  创建测试 Attention Event...');
  const newEvent = await pool.query(`
    INSERT INTO issue_attention_event (issue_id, event_type, score_change, score_before, score_after, related_occurrence_id)
    VALUES ($1, 'occurrence', 1, 0, 1, $2)
    RETURNING *
  `, [issueId, newOccurrence.rows[0].id]);
  console.log(`    ✅ 创建成功: ID=${newEvent.rows[0].id}`);
  
  // 6. 测试视图
  console.log('  测试概览视图...');
  const overview = await pool.query('SELECT * FROM v_issue_overview WHERE id = $1', [issueId]);
  if (overview.rows.length > 0) {
    console.log(`    ✅ 视图正常: 总发生=${overview.rows[0].total_occurrences}, 干预数=${overview.rows[0].intervention_count}`);
  }
  
  // 7. 清理测试数据
  console.log('  清理测试数据...');
  await pool.query('DELETE FROM issue WHERE id = $1', [issueId]);
  console.log('    ✅ 测试数据已清理（级联删除）\n');
}

async function testTrigger() {
  console.log('⚡ 测试触发器行为...\n');
  
  // 获取一个现有的 issue
  const issueResult = await pool.query('SELECT * FROM issue LIMIT 1');
  if (issueResult.rows.length === 0) {
    console.log('  ⚠️ 没有可用的 issue，跳过触发器测试\n');
    return;
  }
  
  const issue = issueResult.rows[0];
  const beforeCount = issue.occurrence_count;
  
  // 插入新的 occurrence
  await pool.query(`
    INSERT INTO issue_occurrence (issue_id, note)
    VALUES ($1, '触发器测试')
  `, [issue.id]);
  
  // 验证 count 增加
  const afterResult = await pool.query('SELECT occurrence_count FROM issue WHERE id = $1', [issue.id]);
  const afterCount = afterResult.rows[0].occurrence_count;
  
  console.log(`  Issue ID: ${issue.id}`);
  console.log(`  发生次数: ${beforeCount} -> ${afterCount}`);
  
  if (afterCount !== beforeCount + 1) {
    throw new Error('触发器未正确更新 occurrence_count');
  }
  
  console.log('  ✅ 触发器测试通过\n');
}

async function runTest() {
  console.log('='.repeat(60));
  console.log('📋 Issue Tracker 表结构测试');
  console.log('='.repeat(60));

  try {
    await testTableStructure();
    await testForeignKeys();
    await testSeedData();
    await testCRUD();
    await testTrigger();
    
    console.log('='.repeat(60));
    console.log('✅ Issue Tracker 表测试通过!');
    console.log('   - issue: 问题追踪 ✓');
    console.log('   - issue_occurrence: 发生记录 ✓');
    console.log('   - intervention: 干预措施 ✓');
    console.log('   - issue_attention_event: 关注度事件 ✓');
    console.log('   - 触发器: 自动更新统计 ✓');
    console.log('='.repeat(60));
    
    process.exit(0);
  } catch (err) {
    console.error('\n❌ 测试失败:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runTest();
