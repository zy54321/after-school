-- ============================================
-- 家庭成长银行 - 抽奖券类型规范化
-- 执行时机：010_ticket_type_sku_link.sql
-- 
-- 目的：
-- 1. 规范 family_sku.type 支持 ticket 类型
-- 2. 为 ticket_type 添加 sku_id 字段，建立显式关联
-- 3. 消除 name ILIKE 模糊匹配的不稳定性
-- ============================================

-- ============================================
-- 1. 更新 family_sku.type 注释
-- ============================================
COMMENT ON COLUMN family_sku.type IS '商品类型：reward=可兑换奖品，auction=竞拍品，ticket=抽奖券';

-- ============================================
-- 2. 为 ticket_type 添加 sku_id 字段
-- ============================================
ALTER TABLE ticket_type 
ADD COLUMN IF NOT EXISTS sku_id INT REFERENCES family_sku(id) ON DELETE SET NULL;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_ticket_type_sku_id ON ticket_type(sku_id);

-- 添加注释
COMMENT ON COLUMN ticket_type.sku_id IS '关联的 SKU ID，用于库存管理和发放。必须是 type=ticket 的 SKU';

-- ============================================
-- 3. 补充 ticket 类型 SKU 示例（如果不存在）
-- ============================================
DO $$
DECLARE
  v_sku_id INT;
  v_ticket_type_id INT;
  v_parent_id INT;
BEGIN
  -- 获取第一个用户ID（用于创建示例数据）
  SELECT id INTO v_parent_id FROM users LIMIT 1;
  
  IF v_parent_id IS NOT NULL THEN
    -- 检查是否已有 ticket 类型 SKU
    SELECT id INTO v_sku_id FROM family_sku 
    WHERE type = 'ticket' AND name = '普通抽奖券' LIMIT 1;
    
    -- 如果不存在，创建示例 ticket SKU
    IF v_sku_id IS NULL THEN
      INSERT INTO family_sku (parent_id, name, description, icon, type, base_cost, is_active)
      VALUES (v_parent_id, '普通抽奖券', '可用于每日转盘抽奖', '🎟️', 'ticket', 10, TRUE)
      RETURNING id INTO v_sku_id;
      
      RAISE NOTICE '✅ 创建了普通抽奖券 SKU，ID: %', v_sku_id;
    ELSE
      RAISE NOTICE '📌 普通抽奖券 SKU 已存在，ID: %', v_sku_id;
    END IF;
    
    -- 检查是否已有对应的 ticket_type
    SELECT id INTO v_ticket_type_id FROM ticket_type 
    WHERE parent_id = v_parent_id AND name = '普通抽奖券' LIMIT 1;
    
    IF v_ticket_type_id IS NOT NULL THEN
      -- 更新 ticket_type 的 sku_id
      UPDATE ticket_type SET sku_id = v_sku_id WHERE id = v_ticket_type_id;
      RAISE NOTICE '✅ 更新了 ticket_type (ID: %) 的 sku_id 为 %', v_ticket_type_id, v_sku_id;
    END IF;
    
    -- 创建黄金抽奖券 SKU
    SELECT id INTO v_sku_id FROM family_sku 
    WHERE type = 'ticket' AND name = '黄金抽奖券' LIMIT 1;
    
    IF v_sku_id IS NULL THEN
      INSERT INTO family_sku (parent_id, name, description, icon, type, base_cost, is_active)
      VALUES (v_parent_id, '黄金抽奖券', '高级抽奖券，可用于黄金转盘', '🎫', 'ticket', 50, TRUE)
      RETURNING id INTO v_sku_id;
      
      RAISE NOTICE '✅ 创建了黄金抽奖券 SKU，ID: %', v_sku_id;
    END IF;
    
    -- 更新黄金抽奖券的 ticket_type
    SELECT id INTO v_ticket_type_id FROM ticket_type 
    WHERE parent_id = v_parent_id AND name = '黄金抽奖券' LIMIT 1;
    
    IF v_ticket_type_id IS NOT NULL THEN
      UPDATE ticket_type SET sku_id = v_sku_id WHERE id = v_ticket_type_id;
      RAISE NOTICE '✅ 更新了 ticket_type (ID: %) 的 sku_id 为 %', v_ticket_type_id, v_sku_id;
    END IF;
    
  ELSE
    RAISE NOTICE '⚠️ 没有找到用户，跳过示例数据创建';
  END IF;
END $$;

-- ============================================
-- 完成提示
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ 抽奖券类型规范化完成！';
  RAISE NOTICE '   - family_sku.type 支持 ticket 类型';
  RAISE NOTICE '   - ticket_type.sku_id 字段已添加';
  RAISE NOTICE '';
  RAISE NOTICE '💡 使用方式：';
  RAISE NOTICE '   1. 创建 ticket 类型的 SKU';
  RAISE NOTICE '   2. 创建 ticket_type，设置 sku_id 关联到 SKU';
  RAISE NOTICE '   3. 发放抽奖券时，直接使用 sku_id 创建库存';
END $$;
