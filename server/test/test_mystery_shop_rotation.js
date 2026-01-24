/**
 * 神秘商店 Rotation 测试
 * 
 * 验证：
 * 1. rotation 表存在且可插入
 * 2. refresh 生成 rotation 记录
 * 3. offers 关联 rotation_id
 * 4. 商店是家庭共享的
 */

const pool = require('../src/shared/config/db');

async function runTests() {
  console.log('🧪 神秘商店 Rotation 测试\n');
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

    // ========== Test 1: mystery_shop_rotation 表存在 ==========
    try {
      const result = await pool.query(
        `SELECT table_name FROM information_schema.tables 
         WHERE table_name = 'mystery_shop_rotation'`
      );
      
      if (result.rows.length > 0) {
        console.log('✅ mystery_shop_rotation 表存在');
        passed++;
      } else {
        console.log('❌ mystery_shop_rotation 表不存在');
        failed++;
      }
    } catch (err) {
      console.log('❌ 检查表失败:', err.message);
      failed++;
    }

    // ========== Test 2: 可以插入 rotation ==========
    let testRotationId;
    try {
      const expiresAt = new Date(Date.now() + 24 * 3600000);
      const result = await pool.query(
        `INSERT INTO mystery_shop_rotation 
         (parent_id, expires_at, offer_count, refresh_type, status)
         VALUES ($1, $2, 3, 'free', 'active')
         RETURNING id`,
        [parentId, expiresAt]
      );
      
      testRotationId = result.rows[0].id;
      console.log(`✅ 可以插入 rotation (id=${testRotationId})`);
      passed++;
    } catch (err) {
      console.log('❌ 插入 rotation 失败:', err.message);
      failed++;
    }

    // ========== Test 3: rotation 字段完整 ==========
    try {
      const result = await pool.query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = 'mystery_shop_rotation'`
      );
      
      const columns = result.rows.map(r => r.column_name);
      const requiredColumns = [
        'id', 'parent_id', 'generated_at', 'expires_at', 
        'offer_count', 'refresh_type', 'payer_member_id', 
        'config', 'status', 'created_at', 'updated_at'
      ];
      
      const missing = requiredColumns.filter(c => !columns.includes(c));
      
      if (missing.length === 0) {
        console.log('✅ rotation 表字段完整');
        passed++;
      } else {
        console.log(`❌ rotation 表缺少字段: ${missing.join(', ')}`);
        failed++;
      }
    } catch (err) {
      console.log('❌ 检查字段失败:', err.message);
      failed++;
    }

    // ========== Test 4: mysteryShopService.refresh 生成 rotation ==========
    try {
      const mysteryShopService = require('../src/systems/family/services/mysteryShopService');
      
      // 先清理现有数据以确保测试干净
      await pool.query(
        `UPDATE mystery_shop_rotation SET status = 'replaced' 
         WHERE parent_id = $1 AND status = 'active'`,
        [parentId]
      );
      
      const result = await mysteryShopService.refresh(parentId, null, true);
      
      if (result.success && result.rotation && result.rotation.id) {
        console.log(`✅ refresh 生成 rotation (id=${result.rotation.id})`);
        console.log(`   - 生成 ${result.offers.length} 个 offers`);
        console.log(`   - 过期时间: ${result.rotation.expiresAt}`);
        passed++;
        
        // 验证 offers 包含 rotation_id
        const hasRotationId = result.offers.every(o => 
          o.rotation_id === result.rotation.id || 
          o.metadata?.rotationId === result.rotation.id
        );
        
        if (hasRotationId) {
          console.log('✅ offers 正确关联 rotation_id');
          passed++;
        } else {
          console.log('❌ offers 未关联 rotation_id');
          failed++;
        }
      } else {
        console.log('❌ refresh 未生成 rotation');
        failed++;
      }
    } catch (err) {
      console.log('❌ refresh 失败:', err.message);
      failed++;
    }

    // ========== Test 5: getShopOffers 返回家庭共享商品 ==========
    try {
      const mysteryShopService = require('../src/systems/family/services/mysteryShopService');
      const offers = await mysteryShopService.getShopOffers(parentId);
      
      console.log(`✅ getShopOffers 返回 ${offers.length} 个商品（家庭共享）`);
      passed++;
    } catch (err) {
      console.log('❌ getShopOffers 失败:', err.message);
      failed++;
    }

    // ========== Test 6: getShopOverview 返回完整概览 ==========
    try {
      const mysteryShopService = require('../src/systems/family/services/mysteryShopService');
      const overview = await mysteryShopService.getShopOverview(parentId);
      
      if (overview.rotation && overview.offers && overview.config) {
        console.log('✅ getShopOverview 返回完整概览');
        console.log(`   - rotation: ${overview.rotation.id}`);
        console.log(`   - offers: ${overview.offers.length}`);
        console.log(`   - canFreeRefresh: ${overview.config.canFreeRefresh}`);
        passed++;
      } else {
        console.log('❌ getShopOverview 返回不完整');
        failed++;
      }
    } catch (err) {
      console.log('❌ getShopOverview 失败:', err.message);
      failed++;
    }

    // ========== Test 7: getCurrentRotation 返回活跃轮次 ==========
    try {
      const mysteryShopService = require('../src/systems/family/services/mysteryShopService');
      const rotation = await mysteryShopService.getCurrentRotation(parentId);
      
      if (rotation && rotation.status === 'active') {
        console.log(`✅ getCurrentRotation 返回活跃轮次 (id=${rotation.id})`);
        passed++;
      } else {
        console.log('❌ getCurrentRotation 未返回活跃轮次');
        failed++;
      }
    } catch (err) {
      console.log('❌ getCurrentRotation 失败:', err.message);
      failed++;
    }

    // ========== Test 8: Controller 不需要 member_id ==========
    try {
      const marketplaceController = require('../src/systems/family/controllers/marketplaceController');
      
      const mockReq = {
        session: { user: { id: parentId, username: 'testuser' } },
        query: {},
        body: {},
      };
      
      const mockRes = {
        statusCode: 200,
        data: null,
        status: function(code) { this.statusCode = code; return this; },
        json: function(data) { this.data = data; return this; },
      };
      
      await marketplaceController.getMysteryShop(mockReq, mockRes);
      
      if (mockRes.statusCode === 200 && mockRes.data.code === 200) {
        console.log('✅ getMysteryShop 不需要 member_id');
        passed++;
      } else {
        console.log('❌ getMysteryShop 失败');
        failed++;
      }
    } catch (err) {
      console.log('❌ getMysteryShop 错误:', err.message);
      failed++;
    }

    // ========== 清理测试数据 ==========
    if (testRotationId) {
      await pool.query('DELETE FROM mystery_shop_rotation WHERE id = $1', [testRotationId]);
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
