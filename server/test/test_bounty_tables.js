/**
 * 悬赏任务表验证脚本
 * 验证 migration 正确执行，可以创建任务+领取记录
 * 
 * 运行方式：
 * cd server && node test/test_bounty_tables.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function runTest() {
  console.log('='.repeat(60));
  console.log('🧪 悬赏任务表验证测试');
  console.log('='.repeat(60));

  const client = await pool.connect();

  try {
    // 1. 验证表存在
    console.log('\n📋 测试 1: 验证表结构');
    
    const tables = ['bounty_task', 'task_claim', 'task_review'];
    for (const table of tables) {
      const result = await client.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = $1 
        ORDER BY ordinal_position
      `, [table]);
      
      if (result.rows.length > 0) {
        console.log(`   ✅ ${table}: ${result.rows.length} 列`);
      } else {
        throw new Error(`表 ${table} 不存在`);
      }
    }

    // 2. 验证外键约束
    console.log('\n🔗 测试 2: 验证外键约束');
    
    const fkResult = await client.query(`
      SELECT 
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name IN ('bounty_task', 'task_claim', 'task_review')
    `);
    
    console.log(`   外键数量: ${fkResult.rows.length}`);
    fkResult.rows.forEach(fk => {
      console.log(`   - ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    });

    // 3. 验证已有数据（从 seed）
    console.log('\n📊 测试 3: 验证种子数据');
    
    const taskCount = await client.query('SELECT COUNT(*) as count FROM bounty_task');
    const claimCount = await client.query('SELECT COUNT(*) as count FROM task_claim');
    const reviewCount = await client.query('SELECT COUNT(*) as count FROM task_review');
    
    console.log(`   悬赏任务: ${taskCount.rows[0].count} 条`);
    console.log(`   领取记录: ${claimCount.rows[0].count} 条`);
    console.log(`   审核记录: ${reviewCount.rows[0].count} 条`);

    // 4. 测试创建新任务
    console.log('\n📝 测试 4: 创建新悬赏任务');
    
    // 获取测试数据
    const userResult = await client.query('SELECT id FROM users WHERE is_active = TRUE LIMIT 1');
    const memberResult = await client.query(
      'SELECT id, name FROM family_members WHERE parent_id = $1 LIMIT 2',
      [userResult.rows[0].id]
    );
    
    const parentId = userResult.rows[0].id;
    const publisherId = memberResult.rows[0].id;
    
    // 创建任务
    const newTask = await client.query(`
      INSERT INTO bounty_task (
        parent_id, publisher_member_id, title, description,
        bounty_points, escrow_points, due_at, accept_criteria, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      parentId,
      publisherId,
      '测试任务 - ' + Date.now(),
      '这是一个自动创建的测试任务',
      25,
      25,
      new Date(Date.now() + 86400000 * 7), // 7天后
      '测试验收标准',
      'open'
    ]);
    
    console.log(`   ✅ 创建任务成功: ID=${newTask.rows[0].id}`);
    console.log(`      标题: ${newTask.rows[0].title}`);
    console.log(`      悬赏: ${newTask.rows[0].bounty_points} 积分`);

    // 5. 测试领取任务
    console.log('\n🙋 测试 5: 领取悬赏任务');
    
    const claimerId = memberResult.rows.length > 1 
      ? memberResult.rows[1].id 
      : memberResult.rows[0].id;
    
    const newClaim = await client.query(`
      INSERT INTO task_claim (task_id, claimer_member_id, status)
      VALUES ($1, $2, 'active')
      RETURNING *
    `, [newTask.rows[0].id, claimerId]);
    
    console.log(`   ✅ 领取成功: ID=${newClaim.rows[0].id}`);
    console.log(`      任务ID: ${newClaim.rows[0].task_id}`);
    console.log(`      领取者: ${claimerId}`);
    
    // 更新任务状态
    await client.query(
      'UPDATE bounty_task SET status = $1 WHERE id = $2',
      ['claimed', newTask.rows[0].id]
    );
    console.log(`   ✅ 任务状态已更新为 claimed`);

    // 6. 测试提交和审核
    console.log('\n✍️ 测试 6: 提交和审核');
    
    // 提交
    await client.query(`
      UPDATE task_claim 
      SET status = 'submitted', submitted_at = NOW(), submission_note = '已完成测试任务'
      WHERE id = $1
    `, [newClaim.rows[0].id]);
    console.log(`   ✅ 任务已提交`);
    
    // 审核
    const newReview = await client.query(`
      INSERT INTO task_review (task_id, claim_id, reviewer_member_id, decision, comment)
      VALUES ($1, $2, $3, 'approved', '测试审核通过')
      RETURNING *
    `, [newTask.rows[0].id, newClaim.rows[0].id, publisherId]);
    
    console.log(`   ✅ 审核记录创建: ID=${newReview.rows[0].id}`);
    console.log(`      决定: ${newReview.rows[0].decision}`);
    
    // 更新状态
    await client.query('UPDATE task_claim SET status = $1 WHERE id = $2', ['approved', newClaim.rows[0].id]);
    await client.query('UPDATE bounty_task SET status = $1, escrow_points = 0 WHERE id = $2', ['approved', newTask.rows[0].id]);
    console.log(`   ✅ 状态已更新为 approved`);

    // 7. 验证视图
    console.log('\n👁️ 测试 7: 验证视图');
    
    const viewResult = await client.query(`
      SELECT id, title, publisher_name, status, claim_status, claimer_name
      FROM v_bounty_task_detail 
      WHERE id = $1
    `, [newTask.rows[0].id]);
    
    if (viewResult.rows.length > 0) {
      const v = viewResult.rows[0];
      console.log(`   ✅ v_bounty_task_detail 视图正常`);
      console.log(`      任务: ${v.title}`);
      console.log(`      发布者: ${v.publisher_name}`);
      console.log(`      状态: ${v.status}`);
      console.log(`      领取状态: ${v.claim_status}`);
      console.log(`      领取者: ${v.claimer_name || '-'}`);
    }

    // 8. 最终统计
    console.log('\n📊 最终统计');
    
    const finalTaskCount = await client.query('SELECT COUNT(*) as count FROM bounty_task');
    const finalClaimCount = await client.query('SELECT COUNT(*) as count FROM task_claim');
    const finalReviewCount = await client.query('SELECT COUNT(*) as count FROM task_review');
    
    console.log(`   悬赏任务: ${finalTaskCount.rows[0].count} 条`);
    console.log(`   领取记录: ${finalClaimCount.rows[0].count} 条`);
    console.log(`   审核记录: ${finalReviewCount.rows[0].count} 条`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ 所有测试通过!');
    console.log('='.repeat(60));

  } catch (err) {
    console.error('\n❌ 测试失败:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runTest();
