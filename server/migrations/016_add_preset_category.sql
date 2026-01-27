-- 1. 添加分类字段，默认为 '常规'
ALTER TABLE family_point_presets ADD COLUMN category VARCHAR(50) DEFAULT '常规';

-- 2. (可选) 刷一下旧数据的分类，让它们看起来不那么单调
UPDATE family_point_presets SET category = '学习' WHERE label LIKE '%作业%' OR label LIKE '%阅读%' OR label LIKE '%书%';
UPDATE family_point_presets SET category = '生活' WHERE label LIKE '%家务%' OR label LIKE '%睡%' OR label LIKE '%吃%' OR label LIKE '%牙%';
UPDATE family_point_presets SET category = '行为' WHERE label LIKE '%礼貌%' OR label LIKE '%脾气%' OR label LIKE '%话%';