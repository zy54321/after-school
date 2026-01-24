-- ============================================
-- 家庭成长银行 - 提醒系统表迁移
-- 执行时机：008_reminder_system.sql
-- 
-- 用途：管理各类提醒策略和提醒事件，支持任务到期提醒、
--       问题发生提醒、积分变动提醒等多种场景
-- ============================================

-- ============================================
-- 1. Reminder Policy 提醒策略表
-- ============================================
-- 定义提醒的规则和配置

CREATE TABLE IF NOT EXISTS reminder_policy (
  id SERIAL PRIMARY KEY,
  parent_id INT NOT NULL,                          -- 所属用户
  
  -- 基本信息
  name VARCHAR(100) NOT NULL,                      -- 策略名称
  description TEXT,                                -- 策略描述
  icon VARCHAR(50) DEFAULT '🔔',                  -- 图标
  
  -- 策略类型与配置
  policy_type VARCHAR(50) NOT NULL DEFAULT 'custom', -- 策略类型
  -- task_due: 任务到期提醒
  -- issue_occurrence: 问题发生提醒
  -- points_low: 积分低于阈值提醒
  -- streak_milestone: 连续天数里程碑
  -- scheduled: 定时提醒
  -- custom: 自定义
  
  config JSONB NOT NULL DEFAULT '{}',             -- 策略配置
  -- 示例配置：
  -- task_due: { "hours_before": [24, 1], "repeat": false }
  -- issue_occurrence: { "threshold": 3, "period_days": 7 }
  -- points_low: { "threshold": 50 }
  -- scheduled: { "cron": "0 9 * * *", "timezone": "Asia/Shanghai" }
  
  -- 目标筛选
  target_type VARCHAR(50),                        -- 目标类型 (task/issue/member/all)
  target_filter JSONB DEFAULT '{}',               -- 目标筛选条件
  -- 示例：{ "member_ids": [1, 2], "tags": ["重要"] }
  
  -- 通知渠道
  channels VARCHAR(30)[] DEFAULT '{app}',         -- 通知渠道数组
  -- app: 应用内通知
  -- push: 推送通知
  -- email: 邮件
  -- sms: 短信
  -- wechat: 微信
  
  -- 状态与优先级
  status VARCHAR(20) NOT NULL DEFAULT 'active',   -- active/paused/archived
  priority INT DEFAULT 0,                          -- 优先级（用于冲突处理）
  
  -- 统计
  trigger_count INT DEFAULT 0,                    -- 触发次数
  last_triggered_at TIMESTAMP,                    -- 上次触发时间
  
  -- 时间戳
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_reminder_policy_parent 
    FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_reminder_policy_parent ON reminder_policy(parent_id);
CREATE INDEX IF NOT EXISTS idx_reminder_policy_status ON reminder_policy(status);
CREATE INDEX IF NOT EXISTS idx_reminder_policy_type ON reminder_policy(policy_type);

-- 注释
COMMENT ON TABLE reminder_policy IS '提醒策略表，定义提醒规则和配置';
COMMENT ON COLUMN reminder_policy.policy_type IS '策略类型：task_due=任务到期, issue_occurrence=问题发生, points_low=积分低, scheduled=定时, custom=自定义';
COMMENT ON COLUMN reminder_policy.config IS 'JSON配置，根据policy_type不同结构不同';
COMMENT ON COLUMN reminder_policy.channels IS '通知渠道数组：app=应用内, push=推送, email=邮件, sms=短信, wechat=微信';

-- ============================================
-- 2. Reminder Event 提醒事件表
-- ============================================
-- 记录每个具体的提醒事件

CREATE TABLE IF NOT EXISTS reminder_event (
  id SERIAL PRIMARY KEY,
  parent_id INT NOT NULL,                          -- 所属用户
  member_id INT,                                   -- 目标成员（可为空表示家长）
  
  -- 目标信息
  target_type VARCHAR(50) NOT NULL,               -- 目标类型
  -- task: 悬赏任务
  -- issue: 问题追踪
  -- auction: 拍卖会话
  -- lottery: 抽奖活动
  -- points: 积分变动
  -- custom: 自定义
  
  target_id INT,                                  -- 目标ID（可为空）
  
  -- 提醒内容
  title VARCHAR(200),                              -- 提醒标题
  message TEXT,                                   -- 提醒内容
  data JSONB DEFAULT '{}',                        -- 附加数据
  
  -- 触发信息
  fire_at TIMESTAMP NOT NULL,                     -- 计划触发时间
  fired_at TIMESTAMP,                             -- 实际触发时间
  
  -- 渠道与状态
  channel VARCHAR(30) NOT NULL DEFAULT 'app',     -- 通知渠道
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- 状态
  -- pending: 待发送
  -- sent: 已发送
  -- delivered: 已送达
  -- read: 已读
  -- failed: 发送失败
  -- cancelled: 已取消
  
  -- 重试信息
  retry_count INT DEFAULT 0,                      -- 重试次数
  max_retries INT DEFAULT 3,                      -- 最大重试次数
  last_error TEXT,                                -- 最后错误信息
  
  -- 关联
  policy_id INT,                                  -- 关联的策略（可为空表示手动创建）
  
  -- 时间戳
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_reminder_event_parent 
    FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_reminder_event_member 
    FOREIGN KEY (member_id) REFERENCES family_members(id) ON DELETE CASCADE,
  CONSTRAINT fk_reminder_event_policy 
    FOREIGN KEY (policy_id) REFERENCES reminder_policy(id) ON DELETE SET NULL
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_reminder_event_parent ON reminder_event(parent_id);
CREATE INDEX IF NOT EXISTS idx_reminder_event_member ON reminder_event(member_id);
CREATE INDEX IF NOT EXISTS idx_reminder_event_status ON reminder_event(status);
CREATE INDEX IF NOT EXISTS idx_reminder_event_fire_at ON reminder_event(fire_at);
CREATE INDEX IF NOT EXISTS idx_reminder_event_pending ON reminder_event(status, fire_at) 
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_reminder_event_target ON reminder_event(target_type, target_id);

-- 注释
COMMENT ON TABLE reminder_event IS '提醒事件表，记录每个具体的提醒';
COMMENT ON COLUMN reminder_event.target_type IS '目标类型：task=任务, issue=问题, auction=拍卖, lottery=抽奖, points=积分, custom=自定义';
COMMENT ON COLUMN reminder_event.channel IS '通知渠道：app=应用内, push=推送, email=邮件, sms=短信, wechat=微信';
COMMENT ON COLUMN reminder_event.status IS '状态：pending=待发送, sent=已发送, delivered=已送达, read=已读, failed=失败, cancelled=已取消';

-- ============================================
-- 3. 触发器：更新时间戳
-- ============================================

-- 创建独立的时间戳更新函数（不依赖 issue 模块）
CREATE OR REPLACE FUNCTION update_reminder_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_reminder_timestamp() IS '提醒系统时间戳更新触发器函数';

-- 更新 reminder_policy 时间戳
DROP TRIGGER IF EXISTS trigger_reminder_policy_updated_at ON reminder_policy;
CREATE TRIGGER trigger_reminder_policy_updated_at
  BEFORE UPDATE ON reminder_policy
  FOR EACH ROW
  EXECUTE FUNCTION update_reminder_timestamp();

-- 更新 reminder_event 时间戳
DROP TRIGGER IF EXISTS trigger_reminder_event_updated_at ON reminder_event;
CREATE TRIGGER trigger_reminder_event_updated_at
  BEFORE UPDATE ON reminder_event
  FOR EACH ROW
  EXECUTE FUNCTION update_reminder_timestamp();

-- ============================================
-- 4. 视图：待发送提醒
-- ============================================
CREATE OR REPLACE VIEW v_pending_reminders AS
SELECT 
  re.*,
  fm.name as member_name,
  u.username as parent_username,
  rp.name as policy_name,
  rp.policy_type
FROM reminder_event re
JOIN users u ON re.parent_id = u.id
LEFT JOIN family_members fm ON re.member_id = fm.id
LEFT JOIN reminder_policy rp ON re.policy_id = rp.id
WHERE re.status = 'pending'
  AND re.fire_at <= CURRENT_TIMESTAMP + INTERVAL '1 hour'
ORDER BY re.fire_at ASC;

COMMENT ON VIEW v_pending_reminders IS '待发送提醒视图，包含即将触发的提醒';

-- ============================================
-- 5. 视图：提醒统计
-- ============================================
CREATE OR REPLACE VIEW v_reminder_stats AS
SELECT 
  parent_id,
  COUNT(*) as total_events,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
  COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_count,
  COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_count,
  COUNT(CASE WHEN status = 'read' THEN 1 END) as read_count,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
  COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_count,
  COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as today_count,
  COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as week_count
FROM reminder_event
GROUP BY parent_id;

COMMENT ON VIEW v_reminder_stats IS '提醒统计视图，按用户统计各状态提醒数量';

-- ============================================
-- 完成提示
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ 提醒系统表创建完成！';
  RAISE NOTICE '   - reminder_policy: 提醒策略配置';
  RAISE NOTICE '   - reminder_event: 提醒事件记录';
  RAISE NOTICE '';
  RAISE NOTICE '💡 使用场景:';
  RAISE NOTICE '   1. 任务到期提醒（task_due）';
  RAISE NOTICE '   2. 问题发生提醒（issue_occurrence）';
  RAISE NOTICE '   3. 积分低于阈值提醒（points_low）';
  RAISE NOTICE '   4. 定时提醒（scheduled）';
  RAISE NOTICE '   5. 自定义提醒（custom）';
END $$;
