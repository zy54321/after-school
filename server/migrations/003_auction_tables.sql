-- ============================================
-- 家庭成长银行 - 拍卖系统表 Migration
-- 执行时机：003_auction_tables.sql
-- 命令示例：psql -U your_user -d your_database -f 003_auction_tables.sql
-- ============================================

-- ============================================
-- 1. 拍卖场次表 (auction_session)
-- ============================================
CREATE TABLE IF NOT EXISTS auction_session (
  id SERIAL PRIMARY KEY,
  parent_id INT NOT NULL,                              -- 创建者用户ID
  title VARCHAR(200) NOT NULL,                         -- 场次标题
  scheduled_at TIMESTAMP,                              -- 预定开始时间
  status VARCHAR(20) NOT NULL DEFAULT 'draft',         -- draft/scheduled/active/ended/cancelled
  config JSONB DEFAULT '{}',                           -- 配置项（如规则、时长等）
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Session 索引
CREATE INDEX IF NOT EXISTS idx_auction_session_parent_id ON auction_session(parent_id);
CREATE INDEX IF NOT EXISTS idx_auction_session_status ON auction_session(status);
CREATE INDEX IF NOT EXISTS idx_auction_session_scheduled_at ON auction_session(scheduled_at);

COMMENT ON TABLE auction_session IS '拍卖场次表';
COMMENT ON COLUMN auction_session.status IS '状态：draft=草稿, scheduled=已排期, active=进行中, ended=已结束, cancelled=已取消';
COMMENT ON COLUMN auction_session.config IS 'JSON配置：如 {"bidIncrement": 5, "countdownSeconds": 30}';

-- ============================================
-- 2. 拍卖品表 (auction_lot)
-- ============================================
CREATE TABLE IF NOT EXISTS auction_lot (
  id SERIAL PRIMARY KEY,
  session_id INT NOT NULL REFERENCES auction_session(id) ON DELETE CASCADE,
  offer_id INT REFERENCES family_offer(id) ON DELETE SET NULL,
  sku_id INT NOT NULL REFERENCES family_sku(id) ON DELETE CASCADE,
  
  -- 拍品属性
  rarity VARCHAR(20) DEFAULT 'common',                 -- 稀有度：common/rare/epic/legendary
  start_price INT NOT NULL DEFAULT 1,                  -- 起拍价
  reserve_price INT,                                   -- 保留价（低于此价不成交）
  buy_now_price INT,                                   -- 一口价（可选）
  quantity INT NOT NULL DEFAULT 1,                     -- 拍品数量
  
  -- 状态
  status VARCHAR(20) NOT NULL DEFAULT 'pending',       -- pending/active/sold/unsold/cancelled
  sort_order INT DEFAULT 0,                            -- 排序顺序
  
  -- 快照信息
  sku_name VARCHAR(100),                               -- SKU名称快照
  sku_icon VARCHAR(50),                                -- SKU图标快照
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Lot 索引
CREATE INDEX IF NOT EXISTS idx_auction_lot_session_id ON auction_lot(session_id);
CREATE INDEX IF NOT EXISTS idx_auction_lot_offer_id ON auction_lot(offer_id);
CREATE INDEX IF NOT EXISTS idx_auction_lot_sku_id ON auction_lot(sku_id);
CREATE INDEX IF NOT EXISTS idx_auction_lot_status ON auction_lot(status);

COMMENT ON TABLE auction_lot IS '拍卖品表';
COMMENT ON COLUMN auction_lot.rarity IS '稀有度：common=普通, rare=稀有, epic=史诗, legendary=传说';
COMMENT ON COLUMN auction_lot.status IS '状态：pending=待拍, active=竞拍中, sold=已成交, unsold=流拍, cancelled=取消';

-- ============================================
-- 3. 竞拍出价表 (auction_bid)
-- ============================================
CREATE TABLE IF NOT EXISTS auction_bid (
  id SERIAL PRIMARY KEY,
  lot_id INT NOT NULL REFERENCES auction_lot(id) ON DELETE CASCADE,
  bidder_member_id INT NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  bid_points INT NOT NULL CHECK (bid_points > 0),      -- 出价积分（必须大于0）
  
  is_auto_bid BOOLEAN DEFAULT FALSE,                   -- 是否自动出价
  max_auto_bid INT,                                    -- 自动出价上限
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bid 索引
CREATE INDEX IF NOT EXISTS idx_auction_bid_lot_id ON auction_bid(lot_id);
CREATE INDEX IF NOT EXISTS idx_auction_bid_bidder ON auction_bid(bidder_member_id);
CREATE INDEX IF NOT EXISTS idx_auction_bid_created_at ON auction_bid(created_at);

-- 唯一约束：同一用户对同一拍品的每次出价都记录（允许多次出价）
-- 但同一时间戳只允许一次出价（防止重复提交）
CREATE UNIQUE INDEX IF NOT EXISTS idx_auction_bid_unique 
  ON auction_bid(lot_id, bidder_member_id, created_at);

COMMENT ON TABLE auction_bid IS '竞拍出价记录表';
COMMENT ON COLUMN auction_bid.bid_points IS '出价积分，必须大于0';
COMMENT ON COLUMN auction_bid.is_auto_bid IS '是否为代理出价（自动加价）';

-- ============================================
-- 4. 拍卖结果表 (auction_result)
-- ============================================
CREATE TABLE IF NOT EXISTS auction_result (
  id SERIAL PRIMARY KEY,
  lot_id INT NOT NULL UNIQUE REFERENCES auction_lot(id) ON DELETE CASCADE,
  
  -- 获胜者信息
  winner_member_id INT REFERENCES family_members(id) ON DELETE SET NULL,
  
  -- 结算信息
  pay_points INT NOT NULL,                             -- 最终支付积分
  second_price INT,                                    -- 次高价（用于次价拍卖）
  winning_bid_id INT REFERENCES auction_bid(id) ON DELETE SET NULL,
  
  -- 关联订单
  settled_order_id INT REFERENCES family_market_order(id) ON DELETE SET NULL,
  
  -- 结算状态
  settlement_status VARCHAR(20) DEFAULT 'pending',     -- pending/settled/failed/refunded
  settled_at TIMESTAMP,                                -- 结算时间
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Result 索引
CREATE INDEX IF NOT EXISTS idx_auction_result_winner ON auction_result(winner_member_id);
CREATE INDEX IF NOT EXISTS idx_auction_result_order ON auction_result(settled_order_id);
CREATE INDEX IF NOT EXISTS idx_auction_result_status ON auction_result(settlement_status);

COMMENT ON TABLE auction_result IS '拍卖结果表';
COMMENT ON COLUMN auction_result.pay_points IS '最终支付积分（可能等于最高价或次高价）';
COMMENT ON COLUMN auction_result.second_price IS '次高价，用于次价拍卖模式';
COMMENT ON COLUMN auction_result.settlement_status IS '结算状态：pending=待结算, settled=已结算, failed=失败, refunded=已退款';

-- ============================================
-- 5. 视图：拍卖品详情（含最高出价）
-- ============================================
CREATE OR REPLACE VIEW v_auction_lot_detail AS
SELECT 
  l.*,
  s.title as session_title,
  s.status as session_status,
  s.scheduled_at as session_scheduled_at,
  (
    SELECT COUNT(*) FROM auction_bid b WHERE b.lot_id = l.id
  ) as bid_count,
  (
    SELECT MAX(b.bid_points) FROM auction_bid b WHERE b.lot_id = l.id
  ) as current_price,
  (
    SELECT b.bidder_member_id 
    FROM auction_bid b 
    WHERE b.lot_id = l.id 
    ORDER BY b.bid_points DESC, b.created_at ASC 
    LIMIT 1
  ) as current_leader_id
FROM auction_lot l
JOIN auction_session s ON l.session_id = s.id;

COMMENT ON VIEW v_auction_lot_detail IS '拍卖品详情视图，包含出价数量和当前最高价';

-- ============================================
-- ✅ Migration 完成
-- ============================================
SELECT 
  '✅ 拍卖系统表创建完成' as status,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'auction_session') as session_exists,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'auction_lot') as lot_exists,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'auction_bid') as bid_exists,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'auction_result') as result_exists;
