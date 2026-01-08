-- ============================================
-- 家庭成长银行 - 背包使用记录表
-- ============================================
-- 创建时间: 2024-01-XX
-- 功能: 记录背包物品的使用历史
-- ============================================

-- 创建使用记录表
CREATE TABLE IF NOT EXISTS family_backpack_usage_log (
  id SERIAL PRIMARY KEY,
  backpack_id INTEGER REFERENCES family_backpack(id) ON DELETE SET NULL,
  member_id INTEGER NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  reward_id INTEGER NOT NULL REFERENCES family_rewards(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1, -- 使用数量
  notes TEXT, -- 使用备注（可选）
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 使用时间
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_usage_log_member ON family_backpack_usage_log(member_id);
CREATE INDEX IF NOT EXISTS idx_usage_log_backpack ON family_backpack_usage_log(backpack_id);
CREATE INDEX IF NOT EXISTS idx_usage_log_reward ON family_backpack_usage_log(reward_id);
CREATE INDEX IF NOT EXISTS idx_usage_log_used_at ON family_backpack_usage_log(used_at);

-- 导入历史使用记录（从背包表中已使用的记录）
INSERT INTO family_backpack_usage_log (backpack_id, member_id, reward_id, quantity, used_at, created_at)
SELECT 
  id as backpack_id,
  member_id,
  reward_id,
  quantity,
  used_at,
  used_at as created_at
FROM family_backpack
WHERE status = 'used' AND used_at IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM family_backpack_usage_log ul 
  WHERE ul.backpack_id = family_backpack.id
)
ORDER BY used_at ASC;

-- 添加注释
COMMENT ON TABLE family_backpack_usage_log IS '背包物品使用记录表';
COMMENT ON COLUMN family_backpack_usage_log.backpack_id IS '背包物品ID（可为NULL，如果物品被删除）';
COMMENT ON COLUMN family_backpack_usage_log.member_id IS '使用成员ID';
COMMENT ON COLUMN family_backpack_usage_log.reward_id IS '奖励/竞拍品ID';
COMMENT ON COLUMN family_backpack_usage_log.quantity IS '使用数量';
COMMENT ON COLUMN family_backpack_usage_log.notes IS '使用备注';
COMMENT ON COLUMN family_backpack_usage_log.used_at IS '使用时间';

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE '✅ 使用记录表创建完成！';
  RAISE NOTICE '✅ 历史使用记录已导入！';
END $$;

