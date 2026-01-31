-- ============================================
-- 家庭成长银行 - 商品类型重构
-- 执行时机：024_refactor_sku_types.sql
-- 
-- 用途：
-- 1. 调整商品类型：item/permission/ticket（删除service）
-- 2. 新增字段：fulfillment_mode、verification、duration_minutes、uses
-- 3. 添加履约状态字段到订单表
-- ============================================

-- ============================================
-- 1. 添加新字段到 family_sku 表
-- ============================================

-- 添加履约方式字段
ALTER TABLE family_sku
  ADD COLUMN IF NOT EXISTS fulfillment_mode VARCHAR(20) DEFAULT 'instant',
  ADD COLUMN IF NOT EXISTS verification VARCHAR(20) DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS duration_minutes INT,
  ADD COLUMN IF NOT EXISTS uses INT;

-- 添加注释
COMMENT ON COLUMN family_sku.fulfillment_mode IS '履约方式：instant=即时生效, manual_confirm=需家长确认, schedule=需预约';
COMMENT ON COLUMN family_sku.verification IS '验证方式：auto=自动验证, parent_confirm=家长确认, both_confirm=双方确认';
COMMENT ON COLUMN family_sku.duration_minutes IS '持续时间（分钟），用于时间类权限';
COMMENT ON COLUMN family_sku.uses IS '使用次数，用于次数类权限';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_family_sku_fulfillment_mode ON family_sku(fulfillment_mode);
CREATE INDEX IF NOT EXISTS idx_family_sku_verification ON family_sku(verification);

-- ============================================
-- 2. 添加履约状态字段到订单表
-- ============================================

ALTER TABLE family_market_order
  ADD COLUMN IF NOT EXISTS fulfillment_status VARCHAR(20) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS confirmed_by INT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP;

COMMENT ON COLUMN family_market_order.fulfillment_status IS '履约状态：pending=待确认, confirmed=已确认, scheduled=已预约, fulfilled=已履约, expired=已过期, cancelled=已取消';
COMMENT ON COLUMN family_market_order.scheduled_at IS '预约时间（schedule模式）';
COMMENT ON COLUMN family_market_order.fulfilled_at IS '履约完成时间';
COMMENT ON COLUMN family_market_order.confirmed_by IS '确认人ID（家长或系统）';
COMMENT ON COLUMN family_market_order.confirmed_at IS '确认时间';

CREATE INDEX IF NOT EXISTS idx_family_market_order_fulfillment_status ON family_market_order(fulfillment_status);

-- ============================================
-- 3. 添加履约状态字段到库存表（用于权限类商品）
-- ============================================

ALTER TABLE family_inventory
  ADD COLUMN IF NOT EXISTS fulfillment_status VARCHAR(20) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS confirmed_by INT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP;

COMMENT ON COLUMN family_inventory.fulfillment_status IS '履约状态：pending=待确认, confirmed=已确认, scheduled=已预约, fulfilled=已履约, expired=已过期, cancelled=已取消';
COMMENT ON COLUMN family_inventory.scheduled_at IS '预约时间（schedule模式）';
COMMENT ON COLUMN family_inventory.fulfilled_at IS '履约完成时间';
COMMENT ON COLUMN family_inventory.expires_at IS '过期时间（时间类权限）';
COMMENT ON COLUMN family_inventory.confirmed_by IS '确认人ID（家长或系统）';
COMMENT ON COLUMN family_inventory.confirmed_at IS '确认时间';

CREATE INDEX IF NOT EXISTS idx_family_inventory_fulfillment_status ON family_inventory(fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_family_inventory_expires_at ON family_inventory(expires_at);

-- ============================================
-- 4. 添加约束：permission类型必须包含duration_minutes或uses
-- ============================================

-- 注意：这个约束会在数据迁移后添加，因为旧数据可能不满足条件
-- 先添加检查函数
CREATE OR REPLACE FUNCTION check_permission_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'permission' THEN
    IF (NEW.duration_minutes IS NULL OR NEW.duration_minutes <= 0) 
       AND (NEW.uses IS NULL OR NEW.uses <= 0) THEN
      RAISE EXCEPTION 'permission类型商品必须包含duration_minutes或uses至少一个';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器（在数据迁移后启用）
-- CREATE TRIGGER trigger_check_permission_fields
--   BEFORE INSERT OR UPDATE ON family_sku
--   FOR EACH ROW
--   EXECUTE FUNCTION check_permission_fields();

DO $$
BEGIN
  RAISE NOTICE '✅ 商品类型重构字段已添加';
  RAISE NOTICE '⚠️ 注意：数据迁移脚本（025_migrate_service_to_permission.sql）需要先执行';
END $$;
