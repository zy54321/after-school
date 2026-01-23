-- ============================================
-- 抽奖系统种子数据
-- 执行时机：006_lottery_tables.sql 之后
-- ============================================

-- 使用事务确保数据一致性
BEGIN;

-- ============================================
-- 1. 创建抽奖券对应的 SKU（用于通过商城/任务系统发放）
-- ============================================
DO $$
DECLARE
  v_parent_id INT := 3;  -- 测试用户 ptjs001
  v_ticket_sku_id INT;
  v_gold_ticket_sku_id INT;
BEGIN
  -- 普通抽奖券 SKU
  INSERT INTO family_sku (parent_id, name, description, icon, type, base_cost, is_active, limit_type, limit_max)
  VALUES (v_parent_id, '普通抽奖券', '可用于幸运转盘抽奖', '🎟️', 'ticket', 20, TRUE, 'daily', 5)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_ticket_sku_id;
  
  -- 黄金抽奖券 SKU
  INSERT INTO family_sku (parent_id, name, description, icon, type, base_cost, is_active, limit_type, limit_max)
  VALUES (v_parent_id, '黄金抽奖券', '高级抽奖券，中奖概率更高', '🎫', 'ticket', 50, TRUE, 'daily', 3)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_gold_ticket_sku_id;
  
  RAISE NOTICE '✅ 抽奖券 SKU 创建完成';
END $$;

-- ============================================
-- 2. 创建抽奖券类型
-- ============================================
INSERT INTO ticket_type (parent_id, name, description, icon, point_value, daily_limit, weekly_limit, status, sort_order)
VALUES 
  (3, '普通抽奖券', '基础抽奖券，可用于幸运转盘', '🎟️', 20, 10, NULL, 'active', 1),
  (3, '黄金抽奖券', '高级抽奖券，中奖概率提升50%', '🎫', 50, 5, NULL, 'active', 2),
  (3, '钻石抽奖券', '顶级抽奖券，必得稀有奖品', '💎', 100, 3, 10, 'active', 3)
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. 创建抽奖池
-- ============================================
INSERT INTO draw_pool (parent_id, name, description, icon, entry_ticket_type_id, tickets_per_draw, status, pool_type, config)
VALUES 
  (
    3, 
    '幸运转盘', 
    '每日免费抽奖机会，或使用抽奖券参与',
    '🎡',
    (SELECT id FROM ticket_type WHERE parent_id = 3 AND name = '普通抽奖券' LIMIT 1),
    1,
    'active',
    'wheel',
    '{"animation": "spin", "spinDuration": 3000, "sectors": 8}'::jsonb
  ),
  (
    3, 
    '黄金宝箱', 
    '使用黄金抽奖券开启，必得好礼',
    '📦',
    (SELECT id FROM ticket_type WHERE parent_id = 3 AND name = '黄金抽奖券' LIMIT 1),
    1,
    'active',
    'box',
    '{"animation": "shake", "openDuration": 2000}'::jsonb
  ),
  (
    3, 
    '钻石夺宝', 
    '消耗钻石券，挑战超稀有大奖',
    '💎',
    (SELECT id FROM ticket_type WHERE parent_id = 3 AND name = '钻石抽奖券' LIMIT 1),
    1,
    'active',
    'slot',
    '{"animation": "slot", "reels": 3, "spinDuration": 2500}'::jsonb
  )
ON CONFLICT DO NOTHING;

-- ============================================
-- 4. 创建抽奖池版本（奖品配置）
-- ============================================

-- 幸运转盘 v1
INSERT INTO draw_pool_version (pool_id, version, is_current, prizes, total_weight, min_guarantee_count, guarantee_prize_id, config)
VALUES (
  (SELECT id FROM draw_pool WHERE parent_id = 3 AND name = '幸运转盘' LIMIT 1),
  1,
  TRUE,
  '[
    {"id": 1, "name": "5积分", "type": "points", "value": 5, "weight": 30, "icon": "🪙"},
    {"id": 2, "name": "10积分", "type": "points", "value": 10, "weight": 25, "icon": "💰"},
    {"id": 3, "name": "20积分", "type": "points", "value": 20, "weight": 15, "icon": "💎"},
    {"id": 4, "name": "再来一次", "type": "ticket", "ticket_type_id": 1, "value": 1, "weight": 10, "icon": "🎟️"},
    {"id": 5, "name": "谢谢参与", "type": "empty", "value": 0, "weight": 15, "icon": "😢"},
    {"id": 6, "name": "50积分大奖", "type": "points", "value": 50, "weight": 5, "icon": "🏆"}
  ]'::jsonb,
  100,
  20,
  6,  -- 20次保底中 50积分大奖
  '{"bgColor": "#FFD700", "textColor": "#333"}'::jsonb
)
ON CONFLICT DO NOTHING;

