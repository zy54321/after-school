-- ============================================
-- 家庭成长银行 - 商城最小测试数据 Seed
-- 执行时机：002_family_market.sql 之后
-- 命令示例：psql -U your_user -d your_database -f 002_family_market_seed.sql
-- ============================================

-- ============================================
-- 完整的种子数据脚本（使用单一 DO 块）
-- ============================================
DO $$
DECLARE
  v_user_id INT;
  v_member_id INT;
  v_order_id INT;
  v_sku_id INT;
  v_offer_id INT;
  v_inventory_id INT;
BEGIN
  -- ============================================
  -- 1. 前置条件检查
  -- ============================================
  SELECT id INTO v_user_id FROM users WHERE is_active = TRUE LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE NOTICE '⚠️ 没有找到活跃用户，请先创建用户';
    RETURN;
  END IF;
  
  -- 确保至少有一个家庭成员
  SELECT id INTO v_member_id FROM family_members WHERE parent_id = v_user_id LIMIT 1;
  IF v_member_id IS NULL THEN
    -- 创建默认成员
    INSERT INTO family_members (parent_id, name, avatar)
    VALUES (v_user_id, '测试宝贝', '')
    RETURNING id INTO v_member_id;
    RAISE NOTICE '✅ 已创建默认家庭成员 ID: %', v_member_id;
  END IF;
  
  RAISE NOTICE '✅ 前置条件检查通过 - 用户ID: %, 成员ID: %', v_user_id, v_member_id;

  -- ============================================
  -- 2. 插入测试 SKU
  -- ============================================
  INSERT INTO family_sku (parent_id, name, description, icon, type, base_cost, limit_type, limit_max, is_active)
  VALUES (
    0,  -- 系统默认
    '30分钟游戏时间',
    '完成任务后可兑换30分钟游戏时间',
    '🎮',
    'reward',
    50,
    'daily',
    2,
    TRUE
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_sku_id;
  
  -- 如果没有插入（已存在），则获取现有的
  IF v_sku_id IS NULL THEN
    SELECT id INTO v_sku_id FROM family_sku WHERE name = '30分钟游戏时间' LIMIT 1;
  END IF;
  
  IF v_sku_id IS NULL THEN
    RAISE NOTICE '⚠️ SKU 创建失败';
    RETURN;
  END IF;
  
  RAISE NOTICE '✅ SKU ID: %', v_sku_id;

  -- ============================================
  -- 3. 插入测试 Offer
  -- ============================================
  INSERT INTO family_offer (sku_id, cost, quantity, is_active)
  VALUES (
    v_sku_id,
    50, -- 积分成本
    1,  -- 数量
    TRUE
  )
  RETURNING id INTO v_offer_id;
  
  IF v_offer_id IS NULL THEN
    SELECT id INTO v_offer_id FROM family_offer WHERE sku_id = v_sku_id LIMIT 1;
  END IF;
  
  RAISE NOTICE '✅ Offer ID: %', v_offer_id;

  -- ============================================
  -- 4. 插入测试 Order
  -- ============================================
  INSERT INTO family_market_order (
    parent_id, member_id, offer_id, sku_id, 
    sku_name, cost, quantity, status, idempotency_key
  )
  VALUES (
    v_user_id,
    v_member_id,
    v_offer_id,
    v_sku_id,
    '30分钟游戏时间',
    50,
    1,
    'paid',
    'seed_order_' || v_user_id || '_001'
  )
  ON CONFLICT (parent_id, idempotency_key) DO UPDATE SET
    status = 'paid',
    updated_at = CURRENT_TIMESTAMP
  RETURNING id INTO v_order_id;
  
  IF v_order_id IS NULL THEN
    SELECT id INTO v_order_id FROM family_market_order 
    WHERE idempotency_key = 'seed_order_' || v_user_id || '_001' LIMIT 1;
  END IF;
  
  RAISE NOTICE '✅ Order ID: %', v_order_id;

  -- ============================================
  -- 5. 插入测试积分流水
  -- ============================================
  INSERT INTO family_points_log (
    member_id, reward_id, description, points_change,
    order_id, idempotency_key, reason_code, parent_id
  )
  VALUES (
    v_member_id,
    NULL,  -- 暂不关联旧的 reward
    '兑换：30分钟游戏时间（商城订单）',
    -50,
    v_order_id,
    'seed_points_' || v_user_id || '_001',
    'reward',
    v_user_id
  )
  ON CONFLICT DO NOTHING;
  
  RAISE NOTICE '✅ 已插入测试积分流水';

  -- ============================================
  -- 6. 插入测试库存
  -- ============================================
  INSERT INTO family_inventory (
    member_id, sku_id, order_id, quantity, status
  )
  VALUES (
    v_member_id,
    v_sku_id,
    v_order_id,
    1,
    'unused'
  )
  RETURNING id INTO v_inventory_id;
  
  RAISE NOTICE '✅ Inventory ID: %', v_inventory_id;
  
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ Seed 数据插入完成！';
  RAISE NOTICE '- SKU ID: %', v_sku_id;
  RAISE NOTICE '- Offer ID: %', v_offer_id;
  RAISE NOTICE '- Order ID: %', v_order_id;
  RAISE NOTICE '- Inventory ID: %', v_inventory_id;
  RAISE NOTICE '============================================';
  
END $$;

-- ============================================
-- 验证结果
-- ============================================
SELECT 
  '✅ Seed 数据验证' as status,
  (SELECT COUNT(*) FROM family_sku) as sku_count,
  (SELECT COUNT(*) FROM family_offer) as offer_count,
  (SELECT COUNT(*) FROM family_market_order) as order_count,
  (SELECT COUNT(*) FROM family_inventory) as inventory_count,
  (SELECT COUNT(*) FROM family_points_log WHERE order_id IS NOT NULL) as points_log_with_order;
