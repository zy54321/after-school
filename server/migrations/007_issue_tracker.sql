-- ============================================
-- 家庭成长银行 - Issue Tracker 表迁移
-- 执行时机：007_issue_tracker.sql
-- 
-- 用途：追踪孩子的行为问题/坏习惯，记录发生次数，
--       设置干预措施，实现自动化惩罚/提醒
-- ============================================

-- ============================================
-- 1. Issue 问题/习惯追踪表
-- ============================================
-- 定义需要追踪的问题或坏习惯

CREATE TABLE IF NOT EXISTS issue (
  id SERIAL PRIMARY KEY,
  parent_id INT NOT NULL,                          -- 所属用户
  owner_member_id INT NOT NULL,                    -- 问题归属的成员
  
  -- 基本信息
  title VARCHAR(200) NOT NULL,                     -- 问题标题
  description TEXT,                                -- 详细描述
  icon VARCHAR(50) DEFAULT '⚠️',                  -- 图标
  tags VARCHAR(50)[] DEFAULT '{}',                 -- 标签数组（如：行为、学习、生活）
  
  -- 严重程度与关注度
  severity VARCHAR(20) DEFAULT 'medium',           -- low/medium/high/critical
  attention_score INT DEFAULT 0,                   -- 关注度分数（可用于排序/警报）
  attention_threshold INT DEFAULT 5,               -- 关注度阈值（超过触发警报）
  
  -- 统计字段（缓存）
  occurrence_count INT DEFAULT 0,                  -- 发生次数
  last_occurred_at TIMESTAMP,                      -- 上次发生时间
  streak_days INT DEFAULT 0,                       -- 连续无发生天数
  
  -- 状态
  status VARCHAR(20) DEFAULT 'active',             -- active/resolved/monitoring/archived
  
  -- 时间戳
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_issue_parent 
    FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_issue_member 
    FOREIGN KEY (owner_member_id) REFERENCES family_members(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_issue_parent ON issue(parent_id);
CREATE INDEX IF NOT EXISTS idx_issue_member ON issue(owner_member_id);
CREATE INDEX IF NOT EXISTS idx_issue_status ON issue(status);
CREATE INDEX IF NOT EXISTS idx_issue_attention ON issue(attention_score DESC);
CREATE INDEX IF NOT EXISTS idx_issue_tags ON issue USING GIN(tags);

-- 注释
COMMENT ON TABLE issue IS '问题/习惯追踪表';
COMMENT ON COLUMN issue.severity IS '严重程度：low=低, medium=中, high=高, critical=紧急';
COMMENT ON COLUMN issue.attention_score IS '关注度分数，每次发生可增加，用于优先级排序';
COMMENT ON COLUMN issue.attention_threshold IS '关注度阈值，超过时触发警报或自动干预';
COMMENT ON COLUMN issue.streak_days IS '连续无发生天数，用于正向激励';

-- ============================================
-- 2. Issue Occurrence 问题发生记录表
-- ============================================
-- 记录每次问题发生的详细信息

CREATE TABLE IF NOT EXISTS issue_occurrence (
  id SERIAL PRIMARY KEY,
  issue_id INT NOT NULL,                           -- 关联的问题
  
  -- 发生信息
  occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 发生时间
  note TEXT,                                       -- 备注说明
  context VARCHAR(100),                            -- 发生场景（如：放学后、做作业时）
  
  -- 关联
  related_task_id INT,                             -- 关联的悬赏任务（如果有）
  reporter_member_id INT,                          -- 记录者（成员ID）
  
  -- 自动处理
  auto_intervention_id INT,                        -- 触发的自动干预措施
  points_deducted INT DEFAULT 0,                   -- 扣除的积分
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_occurrence_issue 
    FOREIGN KEY (issue_id) REFERENCES issue(id) ON DELETE CASCADE,
  CONSTRAINT fk_occurrence_task 
    FOREIGN KEY (related_task_id) REFERENCES bounty_task(id) ON DELETE SET NULL,
  CONSTRAINT fk_occurrence_reporter 
    FOREIGN KEY (reporter_member_id) REFERENCES family_members(id) ON DELETE SET NULL
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_occurrence_issue ON issue_occurrence(issue_id);
CREATE INDEX IF NOT EXISTS idx_occurrence_time ON issue_occurrence(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_occurrence_issue_time ON issue_occurrence(issue_id, occurred_at DESC);

-- 注释
COMMENT ON TABLE issue_occurrence IS '问题发生记录表';
COMMENT ON COLUMN issue_occurrence.context IS '发生场景/情境';
COMMENT ON COLUMN issue_occurrence.auto_intervention_id IS '触发的自动干预措施ID';

-- ============================================
-- 3. Intervention 干预措施表
-- ============================================
-- 定义针对问题的干预措施（手动或自动）

CREATE TABLE IF NOT EXISTS intervention (
  id SERIAL PRIMARY KEY,
  issue_id INT NOT NULL,                           -- 关联的问题
  
  -- 基本信息
  name VARCHAR(100) NOT NULL,                      -- 干预措施名称
  description TEXT,                                -- 描述
  icon VARCHAR(50) DEFAULT '🔧',                  -- 图标
  
  -- 类型与模板
  action_type VARCHAR(30) NOT NULL,                -- 动作类型
  -- deduct_points: 扣积分
  -- create_task: 创建悬赏任务
  -- send_reminder: 发送提醒
  -- lock_reward: 锁定奖励
  -- custom: 自定义
  
  template JSONB DEFAULT '{}',                     -- 动作模板配置
  -- 示例：
  -- { "points": 10 } for deduct_points
  -- { "task_title": "...", "bounty": 20 } for create_task
  -- { "message": "..." } for send_reminder
  
  -- 触发条件
  trigger_type VARCHAR(30) DEFAULT 'manual',       -- manual/auto_on_occurrence/threshold
  trigger_config JSONB DEFAULT '{}',               -- 触发配置
  -- 示例：
  -- { "min_occurrences": 3 } for threshold trigger
  -- { "cooldown_hours": 24 } for cooldown
  
  -- 统计
  execution_count INT DEFAULT 0,                   -- 执行次数
  last_executed_at TIMESTAMP,                      -- 上次执行时间
  
  -- 状态
  status VARCHAR(20) DEFAULT 'active',             -- active/inactive/deprecated
  priority INT DEFAULT 0,                          -- 优先级（多个干预时的执行顺序）
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_intervention_issue 
    FOREIGN KEY (issue_id) REFERENCES issue(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_intervention_issue ON intervention(issue_id);
CREATE INDEX IF NOT EXISTS idx_intervention_status ON intervention(status);
CREATE INDEX IF NOT EXISTS idx_intervention_type ON intervention(action_type);

-- 注释
COMMENT ON TABLE intervention IS '干预措施表';
COMMENT ON COLUMN intervention.action_type IS '动作类型：deduct_points=扣积分, create_task=创建任务, send_reminder=发提醒, lock_reward=锁奖励, custom=自定义';
COMMENT ON COLUMN intervention.trigger_type IS '触发类型：manual=手动, auto_on_occurrence=发生时自动, threshold=达到阈值时';
COMMENT ON COLUMN intervention.template IS 'JSON配置，根据action_type不同结构不同';

-- ============================================
-- 4. Issue Attention Event 注意力事件表（可选）
-- ============================================
-- 记录关注度变化事件，用于分析趋势

CREATE TABLE IF NOT EXISTS issue_attention_event (
  id SERIAL PRIMARY KEY,
  issue_id INT NOT NULL,                           -- 关联的问题
  
  -- 事件信息
  event_type VARCHAR(30) NOT NULL,                 -- 事件类型
  -- occurrence: 发生问题 (+attention)
  -- streak_bonus: 连续无发生奖励 (-attention)
  -- manual_adjust: 手动调整
  -- intervention: 干预措施执行
  -- decay: 自然衰减
  
  score_change INT NOT NULL,                       -- 分数变化（正增负减）
  score_before INT NOT NULL,                       -- 变化前分数
  score_after INT NOT NULL,                        -- 变化后分数
  
  note TEXT,                                       -- 备注
  related_occurrence_id INT,                       -- 关联的发生记录
  related_intervention_id INT,                     -- 关联的干预措施
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_attention_event_issue 
    FOREIGN KEY (issue_id) REFERENCES issue(id) ON DELETE CASCADE,
  CONSTRAINT fk_attention_event_occurrence 
    FOREIGN KEY (related_occurrence_id) REFERENCES issue_occurrence(id) ON DELETE SET NULL,
  CONSTRAINT fk_attention_event_intervention 
    FOREIGN KEY (related_intervention_id) REFERENCES intervention(id) ON DELETE SET NULL
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_attention_event_issue ON issue_attention_event(issue_id);
CREATE INDEX IF NOT EXISTS idx_attention_event_time ON issue_attention_event(created_at DESC);

-- 注释
COMMENT ON TABLE issue_attention_event IS '关注度变化事件表，用于追踪和分析';

-- ============================================
-- 5. 触发器：更新 issue 统计字段
-- ============================================

-- 更新时间戳触发器
CREATE OR REPLACE FUNCTION update_issue_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_issue_updated_at ON issue;
CREATE TRIGGER trigger_issue_updated_at
  BEFORE UPDATE ON issue
  FOR EACH ROW
  EXECUTE FUNCTION update_issue_timestamp();

DROP TRIGGER IF EXISTS trigger_intervention_updated_at ON intervention;
CREATE TRIGGER trigger_intervention_updated_at
  BEFORE UPDATE ON intervention
  FOR EACH ROW
  EXECUTE FUNCTION update_issue_timestamp();

-- 发生记录插入时更新 issue 统计
CREATE OR REPLACE FUNCTION update_issue_on_occurrence()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE issue 
  SET 
    occurrence_count = occurrence_count + 1,
    last_occurred_at = NEW.occurred_at,
    streak_days = 0,  -- 重置连续天数
    updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.issue_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_occurrence_insert ON issue_occurrence;
CREATE TRIGGER trigger_occurrence_insert
  AFTER INSERT ON issue_occurrence
  FOR EACH ROW
  EXECUTE FUNCTION update_issue_on_occurrence();

-- ============================================
-- 6. 视图：问题概览
-- ============================================
CREATE OR REPLACE VIEW v_issue_overview AS
SELECT 
  i.*,
  fm.name as member_name,
  COUNT(DISTINCT io.id) as total_occurrences,
  COUNT(DISTINCT CASE WHEN io.occurred_at >= CURRENT_DATE - INTERVAL '7 days' THEN io.id END) as occurrences_last_7_days,
  COUNT(DISTINCT CASE WHEN io.occurred_at >= CURRENT_DATE - INTERVAL '30 days' THEN io.id END) as occurrences_last_30_days,
  COUNT(DISTINCT iv.id) as intervention_count
FROM issue i
JOIN family_members fm ON i.owner_member_id = fm.id
LEFT JOIN issue_occurrence io ON i.id = io.issue_id
LEFT JOIN intervention iv ON i.id = iv.issue_id AND iv.status = 'active'
GROUP BY i.id, fm.name;

COMMENT ON VIEW v_issue_overview IS '问题概览视图，包含统计信息';

-- ============================================
-- 完成提示
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Issue Tracker 表创建完成！';
  RAISE NOTICE '   - issue: 问题/习惯追踪';
  RAISE NOTICE '   - issue_occurrence: 发生记录';
  RAISE NOTICE '   - intervention: 干预措施';
  RAISE NOTICE '   - issue_attention_event: 关注度事件（可选）';
  RAISE NOTICE '';
  RAISE NOTICE '💡 使用场景:';
  RAISE NOTICE '   1. 记录坏习惯（如：说谎、拖延）';
  RAISE NOTICE '   2. 每次发生时记录 occurrence';
  RAISE NOTICE '   3. 设置干预措施（如：自动扣积分）';
  RAISE NOTICE '   4. attention_score 超过阈值时触发警报';
END $$;