-- 黄金宝箱 v1
INSERT INTO draw_pool_version (pool_id, version, is_current, prizes, total_weight, min_guarantee_count, guarantee_prize_id, config)
VALUES (
  (SELECT id FROM draw_pool WHERE parent_id = 3 AND name = '黄金宝箱' LIMIT 1),
  1,
  TRUE,
  '[
    {"id": 1, "name": "20积分", "type": "points", "value": 20, "weight": 35, "icon": "💰"},
    {"id": 2, "name": "50积分", "type": "points", "value": 50, "weight": 25, "icon": "💎"},
    {"id": 3, "name": "100积分", "type": "points", "value": 100, "weight": 10, "icon": "🏆"},
    {"id": 4, "name": "黄金券x2", "type": "ticket", "ticket_type_id": 2, "value": 2, "weight": 15, "icon": "🎫"},
    {"id": 5, "name": "神秘道具", "type": "sku", "sku_id": null, "value": 1, "weight": 10, "icon": "🎁"},
    {"id": 6, "name": "钻石券", "type": "ticket", "ticket_type_id": 3, "value": 1, "weight": 5, "icon": "💎"}
  ]'::jsonb,
  100,
  10,
  3,  -- 10次保底中 100积分
  '{"rarity": "gold"}'::jsonb
)
ON CONFLICT DO NOTHING;

-- 钻石夺宝 v1
INSERT INTO draw_pool_version (pool_id, version, is_current, prizes, total_weight, min_guarantee_count, guarantee_prize_id, config)
VALUES (
  (SELECT id FROM draw_pool WHERE parent_id = 3 AND name = '钻石夺宝' LIMIT 1),
  1,
  TRUE,
  '[
    {"id": 1, "name": "100积分", "type": "points", "value": 100, "weight": 40, "icon": "💰"},
    {"id": 2, "name": "200积分", "type": "points", "value": 200, "weight": 25, "icon": "💎"},
    {"id": 3, "name": "500积分巨奖", "type": "points", "value": 500, "weight": 10, "icon": "🏆"},
    {"id": 4, "name": "钻石券x3", "type": "ticket", "ticket_type_id": 3, "value": 3, "weight": 15, "icon": "💎"},
    {"id": 5, "name": "传说道具", "type": "sku", "sku_id": null, "value": 1, "weight": 5, "icon": "⭐"},
    {"id": 6, "name": "1000积分神话", "type": "points", "value": 1000, "weight": 5, "icon": "👑"}
  ]'::jsonb,
  100,
  5,
  6,  -- 5次保底中 1000积分
  '{"rarity": "diamond", "vfx": "sparkle"}'::jsonb
)
ON CONFLICT DO NOTHING;

-- ============================================
-- 5. 插入测试抽奖记录
-- ============================================
DO $$
DECLARE
  v_parent_id INT := 3;
  v_member_id INT;
  v_pool_id INT;
  v_version_id INT;
  v_ticket_type_id INT;
BEGIN
  -- 获取测试数据ID
  SELECT id INTO v_member_id FROM family_members WHERE parent_id = v_parent_id LIMIT 1;
  SELECT id INTO v_pool_id FROM draw_pool WHERE parent_id = v_parent_id AND name = '幸运转盘' LIMIT 1;
  SELECT id INTO v_version_id FROM draw_pool_version WHERE pool_id = v_pool_id AND is_current = TRUE LIMIT 1;
  SELECT id INTO v_ticket_type_id FROM ticket_type WHERE parent_id = v_parent_id AND name = '普通抽奖券' LIMIT 1;
  
  IF v_member_id IS NOT NULL AND v_pool_id IS NOT NULL AND v_version_id IS NOT NULL THEN
    -- 插入几条测试抽奖记录
    INSERT INTO draw_log (parent_id, member_id, pool_id, pool_version_id, ticket_type_id, ticket_point_value, tickets_used, result_prize_id, result_type, result_name, result_value, is_guarantee, consecutive_count)
    VALUES 
      (v_parent_id, v_member_id, v_pool_id, v_version_id, v_ticket_type_id, 20, 1, 1, 'points', '5积分', 5, FALSE, 1),
      (v_parent_id, v_member_id, v_pool_id, v_version_id, v_ticket_type_id, 20, 1, 2, 'points', '10积分', 10, FALSE, 2),
      (v_parent_id, v_member_id, v_pool_id, v_version_id, v_ticket_type_id, 20, 1, 5, 'empty', '谢谢参与', 0, FALSE, 3),
      (v_parent_id, v_member_id, v_pool_id, v_version_id, v_ticket_type_id, 20, 1, 4, 'ticket', '再来一次', 1, FALSE, 4),
      (v_parent_id, v_member_id, v_pool_id, v_version_id, v_ticket_type_id, 20, 1, 6, 'points', '50积分大奖', 50, TRUE, 20);
    
    RAISE NOTICE '✅ 测试抽奖记录插入完成';
  ELSE
    RAISE NOTICE '⚠️ 缺少测试数据，跳过抽奖记录插入';
  END IF;
END $$;

COMMIT;

-- ============================================
-- 验证数据
-- ============================================
DO $$
DECLARE
  v_ticket_types INT;
  v_pools INT;
  v_versions INT;
  v_logs INT;
BEGIN
  SELECT COUNT(*) INTO v_ticket_types FROM ticket_type;
  SELECT COUNT(*) INTO v_pools FROM draw_pool;
  SELECT COUNT(*) INTO v_versions FROM draw_pool_version;
  SELECT COUNT(*) INTO v_logs FROM draw_log;
  
  RAISE NOTICE '=== 抽奖系统种子数据统计 ===';
  RAISE NOTICE '  抽奖券类型: % 条', v_ticket_types;
  RAISE NOTICE '  抽奖池: % 个', v_pools;
  RAISE NOTICE '  抽奖池版本: % 个', v_versions;
  RAISE NOTICE '  抽奖记录: % 条', v_logs;
END $$;
