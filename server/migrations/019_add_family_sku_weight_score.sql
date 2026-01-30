-- ============================================
-- 家庭成长银行 - SKU 权重分数字段 Migration
-- 执行时机：019_add_family_sku_weight_score.sql
-- 命令示例：psql -U your_user -d your_database -f 019_add_family_sku_weight_score.sql
-- ============================================

-- ============================================
-- 1. 添加 weight_score 字段
-- ============================================
ALTER TABLE family_sku
ADD COLUMN IF NOT EXISTS weight_score INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN family_sku.weight_score IS '权重分数（0~100），用于映射稀有度：UR(90~100), SSR(75~89), SR(50~74), R(0~49)';

-- ============================================
-- 2. 添加约束：确保 weight_score 在 0~100 范围内
-- ============================================
DO $$
BEGIN
  ALTER TABLE family_sku
  ADD CONSTRAINT chk_family_sku_weight_score
  CHECK (weight_score >= 0 AND weight_score <= 100);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 3. 添加索引：优化按 weight_score 查询
-- ============================================
CREATE INDEX IF NOT EXISTS idx_family_sku_weight_score ON family_sku(weight_score);

-- ============================================
-- ✅ Migration 完成
-- ============================================
SELECT 
  '✅ SKU 权重分数字段添加完成' as status,
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_name = 'family_sku' AND column_name = 'weight_score') as weight_score_exists,
  (SELECT COUNT(*) FROM information_schema.table_constraints 
   WHERE table_name = 'family_sku' AND constraint_name = 'chk_family_sku_weight_score') as constraint_exists,
  (SELECT COUNT(*) FROM pg_indexes 
   WHERE tablename = 'family_sku' AND indexname = 'idx_family_sku_weight_score') as index_exists;
