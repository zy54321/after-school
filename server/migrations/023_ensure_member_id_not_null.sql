-- ============================================
-- 家庭成长银行 - 确保 member_id 为 NOT NULL
-- 执行时机：023_ensure_member_id_not_null.sql
-- 
-- 用途：确保 family_point_presets.member_id 为 NOT NULL
--       避免查询回退到家庭级导致跨成员共享
-- ============================================

-- ============================================
-- 1. 检查并补齐 NULL 值
-- ============================================

DO $$
DECLARE
  v_null_count INT;
  v_updated_count INT;
BEGIN
  -- 检查是否有 member_id 为 NULL 的记录
  SELECT COUNT(*) INTO v_null_count
  FROM family_point_presets
  WHERE member_id IS NULL;
  
  IF v_null_count > 0 THEN
    RAISE NOTICE '⚠️ 发现 % 条 member_id 为 NULL 的记录，开始补齐...', v_null_count;
    
    -- 将 member_id 为 NULL 的记录批量设置为该 parent 下最小 member.id
    UPDATE family_point_presets p
    SET member_id = (
      SELECT m.id 
      FROM family_members m 
      WHERE m.parent_id = p.parent_id 
      ORDER BY m.id 
      LIMIT 1
    )
    WHERE p.member_id IS NULL
      AND p.parent_id IS NOT NULL;
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RAISE NOTICE '✅ 已补齐 % 条记录的 member_id', v_updated_count;
    
    -- 如果还有 parent_id 也为 NULL 的，尝试从其他记录推断
    UPDATE family_point_presets p1
    SET 
      parent_id = (
        SELECT DISTINCT p2.parent_id 
        FROM family_point_presets p2 
        WHERE p2.parent_id IS NOT NULL 
        LIMIT 1
      ),
      member_id = (
        SELECT m.id 
        FROM family_members m 
        WHERE m.parent_id = (
          SELECT DISTINCT p2.parent_id 
          FROM family_point_presets p2 
          WHERE p2.parent_id IS NOT NULL 
          LIMIT 1
        )
        ORDER BY m.id 
        LIMIT 1
      )
    WHERE p1.parent_id IS NULL 
      AND p1.member_id IS NULL
      AND EXISTS (SELECT 1 FROM family_point_presets WHERE parent_id IS NOT NULL);
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    IF v_updated_count > 0 THEN
      RAISE NOTICE '✅ 已补齐 % 条 parent_id 和 member_id 都为 NULL 的记录', v_updated_count;
    END IF;
  ELSE
    RAISE NOTICE '✅ 所有记录的 member_id 都已设置，无需补齐';
  END IF;
END $$;

-- ============================================
-- 2. 验证是否还有 NULL 值
-- ============================================

DO $$
DECLARE
  v_null_count INT;
BEGIN
  SELECT COUNT(*) INTO v_null_count
  FROM family_point_presets
  WHERE member_id IS NULL;
  
  IF v_null_count > 0 THEN
    RAISE WARNING '⚠️ 仍有 % 条记录的 member_id 为 NULL，无法设置 NOT NULL 约束', v_null_count;
    RAISE WARNING '⚠️ 请手动检查并处理这些记录';
  ELSE
    RAISE NOTICE '✅ 所有记录的 member_id 都已设置，可以添加 NOT NULL 约束';
  END IF;
END $$;

-- ============================================
-- 3. 设置 NOT NULL 约束（如果所有值都已补齐）
-- ============================================

DO $$
BEGIN
  -- 检查是否还有 NULL 值
  IF EXISTS (
    SELECT 1 FROM family_point_presets WHERE member_id IS NULL
  ) THEN
    RAISE WARNING '⚠️ 仍有 member_id 为 NULL 的记录，跳过 NOT NULL 约束设置';
  ELSE
    -- 所有值都已补齐，可以设置 NOT NULL
    ALTER TABLE family_point_presets
    ALTER COLUMN member_id SET NOT NULL;
    
    RAISE NOTICE '✅ member_id 已设置为 NOT NULL';
  END IF;
  
  -- 同时确保 parent_id 也是 NOT NULL
  IF EXISTS (
    SELECT 1 FROM family_point_presets WHERE parent_id IS NULL
  ) THEN
    RAISE WARNING '⚠️ 仍有 parent_id 为 NULL 的记录，跳过 NOT NULL 约束设置';
  ELSE
    ALTER TABLE family_point_presets
    ALTER COLUMN parent_id SET NOT NULL;
    
    RAISE NOTICE '✅ parent_id 已设置为 NOT NULL';
  END IF;
END $$;

DO $$
BEGIN
  RAISE NOTICE '✅ member_id NOT NULL 约束检查完成';
END $$;
