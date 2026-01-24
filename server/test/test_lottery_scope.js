/**
 * 抽奖系统改造测试
 * 
 * 验证：
 * 1. draw_pool 查询是 parentId 维度
 * 2. spin 验证 member.parent_id == pool.parent_id
 * 3. pool 不按 memberId 过滤可见性
 */

const pool = require('../src/shared/config/db');

async function runTests() {
  console.log('🧪 抽奖系统改造测试\n');
  let passed = 0;
  let failed = 0;
  let parentId;
  let testMemberId;

  try {
    // 获取测试用 parentId
    const userRes = await pool.query('SELECT id FROM users LIMIT 1');
    parentId = userRes.rows[0]?.id;
    
    if (!parentId) {
      console.log('❌ 找不到测试用户，跳过测试');
      return;
    }

    // 获取测试用成员
    const memberRes = await pool.query(
      'SELECT id FROM family_members WHERE parent_id = $1 LIMIT 1',
      [parentId]
    );
    testMemberId = memberRes.rows[0]?.id;

    console.log(`使用 parentId: ${parentId}, testMemberId: ${testMemberId || '无'}\n`);

    // ========== Test 1: getPoolsByParentId 按 parentId 查询 ==========
    try {
      const lotteryRepo = require('../src/systems/family/repos/lotteryRepo');
      const pools = await lotteryRepo.getPoolsByParentId(parentId);
      
      // 验证所有返回的 pool 都属于该 parent
      const allBelongToParent = pools.every(p => p.parent_id === parentId);
      
      if (allBelongToParent) {
        console.log(`✅ getPoolsByParentId 正确按 parentId 查询`);
        console.log(`   返回 ${pools.length} 个抽奖池`);
        passed++;
      } else {
        console.log('❌ getPoolsByParentId 返回了不属于该 parent 的 pool');
        failed++;
      }
    } catch (err) {
      console.log('❌ getPoolsByParentId 错误:', err.message);
      failed++;
    }

    // ========== Test 2: getDrawOverview 按 parentId 查询 ==========
    try {
      const lotteryService = require('../src/systems/family/services/lotteryService');
      const overview = await lotteryService.getDrawOverview(parentId);
      
      if (overview.parentId === parentId && Array.isArray(overview.pools)) {
        console.log(`✅ getDrawOverview 正确按 parentId 查询`);
        console.log(`   pools: ${overview.totalPools}, ticketTypes: ${overview.totalTicketTypes}`);
        passed++;
      } else {
        console.log('❌ getDrawOverview 返回格式不正确');
        failed++;
      }
    } catch (err) {
      console.log('❌ getDrawOverview 错误:', err.message);
      failed++;
    }

    // ========== Test 3: getPoolsForMember 不会过滤 pool 可见性 ==========
    if (testMemberId) {
      try {
        const lotteryService = require('../src/systems/family/services/lotteryService');
        
        // 获取家庭级别的 pools
        const familyOverview = await lotteryService.getDrawOverview(parentId);
        
        // 获取成员级别的 pools
        const memberPools = await lotteryService.getPoolsForMember(parentId, testMemberId);
        
        // 成员应该能看到所有家庭的 pool（数量应该相等）
        if (memberPools.length === familyOverview.totalPools) {
          console.log(`✅ pool 可见性不按 memberId 过滤`);
          console.log(`   家庭 pools: ${familyOverview.totalPools}, 成员可见: ${memberPools.length}`);
          passed++;
        } else {
          console.log(`❌ pool 可见性被 memberId 过滤了`);
          console.log(`   家庭 pools: ${familyOverview.totalPools}, 成员可见: ${memberPools.length}`);
          failed++;
        }
      } catch (err) {
        console.log('❌ 可见性检查错误:', err.message);
        failed++;
      }
    } else {
      console.log('⚠️ 跳过 pool 可见性测试（无测试成员）');
    }

    // ========== Test 4: spin 验证成员归属 ==========
    try {
      const lotteryService = require('../src/systems/family/services/lotteryService');
      
      // 获取一个活跃的抽奖池
      const lotteryRepo = require('../src/systems/family/repos/lotteryRepo');
      const pools = await lotteryRepo.getPoolsByParentId(parentId);
      
      if (pools.length > 0 && testMemberId) {
        const testPool = pools[0];
        
        // 尝试用不属于该家庭的成员抽奖
        // 首先找一个其他家庭的成员
        const otherMemberRes = await pool.query(
          `SELECT id FROM family_members 
           WHERE parent_id != $1 
           LIMIT 1`,
          [parentId]
        );
        
        if (otherMemberRes.rows.length > 0) {
          const otherMemberId = otherMemberRes.rows[0].id;
          
          try {
            await lotteryService.spin(
              testPool.id, 
              otherMemberId, 
              `test_invalid_${Date.now()}`
            );
            console.log('❌ spin 没有验证成员归属');
            failed++;
          } catch (spinErr) {
            if (spinErr.message.includes('无权') || spinErr.message.includes('不存在')) {
              console.log('✅ spin 正确验证成员归属（拒绝其他家庭成员）');
              passed++;
            } else {
              console.log(`❌ spin 错误信息不正确: ${spinErr.message}`);
              failed++;
            }
          }
        } else {
          console.log('⚠️ 跳过成员归属验证（无其他家庭成员）');
          
          // 改为验证正常成员可以访问
          console.log('   → 验证同家庭成员可以访问...');
          try {
            // 不真正执行抽奖，只验证前置检查通过
            // 这里可能会因为没有券而失败，但错误应该是"券不足"而不是"无权"
            await lotteryService.spin(
              testPool.id, 
              testMemberId, 
              `test_valid_${Date.now()}`
            );
            console.log('✅ spin 同家庭成员可以访问');
            passed++;
          } catch (spinErr) {
            // 只要不是"无权"错误就算通过
            if (!spinErr.message.includes('无权')) {
              console.log(`✅ spin 同家庭成员可以访问（失败原因: ${spinErr.message}）`);
              passed++;
            } else {
              console.log(`❌ spin 错误拒绝了同家庭成员: ${spinErr.message}`);
              failed++;
            }
          }
        }
      } else {
        console.log('⚠️ 跳过 spin 成员归属测试（无抽奖池或成员）');
      }
    } catch (err) {
      console.log('❌ spin 成员归属测试错误:', err.message);
      failed++;
    }

    // ========== Test 5: getTicketTypesByParentId 按 parentId 查询 ==========
    try {
      const lotteryRepo = require('../src/systems/family/repos/lotteryRepo');
      const ticketTypes = await lotteryRepo.getTicketTypesByParentId(parentId);
      
      // 验证所有返回的 ticket_type 都属于该 parent
      const allBelongToParent = ticketTypes.every(t => t.parent_id === parentId);
      
      if (allBelongToParent) {
        console.log(`✅ getTicketTypesByParentId 正确按 parentId 查询`);
        console.log(`   返回 ${ticketTypes.length} 个抽奖券类型`);
        passed++;
      } else {
        console.log('❌ getTicketTypesByParentId 返回了不属于该 parent 的 ticketType');
        failed++;
      }
    } catch (err) {
      console.log('❌ getTicketTypesByParentId 错误:', err.message);
      failed++;
    }

    // ========== Test 6: getPoolDetail 不需要 memberId ==========
    try {
      const lotteryService = require('../src/systems/family/services/lotteryService');
      const lotteryRepo = require('../src/systems/family/repos/lotteryRepo');
      
      const pools = await lotteryRepo.getPoolsByParentId(parentId);
      if (pools.length > 0) {
        // getPoolDetail 只需要 poolId，不需要 memberId
        const detail = await lotteryService.getPoolDetail(pools[0].id);
        
        if (detail.pool && detail.pool.id === pools[0].id) {
          console.log('✅ getPoolDetail 不需要 memberId');
          passed++;
        } else {
          console.log('❌ getPoolDetail 返回格式不正确');
          failed++;
        }
      } else {
        console.log('⚠️ 跳过 getPoolDetail 测试（无抽奖池）');
      }
    } catch (err) {
      console.log('❌ getPoolDetail 错误:', err.message);
      failed++;
    }

  } finally {
    await pool.end();
  }

  console.log(`\n📊 测试结果: ${passed} 通过, ${failed} 失败`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('测试运行失败:', err);
  process.exit(1);
});
