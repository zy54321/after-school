-- ============================================
-- 家庭成长银行 - 悬赏任务测试数据
-- 执行时机：004_bounty_tables.sql 之后
-- ============================================

-- 注意：需要先有 family_members 数据
-- 以下使用子查询获取真实的 member_id

-- ============================================
-- 1. 插入测试悬赏任务
-- ============================================
DO $$
DECLARE
  v_parent_id INT;
  v_publisher_id INT;
  v_claimer_id INT;
  v_task_id INT;
  v_claim_id INT;
BEGIN
  -- 获取测试用户
  SELECT id INTO v_parent_id FROM users WHERE is_active = TRUE LIMIT 1;
  
  IF v_parent_id IS NULL THEN
    RAISE NOTICE '⚠️ 没有找到测试用户，跳过种子数据';
    RETURN;
  END IF;
  
  -- 获取发布者成员
  SELECT id INTO v_publisher_id 
  FROM family_members 
  WHERE parent_id = v_parent_id 
  ORDER BY id 
  LIMIT 1;
  
  -- 获取领取者成员（不同于发布者）
  SELECT id INTO v_claimer_id 
  FROM family_members 
  WHERE parent_id = v_parent_id AND id != v_publisher_id
  ORDER BY id 
  LIMIT 1;
  
  IF v_publisher_id IS NULL THEN
    RAISE NOTICE '⚠️ 没有找到测试成员，跳过种子数据';
    RETURN;
  END IF;
  
  RAISE NOTICE '📝 创建测试悬赏任务...';
  RAISE NOTICE '   用户 ID: %', v_parent_id;
  RAISE NOTICE '   发布者 ID: %', v_publisher_id;
  RAISE NOTICE '   领取者 ID: %', v_claimer_id;
  
  -- 任务1：开放中的任务
  INSERT INTO bounty_task (
    parent_id, publisher_member_id, title, description, 
    bounty_points, escrow_points, due_at, accept_criteria, status
  ) VALUES (
    v_parent_id, 
    v_publisher_id,
    '整理书桌',
    '把书桌上的书本、文具整理好，保持整洁。\n要求：\n1. 书本按大小排列\n2. 文具放入笔筒\n3. 不要的东西清理掉',
    30,
    30,
    CURRENT_TIMESTAMP + INTERVAL '3 days',
    '书桌整洁，物品摆放有序，由家长验收确认',
    'open'
  ) RETURNING id INTO v_task_id;
  RAISE NOTICE '   ✅ 任务1 (开放): ID=%', v_task_id;
  
  -- 任务2：已被领取的任务
  IF v_claimer_id IS NOT NULL THEN
    INSERT INTO bounty_task (
      parent_id, publisher_member_id, title, description, 
      bounty_points, escrow_points, due_at, accept_criteria, status
    ) VALUES (
      v_parent_id, 
      v_publisher_id,
      '完成数学作业',
      '今天的数学作业要全部完成，包括课本练习和习题册。',
      50,
      50,
      CURRENT_TIMESTAMP + INTERVAL '1 day',
      '作业全部完成，正确率达到80%以上',
      'claimed'
    ) RETURNING id INTO v_task_id;
    RAISE NOTICE '   ✅ 任务2 (已领取): ID=%', v_task_id;
    
    -- 创建领取记录
    INSERT INTO task_claim (
      task_id, claimer_member_id, status
    ) VALUES (
      v_task_id,
      v_claimer_id,
      'active'
    ) RETURNING id INTO v_claim_id;
    RAISE NOTICE '   ✅ 领取记录: ID=%', v_claim_id;
  END IF;
  
  -- 任务3：已完成的任务
  INSERT INTO bounty_task (
    parent_id, publisher_member_id, title, description, 
    bounty_points, escrow_points, due_at, accept_criteria, status
  ) VALUES (
    v_parent_id, 
    v_publisher_id,
    '帮忙洗碗',
    '晚饭后把所有碗筷洗干净并擦干收好。',
    20,
    0,  -- 已经结算
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    '碗筷洗净、擦干、收好',
    'approved'
  ) RETURNING id INTO v_task_id;
  RAISE NOTICE '   ✅ 任务3 (已完成): ID=%', v_task_id;
  
  IF v_claimer_id IS NOT NULL THEN
    -- 创建已完成的领取记录
    INSERT INTO task_claim (
      task_id, claimer_member_id, status, submitted_at, submission_note
    ) VALUES (
      v_task_id,
      v_claimer_id,
      'approved',
      CURRENT_TIMESTAMP - INTERVAL '1 day',
      '已经全部洗完并收好了！'
    ) RETURNING id INTO v_claim_id;
    
    -- 创建审核记录
    INSERT INTO task_review (
      task_id, claim_id, reviewer_member_id, decision, comment
    ) VALUES (
      v_task_id,
      v_claim_id,
      v_publisher_id,
      'approved',
      '完成得很好，碗筷都很干净！'
    );
    RAISE NOTICE '   ✅ 审核记录已创建';
  END IF;
  
  -- 任务4：无截止日期的任务
  INSERT INTO bounty_task (
    parent_id, publisher_member_id, title, description, 
    bounty_points, escrow_points, accept_criteria, status
  ) VALUES (
    v_parent_id, 
    v_publisher_id,
    '学会骑自行车',
    '能够独立骑自行车绕小区一圈。',
    100,
    100,
    '能够独立骑行，不需要辅助轮或大人扶着',
    'open'
  ) RETURNING id INTO v_task_id;
  RAISE NOTICE '   ✅ 任务4 (长期): ID=%', v_task_id;
  
  -- 任务5：已取消的任务
  INSERT INTO bounty_task (
    parent_id, publisher_member_id, title, description, 
    bounty_points, escrow_points, status
  ) VALUES (
    v_parent_id, 
    v_publisher_id,
    '已取消的测试任务',
    '这是一个已取消的任务示例。',
    10,
    0,
    'cancelled'
  ) RETURNING id INTO v_task_id;
  RAISE NOTICE '   ✅ 任务5 (已取消): ID=%', v_task_id;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ 悬赏任务测试数据创建完成！';
  
END $$;

-- ============================================
-- 验证数据
-- ============================================
DO $$
DECLARE
  task_count INT;
  claim_count INT;
  review_count INT;
BEGIN
  SELECT COUNT(*) INTO task_count FROM bounty_task;
  SELECT COUNT(*) INTO claim_count FROM task_claim;
  SELECT COUNT(*) INTO review_count FROM task_review;
  
  RAISE NOTICE '';
  RAISE NOTICE '📊 数据统计：';
  RAISE NOTICE '   悬赏任务: % 条', task_count;
  RAISE NOTICE '   领取记录: % 条', claim_count;
  RAISE NOTICE '   审核记录: % 条', review_count;
END $$;
