const pool = require('../../../shared/config/db');

// ==========================================
// 🥦 1. 食材管理 (Ingredients)
// ==========================================

// 获取食材列表
exports.getIngredients = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ingredients ORDER BY category, id');
    res.json({ code: 200, data: result.rows });
  } catch (err) {
    res.status(500).json({ code: 500, msg: '获取食材失败', error: err.message });
  }
};

// 新增食材
exports.createIngredient = async (req, res) => {
  const { name, category, unit, allergen_type, price } = req.body; // 👈 取 price
  try {
    const result = await pool.query(
      `INSERT INTO ingredients (name, category, unit, allergen_type, price) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, category, unit, allergen_type || '无', price || 0]
    );
    res.json({ code: 200, msg: '新增成功', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ code: 500, msg: '新增失败', error: err.message });
  }
};

// 删除食材
exports.deleteIngredient = async (req, res) => {
  try {
    await pool.query('DELETE FROM ingredients WHERE id = $1', [req.params.id]);
    res.json({ code: 200, msg: '删除成功' });
  } catch (err) {
    // 捕获外键约束错误 (23503)
    if (err.code === '23503') {
      return res.status(400).json({ code: 400, msg: '该食材已被菜品使用，无法删除' });
    }
    res.status(500).json({ code: 500, msg: '删除失败', error: err.message });
  }
};

// ==========================================
// 🍲 2. 菜品管理 (Dishes)
// ==========================================

// 获取菜品库 (含食材详情)
exports.getDishes = async (req, res) => {
  try {
    // 聚合查询：查出菜品及其关联的食材
    const query = `
      SELECT d.*, 
        COALESCE(
          json_agg(
            json_build_object(
              'ingredient_id', i.id,
              'name', i.name,
              'allergen_type', i.allergen_type,
              'quantity', di.quantity,
              'unit', i.unit
            )
          ) FILTER (WHERE i.id IS NOT NULL), '[]'
        ) as ingredients
      FROM dishes d
      LEFT JOIN dish_ingredients di ON d.id = di.dish_id
      LEFT JOIN ingredients i ON di.ingredient_id = i.id
      GROUP BY d.id
      ORDER BY d.id DESC
    `;
    const result = await pool.query(query);
    res.json({ code: 200, data: result.rows });
  } catch (err) {
    res.status(500).json({ code: 500, msg: '获取菜品失败', error: err.message });
  }
};

// 新增菜品 (事务处理：同时插入菜品和配方)
exports.createDish = async (req, res) => {
  const { name, photo_url, description, tags, ingredients } = req.body; 
  // ingredients 格式: [{ id: 1, quantity: 0.5 }, ...]
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. 插入菜品
    const dishRes = await client.query(
      `INSERT INTO dishes (name, photo_url, description, tags) VALUES ($1, $2, $3, $4) RETURNING id`,
      [name, photo_url, description, tags || []]
    );
    const dishId = dishRes.rows[0].id;

    // 2. 插入配方 (如果有)
    if (ingredients && ingredients.length > 0) {
      for (const item of ingredients) {
        await client.query(
          `INSERT INTO dish_ingredients (dish_id, ingredient_id, quantity) VALUES ($1, $2, $3)`,
          [dishId, item.id, item.quantity || 0]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ code: 200, msg: '菜品创建成功', data: { id: dishId } });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ code: 500, msg: '创建失败', error: err.message });
  } finally {
    client.release();
  }
};

exports.uploadImage = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ code: 400, msg: '未上传文件' });
  }
  // 返回可访问的 URL (假设后端跑在 3000 端口，前端可以通过相对路径访问)
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ code: 200, msg: '上传成功', url: fileUrl });
};

// 删除菜品
exports.deleteDish = async (req, res) => {
  try {
    await pool.query('DELETE FROM dishes WHERE id = $1', [req.params.id]);
    res.json({ code: 200, msg: '删除成功' });
  } catch (err) {
    res.status(500).json({ code: 500, msg: '删除失败', error: err.message });
  }
};

// ==========================================
// 📅 3. 食谱排期 (Menus)
// ==========================================

// 获取某一周期的食谱 (按日期范围)
exports.getMenus = async (req, res) => {
  const { start_date, end_date } = req.query;
  try {
    const query = `
      SELECT 
        wm.id, 
        -- 👇👇👇 核心修改：强制转为字符串 (YYYY-MM-DD)，避免时区偏移 👇👇👇
        to_char(wm.plan_date, 'YYYY-MM-DD') as plan_date, 
        wm.meal_type, 
        d.id as dish_id, d.name as dish_name, d.photo_url, d.tags,
        EXISTS (
          SELECT 1 FROM dish_ingredients di
          JOIN ingredients i ON di.ingredient_id = i.id
          WHERE di.dish_id = d.id AND i.allergen_type != '无'
        ) as has_allergen,
        (
          SELECT string_agg(DISTINCT i.allergen_type, ',') 
          FROM dish_ingredients di
          JOIN ingredients i ON di.ingredient_id = i.id
          WHERE di.dish_id = d.id AND i.allergen_type != '无'
        ) as allergens
      FROM weekly_menus wm
      JOIN dishes d ON wm.dish_id = d.id
      WHERE wm.plan_date >= $1 AND wm.plan_date <= $2
      ORDER BY wm.plan_date, wm.meal_type
    `;
    const result = await pool.query(query, [start_date, end_date]);
    res.json({ code: 200, data: result.rows });
  } catch (err) {
    res.status(500).json({ code: 500, msg: '获取食谱失败', error: err.message });
  }
};

// 排期：添加一道菜到某天
exports.addMenuItem = async (req, res) => {
  const { plan_date, meal_type, dish_id } = req.body;
  try {
    await pool.query(
      `INSERT INTO weekly_menus (plan_date, meal_type, dish_id) VALUES ($1, $2, $3)
       ON CONFLICT (plan_date, meal_type, dish_id) DO NOTHING`,
      [plan_date, meal_type, dish_id]
    );
    res.json({ code: 200, msg: '添加成功' });
  } catch (err) {
    res.status(500).json({ code: 500, msg: '添加失败', error: err.message });
  }
};

// 排期：移除一道菜
exports.removeMenuItem = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM weekly_menus WHERE id = $1', [id]);
    res.json({ code: 200, msg: '移除成功' });
  } catch (err) {
    res.status(500).json({ code: 500, msg: '移除失败' });
  }
};

// 更新食材
exports.updateIngredient = async (req, res) => {
  const { id } = req.params;
  const { name, category, unit, allergen_type, price } = req.body;
  try {
    const result = await pool.query(
      `UPDATE ingredients SET name=$1, category=$2, unit=$3, allergen_type=$4, price=$5 WHERE id=$6 RETURNING *`,
      [name, category, unit, allergen_type, price || 0, id]
    );
    res.json({ code: 200, msg: '更新成功', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ code: 500, msg: '更新失败', error: err.message });
  }
};

// 更新菜品 (包含配方更新)
exports.updateDish = async (req, res) => {
  const { id } = req.params;
  const { name, photo_url, description, tags, ingredients } = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. 更新菜品基本信息
    await client.query(
      `UPDATE dishes SET name=$1, photo_url=$2, description=$3, tags=$4 WHERE id=$5`,
      [name, photo_url, description, tags || [], id]
    );

    // 2. 更新配方 (策略：全删全加，简单粗暴且有效)
    await client.query('DELETE FROM dish_ingredients WHERE dish_id = $1', [id]);
    
    if (ingredients && ingredients.length > 0) {
      for (const item of ingredients) {
        await client.query(
          `INSERT INTO dish_ingredients (dish_id, ingredient_id, quantity) VALUES ($1, $2, $3)`,
          [id, item.ingredient_id || item.id, item.quantity || 0] // 兼容两种字段名
        );
      }
    }

    await client.query('COMMIT');
    res.json({ code: 200, msg: '菜品更新成功' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ code: 500, msg: '更新失败', error: err.message });
  } finally {
    client.release();
  }
};