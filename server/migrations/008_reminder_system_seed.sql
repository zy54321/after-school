-- ============================================
-- 家庭成长银行 - 提醒系统种子数据
-- 执行时机：在 008_reminder_system.sql 之后
-- ============================================

-- ============================================
-- 1. 插入测试提醒策略
-- ============================================

-- 假设用户 ID=1 存在
INSERT INTO reminder_policy (parent_id, name, description, policy_type, config, channels, status)
VALUES 
  -- 任务到期提醒策略
  (1, '任务到期提醒', '在任务到期前24小时和1小时发送提醒', 'task_due', 
   '{"hours_before": [24, 1], "repeat": false}'::jsonb, 
   ARRAY['app', 'push'], 'active'),
  
  -- 问题发生提醒策略
  (1, '问题发生警报', '当问题在7天内发生3次以上时发送警报', 'issue_occurrence',
   '{"threshold": 3, "period_days": 7, "alert_level": "high"}'::jsonb,
   ARRAY['app', 'push', 'email'], 'active'),
  
  -- 积分低提醒策略
  (1, '积分余额提醒', '当积分低于50时提醒', 'points_low',
   '{"threshold": 50, "cooldown_hours": 24}'::jsonb,
   ARRAY['app'], 'active'),
  
  -- 每日定时提醒
  (1, '每日学习提醒', '每天早上9点提醒开始学习', 'scheduled',
   '{"cron": "0 9 * * *", "timezone": "Asia/Shanghai", "message": "该开始今天的学习任务啦！"}'::jsonb,
   ARRAY['app', 'push'], 'active'),
  
  -- 连续天数里程碑提醒
  (1, '连续打卡奖励', '连续完成任务达到里程碑时提醒', 'streak_milestone',
   '{"milestones": [7, 14, 30, 60, 100], "reward_multiplier": 1.5}'::jsonb,
   ARRAY['app'], 'active'),
  
  -- 暂停状态的策略
  (1, '周末活动提醒', '周末特别活动提醒（已暂停）', 'scheduled',
   '{"cron": "0 10 * * 6,0", "timezone": "Asia/Shanghai"}'::jsonb,
   ARRAY['app'], 'paused')
ON CONFLICT DO NOTHING;

-- ============================================
-- 2. 插入测试提醒事件
-- ============================================

-- 假设成员 ID=1 存在
INSERT INTO reminder_event (parent_id, member_id, target_type, target_id, title, message, fire_at, channel, status, policy_id)
VALUES 
  -- 待发送的任务提醒
  (1, 1, 'task', 1, '任务即将到期', '您有一个任务将在1小时后到期，请尽快完成！', 
   CURRENT_TIMESTAMP + INTERVAL '30 minutes', 'app', 'pending', 1),
  
  -- 待发送的问题提醒
  (1, 1, 'issue', 1, '问题行为频繁', '本周"拖延作业"问题已发生3次，需要关注', 
   CURRENT_TIMESTAMP + INTERVAL '1 hour', 'push', 'pending', 2),
  
  -- 已发送的提醒
  (1, 1, 'task', 2, '任务已完成', '恭喜完成"整理房间"任务，获得20积分！', 
   CURRENT_TIMESTAMP - INTERVAL '2 hours', 'app', 'sent', NULL),
  
  -- 已读的提醒
  (1, 1, 'points', NULL, '积分余额提醒', '您的积分余额已降至45，请注意节约使用', 
   CURRENT_TIMESTAMP - INTERVAL '1 day', 'app', 'read', 3),
  
  -- 失败的提醒
  (1, 1, 'custom', NULL, '系统通知', '系统维护通知', 
   CURRENT_TIMESTAMP - INTERVAL '3 days', 'email', 'failed', NULL),
  
  -- 已取消的提醒
  (1, 1, 'task', 3, '任务到期提醒', '任务已被取消，此提醒作废', 
   CURRENT_TIMESTAMP - INTERVAL '1 hour', 'app', 'cancelled', 1)
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. 更新策略触发统计
-- ============================================
UPDATE reminder_policy 
SET trigger_count = 2, last_triggered_at = CURRENT_TIMESTAMP - INTERVAL '1 hour'
WHERE name = '任务到期提醒' AND parent_id = 1;

UPDATE reminder_policy 
SET trigger_count = 1, last_triggered_at = CURRENT_TIMESTAMP - INTERVAL '1 day'
WHERE name = '积分余额提醒' AND parent_id = 1;

-- ============================================
-- 完成提示
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ 提醒系统种子数据插入完成！';
  RAISE NOTICE '   - 6 条提醒策略';
  RAISE NOTICE '   - 6 条提醒事件（各状态）';
END $$;
