-- 创建积分预设表
CREATE TABLE IF NOT EXISTS family_point_presets (
    id SERIAL PRIMARY KEY,
    label VARCHAR(50) NOT NULL,
    points INTEGER NOT NULL DEFAULT 10,
    type VARCHAR(10) NOT NULL CHECK (type IN ('add', 'deduct')),
    icon VARCHAR(20) DEFAULT '🌟',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认种子数据
INSERT INTO family_point_presets (label, points, type, icon) VALUES
('做家务', 10, 'add', '🧹'),
('完成作业', 20, 'add', '📚'),
('阅读打卡', 15, 'add', '📖'),
('运动锻炼', 20, 'add', '🏃'),
('早睡早起', 10, 'add', '🌅'),
('表现优秀', 50, 'add', '🌟'),
('未完成作业', 20, 'deduct', '❌'),
('看电视超时', 15, 'deduct', '📺'),
('晚睡', 10, 'deduct', '🌙'),
('乱发脾气', 20, 'deduct', '😤'),
('不讲卫生', 10, 'deduct', '🦠'),
('挑食', 5, 'deduct', '🥦')
ON CONFLICT DO NOTHING;