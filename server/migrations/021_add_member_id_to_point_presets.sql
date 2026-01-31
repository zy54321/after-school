-- ============================================
-- 家庭成长银行 - 积分预设表成员级改造
-- 执行时机：021_add_member_id_to_point_presets.sql
-- 
-- 用途：将奖励/惩罚规则从家庭级改为成员级
--       每个成员可以有自己独立的规则配置
-- ============================================

-- ============================================
-- 1. 添加 parent_id 和 member_id 字段
-- ============================================

-- 添加 parent_id 字段（允许为空，用于数据迁移过渡）
ALTER TABLE family_point_presets 
ADD COLUMN IF NOT EXISTS parent_id INT;

-- 添加 member_id 字段（允许为空，用于数据迁移过渡）
ALTER TABLE family_point_presets 
ADD COLUMN IF NOT EXISTS member_id INT;

-- 添加外键约束
DO $$
BEGIN
  -- 添加 parent_id 外键（如果不存在）
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_point_presets_parent'
  ) THEN
    ALTER TABLE family_point_presets
    ADD CONSTRAINT fk_point_presets_parent
    FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;

  -- 添加 member_id 外键（如果不存在）
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_point_presets_member'
  ) THEN
    ALTER TABLE family_point_presets
    ADD CONSTRAINT fk_point_presets_member
    FOREIGN KEY (member_id) REFERENCES family_members(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- 2. 创建索引
-- ============================================

CREATE INDEX IF NOT EXISTS idx_point_presets_parent_id 
ON family_point_presets(parent_id);

CREATE INDEX IF NOT EXISTS idx_point_presets_member_id 
ON family_point_presets(member_id);

CREATE INDEX IF NOT EXISTS idx_point_presets_parent_member 
ON family_point_presets(parent_id, member_id);

-- ============================================
-- 3. 添加唯一约束：同一成员同名规则不重复
-- ============================================

-- 先删除可能存在的旧约束（如果有）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'uk_point_presets_member_name'
  ) THEN
    ALTER TABLE family_point_presets
    DROP CONSTRAINT uk_point_presets_member_name;
  END IF;
END $$;

-- 添加唯一约束：(parent_id, member_id, label) 或 (member_id, label)
-- 注意：由于 member_id 已经通过外键关联了 parent_id，所以只需要 (member_id, label) 即可
ALTER TABLE family_point_presets
ADD CONSTRAINT uk_point_presets_member_name
UNIQUE (member_id, label);

-- ============================================
-- 4. 数据迁移：将现有规则复制到每个成员
-- ============================================

DO $$
DECLARE
  v_preset RECORD;
  v_member RECORD;
  v_new_id INT;
BEGIN
  -- 遍历所有现有的预设（没有 parent_id 和 member_id 的旧数据）
  FOR v_preset IN 
    SELECT * FROM family_point_presets 
    WHERE parent_id IS NULL AND member_id IS NULL
  LOOP
    -- 遍历所有成员，为每个成员创建一份规则
    FOR v_member IN 
      SELECT DISTINCT fm.id, fm.parent_id
      FROM family_members fm
    LOOP
      -- 检查是否已存在（避免重复）
      IF NOT EXISTS (
        SELECT 1 FROM family_point_presets
        WHERE member_id = v_member.id 
        AND label = v_preset.label
        AND type = v_preset.type
      ) THEN
        -- 插入新记录
        INSERT INTO family_point_presets (
          label, points, type, icon, category, 
          parent_id, member_id, created_at
        )
        VALUES (
          v_preset.label,
          v_preset.points,
          v_preset.type,
          v_preset.icon,
          COALESCE(v_preset.category, '常规'),
          v_member.parent_id,
          v_member.id,
          v_preset.created_at
        );
      END IF;
    END LOOP;
    
    -- 标记旧规则为已迁移（可选：删除或保留）
    -- 这里我们保留旧规则但标记为 deprecated（通过设置一个特殊标记）
    -- 或者直接删除（如果确定不再需要）
    -- UPDATE family_point_presets SET label = label || ' [已迁移]' WHERE id = v_preset.id;
  END LOOP;
  
  RAISE NOTICE '✅ 数据迁移完成：所有规则已复制到每个成员';
END $$;

-- ============================================
-- 5. 将 member_id 设为 NOT NULL（完成迁移后）
-- ============================================

-- 注意：这一步应该在确认所有数据都已迁移后执行
-- 如果还有旧数据（parent_id 和 member_id 都为 NULL），则先处理
DO $$
BEGIN
  -- 检查是否还有未迁移的数据
  IF EXISTS (
    SELECT 1 FROM family_point_presets 
    WHERE parent_id IS NULL AND member_id IS NULL
  ) THEN
    RAISE NOTICE '⚠️ 警告：仍有未迁移的数据，请检查后再执行 NOT NULL 约束';
  ELSE
    -- 所有数据都已迁移，可以设置 NOT NULL
    ALTER TABLE family_point_presets
    ALTER COLUMN parent_id SET NOT NULL;
    
    ALTER TABLE family_point_presets
    ALTER COLUMN member_id SET NOT NULL;
    
    RAISE NOTICE '✅ member_id 和 parent_id 已设置为 NOT NULL';
  END IF;
END $$;

-- ============================================
-- 6. 添加注释
-- ============================================

COMMENT ON COLUMN family_point_presets.parent_id IS '所属用户ID（冗余字段，用于快速查询）';
COMMENT ON COLUMN family_point_presets.member_id IS '所属成员ID，规则现在按成员级别管理';
COMMENT ON CONSTRAINT uk_point_presets_member_name ON family_point_presets IS '唯一约束：同一成员不能有重复名称的规则';

DO $$
BEGIN
  RAISE NOTICE '✅ 积分预设表成员级改造完成';
END $$;
