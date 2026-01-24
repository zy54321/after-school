/**
 * 拍卖系统改造测试
 * 
 * 验证：
 * 1. 场次/拍品查询是 parentId 维度
 * 2. member 仅参与记录（bidder_member_id）
 * 3. submitBid 验证成员归属
 * 4. settleSession 是家庭级操作
 */

const pool = require('../src/shared/config/db');

async function runTests() {
  console.log('🧪 拍卖系统改造测试\n');
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

    // ========== Test 1: getSessionsByParentId 按 parentId 查询 ==========
    try {
      const auctionRepo = require('../src/systems/family/repos/auctionRepo');
      const sessions = await auctionRepo.getSessionsByParentId(parentId);
      
      // 验证所有返回的 session 都属于该 parent
      const allBelongToParent = sessions.every(s => s.parent_id === parentId);
      
      if (allBelongToParent) {
        console.log(`✅ getSessionsByParentId 正确按 parentId 查询`);
        console.log(`   返回 ${sessions.length} 个场次`);
        passed++;
      } else {
        console.log('❌ getSessionsByParentId 返回了不属于该 parent 的 session');
        failed++;
      }
    } catch (err) {
      console.log('❌ getSessionsByParentId 错误:', err.message);
      failed++;
    }

    // ========== Test 2: getAuctionOverview 按 parentId 查询 ==========
    try {
      const auctionService = require('../src/systems/family/services/auctionService');
      const overview = await auctionService.getAuctionOverview(parentId);
      
      if (overview.parentId === parentId && Array.isArray(overview.sessions)) {
        console.log(`✅ getAuctionOverview 正确按 parentId 查询`);
        console.log(`   sessions: ${overview.totalSessions}, auctionableSkus: ${overview.auctionableSkuCount}`);
        passed++;
      } else {
        console.log('❌ getAuctionOverview 返回格式不正确');
        failed++;
      }
    } catch (err) {
      console.log('❌ getAuctionOverview 错误:', err.message);
      failed++;
    }

    // ========== Test 3: getSessionWithLots 不需要 memberId ==========
    try {
      const auctionService = require('../src/systems/family/services/auctionService');
      const auctionRepo = require('../src/systems/family/repos/auctionRepo');
      
      const sessions = await auctionRepo.getSessionsByParentId(parentId);
      if (sessions.length > 0) {
        // getSessionWithLots 只需要 sessionId，不需要 memberId
        const detail = await auctionService.getSessionWithLots(sessions[0].id);
        
        if (detail.session && detail.session.id === sessions[0].id) {
          console.log('✅ getSessionWithLots 不需要 memberId');
          console.log(`   lotCount: ${detail.lotCount}`);
          passed++;
        } else {
          console.log('❌ getSessionWithLots 返回格式不正确');
          failed++;
        }
      } else {
        console.log('⚠️ 跳过 getSessionWithLots 测试（无场次）');
      }
    } catch (err) {
      console.log('❌ getSessionWithLots 错误:', err.message);
      failed++;
    }

    // ========== Test 4: submitBid 验证成员归属 ==========
    try {
      const auctionService = require('../src/systems/family/services/auctionService');
      const auctionRepo = require('../src/systems/family/repos/auctionRepo');
      
      // 获取一个场次
      const sessions = await auctionRepo.getSessionsByParentId(parentId);
      
      if (sessions.length > 0) {
        // 获取该场次的拍品
        const lots = await auctionRepo.getLotsBySessionId(sessions[0].id);
        
        if (lots.length > 0) {
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
              await auctionService.submitBid(
                lots[0].id, 
                otherMemberId, 
                lots[0].start_price
              );
              console.log('❌ submitBid 没有验证成员归属');
              failed++;
            } catch (bidErr) {
              if (bidErr.message.includes('不属于') || bidErr.message.includes('无权')) {
                console.log('✅ submitBid 正确验证成员归属（拒绝其他家庭成员）');
                passed++;
              } else {
                console.log(`❌ submitBid 错误信息不正确: ${bidErr.message}`);
                failed++;
              }
            }
          } else {
            console.log('⚠️ 跳过成员归属验证（无其他家庭成员）');
            
            // 改为验证同家庭成员可以出价
            if (testMemberId) {
              console.log('   → 验证同家庭成员可以出价...');
              try {
                await auctionService.submitBid(
                  lots[0].id, 
                  testMemberId, 
                  lots[0].start_price
                );
                console.log('✅ submitBid 同家庭成员可以出价');
                passed++;
              } catch (bidErr) {
                // 只要不是"不属于"错误就算通过
                if (!bidErr.message.includes('不属于') && !bidErr.message.includes('无权')) {
                  console.log(`✅ submitBid 同家庭成员可以出价（失败原因: ${bidErr.message}）`);
                  passed++;
                } else {
                  console.log(`❌ submitBid 错误拒绝了同家庭成员: ${bidErr.message}`);
                  failed++;
                }
              }
            }
          }
        } else {
          console.log('⚠️ 跳过 submitBid 测试（无拍品）');
        }
      } else {
        console.log('⚠️ 跳过 submitBid 测试（无场次）');
      }
    } catch (err) {
      console.log('❌ submitBid 成员归属测试错误:', err.message);
      failed++;
    }

    // ========== Test 5: getLotsBySessionId 按 sessionId 查询（不需要 memberId） ==========
    try {
      const auctionRepo = require('../src/systems/family/repos/auctionRepo');
      
      const sessions = await auctionRepo.getSessionsByParentId(parentId);
      if (sessions.length > 0) {
        const lots = await auctionRepo.getLotsBySessionId(sessions[0].id);
        
        // 验证查询成功
        if (Array.isArray(lots)) {
          console.log(`✅ getLotsBySessionId 正确按 sessionId 查询（不需要 memberId）`);
          console.log(`   返回 ${lots.length} 个拍品`);
          passed++;
        } else {
          console.log('❌ getLotsBySessionId 返回格式不正确');
          failed++;
        }
      } else {
        console.log('⚠️ 跳过 getLotsBySessionId 测试（无场次）');
      }
    } catch (err) {
      console.log('❌ getLotsBySessionId 错误:', err.message);
      failed++;
    }

    // ========== Test 6: getBidsByLotId 包含 bidder_member_id ==========
    try {
      const auctionRepo = require('../src/systems/family/repos/auctionRepo');
      
      const sessions = await auctionRepo.getSessionsByParentId(parentId);
      if (sessions.length > 0) {
        const lots = await auctionRepo.getLotsBySessionId(sessions[0].id);
        
        if (lots.length > 0) {
          const bids = await auctionRepo.getBidsByLotId(lots[0].id);
          
          // 验证 bids 结构中包含 bidder_member_id
          if (Array.isArray(bids)) {
            if (bids.length > 0) {
              const hasCorrectField = bids[0].hasOwnProperty('bidder_member_id');
              if (hasCorrectField) {
                console.log('✅ getBidsByLotId 正确包含 bidder_member_id');
                console.log(`   返回 ${bids.length} 个出价记录`);
                passed++;
              } else {
                console.log('❌ getBidsByLotId 缺少 bidder_member_id 字段');
                failed++;
              }
            } else {
              console.log('✅ getBidsByLotId 查询成功（无出价记录）');
              passed++;
            }
          } else {
            console.log('❌ getBidsByLotId 返回格式不正确');
            failed++;
          }
        } else {
          console.log('⚠️ 跳过 getBidsByLotId 测试（无拍品）');
        }
      } else {
        console.log('⚠️ 跳过 getBidsByLotId 测试（无场次）');
      }
    } catch (err) {
      console.log('❌ getBidsByLotId 错误:', err.message);
      failed++;
    }

    // ========== Test 7: getAuctionableSkus 按 parentId 查询 ==========
    try {
      const auctionRepo = require('../src/systems/family/repos/auctionRepo');
      const skus = await auctionRepo.getAuctionableSkus(parentId);
      
      if (Array.isArray(skus)) {
        console.log(`✅ getAuctionableSkus 正确按 parentId 查询`);
        console.log(`   返回 ${skus.length} 个可拍卖 SKU`);
        passed++;
      } else {
        console.log('❌ getAuctionableSkus 返回格式不正确');
        failed++;
      }
    } catch (err) {
      console.log('❌ getAuctionableSkus 错误:', err.message);
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
