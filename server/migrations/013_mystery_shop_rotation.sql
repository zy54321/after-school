-- ============================================
-- 家庭成长银行 - 神秘商店 Rotation 表迁移
-- 执行时机：Step B5 神秘商店改造
-- ============================================

-- ============================================
-- 1. 创建 mystery_shop_rotation 表（家庭级）
-- ============================================
-- 每次刷新生成一个 rotation，全家共享
-- offers 通过 metadata.rotation_id 关联

CREATE TABLE IF NOT EXISTS mystery_shop_rotation (
  id SERIAL PRIMARY KEY,
  parent_id INT NOT NULL,                          -- 所属家庭
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 生成时间
  expires_at TIMESTAMP NOT NULL,                   -- 过期时间
  offer_count INT DEFAULT 0,                       -- 生成的 offer 数量
  refresh_type VARCHAR(20) DEFAULT 'free',         -- 刷新类型：free/paid
  payer_member_id INT,                             -- 付费刷新时的付款人（可为空）
  config JSONB DEFAULT '{}',                       -- 配置快照
  status VARCHAR(20) DEFAULT 'active',             -- 状态：active/expired/replaced
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_mystery_rotation_parent 
    FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_mystery_rotation_payer 
    FOREIGN KEY (payer_member_id) REFERENCES family_members(id) ON DELETE SET NULL
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_mystery_rotation_parent_id 
  ON mystery_shop_rotation(parent_id);
CREATE INDEX IF NOT EXISTS idx_mystery_rotation_parent_status 
  ON mystery_shop_rotation(parent_id, status);
CREATE INDEX IF NOT EXISTS idx_mystery_rotation_expires 
  ON mystery_shop_rotation(expires_at);

-- 注释
COMMENT ON TABLE mystery_shop_rotation IS '神秘商店轮次表（家庭级），每次刷新生成一条记录';
COMMENT ON COLUMN mystery_shop_rotation.parent_id IS '所属家庭（用户ID）';
COMMENT ON COLUMN mystery_shop_rotation.expires_at IS '本轮商品过期时间';
COMMENT ON COLUMN mystery_shop_rotation.refresh_type IS '刷新类型：free=免费, paid=付费';
COMMENT ON COLUMN mystery_shop_rotation.payer_member_id IS '付费刷新的付款成员（仅 paid 类型有值）';
COMMENT ON COLUMN mystery_shop_rotation.status IS '状态：active=当前有效, expired=已过期, replaced=已被新轮次替换';

-- ============================================
-- 2. 更新时间触发器
-- ============================================
CREATE OR REPLACE FUNCTION update_mystery_rotation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_mystery_rotation_updated_at ON mystery_shop_rotation;
CREATE TRIGGER trigger_mystery_rotation_updated_at
  BEFORE UPDATE ON mystery_shop_rotation
  FOR EACH ROW
  EXECUTE FUNCTION update_mystery_rotation_timestamp();

-- ============================================
-- 3. 将现有神秘商店 offers 迁移到 rotation 体系（可选）
-- ============================================
-- 如果已有 mystery_shop offers，创建一个虚拟 rotation 来关联它们
DO $$
DECLARE
  v_parent_id INT;
  v_rotation_id INT;
  v_count INT;
BEGIN
  -- 遍历每个有活跃神秘商店商品的家庭（跳过无效的 parent_id）
  FOR v_parent_id IN 
    SELECT DISTINCT o.parent_id FROM family_offer o
    JOIN users u ON o.parent_id = u.id  -- 确保 parent_id 有效
    WHERE o.offer_type = 'mystery_shop' AND o.is_active = TRUE AND o.parent_id IS NOT NULL
  LOOP
    -- 检查是否已有 rotation
    SELECT id INTO v_rotation_id 
    FROM mystery_shop_rotation 
    WHERE parent_id = v_parent_id AND status = 'active'
    LIMIT 1;
    
    IF v_rotation_id IS NULL THEN
      -- 创建虚拟 rotation
      INSERT INTO mystery_shop_rotation (parent_id, expires_at, status)
      SELECT v_parent_id, 
             COALESCE(MAX(valid_until), CURRENT_TIMESTAMP + INTERVAL '24 hours'),
             'active'
      FROM family_offer 
      WHERE parent_id = v_parent_id 
        AND offer_type = 'mystery_shop' 
        AND is_active = TRUE
      RETURNING id INTO v_rotation_id;
      
      -- 更新 offers 的 metadata 关联 rotation_id
      UPDATE family_offer 
      SET metadata = jsonb_set(COALESCE(metadata, '{}'), '{rotation_id}', to_jsonb(v_rotation_id))
      WHERE parent_id = v_parent_id 
        AND offer_type = 'mystery_shop' 
        AND is_active = TRUE;
        
      -- 更新 offer_count
      SELECT COUNT(*) INTO v_count 
      FROM family_offer 
      WHERE parent_id = v_parent_id 
        AND offer_type = 'mystery_shop' 
        AND is_active = TRUE;
        
      UPDATE mystery_shop_rotation 
      SET offer_count = v_count 
      WHERE id = v_rotation_id;
      
      RAISE NOTICE '为家庭 % 创建了虚拟 rotation (id=%), 包含 % 个商品', 
        v_parent_id, v_rotation_id, v_count;
    END IF;
  END LOOP;
END $$;

-- ============================================
-- 完成提示
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ 神秘商店 Rotation 迁移完成！';
  RAISE NOTICE '   - 新增表: mystery_shop_rotation（家庭级轮次表）';
  RAISE NOTICE '   - offers 通过 metadata.rotation_id 关联轮次';
  RAISE NOTICE '   - 刷新是家庭共享的，付费刷新时 member_id 只是付款人';
END $$;
