-- ============================================
-- 家庭成长银行 - 抽奖系统核心表 Migration
-- 执行时机：006_lottery_tables.sql
-- ============================================

-- ============================================
-- 1. Ticket Type 抽奖券类型表
-- ============================================
-- 定义不同类型的抽奖券（普通券、黄金券、钻石券等）
-- 抽奖券通过 inventory 系统发放 (sku_type=ticket)

CREATE TABLE IF NOT EXISTS ticket_type (
  id SERIAL PRIMARY KEY,
  parent_id INT NOT NULL,                          -- 所属用户
  name VARCHAR(100) NOT NULL,                      -- 券类型名称
  description TEXT,                                -- 描述
  icon VARCHAR(50) DEFAULT '🎟️',                  -- 图标
  point_value INT NOT NULL DEFAULT 0,              -- 积分价值（用于计算中奖概率权重等）
  daily_limit INT,                                 -- 每日使用上限（NULL=无限制）
  weekly_limit INT,                                -- 每周使用上限（NULL=无限制）
  status VARCHAR(20) NOT NULL DEFAULT 'active',    -- active/inactive/deprecated
  sort_order INT DEFAULT 0,                        -- 排序
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_ticket_type_parent 
    FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_ticket_type_parent ON ticket_type(parent_id);
CREATE INDEX IF NOT EXISTS idx_ticket_type_status ON ticket_type(status);

-- 注释
COMMENT ON TABLE ticket_type IS '抽奖券类型表';
COMMENT ON COLUMN ticket_type.point_value IS '积分价值，用于计算权重或兑换比例';
COMMENT ON COLUMN ticket_type.daily_limit IS '每日使用上限，NULL表示无限制';
COMMENT ON COLUMN ticket_type.weekly_limit IS '每周使用上限，NULL表示无限制';

-- ============================================
-- 2. Draw Pool 抽奖池表
-- ============================================
-- 定义抽奖池（如：每日转盘、黄金宝箱等）

CREATE TABLE IF NOT EXISTS draw_pool (
  id SERIAL PRIMARY KEY,
  parent_id INT NOT NULL,                          -- 所属用户
  name VARCHAR(100) NOT NULL,                      -- 抽奖池名称
  description TEXT,                                -- 描述
  icon VARCHAR(50) DEFAULT '🎰',                  -- 图标
  entry_ticket_type_id INT,                        -- 入场券类型（NULL=不需要券）
  tickets_per_draw INT DEFAULT 1,                  -- 每次抽奖消耗券数
  status VARCHAR(20) NOT NULL DEFAULT 'active',    -- active/inactive/deprecated
  pool_type VARCHAR(30) DEFAULT 'wheel',           -- wheel/box/card/slot
  config JSONB DEFAULT '{}',                       -- 额外配置（动画、UI等）
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_draw_pool_parent 
    FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_draw_pool_ticket_type 
    FOREIGN KEY (entry_ticket_type_id) REFERENCES ticket_type(id) ON DELETE SET NULL
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_draw_pool_parent ON draw_pool(parent_id);
CREATE INDEX IF NOT EXISTS idx_draw_pool_status ON draw_pool(status);

-- 注释
COMMENT ON TABLE draw_pool IS '抽奖池表';
COMMENT ON COLUMN draw_pool.entry_ticket_type_id IS '入场需要的抽奖券类型，NULL表示不需要券（积分直抽）';
COMMENT ON COLUMN draw_pool.tickets_per_draw IS '每次抽奖消耗的券数量';
COMMENT ON COLUMN draw_pool.pool_type IS '抽奖池类型：wheel=转盘, box=宝箱, card=翻牌, slot=老虎机';

-- ============================================
-- 3. Draw Pool Version 抽奖池版本表
-- ============================================
-- 记录抽奖池的配置版本（奖品配置、概率配置等）
-- 每次修改配置都创建新版本，确保 draw_log 可追溯

CREATE TABLE IF NOT EXISTS draw_pool_version (
  id SERIAL PRIMARY KEY,
  pool_id INT NOT NULL,                            -- 关联的抽奖池
  version INT NOT NULL DEFAULT 1,                  -- 版本号
  is_current BOOLEAN DEFAULT TRUE,                 -- 是否当前生效版本
  prizes JSONB NOT NULL DEFAULT '[]',              -- 奖品配置列表
  -- prizes 结构示例:
  -- [
  --   { "id": 1, "name": "10积分", "type": "points", "value": 10, "weight": 50, "icon": "🪙" },
  --   { "id": 2, "name": "再来一次", "type": "ticket", "value": 1, "weight": 20, "icon": "🎟️" },
  --   { "id": 3, "name": "稀有道具", "type": "sku", "sku_id": 5, "weight": 5, "icon": "💎" },
  --   { "id": 4, "name": "谢谢参与", "type": "empty", "value": 0, "weight": 25, "icon": "😢" }
  -- ]
  total_weight INT DEFAULT 0,                      -- 总权重（缓存）
  min_guarantee_count INT,                         -- 保底次数（NULL=无保底）
  guarantee_prize_id INT,                          -- 保底奖品ID（对应 prizes 中的 id）
  config JSONB DEFAULT '{}',                       -- 其他配置
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INT,                                  -- 创建者（成员ID）
  
  CONSTRAINT fk_draw_pool_version_pool 
    FOREIGN KEY (pool_id) REFERENCES draw_pool(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_draw_pool_version_pool ON draw_pool_version(pool_id);
CREATE INDEX IF NOT EXISTS idx_draw_pool_version_current ON draw_pool_version(pool_id, is_current) WHERE is_current = TRUE;

-- 唯一约束：每个池的版本号唯一
CREATE UNIQUE INDEX IF NOT EXISTS idx_draw_pool_version_unique 
  ON draw_pool_version(pool_id, version);

-- 注释
COMMENT ON TABLE draw_pool_version IS '抽奖池版本表，记录每次配置变更';
COMMENT ON COLUMN draw_pool_version.prizes IS 'JSON数组，包含所有奖品配置';
COMMENT ON COLUMN draw_pool_version.total_weight IS '所有奖品权重之和，用于概率计算';
COMMENT ON COLUMN draw_pool_version.min_guarantee_count IS '保底抽奖次数，达到此次数必中 guarantee_prize_id';

-- ============================================
-- 4. Draw Log 抽奖记录表
-- ============================================
-- 记录每次抽奖的详细信息

CREATE TABLE IF NOT EXISTS draw_log (
  id SERIAL PRIMARY KEY,
  parent_id INT NOT NULL,                          -- 所属用户
  member_id INT NOT NULL,                          -- 抽奖成员
  pool_id INT NOT NULL,                            -- 抽奖池
  pool_version_id INT NOT NULL,                    -- 抽奖池版本（关键！确保可追溯）
  ticket_type_id INT,                              -- 使用的券类型（NULL=积分直抽）
  ticket_point_value INT DEFAULT 0,                -- 券的积分价值快照
  tickets_used INT DEFAULT 1,                      -- 消耗的券数量
  
  -- 抽奖结果
  result_prize_id INT,                             -- 中奖的奖品ID（对应 version.prizes 中的 id）
  result_type VARCHAR(30) NOT NULL,                -- 结果类型：points/ticket/sku/empty
  result_name VARCHAR(100),                        -- 结果名称快照
  result_value INT DEFAULT 0,                      -- 结果值（积分数/券数/SKU ID等）
  result_sku_id INT,                               -- 如果是 SKU 奖品，记录 SKU ID
  
  -- 订单关联
  order_id INT,                                    -- 关联订单（如果奖品走订单系统）
  inventory_id INT,                                -- 关联库存（如果奖品进入背包）
  points_log_id INT,                               -- 关联积分流水（如果是积分奖励）
  
  -- 统计字段
  is_guarantee BOOLEAN DEFAULT FALSE,              -- 是否触发保底
  consecutive_count INT DEFAULT 1,                 -- 本次连续抽奖的第几次
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_draw_log_parent 
    FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_draw_log_member 
    FOREIGN KEY (member_id) REFERENCES family_members(id) ON DELETE CASCADE,
  CONSTRAINT fk_draw_log_pool 
    FOREIGN KEY (pool_id) REFERENCES draw_pool(id) ON DELETE CASCADE,
  CONSTRAINT fk_draw_log_version 
    FOREIGN KEY (pool_version_id) REFERENCES draw_pool_version(id) ON DELETE CASCADE,
  CONSTRAINT fk_draw_log_ticket_type 
    FOREIGN KEY (ticket_type_id) REFERENCES ticket_type(id) ON DELETE SET NULL,
  CONSTRAINT fk_draw_log_order 
    FOREIGN KEY (order_id) REFERENCES family_market_order(id) ON DELETE SET NULL
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_draw_log_parent ON draw_log(parent_id);
CREATE INDEX IF NOT EXISTS idx_draw_log_member ON draw_log(member_id);
CREATE INDEX IF NOT EXISTS idx_draw_log_pool ON draw_log(pool_id);
CREATE INDEX IF NOT EXISTS idx_draw_log_created ON draw_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_draw_log_member_pool ON draw_log(member_id, pool_id, created_at DESC);

-- 注释
COMMENT ON TABLE draw_log IS '抽奖记录表';
COMMENT ON COLUMN draw_log.pool_version_id IS '必须记录版本ID，确保奖品配置变更后可追溯';
COMMENT ON COLUMN draw_log.ticket_point_value IS '券积分价值快照，避免后续修改影响统计';
COMMENT ON COLUMN draw_log.result_type IS '结果类型：points=积分, ticket=抽奖券, sku=商品, empty=未中奖';
COMMENT ON COLUMN draw_log.is_guarantee IS '是否触发保底机制';

-- ============================================
-- 5. 抽奖统计视图（可选）
-- ============================================
CREATE OR REPLACE VIEW v_draw_stats AS
SELECT 
  dl.parent_id,
  dl.member_id,
  fm.name as member_name,
  dl.pool_id,
  dp.name as pool_name,
  COUNT(*) as total_draws,
  COUNT(CASE WHEN dl.result_type != 'empty' THEN 1 END) as wins,
  COUNT(CASE WHEN dl.is_guarantee THEN 1 END) as guarantees,
  SUM(dl.ticket_point_value) as total_ticket_value,
  SUM(CASE WHEN dl.result_type = 'points' THEN dl.result_value ELSE 0 END) as total_points_won
FROM draw_log dl
JOIN family_members fm ON dl.member_id = fm.id
JOIN draw_pool dp ON dl.pool_id = dp.id
GROUP BY dl.parent_id, dl.member_id, fm.name, dl.pool_id, dp.name;

COMMENT ON VIEW v_draw_stats IS '抽奖统计视图';

-- ============================================
-- 6. 更新时间触发器
-- ============================================
CREATE OR REPLACE FUNCTION update_lottery_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ticket_type_updated_at ON ticket_type;
CREATE TRIGGER trigger_ticket_type_updated_at
  BEFORE UPDATE ON ticket_type
  FOR EACH ROW
  EXECUTE FUNCTION update_lottery_timestamp();

DROP TRIGGER IF EXISTS trigger_draw_pool_updated_at ON draw_pool;
CREATE TRIGGER trigger_draw_pool_updated_at
  BEFORE UPDATE ON draw_pool
  FOR EACH ROW
  EXECUTE FUNCTION update_lottery_timestamp();

-- ============================================
-- 完成提示
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ 抽奖系统核心表创建完成！';
  RAISE NOTICE '   - ticket_type: 抽奖券类型';
  RAISE NOTICE '   - draw_pool: 抽奖池';
  RAISE NOTICE '   - draw_pool_version: 抽奖池版本（奖品配置）';
  RAISE NOTICE '   - draw_log: 抽奖记录（必须记录 pool_version_id）';
  RAISE NOTICE '';
  RAISE NOTICE '💡 提示: 抽奖券建议创建对应的 SKU (type=ticket)，通过商城/任务系统发放';
END $$;
