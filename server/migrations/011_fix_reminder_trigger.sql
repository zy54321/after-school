-- ============================================
-- 修复提醒系统触发器依赖
-- 执行时机：011_fix_reminder_trigger.sql
-- 
-- 目的：消除对 update_issue_timestamp() 的依赖
--       创建独立的 update_reminder_timestamp() 函数
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

-- 更新 reminder_policy 触发器
DROP TRIGGER IF EXISTS trigger_reminder_policy_updated_at ON reminder_policy;
CREATE TRIGGER trigger_reminder_policy_updated_at
  BEFORE UPDATE ON reminder_policy
  FOR EACH ROW
  EXECUTE FUNCTION update_reminder_timestamp();

-- 更新 reminder_event 触发器
DROP TRIGGER IF EXISTS trigger_reminder_event_updated_at ON reminder_event;
CREATE TRIGGER trigger_reminder_event_updated_at
  BEFORE UPDATE ON reminder_event
  FOR EACH ROW
  EXECUTE FUNCTION update_reminder_timestamp();

-- ============================================
-- 验证
-- ============================================
DO $$
DECLARE
  v_func_exists BOOLEAN;
  v_trigger1_exists BOOLEAN;
  v_trigger2_exists BOOLEAN;
BEGIN
  -- 检查函数是否存在
  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_reminder_timestamp'
  ) INTO v_func_exists;
  
  -- 检查触发器是否存在
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_reminder_policy_updated_at'
  ) INTO v_trigger1_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_reminder_event_updated_at'
  ) INTO v_trigger2_exists;
  
  IF v_func_exists AND v_trigger1_exists AND v_trigger2_exists THEN
    RAISE NOTICE '✅ 提醒系统触发器修复完成！';
    RAISE NOTICE '   - update_reminder_timestamp() 函数已创建';
    RAISE NOTICE '   - reminder_policy 触发器已更新';
    RAISE NOTICE '   - reminder_event 触发器已更新';
  ELSE
    RAISE NOTICE '⚠️ 部分组件未创建:';
    RAISE NOTICE '   - 函数: %', CASE WHEN v_func_exists THEN '✓' ELSE '✗' END;
    RAISE NOTICE '   - policy触发器: %', CASE WHEN v_trigger1_exists THEN '✓' ELSE '✗' END;
    RAISE NOTICE '   - event触发器: %', CASE WHEN v_trigger2_exists THEN '✓' ELSE '✗' END;
  END IF;
END $$;
