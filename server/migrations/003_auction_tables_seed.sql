-- ============================================
-- 家庭成长银行 - 拍卖系统最小测试数据 Seed
-- 执行时机：003_auction_tables.sql 之后
-- ============================================

DO $$
DECLARE
  v_user_id INT;
  v_session_id INT;
  v_lot_id INT;
  v_sku_id INT;
  v_offer_id INT;
BEGIN
  -- ============================================
  -- 1. 获取前置数据
  -- ============================================
  SELECT id INTO v_user_id FROM users WHERE is_active = TRUE LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE NOTICE '⚠️ 没有找到活跃用户，请先创建用户';
    RETURN;
  END IF;
  
  -- 获取一个可用的 SKU
  SELECT id INTO v_sku_id FROM family_sku WHERE is_active = TRUE LIMIT 1;
  IF v_sku_id IS NULL THEN
    RAISE NOTICE '⚠️ 没有找到可用的 SKU，请先运行商城 seed';
    RETURN;
  END IF;
  
  -- 获取一个可用的 Offer
  SELECT id INTO v_offer_id FROM family_offer WHERE is_active = TRUE AND sku_id = v_sku_id LIMIT 1;
  
  RAISE NOTICE '✅ 前置数据：用户ID=%, SKU_ID=%, Offer_ID=%', v_user_id, v_sku_id, v_offer_id;
  
  -- ============================================
  -- 2. 创建测试拍卖场次
  -- ============================================
  INSERT INTO auction_session (
    parent_id, 
    title, 
    scheduled_at, 
    status, 
    config
  )
  VALUES (
    v_user_id,
    '周末积分拍卖会',
    CURRENT_TIMESTAMP + INTERVAL '1 day',
    'scheduled',
    '{"bidIncrement": 5, "countdownSeconds": 30, "mode": "english"}'::jsonb
  )
  RETURNING id INTO v_session_id;
  
  RAISE NOTICE '✅ 已创建拍卖场次 ID: %', v_session_id;
  
  -- ============================================
  -- 3. 创建测试拍卖品
  -- ============================================
  INSERT INTO auction_lot (
    session_id,
    offer_id,
    sku_id,
    rarity,
    start_price,
    reserve_price,
    buy_now_price,
    quantity,
    status,
    sort_order,
    sku_name,
    sku_icon
  )
  VALUES (
    v_session_id,
    v_offer_id,
    v_sku_id,
    'rare',
    10,     -- 起拍价
    NULL,   -- 无保留价
    100,    -- 一口价
    1,
    'pending',
    1,
    (SELECT name FROM family_sku WHERE id = v_sku_id),
    (SELECT icon FROM family_sku WHERE id = v_sku_id)
  )
  RETURNING id INTO v_lot_id;
  
  RAISE NOTICE '✅ 已创建拍卖品 ID: %', v_lot_id;
  
  -- ============================================
  -- 4. 创建第二个拍卖品（不同稀有度）
  -- ============================================
  INSERT INTO auction_lot (
    session_id,
    offer_id,
    sku_id,
    rarity,
    start_price,
    quantity,
    status,
    sort_order,
    sku_name,
    sku_icon
  )
  VALUES (
    v_session_id,
    v_offer_id,
    v_sku_id,
    'epic',
    20,     -- 更高起拍价
    1,
    'pending',
    2,
    (SELECT name FROM family_sku WHERE id = v_sku_id) || ' (限量版)',
    (SELECT icon FROM family_sku WHERE id = v_sku_id)
  );
  
  RAISE NOTICE '✅ 已创建第二个拍卖品';
  
  -- ============================================
  -- 输出总结
  -- ============================================
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ Seed 数据插入完成！';
  RAISE NOTICE '- Session ID: %', v_session_id;
  RAISE NOTICE '- Lot 数量: 2';
  RAISE NOTICE '============================================';
  
END $$;

-- ============================================
-- 验证结果
-- ============================================
SELECT 
  '✅ Seed 数据验证' as status,
  (SELECT COUNT(*) FROM auction_session) as session_count,
  (SELECT COUNT(*) FROM auction_lot) as lot_count,
  (SELECT COUNT(*) FROM auction_bid) as bid_count,
  (SELECT COUNT(*) FROM auction_result) as result_count;

-- 显示场次数据
SELECT '--- 拍卖场次 ---' as info;
SELECT id, title, status, scheduled_at, config FROM auction_session;

-- 显示拍卖品数据
SELECT '--- 拍卖品 ---' as info;
SELECT id, session_id, sku_name, rarity, start_price, buy_now_price, status FROM auction_lot;

-- 显示拍卖品详情视图
SELECT '--- 拍卖品详情视图 ---' as info;
SELECT id, session_title, sku_name, rarity, start_price, current_price, bid_count FROM v_auction_lot_detail;
