/**
 * Controller 层改造测试
 * 
 * 验证：
 * 1. 供给侧接口不强制 member_id
 * 2. 消费侧接口需要 member_id
 */

const pool = require('../src/shared/config/db');

// 模拟 session
const createMockSession = (userId, username = 'testuser') => ({
  user: { id: userId, username }
});

// 模拟 request/response
const createMockReq = (options = {}) => ({
  session: createMockSession(options.userId || 1, options.username),
  params: options.params || {},
  query: options.query || {},
  body: options.body || {},
});

const createMockRes = () => {
  const res = {
    statusCode: 200,
    data: null,
    status: function(code) { 
      this.statusCode = code; 
      return this; 
    },
    json: function(data) { 
      this.data = data;
      return this;
    }
  };
  return res;
};

async function runTests() {
  console.log('🧪 Controller 层改造测试\n');
  let passed = 0;
  let failed = 0;
  let parentId;

  try {
    // 获取测试用 parentId
    const userRes = await pool.query('SELECT id FROM users LIMIT 1');
    parentId = userRes.rows[0]?.id;
    
    if (!parentId) {
      console.log('❌ 找不到测试用户，跳过测试');
      return;
    }

    console.log(`使用 parentId: ${parentId}\n`);

    // ========== Test 1: marketplaceController.getSkus (不需要 member_id) ==========
    try {
      const marketplaceController = require('../src/systems/family/controllers/marketplaceController');
      const req = createMockReq({ userId: parentId });
      const res = createMockRes();
      
      await marketplaceController.getSkus(req, res);
      
      if (res.statusCode === 200 && res.data.code === 200) {
        console.log('✅ getSkus 不需要 member_id 即可调用');
        console.log(`   返回 ${res.data.data.total} 个 SKU`);
        passed++;
      } else {
        console.log('❌ getSkus 失败:', res.data);
        failed++;
      }
    } catch (err) {
      console.log('❌ getSkus 错误:', err.message);
      failed++;
    }

    // ========== Test 2: marketplaceController.getCatalog (不需要 member_id) ==========
    try {
      const marketplaceController = require('../src/systems/family/controllers/marketplaceController');
      const req = createMockReq({ userId: parentId });
      const res = createMockRes();
      
      await marketplaceController.getCatalog(req, res);
      
      if (res.statusCode === 200 && res.data.code === 200) {
        console.log('✅ getCatalog 不需要 member_id 即可调用');
        console.log(`   返回 ${res.data.data.totalSkus} 个 SKU, ${res.data.data.totalOffers} 个 Offer`);
        passed++;
      } else {
        console.log('❌ getCatalog 失败:', res.data);
        failed++;
      }
    } catch (err) {
      console.log('❌ getCatalog 错误:', err.message);
      failed++;
    }

    // ========== Test 3: marketplaceController.getOffers (不需要 member_id) ==========
    try {
      const marketplaceController = require('../src/systems/family/controllers/marketplaceController');
      const req = createMockReq({ userId: parentId });
      const res = createMockRes();
      
      await marketplaceController.getOffers(req, res);
      
      if (res.statusCode === 200 && res.data.code === 200) {
        console.log('✅ getOffers 不需要 member_id 即可调用');
        console.log(`   返回 ${res.data.data.total} 个 Offer`);
        passed++;
      } else {
        console.log('❌ getOffers 失败:', res.data);
        failed++;
      }
    } catch (err) {
      console.log('❌ getOffers 错误:', err.message);
      failed++;
    }

    // ========== Test 4: marketplaceController.getMysteryShop (不需要 member_id) ==========
    try {
      const marketplaceController = require('../src/systems/family/controllers/marketplaceController');
      const req = createMockReq({ userId: parentId });
      const res = createMockRes();
      
      await marketplaceController.getMysteryShop(req, res);
      
      if (res.statusCode === 200 && res.data.code === 200) {
        console.log('✅ getMysteryShop 不需要 member_id 即可调用');
        console.log(`   返回 ${res.data.data.total} 个商店商品`);
        passed++;
      } else {
        console.log('❌ getMysteryShop 失败:', res.data);
        failed++;
      }
    } catch (err) {
      console.log('❌ getMysteryShop 错误:', err.message);
      failed++;
    }

    // ========== Test 5: auctionController.getSessions (不需要 member_id) ==========
    try {
      const auctionController = require('../src/systems/family/controllers/auctionController');
      const req = createMockReq({ userId: parentId });
      const res = createMockRes();
      
      await auctionController.getSessions(req, res);
      
      if (res.statusCode === 200 && res.data.code === 200) {
        console.log('✅ getSessions 不需要 member_id 即可调用');
        console.log(`   返回 ${res.data.data.total} 个场次`);
        passed++;
      } else {
        console.log('❌ getSessions 失败:', res.data);
        failed++;
      }
    } catch (err) {
      console.log('❌ getSessions 错误:', err.message);
      failed++;
    }

    // ========== Test 6: auctionController.getOverview (不需要 member_id) ==========
    try {
      const auctionController = require('../src/systems/family/controllers/auctionController');
      const req = createMockReq({ userId: parentId });
      const res = createMockRes();
      
      await auctionController.getOverview(req, res);
      
      if (res.statusCode === 200 && res.data.code === 200) {
        console.log('✅ getOverview 不需要 member_id 即可调用');
        console.log(`   返回 ${res.data.data.totalSessions} 个场次`);
        passed++;
      } else {
        console.log('❌ getOverview 失败:', res.data);
        failed++;
      }
    } catch (err) {
      console.log('❌ getOverview 错误:', err.message);
      failed++;
    }

    // ========== Test 7: auctionController.getAuctionableSkus (不需要 member_id) ==========
    try {
      const auctionController = require('../src/systems/family/controllers/auctionController');
      const req = createMockReq({ userId: parentId });
      const res = createMockRes();
      
      await auctionController.getAuctionableSkus(req, res);
      
      if (res.statusCode === 200 && res.data.code === 200) {
        console.log('✅ getAuctionableSkus 不需要 member_id 即可调用');
        console.log(`   返回 ${res.data.data.total} 个可拍卖 SKU`);
        passed++;
      } else {
        console.log('❌ getAuctionableSkus 失败:', res.data);
        failed++;
      }
    } catch (err) {
      console.log('❌ getAuctionableSkus 错误:', err.message);
      failed++;
    }

    // ========== Test 8: lotteryController.getPools 无 member_id (Family 视角) ==========
    try {
      const lotteryController = require('../src/systems/family/controllers/lotteryController');
      const req = createMockReq({ userId: parentId });
      const res = createMockRes();
      
      await lotteryController.getPools(req, res);
      
      if (res.statusCode === 200 && res.data.code === 200) {
        console.log('✅ getPools (Family 视角) 不需要 member_id 即可调用');
        console.log(`   返回 ${res.data.data.total} 个抽奖池, viewMode: ${res.data.data.viewMode}`);
        passed++;
      } else {
        console.log('❌ getPools (Family 视角) 失败:', res.data);
        failed++;
      }
    } catch (err) {
      console.log('❌ getPools (Family 视角) 错误:', err.message);
      failed++;
    }

    // ========== Test 9: lotteryController.getOverview (不需要 member_id) ==========
    try {
      const lotteryController = require('../src/systems/family/controllers/lotteryController');
      const req = createMockReq({ userId: parentId });
      const res = createMockRes();
      
      await lotteryController.getOverview(req, res);
      
      if (res.statusCode === 200 && res.data.code === 200) {
        console.log('✅ getOverview 不需要 member_id 即可调用');
        console.log(`   返回 ${res.data.data.pools?.length || 0} 个抽奖池`);
        passed++;
      } else {
        console.log('❌ getOverview 失败:', res.data);
        failed++;
      }
    } catch (err) {
      console.log('❌ getOverview 错误:', err.message);
      failed++;
    }

    // ========== Test 10: lotteryController.getPoolDetail (不需要 member_id) ==========
    try {
      const lotteryController = require('../src/systems/family/controllers/lotteryController');
      
      // 先获取一个 pool id
      const poolsRes = await pool.query('SELECT id FROM draw_pool WHERE parent_id = $1 LIMIT 1', [parentId]);
      if (poolsRes.rows[0]) {
        const req = createMockReq({ 
          userId: parentId, 
          params: { id: poolsRes.rows[0].id.toString() } 
        });
        const res = createMockRes();
        
        await lotteryController.getPoolDetail(req, res);
        
        if (res.statusCode === 200 && res.data.code === 200) {
          console.log('✅ getPoolDetail 不需要 member_id 即可调用');
          passed++;
        } else {
          console.log('❌ getPoolDetail 失败:', res.data);
          failed++;
        }
      } else {
        console.log('⚠️ getPoolDetail 跳过 (无测试数据)');
      }
    } catch (err) {
      console.log('❌ getPoolDetail 错误:', err.message);
      failed++;
    }

    // ========== Test 11: marketplaceController.createOrder 需要 member_id ==========
    try {
      const marketplaceController = require('../src/systems/family/controllers/marketplaceController');
      const req = createMockReq({ 
        userId: parentId,
        body: {
          offer_id: 1,
          // 故意不传 buyer_member_id
          idempotency_key: 'test_key'
        }
      });
      const res = createMockRes();
      
      await marketplaceController.createOrder(req, res);
      
      if (res.statusCode === 400 && res.data.msg.includes('buyer_member_id')) {
        console.log('✅ createOrder 正确要求 buyer_member_id');
        passed++;
      } else {
        console.log('❌ createOrder 应该要求 buyer_member_id');
        failed++;
      }
    } catch (err) {
      console.log('❌ createOrder 校验错误:', err.message);
      failed++;
    }

    // ========== Test 12: auctionController.submitBid 需要 member_id ==========
    try {
      const auctionController = require('../src/systems/family/controllers/auctionController');
      const req = createMockReq({ 
        userId: parentId,
        params: { id: '1' },
        body: {
          // 故意不传 member_id
          bid_points: 100
        }
      });
      const res = createMockRes();
      
      await auctionController.submitBid(req, res);
      
      if (res.statusCode === 400 && res.data.msg.includes('member_id')) {
        console.log('✅ submitBid 正确要求 member_id');
        passed++;
      } else {
        console.log('❌ submitBid 应该要求 member_id');
        failed++;
      }
    } catch (err) {
      console.log('❌ submitBid 校验错误:', err.message);
      failed++;
    }

    // ========== Test 13: lotteryController.spin 需要 member_id ==========
    try {
      const lotteryController = require('../src/systems/family/controllers/lotteryController');
      const req = createMockReq({ 
        userId: parentId,
        body: {
          pool_id: 1,
          // 故意不传 member_id
        }
      });
      const res = createMockRes();
      
      await lotteryController.spin(req, res);
      
      if (res.statusCode === 400 && res.data.msg.includes('member_id')) {
        console.log('✅ spin 正确要求 member_id');
        passed++;
      } else {
        console.log('❌ spin 应该要求 member_id');
        failed++;
      }
    } catch (err) {
      console.log('❌ spin 校验错误:', err.message);
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
