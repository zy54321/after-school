# 字典管理功能 - 数据库迁移指南

## 执行顺序

请按照以下顺序执行 SQL 脚本：

### 1. 创建表结构
```bash
psql -U postgres -d your_database_name -f create_feature_dictionary_tables.sql
```

或者在 PostgreSQL 客户端中执行：
```sql
\i create_feature_dictionary_tables.sql
```

### 2. 填充初始数据
```bash
psql -U postgres -d your_database_name -f seed_feature_dictionary_data.sql
```

或者在 PostgreSQL 客户端中执行：
```sql
\i seed_feature_dictionary_data.sql
```

### 3. 迁移现有数据（可选）
如果数据库中已有 `market_features` 表的数据，执行此脚本确保所有类型都在字典中：
```bash
psql -U postgres -d your_database_name -f migrate_existing_features_to_dictionary.sql
```

或者在 PostgreSQL 客户端中执行：
```sql
\i migrate_existing_features_to_dictionary.sql
```

## 验证

执行完成后，可以运行以下 SQL 验证：

```sql
-- 查看所有字典类型
SELECT * FROM feature_dictionary_types ORDER BY geometry_type, sort_order;

-- 查看所有字典字段
SELECT f.*, t.name_zh as type_name 
FROM feature_dictionary_fields f
JOIN feature_dictionary_types t ON f.type_id = t.id
ORDER BY t.geometry_type, t.sort_order, f.sort_order;

-- 查看完整配置（类型+字段）
SELECT 
  t.geometry_type,
  t.type_code,
  t.name_zh,
  COUNT(f.id) as field_count
FROM feature_dictionary_types t
LEFT JOIN feature_dictionary_fields f ON t.id = f.type_id
GROUP BY t.id, t.geometry_type, t.type_code, t.name_zh
ORDER BY t.geometry_type, t.sort_order;
```

## 回滚（如果需要）

如果需要回滚，执行：

```sql
DROP TABLE IF EXISTS feature_dictionary_fields CASCADE;
DROP TABLE IF EXISTS feature_dictionary_types CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
```

