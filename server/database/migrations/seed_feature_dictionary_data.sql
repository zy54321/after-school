-- ============================================
-- 字典管理功能 - 初始数据填充脚本
-- 说明: 将现有硬编码的类型和字段迁移到字典表
-- ============================================

-- 1. 插入点要素类型 (Point)
INSERT INTO feature_dictionary_types (geometry_type, type_code, name_zh, name_en, color, icon, sort_order) VALUES
  ('Point', 'own', '我方校区', 'Our Campus', '#409EFF', 'school', 1),
  ('Point', 'competitor', '竞争对手', 'Competitor', '#F56C6C', 'competitor', 2),
  ('Point', 'school', '公立学校', 'Public School', '#67C23A', 'school', 3),
  ('Point', 'community', '住宅小区', 'Residential Community', '#E6A23C', 'home', 4)
ON CONFLICT (type_code) DO NOTHING;

-- 2. 插入线要素类型 (LineString)
INSERT INTO feature_dictionary_types (geometry_type, type_code, name_zh, name_en, color, icon, sort_order) VALUES
  ('LineString', 'route', '接送路线', 'Pickup Route', '#00FFFF', 'route', 1),
  ('LineString', 'block', '竞对拦截线', 'Competitor Block Line', '#FF00FF', 'block', 2)
ON CONFLICT (type_code) DO NOTHING;

-- 3. 插入面要素类型 (Polygon)
INSERT INTO feature_dictionary_types (geometry_type, type_code, name_zh, name_en, color, icon, sort_order) VALUES
  ('Polygon', 'hotzone', '辐射热区', 'Hot Zone', '#FFFF00', 'zone', 1)
ON CONFLICT (type_code) DO NOTHING;

-- 4. 获取类型ID（用于插入字段）
DO $$
DECLARE
  competitor_type_id INTEGER;
  community_type_id INTEGER;
  school_type_id INTEGER;
  route_type_id INTEGER;
BEGIN
  -- 获取类型ID
  SELECT id INTO competitor_type_id FROM feature_dictionary_types WHERE type_code = 'competitor';
  SELECT id INTO community_type_id FROM feature_dictionary_types WHERE type_code = 'community';
  SELECT id INTO school_type_id FROM feature_dictionary_types WHERE type_code = 'school';
  SELECT id INTO route_type_id FROM feature_dictionary_types WHERE type_code = 'route';

  -- 5. 插入竞争对手类型的字段
  IF competitor_type_id IS NOT NULL THEN
    INSERT INTO feature_dictionary_fields (type_id, field_key, name_zh, name_en, field_type, suffix, validation_rule, sort_order) VALUES
      (competitor_type_id, 'price', '预估客单价', 'Estimated Price', 'number', '元', '{"min": 0}', 1),
      (competitor_type_id, 'students', '预估学员数', 'Estimated Students', 'number', '人', '{"min": 0}', 2),
      (competitor_type_id, 'threat', '威胁等级', 'Threat Level', 'rate', NULL, '{"max": 5}', 3)
    ON CONFLICT (type_id, field_key) DO NOTHING;
  END IF;

  -- 6. 插入住宅小区类型的字段
  IF community_type_id IS NOT NULL THEN
    INSERT INTO feature_dictionary_fields (type_id, field_key, name_zh, name_en, field_type, suffix, placeholder_zh, placeholder_en, sort_order) VALUES
      (community_type_id, 'avg_price', '挂牌均价', 'Average Price', 'number', '元/㎡', NULL, NULL, 1),
      (community_type_id, 'households', '总户数', 'Total Households', 'number', '户', NULL, NULL, 2),
      (community_type_id, 'age', '建筑年代', 'Building Age', 'text', NULL, '如: 2010年', 'e.g.: 2010', 3)
    ON CONFLICT (type_id, field_key) DO NOTHING;
  END IF;

  -- 7. 插入公立学校类型的字段
  IF school_type_id IS NOT NULL THEN
    INSERT INTO feature_dictionary_fields (type_id, field_key, name_zh, name_en, field_type, suffix, placeholder_zh, placeholder_en, sort_order) VALUES
      (school_type_id, 'level', '学校等级', 'School Level', 'text', NULL, '省重点/市重点', 'Provincial/Municipal Key', 1),
      (school_type_id, 'students', '在校生总数', 'Total Students', 'number', '人', NULL, NULL, 2)
    ON CONFLICT (type_id, field_key) DO NOTHING;
  END IF;

  -- 8. 插入接送路线类型的字段
  IF route_type_id IS NOT NULL THEN
    INSERT INTO feature_dictionary_fields (type_id, field_key, name_zh, name_en, field_type, suffix, validation_rule, sort_order) VALUES
      (route_type_id, 'duration', '预计耗时', 'Estimated Duration', 'number', '分钟', '{"min": 0}', 1),
      (route_type_id, 'safety', '安全系数', 'Safety Rating', 'rate', NULL, '{"max": 5}', 2)
    ON CONFLICT (type_id, field_key) DO NOTHING;
  END IF;
END $$;

