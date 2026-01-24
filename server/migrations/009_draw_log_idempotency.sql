-- ============================================
-- 家庭成长银行 - 抽奖幂等性修复
-- 执行时机：009_draw_log_idempotency.sql
-- 
-- 目的：为 draw_log 添加 idempotency_key 字段
--       防止重复请求导致重复扣券/发奖
-- ============================================

-- 1. 添加 idempotency_key 字段
ALTER TABLE draw_log
ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);

-- 2. 添加唯一约束 (parent_id + idempotency_key)
-- 注意：只对非空的 idempotency_key 建立唯一约束
CREATE UNIQUE INDEX IF NOT EXISTS idx_draw_log_idempotency 
ON draw_log(parent_id, idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- 3. 添加索引优化查询
CREATE INDEX IF NOT EXISTS idx_draw_log_idempotency_lookup
ON draw_log(idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- 4. 添加注释
COMMENT ON COLUMN draw_log.idempotency_key IS '幂等键，防止重复抽奖。格式: spin_{poolId}_{memberId}_{timestamp}';

-- ============================================
-- 完成提示
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ 抽奖幂等性字段添加完成！';
  RAISE NOTICE '   - draw_log.idempotency_key: 幂等键';
  RAISE NOTICE '   - UNIQUE(parent_id, idempotency_key): 唯一约束';
  RAISE NOTICE '';
  RAISE NOTICE '💡 幂等逻辑：';
  RAISE NOTICE '   1. spin() 开始时检查 idempotency_key 是否已存在';
  RAISE NOTICE '   2. 若存在，直接返回历史结果';
  RAISE NOTICE '   3. 若不存在，正常执行抽奖并记录 key';
END $$;
