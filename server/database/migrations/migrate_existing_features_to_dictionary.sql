-- ============================================
-- 字典管理功能 - 数据迁移脚本
-- 说明: 确保现有 market_features 表中的所有 category 都在字典表中存在
-- ============================================

-- 检查并创建缺失的字典类型（如果 market_features 表中有新的 category）
DO $$
DECLARE
  existing_category RECORD;
  type_exists BOOLEAN;
BEGIN
  -- 遍历 market_features 表中的所有唯一 category
  FOR existing_category IN 
    SELECT DISTINCT category FROM market_features WHERE category IS NOT NULL
  LOOP
    -- 检查该 category 是否已存在于字典表中
    SELECT EXISTS(
      SELECT 1 FROM feature_dictionary_types WHERE type_code = existing_category.category
    ) INTO type_exists;
    
    -- 如果不存在，根据 feature_type 推断 geometry_type 并创建
    IF NOT type_exists THEN
      INSERT INTO feature_dictionary_types (geometry_type, type_code, name_zh, name_en, color, sort_order)
      SELECT 
        CASE 
          WHEN feature_type = 'Point' THEN 'Point'
          WHEN feature_type = 'LineString' THEN 'LineString'
          WHEN feature_type = 'Polygon' THEN 'Polygon'
          ELSE 'Point' -- 默认值
        END as geometry_type,
        existing_category.category as type_code,
        existing_category.category as name_zh, -- 临时名称，需要手动更新
        existing_category.category as name_en, -- 临时名称，需要手动更新
        '#888888' as color, -- 默认颜色
        999 as sort_order
      FROM market_features
      WHERE category = existing_category.category
      LIMIT 1
      ON CONFLICT (type_code) DO NOTHING;
      
      RAISE NOTICE '已自动创建字典类型: %', existing_category.category;
    END IF;
  END LOOP;
END $$;

-- 验证：显示所有字典类型及其使用情况
SELECT 
  t.type_code,
  t.name_zh,
  t.geometry_type,
  COUNT(f.id) as usage_count
FROM feature_dictionary_types t
LEFT JOIN market_features f ON f.category = t.type_code
GROUP BY t.id, t.type_code, t.name_zh, t.geometry_type
ORDER BY t.geometry_type, t.sort_order;

