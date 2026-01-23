-- ============================================
-- 家庭成长银行 - 商城核心表 Migration
-- 执行时机：商城功能上线前
-- 命令示例：psql -U your_user -d your_database -f 002_family_market.sql
-- ============================================

-- ============================================
-- 1. SKU 商品表
-- ============================================
CREATE TABLE IF NOT EXISTS family_sku (
  id SERIAL PRIMARY KEY,
  parent_id INT NOT NULL DEFAULT 0,              -- 创建者用户ID（0=系统默认）
  name VARCHAR(100) NOT NULL,                    -- 商品名称
  description TEXT,                              -- 商品描述
  icon VARCHAR(50),                              -- 图标/emoji
  type VARCHAR(20) NOT NULL DEFAULT 'reward',    -- 类型：reward/auction
  base_cost INT NOT NULL DEFAULT 0,              -- 基础积分成本
  limit_type VARCHAR(20) DEFAULT 'unlimited',    -- 限制类型：unlimited/daily/weekly/monthly
  limit_max INT DEFAULT 0,                       -- 周期内最大次数
  target_members INT[],                          -- 目标成员ID数组（NULL=所有）
  is_active BOOLEAN DEFAULT TRUE,                -- 是否上架
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SKU 索引
CREATE INDEX IF NOT EXISTS idx_family_sku_parent_id ON family_sku(parent_id);
CREATE INDEX IF NOT EXISTS idx_family_sku_type ON family_sku(type);
CREATE INDEX IF NOT EXISTS idx_family_sku_is_active ON family_sku(is_active);

COMMENT ON TABLE family_sku IS '家庭商城SKU商品表';
COMMENT ON COLUMN family_sku.parent_id IS '创建者用户ID，0表示系统默认';
COMMENT ON COLUMN family_sku.type IS '商品类型：reward=可兑换奖品，auction=竞拍品';

-- ============================================
-- 2. Offer 报价表（SKU的定价实例）
-- ============================================
CREATE TABLE IF NOT EXISTS family_offer (
  id SERIAL PRIMARY KEY,
  sku_id INT NOT NULL REFERENCES family_sku(id) ON DELETE CASCADE,
  cost INT NOT NULL,                             -- 本次报价的积分成本
  quantity INT NOT NULL DEFAULT 1,               -- 本次报价包含的数量
  valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,-- 生效开始时间
  valid_until TIMESTAMP,                         -- 生效结束时间（NULL=永久）
  is_active BOOLEAN DEFAULT TRUE,                -- 是否启用
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Offer 索引
CREATE INDEX IF NOT EXISTS idx_family_offer_sku_id ON family_offer(sku_id);
CREATE INDEX IF NOT EXISTS idx_family_offer_valid ON family_offer(valid_from, valid_until);

COMMENT ON TABLE family_offer IS '家庭商城Offer报价表';
COMMENT ON COLUMN family_offer.cost IS '本次报价的积分成本';
COMMENT ON COLUMN family_offer.quantity IS '本次报价包含的商品数量';

-- ============================================
-- 3. Market Order 商城订单表
-- ============================================
CREATE TABLE IF NOT EXISTS family_market_order (
  id SERIAL PRIMARY KEY,
  parent_id INT NOT NULL,                        -- 所属用户ID（用于幂等键约束）
  member_id INT NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  offer_id INT REFERENCES family_offer(id) ON DELETE SET NULL,
  sku_id INT REFERENCES family_sku(id) ON DELETE SET NULL,
  
  -- 订单快照（防止关联数据变化）
  sku_name VARCHAR(100),                         -- SKU名称快照
  cost INT NOT NULL,                             -- 实际支付积分
  quantity INT NOT NULL DEFAULT 1,               -- 购买数量
  
  -- 订单状态
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending/paid/cancelled/refunded
  
  -- 幂等性支持
  idempotency_key VARCHAR(100),                  -- 幂等键
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- 幂等键约束：同一用户同一幂等键只能有一个订单
  CONSTRAINT uq_market_order_idempotency UNIQUE (parent_id, idempotency_key)
);

-- Order 索引
CREATE INDEX IF NOT EXISTS idx_family_market_order_member_id ON family_market_order(member_id);
CREATE INDEX IF NOT EXISTS idx_family_market_order_offer_id ON family_market_order(offer_id);
CREATE INDEX IF NOT EXISTS idx_family_market_order_status ON family_market_order(status);
CREATE INDEX IF NOT EXISTS idx_family_market_order_created_at ON family_market_order(created_at);

COMMENT ON TABLE family_market_order IS '家庭商城订单表';
COMMENT ON COLUMN family_market_order.idempotency_key IS '幂等键，防止重复下单';
COMMENT ON COLUMN family_market_order.sku_name IS 'SKU名称快照，防止商品改名后订单信息丢失';

-- ============================================
-- 4. Inventory 库存/背包表
-- ============================================
CREATE TABLE IF NOT EXISTS family_inventory (
  id SERIAL PRIMARY KEY,
  member_id INT NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  sku_id INT NOT NULL REFERENCES family_sku(id) ON DELETE CASCADE,
  order_id INT REFERENCES family_market_order(id) ON DELETE SET NULL,
  
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity >= 0), -- 数量（非负）
  status VARCHAR(20) NOT NULL DEFAULT 'unused',          -- unused/used/expired
  
  obtained_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,       -- 获得时间
  used_at TIMESTAMP,                                     -- 使用时间
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory 索引
CREATE INDEX IF NOT EXISTS idx_family_inventory_member_id ON family_inventory(member_id);
CREATE INDEX IF NOT EXISTS idx_family_inventory_sku_id ON family_inventory(sku_id);
CREATE INDEX IF NOT EXISTS idx_family_inventory_order_id ON family_inventory(order_id);
CREATE INDEX IF NOT EXISTS idx_family_inventory_status ON family_inventory(status);

COMMENT ON TABLE family_inventory IS '家庭成员库存/背包表';
COMMENT ON COLUMN family_inventory.quantity IS '库存数量，不能为负';

-- ============================================
-- 5. 扩展 family_points_log 表
-- 添加商城相关字段
-- ============================================

-- 添加 order_id 字段（关联商城订单）
ALTER TABLE family_points_log 
  ADD COLUMN IF NOT EXISTS order_id INT REFERENCES family_market_order(id) ON DELETE SET NULL;

-- 添加 idempotency_key 字段（幂等键）
ALTER TABLE family_points_log 
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100);

-- 添加 reason_code 字段（积分变动原因代码）
ALTER TABLE family_points_log 
  ADD COLUMN IF NOT EXISTS reason_code VARCHAR(50);

-- 添加 parent_id 字段（用于幂等键约束）
ALTER TABLE family_points_log 
  ADD COLUMN IF NOT EXISTS parent_id INT;

-- 创建幂等键唯一约束
-- 注意：需要先填充 parent_id 字段才能创建约束
DO $$
BEGIN
  -- 更新现有记录的 parent_id
  UPDATE family_points_log pl
  SET parent_id = fm.parent_id
  FROM family_members fm
  WHERE pl.member_id = fm.id AND pl.parent_id IS NULL;
  
  -- 创建唯一约束（如果不存在）
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'uq_points_log_idempotency'
  ) THEN
    -- 只对有 idempotency_key 的记录创建约束
    CREATE UNIQUE INDEX IF NOT EXISTS idx_points_log_idempotency 
      ON family_points_log(parent_id, idempotency_key) 
      WHERE idempotency_key IS NOT NULL;
  END IF;
END $$;

-- Points Log 索引
CREATE INDEX IF NOT EXISTS idx_family_points_log_order_id ON family_points_log(order_id);
CREATE INDEX IF NOT EXISTS idx_family_points_log_reason_code ON family_points_log(reason_code);

COMMENT ON COLUMN family_points_log.order_id IS '关联的商城订单ID';
COMMENT ON COLUMN family_points_log.idempotency_key IS '幂等键，防止重复记录';
COMMENT ON COLUMN family_points_log.reason_code IS '积分变动原因代码：task/reward/auction/refund/manual等';

-- ============================================
-- 6. 常用 reason_code 参考值
-- ============================================
-- task      - 完成任务
-- penalty   - 扣分惩罚
-- reward    - 兑换奖品
-- auction   - 竞拍得标
-- refund    - 退款返还
-- manual    - 手动调整
-- transfer  - 转赠
-- gift      - 赠送

-- ============================================
-- ✅ Migration 完成
-- ============================================
SELECT 
  '✅ 家庭商城核心表创建完成' as status,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'family_sku') as sku_exists,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'family_offer') as offer_exists,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'family_market_order') as order_exists,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'family_inventory') as inventory_exists;
