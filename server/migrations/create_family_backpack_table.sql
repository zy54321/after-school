-- ============================================
-- 家庭成长银行 - 背包功能数据库迁移脚本
-- ============================================
-- 创建时间: 2024-01-XX
-- 功能: 创建背包表并导入历史兑换记录
-- ============================================

-- 1. 创建背包表
CREATE TABLE IF NOT EXISTS family_backpack (
  id SERIAL PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  reward_id INTEGER NOT NULL REFERENCES family_rewards(id) ON DELETE CASCADE,
  points_log_id INTEGER REFERENCES family_points_log(id), -- 关联到兑换记录
  quantity INTEGER DEFAULT 1, -- 数量（同一物品多次兑换合并）
  status VARCHAR(20) DEFAULT 'unused', -- 'unused' 未使用 / 'used' 已使用
  obtained_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 获得时间（兑换时间）
  used_at TIMESTAMP, -- 使用时间（NULL表示未使用）
  notes TEXT, -- 备注（可选）
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_backpack_member ON family_backpack(member_id);
CREATE INDEX IF NOT EXISTS idx_backpack_status ON family_backpack(member_id, status);
CREATE INDEX IF NOT EXISTS idx_backpack_reward ON family_backpack(reward_id);
CREATE INDEX IF NOT EXISTS idx_backpack_points_log ON family_backpack(points_log_id);

-- 3. 导入历史兑换记录到背包
-- 说明：将 family_points_log 中所有兑换和竞拍记录导入背包
-- 条件：points_change < 0 且 reward_id IS NOT NULL

INSERT INTO family_backpack (member_id, reward_id, points_log_id, quantity, status, obtained_at, created_at, updated_at)
SELECT 
  member_id,
  reward_id,
  id as points_log_id,
  1 as quantity,
  'unused' as status, -- 历史记录默认为未使用
  created_at as obtained_at,
  created_at,
  created_at
FROM family_points_log
WHERE 
  reward_id IS NOT NULL 
  AND points_change < 0
  AND (description LIKE '%兑换：%' OR description LIKE '%竞拍得标：%')
  AND NOT EXISTS (
    -- 避免重复导入：检查是否已存在相同的背包记录
    SELECT 1 FROM family_backpack bp 
    WHERE bp.member_id = family_points_log.member_id 
      AND bp.reward_id = family_points_log.reward_id 
      AND bp.points_log_id = family_points_log.id
  )
ORDER BY created_at ASC;

-- 4. 合并同一成员同一奖励的多次兑换记录（合并数量）
-- 说明：对于同一成员、同一奖励、状态为 unused 的多条记录，合并为一条并累加数量

-- 创建临时表存储合并后的数据
CREATE TEMP TABLE backpack_merged AS
SELECT 
  member_id,
  reward_id,
  MIN(points_log_id) as points_log_id, -- 保留最早的兑换记录ID
  SUM(quantity) as quantity,
  'unused' as status,
  MIN(obtained_at) as obtained_at, -- 保留最早的获得时间
  MIN(created_at) as created_at,
  MAX(updated_at) as updated_at
FROM family_backpack
WHERE status = 'unused'
GROUP BY member_id, reward_id
HAVING COUNT(*) > 1; -- 只处理有重复的记录

-- 删除需要合并的旧记录
DELETE FROM family_backpack bp
WHERE bp.status = 'unused'
  AND EXISTS (
    SELECT 1 FROM backpack_merged bm
    WHERE bm.member_id = bp.member_id 
      AND bm.reward_id = bp.reward_id
  );

-- 插入合并后的记录
INSERT INTO family_backpack (member_id, reward_id, points_log_id, quantity, status, obtained_at, created_at, updated_at)
SELECT 
  member_id,
  reward_id,
  points_log_id,
  quantity,
  status,
  obtained_at,
  created_at,
  updated_at
FROM backpack_merged;

-- 清理临时表
DROP TABLE IF EXISTS backpack_merged;

-- 5. 添加注释
COMMENT ON TABLE family_backpack IS '家庭成长银行背包表，存储成员兑换/竞拍获得的物品';
COMMENT ON COLUMN family_backpack.member_id IS '所属成员ID';
COMMENT ON COLUMN family_backpack.reward_id IS '奖励/竞拍品ID';
COMMENT ON COLUMN family_backpack.points_log_id IS '关联的积分流水记录ID';
COMMENT ON COLUMN family_backpack.quantity IS '数量（同一物品多次兑换合并）';
COMMENT ON COLUMN family_backpack.status IS '状态：unused-未使用，used-已使用';
COMMENT ON COLUMN family_backpack.obtained_at IS '获得时间（兑换时间）';
COMMENT ON COLUMN family_backpack.used_at IS '使用时间';

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE '✅ 背包表创建完成！';
  RAISE NOTICE '✅ 历史兑换记录已导入背包！';
  RAISE NOTICE '✅ 同一物品多次兑换已合并数量！';
END $$;

