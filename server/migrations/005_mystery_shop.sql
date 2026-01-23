-- ============================================
-- 家庭成长银行 - 神秘商店扩展 Migration
-- 执行时机：005_mystery_shop.sql
-- ============================================

-- ============================================
-- 1. 扩展 family_offer 表
-- ============================================
-- 添加神秘商店相关字段

-- offer_type: 区分不同类型的 offer
ALTER TABLE family_offer 
  ADD COLUMN IF NOT EXISTS offer_type VARCHAR(30) DEFAULT 'normal';

-- discount_rate: 折扣率（如 0.8 表示8折）
ALTER TABLE family_offer 
  ADD COLUMN IF NOT EXISTS discount_rate DECIMAL(3,2);

-- limit_per_member: 每人限购数量
ALTER TABLE family_offer 
  ADD COLUMN IF NOT EXISTS limit_per_member INT;

-- metadata: 扩展元数据（JSON）
ALTER TABLE family_offer 
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_family_offer_type ON family_offer(offer_type);
CREATE INDEX IF NOT EXISTS idx_family_offer_type_active ON family_offer(offer_type, is_active);

-- 注释
COMMENT ON COLUMN family_offer.offer_type IS 'Offer类型：normal=普通, mystery_shop=神秘商店, auction_lot=拍卖品, flash_sale=限时特卖';
COMMENT ON COLUMN family_offer.discount_rate IS '折扣率（0.0-1.0），如0.8表示8折';
COMMENT ON COLUMN family_offer.limit_per_member IS '每人限购数量';
COMMENT ON COLUMN family_offer.metadata IS 'JSON扩展元数据';

-- ============================================
-- 2. 神秘商店配置表（可选）
-- ============================================
CREATE TABLE IF NOT EXISTS mystery_shop_config (
  id SERIAL PRIMARY KEY,
  parent_id INT NOT NULL,                          -- 所属用户
  last_refresh_at TIMESTAMP,                       -- 上次刷新时间
  refresh_count INT DEFAULT 0,                     -- 今日刷新次数
  refresh_cost INT DEFAULT 10,                     -- 刷新成本（积分）
  free_refresh_count INT DEFAULT 1,                -- 每日免费刷新次数
  config JSONB DEFAULT '{}',                       -- 其他配置
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_mystery_shop_parent 
    FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 唯一约束：每个用户只有一条配置
CREATE UNIQUE INDEX IF NOT EXISTS idx_mystery_shop_config_parent 
  ON mystery_shop_config(parent_id);

COMMENT ON TABLE mystery_shop_config IS '神秘商店配置表';

-- ============================================
-- 3. 更新时间触发器
-- ============================================
CREATE OR REPLACE FUNCTION update_mystery_shop_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_mystery_shop_config_updated_at ON mystery_shop_config;
CREATE TRIGGER trigger_mystery_shop_config_updated_at
  BEFORE UPDATE ON mystery_shop_config
  FOR EACH ROW
  EXECUTE FUNCTION update_mystery_shop_config_timestamp();

-- ============================================
-- 完成提示
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ 神秘商店扩展完成！';
  RAISE NOTICE '   - family_offer 新增字段: offer_type, discount_rate, limit_per_member, metadata';
  RAISE NOTICE '   - 新增表: mystery_shop_config';
END $$;
