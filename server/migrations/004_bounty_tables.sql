-- ============================================
-- 家庭成长银行 - 悬赏任务系统表 Migration
-- 执行时机：004_bounty_tables.sql
-- 命令示例：psql -U your_user -d your_database -f 004_bounty_tables.sql
-- ============================================

-- ============================================
-- 1. 悬赏任务表 (bounty_task)
-- ============================================
-- 成员发布悬赏任务，其他成员可以领取完成
CREATE TABLE IF NOT EXISTS bounty_task (
  id SERIAL PRIMARY KEY,
  parent_id INT NOT NULL,                              -- 所属家庭（用户ID）
  publisher_member_id INT NOT NULL,                    -- 发布者成员ID
  
  -- 任务信息
  title VARCHAR(200) NOT NULL,                         -- 任务标题
  description TEXT,                                    -- 任务描述/要求
  bounty_points INT NOT NULL CHECK (bounty_points > 0), -- 悬赏积分
  escrow_points INT NOT NULL DEFAULT 0,                -- 托管积分（从发布者扣除）
  
  -- 时间限制
  due_at TIMESTAMP,                                    -- 截止时间
  
  -- 验收标准
  accept_criteria TEXT,                                -- 验收标准描述
  
  -- 状态管理
  status VARCHAR(30) NOT NULL DEFAULT 'open',          -- open/claimed/submitted/approved/rejected/cancelled/expired
  
  -- 关联（可选：与 GitHub Issue 关联等）
  issue_id VARCHAR(100),                               -- 外部任务ID（如 GitHub Issue）
  
  -- 时间戳
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 悬赏任务索引
CREATE INDEX IF NOT EXISTS idx_bounty_task_parent_id ON bounty_task(parent_id);
CREATE INDEX IF NOT EXISTS idx_bounty_task_publisher ON bounty_task(publisher_member_id);
CREATE INDEX IF NOT EXISTS idx_bounty_task_status ON bounty_task(status);
CREATE INDEX IF NOT EXISTS idx_bounty_task_due_at ON bounty_task(due_at);
CREATE INDEX IF NOT EXISTS idx_bounty_task_created_at ON bounty_task(created_at DESC);

-- 悬赏任务外键
ALTER TABLE bounty_task 
  DROP CONSTRAINT IF EXISTS fk_bounty_task_parent,
  ADD CONSTRAINT fk_bounty_task_parent 
    FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE bounty_task 
  DROP CONSTRAINT IF EXISTS fk_bounty_task_publisher,
  ADD CONSTRAINT fk_bounty_task_publisher 
    FOREIGN KEY (publisher_member_id) REFERENCES family_members(id) ON DELETE CASCADE;

COMMENT ON TABLE bounty_task IS '悬赏任务表 - 成员发布悬赏任务供其他成员领取完成';
COMMENT ON COLUMN bounty_task.status IS '状态：open=开放中, claimed=已被领取, submitted=已提交待审核, approved=已通过, rejected=已拒绝, cancelled=已取消, expired=已过期';
COMMENT ON COLUMN bounty_task.bounty_points IS '悬赏积分金额';
COMMENT ON COLUMN bounty_task.escrow_points IS '托管积分（发布时从发布者扣除，完成后转给完成者）';
COMMENT ON COLUMN bounty_task.accept_criteria IS '任务验收标准，用于审核参考';
COMMENT ON COLUMN bounty_task.issue_id IS '外部任务关联ID，如 GitHub Issue 编号';

-- ============================================
-- 2. 任务领取表 (task_claim)
-- ============================================
-- 记录成员领取悬赏任务的情况
CREATE TABLE IF NOT EXISTS task_claim (
  id SERIAL PRIMARY KEY,
  task_id INT NOT NULL,                                -- 关联的悬赏任务ID
  claimer_member_id INT NOT NULL,                      -- 领取者成员ID
  
  -- 领取信息
  claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,      -- 领取时间
  
  -- 状态
  status VARCHAR(20) NOT NULL DEFAULT 'active',        -- active/submitted/approved/rejected/cancelled
  
  -- 提交信息
  submitted_at TIMESTAMP,                              -- 提交时间
  submission_note TEXT,                                -- 提交说明
  
  -- 时间戳
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 任务领取索引
CREATE INDEX IF NOT EXISTS idx_task_claim_task_id ON task_claim(task_id);
CREATE INDEX IF NOT EXISTS idx_task_claim_claimer ON task_claim(claimer_member_id);
CREATE INDEX IF NOT EXISTS idx_task_claim_status ON task_claim(status);
CREATE INDEX IF NOT EXISTS idx_task_claim_claimed_at ON task_claim(claimed_at DESC);

-- 确保每个任务只能被一个成员领取（当前状态为 active）
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_claim_unique_active 
  ON task_claim(task_id) 
  WHERE status = 'active';

-- 任务领取外键
ALTER TABLE task_claim 
  DROP CONSTRAINT IF EXISTS fk_task_claim_task,
  ADD CONSTRAINT fk_task_claim_task 
    FOREIGN KEY (task_id) REFERENCES bounty_task(id) ON DELETE CASCADE;

ALTER TABLE task_claim 
  DROP CONSTRAINT IF EXISTS fk_task_claim_claimer,
  ADD CONSTRAINT fk_task_claim_claimer 
    FOREIGN KEY (claimer_member_id) REFERENCES family_members(id) ON DELETE CASCADE;

COMMENT ON TABLE task_claim IS '任务领取表 - 记录成员领取悬赏任务';
COMMENT ON COLUMN task_claim.status IS '状态：active=进行中, submitted=已提交, approved=已通过, rejected=已拒绝, cancelled=已取消';
COMMENT ON COLUMN task_claim.submission_note IS '提交时的说明，描述完成情况';

-- ============================================
-- 3. 任务审核表 (task_review)
-- ============================================
-- 记录任务的审核历史
CREATE TABLE IF NOT EXISTS task_review (
  id SERIAL PRIMARY KEY,
  task_id INT NOT NULL,                                -- 关联的悬赏任务ID
  claim_id INT,                                        -- 关联的领取记录ID（可选）
  reviewer_member_id INT NOT NULL,                     -- 审核者成员ID
  
  -- 审核决定
  decision VARCHAR(20) NOT NULL,                       -- approved/rejected
  comment TEXT,                                        -- 审核意见
  
  -- 时间戳
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 任务审核索引
CREATE INDEX IF NOT EXISTS idx_task_review_task_id ON task_review(task_id);
CREATE INDEX IF NOT EXISTS idx_task_review_claim_id ON task_review(claim_id);
CREATE INDEX IF NOT EXISTS idx_task_review_reviewer ON task_review(reviewer_member_id);
CREATE INDEX IF NOT EXISTS idx_task_review_decision ON task_review(decision);
CREATE INDEX IF NOT EXISTS idx_task_review_created_at ON task_review(created_at DESC);

-- 任务审核外键
ALTER TABLE task_review 
  DROP CONSTRAINT IF EXISTS fk_task_review_task,
  ADD CONSTRAINT fk_task_review_task 
    FOREIGN KEY (task_id) REFERENCES bounty_task(id) ON DELETE CASCADE;

ALTER TABLE task_review 
  DROP CONSTRAINT IF EXISTS fk_task_review_claim,
  ADD CONSTRAINT fk_task_review_claim 
    FOREIGN KEY (claim_id) REFERENCES task_claim(id) ON DELETE SET NULL;

ALTER TABLE task_review 
  DROP CONSTRAINT IF EXISTS fk_task_review_reviewer,
  ADD CONSTRAINT fk_task_review_reviewer 
    FOREIGN KEY (reviewer_member_id) REFERENCES family_members(id) ON DELETE CASCADE;

COMMENT ON TABLE task_review IS '任务审核表 - 记录悬赏任务的审核历史';
COMMENT ON COLUMN task_review.decision IS '审核决定：approved=通过, rejected=拒绝';
COMMENT ON COLUMN task_review.comment IS '审核意见/理由';

-- ============================================
-- 4. 更新时间触发器
-- ============================================
-- bounty_task 更新时间触发器
CREATE OR REPLACE FUNCTION update_bounty_task_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_bounty_task_updated_at ON bounty_task;
CREATE TRIGGER trigger_bounty_task_updated_at
  BEFORE UPDATE ON bounty_task
  FOR EACH ROW
  EXECUTE FUNCTION update_bounty_task_timestamp();

-- task_claim 更新时间触发器
CREATE OR REPLACE FUNCTION update_task_claim_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_task_claim_updated_at ON task_claim;
CREATE TRIGGER trigger_task_claim_updated_at
  BEFORE UPDATE ON task_claim
  FOR EACH ROW
  EXECUTE FUNCTION update_task_claim_timestamp();

-- ============================================
-- 5. 悬赏任务详情视图
-- ============================================
CREATE OR REPLACE VIEW v_bounty_task_detail AS
SELECT 
  bt.*,
  pm.name AS publisher_name,
  pm.avatar AS publisher_avatar,
  
  -- 领取信息
  tc.id AS claim_id,
  tc.claimer_member_id,
  tc.claimed_at,
  tc.status AS claim_status,
  tc.submitted_at,
  cm.name AS claimer_name,
  cm.avatar AS claimer_avatar,
  
  -- 统计
  (SELECT COUNT(*) FROM task_claim WHERE task_id = bt.id) AS total_claims,
  (SELECT COUNT(*) FROM task_review WHERE task_id = bt.id) AS total_reviews

FROM bounty_task bt
LEFT JOIN family_members pm ON bt.publisher_member_id = pm.id
LEFT JOIN task_claim tc ON tc.task_id = bt.id AND tc.status = 'active'
LEFT JOIN family_members cm ON tc.claimer_member_id = cm.id;

COMMENT ON VIEW v_bounty_task_detail IS '悬赏任务详情视图 - 包含发布者、当前领取者等信息';

-- ============================================
-- 完成提示
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ 悬赏任务表创建完成！';
  RAISE NOTICE '   - bounty_task: 悬赏任务表';
  RAISE NOTICE '   - task_claim: 任务领取表';
  RAISE NOTICE '   - task_review: 任务审核表';
  RAISE NOTICE '   - v_bounty_task_detail: 任务详情视图';
END $$;
