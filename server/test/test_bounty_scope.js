/**
 * 任务系统改造测试
 * 
 * 验证：
 * 1. 任务列表查询是 parentId 维度
 * 2. member 只参与发布/领取/审核
 * 3. 成员归属验证
 * 4. 不允许按 memberId 生成专属市场
 */

const pool = require('../src/shared/config/db');

async function runTests() {
  console.log('🧪 任务系统改造测试\n');
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

    // ========== Test 1: getTasksByParentId 按 parentId 查询 ==========
    try {
      const bountyRepo = require('../src/systems/family/repos/bountyRepo');
      const tasks = await bountyRepo.getTasksByParentId(parentId);
      
      // 验证所有返回的 task 都属于该 parent
      const allBelongToParent = tasks.every(t => t.parent_id === parentId);
      
      if (allBelongToParent) {
        console.log(`✅ getTasksByParentId 正确按 parentId 查询`);
        console.log(`   返回 ${tasks.length} 个任务`);
        passed++;
      } else {
        console.log('❌ getTasksByParentId 返回了不属于该 parent 的 task');
        failed++;
      }
    } catch (err) {
      console.log('❌ getTasksByParentId 错误:', err.message);
      failed++;
    }

    // ========== Test 2: getTaskMarket 按 parentId 查询 ==========
    try {
      const bountyService = require('../src/systems/family/services/bountyService');
      const market = await bountyService.getTaskMarket(parentId);
      
      if (market.parentId === parentId && Array.isArray(market.tasks)) {
        console.log(`✅ getTaskMarket 正确按 parentId 查询`);
        console.log(`   tasks: ${market.totalTasks}, pendingSubmissions: ${market.pendingSubmissionCount}`);
        console.log(`   stats: open=${market.stats.open}, claimed=${market.stats.claimed}`);
        passed++;
      } else {
        console.log('❌ getTaskMarket 返回格式不正确');
        failed++;
      }
    } catch (err) {
      console.log('❌ getTaskMarket 错误:', err.message);
      failed++;
    }

    // ========== Test 3: getPendingSubmissions 按 parentId 查询 ==========
    try {
      const bountyRepo = require('../src/systems/family/repos/bountyRepo');
      const submissions = await bountyRepo.getPendingSubmissions(parentId);
      
      if (Array.isArray(submissions)) {
        console.log(`✅ getPendingSubmissions 正确按 parentId 查询`);
        console.log(`   返回 ${submissions.length} 个待审核提交`);
        passed++;
      } else {
        console.log('❌ getPendingSubmissions 返回格式不正确');
        failed++;
      }
    } catch (err) {
      console.log('❌ getPendingSubmissions 错误:', err.message);
      failed++;
    }

    // ========== Test 4: 任务包含 publisher_member_id 字段 ==========
    try {
      const bountyRepo = require('../src/systems/family/repos/bountyRepo');
      const tasks = await bountyRepo.getTasksByParentId(parentId);
      
      if (tasks.length > 0) {
        const hasPublisherField = tasks[0].hasOwnProperty('publisher_member_id');
        if (hasPublisherField) {
          console.log('✅ 任务包含 publisher_member_id 字段');
          passed++;
        } else {
          console.log('❌ 任务缺少 publisher_member_id 字段');
          failed++;
        }
      } else {
        console.log('⚠️ 跳过 publisher_member_id 测试（无任务）');
      }
    } catch (err) {
      console.log('❌ publisher_member_id 检查错误:', err.message);
      failed++;
    }

    // ========== Test 5: claimTask 验证成员归属 ==========
    try {
      const bountyService = require('../src/systems/family/services/bountyService');
      const bountyRepo = require('../src/systems/family/repos/bountyRepo');
      
      // 获取一个 open 状态的任务
      const tasks = await bountyRepo.getTasksByParentId(parentId, 'open');
      
      if (tasks.length > 0) {
        // 找一个其他家庭的成员
        const otherMemberRes = await pool.query(
          `SELECT id FROM family_members 
           WHERE parent_id != $1 
           LIMIT 1`,
          [parentId]
        );
        
        if (otherMemberRes.rows.length > 0) {
          const otherMemberId = otherMemberRes.rows[0].id;
          
          try {
            await bountyService.claimTask(tasks[0].id, otherMemberId);
            console.log('❌ claimTask 没有验证成员归属');
            failed++;
          } catch (claimErr) {
            if (claimErr.message.includes('无权')) {
              console.log('✅ claimTask 正确验证成员归属（拒绝其他家庭成员）');
              passed++;
            } else {
              console.log(`❌ claimTask 错误信息不正确: ${claimErr.message}`);
              failed++;
            }
          }
        } else {
          console.log('⚠️ 跳过成员归属验证（无其他家庭成员）');
        }
      } else {
        console.log('⚠️ 跳过 claimTask 成员归属测试（无 open 任务）');
      }
    } catch (err) {
      console.log('❌ claimTask 成员归属测试错误:', err.message);
      failed++;
    }

    // ========== Test 6: 领取记录包含 claimer_member_id 字段 ==========
    try {
      const bountyRepo = require('../src/systems/family/repos/bountyRepo');
      
      if (testMemberId) {
        const claims = await bountyRepo.getClaimsByMemberId(testMemberId);
        
        if (claims.length > 0) {
          const hasClaimerField = claims[0].hasOwnProperty('claimer_member_id');
          if (hasClaimerField) {
            console.log('✅ 领取记录包含 claimer_member_id 字段');
            passed++;
          } else {
            console.log('❌ 领取记录缺少 claimer_member_id 字段');
            failed++;
          }
        } else {
          console.log('✅ getClaimsByMemberId 查询成功（无领取记录）');
          passed++;
        }
      } else {
        console.log('⚠️ 跳过 claimer_member_id 测试（无测试成员）');
      }
    } catch (err) {
      console.log('❌ claimer_member_id 检查错误:', err.message);
      failed++;
    }

    // ========== Test 7: getOpenTasksForMember 不生成专属市场 ==========
    try {
      const bountyRepo = require('../src/systems/family/repos/bountyRepo');
      
      if (testMemberId) {
        // 获取家庭所有 open 任务
        const allOpenTasks = await bountyRepo.getTasksByParentId(parentId, 'open');
        
        // 获取成员可领取的任务（排除自己发布的）
        const memberTasks = await bountyRepo.getOpenTasksForMember(parentId, testMemberId);
        
        // 成员任务数应该 <= 全部任务数（只是排除了自己发布的）
        // 这不是生成专属市场，而是从家庭市场中过滤
        if (memberTasks.length <= allOpenTasks.length) {
          console.log(`✅ getOpenTasksForMember 不生成专属市场（从家庭市场过滤）`);
          console.log(`   家庭 open 任务: ${allOpenTasks.length}, 成员可领取: ${memberTasks.length}`);
          passed++;
        } else {
          console.log('❌ getOpenTasksForMember 可能生成了专属市场');
          failed++;
        }
      } else {
        console.log('⚠️ 跳过专属市场测试（无测试成员）');
      }
    } catch (err) {
      console.log('❌ 专属市场检查错误:', err.message);
      failed++;
    }

    // ========== Test 8: Controller getTasks 不强制 member_id ==========
    try {
      const bountyController = require('../src/systems/family/controllers/bountyController');
      
      const mockReq = {
        session: { user: { id: parentId, username: 'testuser' } },
        query: {},  // 不提供 member_id
        body: {},
        params: {},
      };
      
      const mockRes = {
        statusCode: 200,
        data: null,
        status: function(code) { this.statusCode = code; return this; },
        json: function(data) { this.data = data; return this; },
      };
      
      await bountyController.getTasks(mockReq, mockRes);
      
      if (mockRes.statusCode === 200 && mockRes.data.code === 200) {
        console.log(`✅ getTasks 不需要 member_id (viewMode: ${mockRes.data.data.viewMode})`);
        console.log(`   返回 ${mockRes.data.data.total} 个任务`);
        passed++;
      } else {
        console.log('❌ getTasks 失败');
        failed++;
      }
    } catch (err) {
      console.log('❌ getTasks Controller 错误:', err.message);
      failed++;
    }

    // ========== Test 9: Controller getTaskMarket 不需要 member_id ==========
    try {
      const bountyController = require('../src/systems/family/controllers/bountyController');
      
      const mockReq = {
        session: { user: { id: parentId, username: 'testuser' } },
        query: {},
        body: {},
        params: {},
      };
      
      const mockRes = {
        statusCode: 200,
        data: null,
        status: function(code) { this.statusCode = code; return this; },
        json: function(data) { this.data = data; return this; },
      };
      
      await bountyController.getTaskMarket(mockReq, mockRes);
      
      if (mockRes.statusCode === 200 && mockRes.data.code === 200) {
        console.log('✅ getTaskMarket 不需要 member_id');
        console.log(`   totalTasks: ${mockRes.data.data.totalTasks}`);
        passed++;
      } else {
        console.log('❌ getTaskMarket 失败');
        failed++;
      }
    } catch (err) {
      console.log('❌ getTaskMarket Controller 错误:', err.message);
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
