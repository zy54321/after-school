-- ============================================
-- 家庭成长银行 - 将service类型迁移为permission
-- 执行时机：025_migrate_service_to_permission.sql（在024之后执行）
-- 
-- 用途：
-- 1. 将所有service类型SKU改为permission
-- 2. 将所有reward类型SKU改为item
-- 3. 根据名称和描述推断fulfillment_mode和verification
-- ============================================

DO $$
DECLARE
  v_updated_count INT;
  v_sku RECORD;
  v_fulfillment_mode VARCHAR(20);
  v_verification VARCHAR(20);
  v_duration_minutes INT;
  v_uses INT;
BEGIN
  -- ============================================
  -- 1. 迁移 service 类型为 permission
  -- ============================================
  
  FOR v_sku IN 
    SELECT id, name, description, type
    FROM family_sku
    WHERE type = 'service'
  LOOP
    -- 推断 fulfillment_mode
    v_fulfillment_mode := 'instant'; -- 默认值
    
    IF v_sku.name ILIKE '%陪同%' OR v_sku.name ILIKE '%购买%' 
       OR v_sku.name ILIKE '%帮忙%' OR v_sku.name ILIKE '%一次%'
       OR (v_sku.description IS NOT NULL AND (
         v_sku.description ILIKE '%陪同%' OR v_sku.description ILIKE '%购买%'
         OR v_sku.description ILIKE '%帮忙%' OR v_sku.description ILIKE '%一次%'
       )) THEN
      v_fulfillment_mode := 'manual_confirm';
    ELSIF v_sku.name ILIKE '%预约%' OR v_sku.name ILIKE '%周末%' 
          OR v_sku.name ILIKE '%活动%'
          OR (v_sku.description IS NOT NULL AND (
            v_sku.description ILIKE '%预约%' OR v_sku.description ILIKE '%周末%'
            OR v_sku.description ILIKE '%活动%'
          )) THEN
      v_fulfillment_mode := 'schedule';
    ELSIF v_sku.name ILIKE '%分钟%' OR v_sku.name ILIKE '%小时%' 
          OR v_sku.name ILIKE '%免一次%'
          OR (v_sku.description IS NOT NULL AND (
            v_sku.description ILIKE '%分钟%' OR v_sku.description ILIKE '%小时%'
            OR v_sku.description ILIKE '%免一次%'
          )) THEN
      v_fulfillment_mode := 'instant';
    END IF;
    
    -- 推断 verification
    IF v_fulfillment_mode = 'instant' THEN
      v_verification := 'auto';
    ELSIF v_fulfillment_mode = 'manual_confirm' THEN
      v_verification := 'parent_confirm';
    ELSIF v_fulfillment_mode = 'schedule' THEN
      v_verification := 'both_confirm';
    ELSE
      v_verification := 'auto';
    END IF;
    
    -- 尝试从名称中提取 duration_minutes 或 uses
    v_duration_minutes := NULL;
    v_uses := NULL;
    
    -- 提取分钟数（如"30分钟"、"1小时"）
    IF v_sku.name ~* '(\d+)\s*分钟' THEN
      v_duration_minutes := (regexp_match(v_sku.name, '(\d+)\s*分钟'))[1]::INT;
    ELSIF v_sku.name ~* '(\d+)\s*小时' THEN
      v_duration_minutes := (regexp_match(v_sku.name, '(\d+)\s*小时'))[1]::INT * 60;
    ELSIF v_sku.description IS NOT NULL THEN
      IF v_sku.description ~* '(\d+)\s*分钟' THEN
        v_duration_minutes := (regexp_match(v_sku.description, '(\d+)\s*分钟'))[1]::INT;
      ELSIF v_sku.description ~* '(\d+)\s*小时' THEN
        v_duration_minutes := (regexp_match(v_sku.description, '(\d+)\s*小时'))[1]::INT * 60;
      END IF;
    END IF;
    
    -- 提取次数（如"免1次"、"一次"）
    IF v_sku.name ~* '免\s*(\d+)\s*次' OR v_sku.name ~* '(\d+)\s*次' THEN
      v_uses := COALESCE(
        (regexp_match(v_sku.name, '免\s*(\d+)\s*次'))[1]::INT,
        (regexp_match(v_sku.name, '(\d+)\s*次'))[1]::INT,
        1
      );
    ELSIF v_sku.name ILIKE '%一次%' THEN
      v_uses := 1;
    END IF;
    
    -- 如果都没有，默认设置 uses = 1
    IF v_duration_minutes IS NULL AND v_uses IS NULL THEN
      v_uses := 1;
    END IF;
    
    -- 更新SKU
    UPDATE family_sku
    SET 
      type = 'permission',
      fulfillment_mode = v_fulfillment_mode,
      verification = v_verification,
      duration_minutes = v_duration_minutes,
      uses = v_uses
    WHERE id = v_sku.id;
    
    RAISE NOTICE '✅ 迁移 SKU #%: % -> permission (fulfillment: %, verification: %, duration: %, uses: %)',
      v_sku.id, v_sku.name, v_fulfillment_mode, v_verification, 
      COALESCE(v_duration_minutes::TEXT, 'NULL'), COALESCE(v_uses::TEXT, 'NULL');
  END LOOP;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE '✅ 已迁移 % 条 service 类型为 permission', v_updated_count;
  
  -- ============================================
  -- 2. 迁移 reward 类型为 item
  -- ============================================
  
  UPDATE family_sku
  SET type = 'item'
  WHERE type = 'reward';
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE '✅ 已迁移 % 条 reward 类型为 item', v_updated_count;
  
  -- ============================================
  -- 3. 验证迁移结果
  -- ============================================
  
  IF EXISTS (SELECT 1 FROM family_sku WHERE type = 'service') THEN
    RAISE WARNING '⚠️ 仍有 service 类型的 SKU，请检查';
  END IF;
  
  IF EXISTS (SELECT 1 FROM family_sku WHERE type = 'reward') THEN
    RAISE WARNING '⚠️ 仍有 reward 类型的 SKU，请检查';
  END IF;
  
  -- 检查 permission 类型是否都有 duration_minutes 或 uses
  IF EXISTS (
    SELECT 1 FROM family_sku 
    WHERE type = 'permission' 
      AND (duration_minutes IS NULL OR duration_minutes <= 0)
      AND (uses IS NULL OR uses <= 0)
  ) THEN
    RAISE WARNING '⚠️ 有 permission 类型 SKU 缺少 duration_minutes 和 uses，请手动补充';
  END IF;
  
END $$;

-- ============================================
-- 4. 启用约束检查触发器
-- ============================================

-- 现在可以安全地启用触发器了
DROP TRIGGER IF EXISTS trigger_check_permission_fields ON family_sku;
CREATE TRIGGER trigger_check_permission_fields
  BEFORE INSERT OR UPDATE ON family_sku
  FOR EACH ROW
  EXECUTE FUNCTION check_permission_fields();

DO $$
BEGIN
  RAISE NOTICE '✅ service 类型迁移完成';
  RAISE NOTICE '✅ 约束检查触发器已启用';
END $$;
