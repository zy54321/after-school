-- ============================================
-- 字典管理功能 - 数据库表创建脚本
-- 创建时间: 2025-01-XX
-- 说明: 为商业分析地图系统创建字典类型和字段管理表
-- ============================================

-- 1. 字典类型表（按点线面分类）
CREATE TABLE IF NOT EXISTS feature_dictionary_types (
  id SERIAL PRIMARY KEY,
  geometry_type VARCHAR(20) NOT NULL CHECK (geometry_type IN ('Point', 'LineString', 'Polygon')),
  type_code VARCHAR(50) NOT NULL UNIQUE,
  name_zh VARCHAR(100) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  color VARCHAR(7) DEFAULT '#409EFF', -- 颜色代码，如 '#409EFF'
  icon VARCHAR(50), -- 图标标识，如 'school', 'home' 等
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 字典字段表（属性字段定义）
CREATE TABLE IF NOT EXISTS feature_dictionary_fields (
  id SERIAL PRIMARY KEY,
  type_id INTEGER NOT NULL REFERENCES feature_dictionary_types(id) ON DELETE CASCADE,
  field_key VARCHAR(50) NOT NULL, -- 字段键名，如 'student_count', 'price' 等
  name_zh VARCHAR(100) NOT NULL, -- 中文标签
  name_en VARCHAR(100) NOT NULL, -- 英文标签
  field_type VARCHAR(20) NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'boolean', 'select', 'rate', 'textarea', 'url')),
  is_required BOOLEAN DEFAULT false,
  default_value TEXT, -- 默认值
  placeholder_zh VARCHAR(200), -- 中文占位符
  placeholder_en VARCHAR(200), -- 英文占位符
  suffix VARCHAR(20), -- 单位后缀，如 '元', '人', '户' 等
  validation_rule JSONB, -- 验证规则，如 {"min": 0, "max": 100, "pattern": "..."}
  options JSONB, -- select 类型的选项，如 [{"label": "选项1", "value": "opt1"}]
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(type_id, field_key)
);

-- 3. 创建索引
CREATE INDEX idx_dictionary_types_geometry ON feature_dictionary_types(geometry_type);
CREATE INDEX idx_dictionary_types_active ON feature_dictionary_types(is_active);
CREATE INDEX idx_dictionary_fields_type ON feature_dictionary_fields(type_id);
CREATE INDEX idx_dictionary_fields_sort ON feature_dictionary_fields(type_id, sort_order);

-- 4. 创建触发器函数：自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. 为两个表添加触发器
CREATE TRIGGER update_feature_dictionary_types_updated_at
  BEFORE UPDATE ON feature_dictionary_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feature_dictionary_fields_updated_at
  BEFORE UPDATE ON feature_dictionary_fields
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. 添加注释
COMMENT ON TABLE feature_dictionary_types IS '要素字典类型表，按点线面分类管理要素类型';
COMMENT ON TABLE feature_dictionary_fields IS '要素字典字段表，定义每个类型的属性字段';
COMMENT ON COLUMN feature_dictionary_types.geometry_type IS '几何类型：Point(点), LineString(线), Polygon(面)';
COMMENT ON COLUMN feature_dictionary_types.type_code IS '类型代码，唯一标识，如 kindergarten, competitor 等';
COMMENT ON COLUMN feature_dictionary_fields.field_type IS '字段类型：text, number, date, boolean, select, rate, textarea, url';
COMMENT ON COLUMN feature_dictionary_fields.validation_rule IS '验证规则JSON，如 {"min": 0, "max": 100, "pattern": "^[0-9]+$"}';
COMMENT ON COLUMN feature_dictionary_fields.options IS 'select类型选项JSON，如 [{"label": "选项1", "value": "opt1"}]';

