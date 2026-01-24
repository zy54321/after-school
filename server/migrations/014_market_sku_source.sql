-- ============================================
-- 家庭成长银行 - SKU 商品来源扩展
-- 目的：统一商品来源（物品/权限/服务/抽奖券类型）
-- ============================================

ALTER TABLE family_sku
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS source_id INT,
  ADD COLUMN IF NOT EXISTS source_meta JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN family_sku.source_type IS '来源类型：custom/item/permission/service/ticket_type';
COMMENT ON COLUMN family_sku.source_id IS '来源ID（如 ticket_type.id）';
COMMENT ON COLUMN family_sku.source_meta IS '来源扩展信息';

CREATE INDEX IF NOT EXISTS idx_family_sku_source ON family_sku(source_type, source_id);

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE '✅ SKU 来源字段已添加：source_type / source_id / source_meta';
END $$;
