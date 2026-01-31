-- ============================================
-- 家庭成长银行 - 最终迁移 service 为 permission
-- 执行时机：026_migrate_service_to_permission_final.sql
-- 
-- 用途：
-- 1. 把历史数据中的 service 批量改为 permission
-- 2. 确保数据库中不再存在 type='service' 的记录
-- ============================================

DO $$
DECLARE
  v_updated_count INT;
BEGIN
  -- ============================================
  -- 1. 更新 family_sku 表中的 service 类型
  -- ============================================
  
  UPDATE family_sku
  SET type = 'permission'
  WHERE type = 'service';
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  IF v_updated_count > 0 THEN
    RAISE NOTICE '✅ 已更新 % 条 family_sku 记录：service -> permission', v_updated_count;
  ELSE
    RAISE NOTICE '✅ family_sku 表中没有 service 类型的记录';
  END IF;
  
  -- ============================================
  -- 2. 检查是否有其他表也存储了 type 字段
  -- ============================================
  
  -- 检查 family_offer 表是否有 type 字段（通常没有，但为了安全起见检查）
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'family_offer' AND column_name = 'type'
  ) THEN
    UPDATE family_offer
    SET type = 'permission'
    WHERE type = 'service';
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    IF v_updated_count > 0 THEN
      RAISE NOTICE '✅ 已更新 % 条 family_offer 记录：service -> permission', v_updated_count;
    END IF;
  END IF;
  
  -- 检查 family_market_order 表是否有 type 字段
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'family_market_order' AND column_name = 'type'
  ) THEN
    UPDATE family_market_order
    SET type = 'permission'
    WHERE type = 'service';
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    IF v_updated_count > 0 THEN
      RAISE NOTICE '✅ 已更新 % 条 family_market_order 记录：service -> permission', v_updated_count;
    END IF;
  END IF;
  
  -- 检查 family_inventory 表是否有 type 字段
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'family_inventory' AND column_name = 'type'
  ) THEN
    UPDATE family_inventory
    SET type = 'permission'
    WHERE type = 'service';
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    IF v_updated_count > 0 THEN
      RAISE NOTICE '✅ 已更新 % 条 family_inventory 记录：service -> permission', v_updated_count;
    END IF;
  END IF;
  
END $$;

-- ============================================
-- 3. 验证迁移结果
-- ============================================

DO $$
DECLARE
  v_remaining_count INT;
BEGIN
  -- 检查是否还有 service 类型的记录
  SELECT COUNT(*) INTO v_remaining_count
  FROM family_sku
  WHERE type = 'service';
  
  IF v_remaining_count > 0 THEN
    RAISE WARNING '⚠️ 仍有 % 条 family_sku 记录的 type 为 service，请检查', v_remaining_count;
  ELSE
    RAISE NOTICE '✅ 所有 service 类型已成功迁移为 permission';
  END IF;
END $$;

DO $$
BEGIN
  RAISE NOTICE '✅ service 类型最终迁移完成';
END $$;
