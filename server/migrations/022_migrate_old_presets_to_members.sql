-- ============================================
-- 家庭成长银行 - 迁移旧预设数据到成员
-- 执行时机：022_migrate_old_presets_to_members.sql
-- 
-- 用途：将 member_id 为 NULL 的旧预设数据
--       批量设置为该 parent 下最小 member.id
-- ============================================

-- ============================================
-- 迁移旧预设数据到成员
-- ============================================

DO $$
DECLARE
  v_updated_count INT;
BEGIN
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
  
  RAISE NOTICE '✅ 已迁移 % 条旧预设数据到成员', v_updated_count;
  
  -- 检查是否还有未迁移的数据
  IF EXISTS (
    SELECT 1 FROM family_point_presets 
    WHERE member_id IS NULL AND parent_id IS NOT NULL
  ) THEN
    RAISE WARNING '⚠️ 仍有未迁移的数据，请检查 parent_id 是否正确';
  END IF;
  
  -- 如果还有 parent_id 也为 NULL 的旧数据，尝试从其他记录推断
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
    RAISE NOTICE '✅ 已迁移 % 条 parent_id 为 NULL 的旧数据', v_updated_count;
  END IF;
  
END $$;

-- ============================================
-- 验证迁移结果
-- ============================================

DO $$
DECLARE
  v_null_count INT;
BEGIN
  SELECT COUNT(*) INTO v_null_count
  FROM family_point_presets
  WHERE member_id IS NULL;
  
  IF v_null_count > 0 THEN
    RAISE WARNING '⚠️ 仍有 % 条记录的 member_id 为 NULL，请手动处理', v_null_count;
  ELSE
    RAISE NOTICE '✅ 所有预设数据已成功迁移到成员';
  END IF;
END $$;

DO $$
BEGIN
  RAISE NOTICE '✅ 预设数据迁移完成';
END $$;
