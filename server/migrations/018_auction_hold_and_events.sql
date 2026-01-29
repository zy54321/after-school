-- ============================================
-- 拍卖系统增强 - 冻结机制和事件审计
-- Migration: 018_auction_hold_and_events.sql
-- 执行时机：在 003_auction_tables.sql 之后
-- 命令示例：psql -U your_user -d your_database -f 018_auction_hold_and_events.sql
-- ============================================

-- ============================================
-- A1. 拍卖冻结表 (auction_hold)
-- 用于冻结竞拍者的积分，防止重复出价和超支
-- ============================================
CREATE TABLE IF NOT EXISTS auction_hold (
  id SERIAL PRIMARY KEY,
  session_id INT NOT NULL REFERENCES auction_session(id) ON DELETE CASCADE,
  lot_id INT NOT NULL REFERENCES auction_lot(id) ON DELETE CASCADE,
  bidder_id INT NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,

  hold_points INT NOT NULL DEFAULT 0,      -- 当前冻结额度（=该人该 lot 的最高出价）
  status TEXT NOT NULL DEFAULT 'active',   -- active/released/converted

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(lot_id, bidder_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_auction_hold_session ON auction_hold(session_id);
CREATE INDEX IF NOT EXISTS idx_auction_hold_lot ON auction_hold(lot_id);
CREATE INDEX IF NOT EXISTS idx_auction_hold_bidder ON auction_hold(bidder_id);
CREATE INDEX IF NOT EXISTS idx_auction_hold_status ON auction_hold(status);

-- 注释
COMMENT ON TABLE auction_hold IS '拍卖冻结表，记录竞拍者的积分冻结状态';
COMMENT ON COLUMN auction_hold.hold_points IS '当前冻结的积分额度，等于该竞拍者在该拍品的最高出价';
COMMENT ON COLUMN auction_hold.status IS '状态：active=活跃冻结, released=已释放, converted=已转换为订单';

-- ============================================
-- A2. 拍卖事件表 (auction_event)
-- 用于审计和回放，记录所有关键操作
-- ============================================
CREATE TABLE IF NOT EXISTS auction_event (
  id SERIAL PRIMARY KEY,
  actor_user_id INT,                       -- 管理员 user id（session user）
  session_id INT REFERENCES auction_session(id) ON DELETE CASCADE,
  lot_id INT REFERENCES auction_lot(id) ON DELETE CASCADE,
  bidder_id INT REFERENCES family_members(id) ON DELETE SET NULL,

  event_type TEXT NOT NULL,                -- bid/undo_bid/close_lot/reopen_lot/settle_session/void_settle
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_auction_event_session ON auction_event(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auction_event_lot ON auction_event(lot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auction_event_bidder ON auction_event(bidder_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auction_event_type ON auction_event(event_type, created_at DESC);

-- 注释
COMMENT ON TABLE auction_event IS '拍卖事件表，记录所有关键操作用于审计和回放';
COMMENT ON COLUMN auction_event.actor_user_id IS '操作者用户ID（管理员），NULL表示系统自动操作';
COMMENT ON COLUMN auction_event.event_type IS '事件类型：bid=出价, undo_bid=撤销出价, close_lot=关闭拍品, reopen_lot=重新开放拍品, settle_session=结算场次, void_settle=撤销结算';
COMMENT ON COLUMN auction_event.payload IS '事件负载数据（JSON），包含事件相关的详细信息';

-- ============================================
-- A3. auction_result 唯一约束
-- 防止重复成交/重复扣款/重复入库
-- ============================================

-- 首先检查并添加 session_id 字段（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'auction_result' AND column_name = 'session_id'
  ) THEN
    -- 添加 session_id 字段（通过 lot_id 关联 auction_lot 获取）
    ALTER TABLE auction_result 
      ADD COLUMN session_id INT REFERENCES auction_session(id) ON DELETE CASCADE;
    
    -- 填充现有数据的 session_id
    UPDATE auction_result ar
    SET session_id = al.session_id
    FROM auction_lot al
    WHERE ar.lot_id = al.id AND ar.session_id IS NULL;
    
    -- 添加非空约束（对于新数据）
    ALTER TABLE auction_result 
      ALTER COLUMN session_id SET NOT NULL;
    
    -- 添加索引
    CREATE INDEX IF NOT EXISTS idx_auction_result_session ON auction_result(session_id);
    
    COMMENT ON COLUMN auction_result.session_id IS '拍卖场次ID，用于唯一约束和快速查询';
  END IF;
END $$;

-- 添加唯一约束（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'uq_auction_result_session_lot'
  ) THEN
    -- 先删除可能存在的旧约束（lot_id UNIQUE）
    ALTER TABLE auction_result DROP CONSTRAINT IF EXISTS auction_result_lot_id_key;
    
    -- 添加新的唯一约束
    ALTER TABLE auction_result
      ADD CONSTRAINT uq_auction_result_session_lot UNIQUE(session_id, lot_id);
  END IF;
END $$;

-- ============================================
-- A4. auction_bid 添加 is_void 字段（用于撤销出价，不删除记录）
-- ============================================

-- 添加 is_void 字段（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'auction_bid' AND column_name = 'is_void'
  ) THEN
    ALTER TABLE auction_bid 
      ADD COLUMN is_void BOOLEAN DEFAULT FALSE;
    
    CREATE INDEX IF NOT EXISTS idx_auction_bid_is_void ON auction_bid(is_void) WHERE is_void = FALSE;
    
    COMMENT ON COLUMN auction_bid.is_void IS '是否已撤销（true=已撤销，false/null=有效）';
  END IF;
END $$;

-- ============================================
-- ✅ Migration 完成检查
-- ============================================
SELECT 
  '✅ 拍卖系统增强迁移完成' as status,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'auction_hold') as hold_exists,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'auction_event') as event_exists,
  (SELECT COUNT(*) FROM pg_constraint WHERE conname = 'uq_auction_result_session_lot') as constraint_exists,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'auction_bid' AND column_name = 'is_void') as bid_void_field_exists;

  -- ===================啊啊啊啊=========================

