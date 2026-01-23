-- ============================================
-- Issue Tracker 种子数据
-- 执行时机：007_issue_tracker.sql 之后
-- ============================================

BEGIN;

-- ============================================
-- 1. 创建示例问题
-- ============================================
DO $$
DECLARE
  v_parent_id INT := 3;  -- 测试用户 ptjs001
  v_member_id INT;
  v_issue_id_1 INT;
  v_issue_id_2 INT;
  v_issue_id_3 INT;
BEGIN
  -- 获取测试成员
  SELECT id INTO v_member_id 
  FROM family_members 
  WHERE parent_id = v_parent_id 
  ORDER BY id 
  LIMIT 1;
  
  IF v_member_id IS NULL THEN
    RAISE NOTICE '⚠️ 找不到测试成员，跳过种子数据';
    RETURN;
  END IF;
  
  -- 问题1：拖延症
  INSERT INTO issue (parent_id, owner_member_id, title, description, icon, tags, severity, attention_score, attention_threshold, status)
  VALUES (
    v_parent_id, 
    v_member_id, 
    '作业拖延', 
    '放学后不及时完成作业，总是拖到很晚',
    '⏰',
    ARRAY['学习', '时间管理'],
    'high',
    3,
    5,
    'active'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_issue_id_1;
  
  -- 问题2：说谎
  INSERT INTO issue (parent_id, owner_member_id, title, description, icon, tags, severity, attention_score, attention_threshold, status)
  VALUES (
    v_parent_id, 
    v_member_id, 
    '不诚实行为', 
    '对家长说谎，隐瞒事实',
    '🤥',
    ARRAY['品德', '沟通'],
    'critical',
    2,
    3,
    'active'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_issue_id_2;
  
  -- 问题3：屏幕时间过长
  INSERT INTO issue (parent_id, owner_member_id, title, description, icon, tags, severity, attention_score, attention_threshold, status)
  VALUES (
    v_parent_id, 
    v_member_id, 
    '过度使用电子设备', 
    '玩游戏或看视频超过规定时间',
    '📱',
    ARRAY['生活', '自控'],
    'medium',
    1,
    5,
    'monitoring'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_issue_id_3;
  
  RAISE NOTICE '✅ 问题创建完成: 3 条';
  
  -- ============================================
  -- 2. 创建发生记录
  -- ============================================
  IF v_issue_id_1 IS NOT NULL THEN
    INSERT INTO issue_occurrence (issue_id, occurred_at, note, context)
    VALUES 
      (v_issue_id_1, CURRENT_TIMESTAMP - INTERVAL '3 days', '放学后玩了2小时才开始写作业', '放学后'),
      (v_issue_id_1, CURRENT_TIMESTAMP - INTERVAL '1 day', '晚饭后一直拖延，到9点才开始', '晚饭后'),
      (v_issue_id_1, CURRENT_TIMESTAMP - INTERVAL '6 hours', '周末作业拖到周日晚上', '周末');
    
    RAISE NOTICE '✅ 问题1发生记录: 3 条';
  END IF;
  
  IF v_issue_id_2 IS NOT NULL THEN
    INSERT INTO issue_occurrence (issue_id, occurred_at, note, context)
    VALUES 
      (v_issue_id_2, CURRENT_TIMESTAMP - INTERVAL '5 days', '说作业写完了但实际没写', '放学后'),
      (v_issue_id_2, CURRENT_TIMESTAMP - INTERVAL '2 days', '偷吃零食后否认', '午休时');
    
    RAISE NOTICE '✅ 问题2发生记录: 2 条';
  END IF;
  
  IF v_issue_id_3 IS NOT NULL THEN
    INSERT INTO issue_occurrence (issue_id, occurred_at, note, context, points_deducted)
    VALUES 
      (v_issue_id_3, CURRENT_TIMESTAMP - INTERVAL '4 days', '玩游戏超时30分钟', '晚饭后', 5);
    
    RAISE NOTICE '✅ 问题3发生记录: 1 条';
  END IF;
  
  -- ============================================
  -- 3. 创建干预措施
  -- ============================================
  IF v_issue_id_1 IS NOT NULL THEN
    -- 拖延症干预：自动扣积分
    INSERT INTO intervention (issue_id, name, description, icon, action_type, template, trigger_type, trigger_config, status)
    VALUES (
      v_issue_id_1,
      '拖延扣分',
      '每次拖延扣除10积分',
      '💸',
      'deduct_points',
      '{"points": 10}'::jsonb,
      'auto_on_occurrence',
      '{}'::jsonb,
      'active'
    );
    
    -- 拖延症干预：创建补救任务
    INSERT INTO intervention (issue_id, name, description, icon, action_type, template, trigger_type, trigger_config, status, priority)
    VALUES (
      v_issue_id_1,
      '补救任务',
      '连续发生3次后创建补救任务',
      '📝',
      'create_task',
      '{"task_title": "按时完成作业打卡3天", "bounty": 30}'::jsonb,
      'threshold',
      '{"min_occurrences": 3, "period_days": 7}'::jsonb,
      'active',
      1
    );
    
    RAISE NOTICE '✅ 问题1干预措施: 2 条';
  END IF;
  
  IF v_issue_id_2 IS NOT NULL THEN
    -- 说谎干预：严厉扣分
    INSERT INTO intervention (issue_id, name, description, icon, action_type, template, trigger_type, status)
    VALUES (
      v_issue_id_2,
      '诚实惩罚',
      '说谎行为扣除30积分',
      '⚡',
      'deduct_points',
      '{"points": 30}'::jsonb,
      'auto_on_occurrence',
      'active'
    );
    
    RAISE NOTICE '✅ 问题2干预措施: 1 条';
  END IF;
  
  IF v_issue_id_3 IS NOT NULL THEN
    -- 屏幕时间干预：轻度扣分
    INSERT INTO intervention (issue_id, name, description, icon, action_type, template, trigger_type, status)
    VALUES (
      v_issue_id_3,
      '超时扣分',
      '屏幕时间超时扣除5积分',
      '📵',
      'deduct_points',
      '{"points": 5}'::jsonb,
      'manual',
      'active'
    );
    
    RAISE NOTICE '✅ 问题3干预措施: 1 条';
  END IF;
  
  -- ============================================
  -- 4. 创建关注度事件
  -- ============================================
  IF v_issue_id_1 IS NOT NULL THEN
    INSERT INTO issue_attention_event (issue_id, event_type, score_change, score_before, score_after, note)
    VALUES 
      (v_issue_id_1, 'occurrence', 1, 0, 1, '第一次发生'),
      (v_issue_id_1, 'occurrence', 1, 1, 2, '第二次发生'),
      (v_issue_id_1, 'occurrence', 1, 2, 3, '第三次发生');
    
    RAISE NOTICE '✅ 关注度事件: 3 条';
  END IF;
  
END $$;

COMMIT;

-- ============================================
-- 验证数据
-- ============================================
DO $$
DECLARE
  v_issues INT;
  v_occurrences INT;
  v_interventions INT;
  v_events INT;
BEGIN
  SELECT COUNT(*) INTO v_issues FROM issue;
  SELECT COUNT(*) INTO v_occurrences FROM issue_occurrence;
  SELECT COUNT(*) INTO v_interventions FROM intervention;
  SELECT COUNT(*) INTO v_events FROM issue_attention_event;
  
  RAISE NOTICE '=== Issue Tracker 种子数据统计 ===';
  RAISE NOTICE '  问题: % 条', v_issues;
  RAISE NOTICE '  发生记录: % 条', v_occurrences;
  RAISE NOTICE '  干预措施: % 条', v_interventions;
  RAISE NOTICE '  关注度事件: % 条', v_events;
END $$;
