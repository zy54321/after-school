-- ============================================
-- 家庭成长银行 - Offer 唯一约束 Migration
-- 执行时机：020_add_family_offer_unique_constraint.sql
-- 命令示例：psql -U your_user -d your_database -f 020_add_family_offer_unique_constraint.sql
-- ============================================

-- ============================================
-- 1. 检查是否已存在唯一约束
-- ============================================
DO $$
BEGIN
  -- 检查是否已存在 (parent_id, sku_id) 的唯一约束
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'uk_family_offer_parent_sku' 
    AND conrelid = 'family_offer'::regclass
  ) THEN
    -- 如果存在重复数据，先清理（保留 parent_id 较大的，或 parent_id=0 的）
    -- 这里我们保留每个 (parent_id, sku_id) 组合中 id 最大的那条
    DELETE FROM family_offer o1
    WHERE EXISTS (
      SELECT 1 FROM family_offer o2
      WHERE o2.parent_id = o1.parent_id
        AND o2.sku_id = o1.sku_id
        AND o2.id > o1.id
    );

    -- 添加唯一约束
    ALTER TABLE family_offer
    ADD CONSTRAINT uk_family_offer_parent_sku 
    UNIQUE (parent_id, sku_id);

    RAISE NOTICE '✅ 唯一约束 uk_family_offer_parent_sku 已添加';
  ELSE
    RAISE NOTICE '⚠️ 唯一约束 uk_family_offer_parent_sku 已存在，跳过';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️ 添加唯一约束失败: %', SQLERRM;
END $$;

-- ============================================
-- ✅ Migration 完成
-- ============================================
SELECT 
  '✅ Offer 唯一约束添加完成' as status,
  (SELECT COUNT(*) FROM pg_constraint 
   WHERE conname = 'uk_family_offer_parent_sku' 
   AND conrelid = 'family_offer'::regclass) as constraint_exists;
