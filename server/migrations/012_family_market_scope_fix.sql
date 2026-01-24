-- ============================================
-- 家庭成长银行 - Schema 强化：明确"家庭配置 vs 成员参与"
-- 执行时机：012_family_market_scope_fix.sql
-- 
-- 目标：在数据层明确家庭配置字段，避免 member 参与数据污染供给侧配置
-- ============================================

-- ============================================
-- 1. family_offer 增加 parent_id（关键）
-- ============================================
-- 供给侧一定要能"直接按 parent_id 查询"

-- 添加 parent_id 字段
ALTER TABLE family_offer
ADD COLUMN IF NOT EXISTS parent_id INT;

-- 回填 parent_id（通过 sku 反查）
UPDATE family_offer o
SET parent_id = s.parent_id
FROM family_sku s
WHERE o.sku_id = s.id AND o.parent_id IS NULL;

-- 对于没有关联 SKU 的 offer，设置默认值（使用第一个用户的 ID）
DO $$
DECLARE
  v_default_parent_id INT;
BEGIN
  -- 获取默认 parent_id
  SELECT id INTO v_default_parent_id FROM users LIMIT 1;
  
  -- 更新仍然为空的记录
  IF v_default_parent_id IS NOT NULL THEN
    UPDATE family_offer
    SET parent_id = v_default_parent_id
    WHERE parent_id IS NULL;
  END IF;
END $$;

-- 设置 NOT NULL 约束（确保所有记录都有 parent_id 后）
DO $$
BEGIN
  -- 检查是否还有 NULL 值
  IF EXISTS (SELECT 1 FROM family_offer WHERE parent_id IS NULL) THEN
    RAISE NOTICE '⚠️ 仍有 family_offer 记录的 parent_id 为空，跳过 NOT NULL 约束';
  ELSE
    -- 尝试添加 NOT NULL 约束
    BEGIN
      ALTER TABLE family_offer
      ALTER COLUMN parent_id SET NOT NULL;
      RAISE NOTICE '✅ family_offer.parent_id 已设置为 NOT NULL';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '⚠️ 设置 NOT NULL 约束失败: %', SQLERRM;
    END;
  END IF;
END $$;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_family_offer_parent_id ON family_offer(parent_id);

-- 添加外键约束（可选，如果需要严格约束）
-- ALTER TABLE family_offer
-- ADD CONSTRAINT fk_family_offer_parent 
--   FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE;

-- 添加注释
COMMENT ON COLUMN family_offer.parent_id IS '所属用户ID，用于直接按家庭查询供给侧配置';

-- ============================================
-- 2. 检查并补充供给侧表的 parent_id 索引
-- ============================================

-- family_sku(parent_id)
CREATE INDEX IF NOT EXISTS idx_family_sku_parent_id ON family_sku(parent_id);

-- auction_session(parent_id)
CREATE INDEX IF NOT EXISTS idx_auction_session_parent_id ON auction_session(parent_id);

-- draw_pool(parent_id)
CREATE INDEX IF NOT EXISTS idx_draw_pool_parent_id ON draw_pool(parent_id);

-- reminder_policy(parent_id)
CREATE INDEX IF NOT EXISTS idx_reminder_policy_parent_id ON reminder_policy(parent_id);

-- issue(parent_id) - 如果 issue 表存在
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'issue') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_issue_parent_id ON issue(parent_id)';
    RAISE NOTICE '✅ issue(parent_id) 索引已创建';
  ELSE
    RAISE NOTICE '📌 issue 表不存在，跳过索引创建';
  END IF;
END $$;

-- ticket_type(parent_id) - 抽奖券类型也是供给侧
CREATE INDEX IF NOT EXISTS idx_ticket_type_parent_id ON ticket_type(parent_id);

-- ============================================
-- 3. 验证结果
-- ============================================
DO $$
DECLARE
  v_offer_count INT;
  v_offer_with_parent INT;
  v_indexes TEXT[];
BEGIN
  -- 统计 family_offer
  SELECT COUNT(*), COUNT(parent_id) 
  INTO v_offer_count, v_offer_with_parent
  FROM family_offer;
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ Schema 强化完成！';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  RAISE NOTICE '📊 family_offer 统计:';
  RAISE NOTICE '   - 总记录数: %', v_offer_count;
  RAISE NOTICE '   - 有 parent_id: %', v_offer_with_parent;
  RAISE NOTICE '';
  RAISE NOTICE '📌 供给侧表 parent_id 索引:';
  RAISE NOTICE '   - family_sku(parent_id) ✓';
  RAISE NOTICE '   - family_offer(parent_id) ✓';
  RAISE NOTICE '   - auction_session(parent_id) ✓';
  RAISE NOTICE '   - draw_pool(parent_id) ✓';
  RAISE NOTICE '   - reminder_policy(parent_id) ✓';
  RAISE NOTICE '   - ticket_type(parent_id) ✓';
  RAISE NOTICE '';
  RAISE NOTICE '💡 现在可以直接按 parent_id 查询 family_offer';
  RAISE NOTICE '   SELECT * FROM family_offer WHERE parent_id = ?';
END $$;
