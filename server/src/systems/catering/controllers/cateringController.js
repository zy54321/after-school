const pool = require('../../../shared/config/db');

// ==========================================
// 🥦 1. 食材管理 (Ingredients)
// ==========================================

// 获取食材列表 (按分类排序，方便前端合并显示)
exports.getIngredients = async (req, res) => {
  try {
    // ⭐ 重点：必须 ORDER BY category，否则前端合并单元格会乱
    const result = await pool.query(
      'SELECT * FROM ingredients ORDER BY category DESC, id ASC'
    );
    res.json({ code: 200, data: result.rows });
  } catch (err) {
    res
      .status(500)
      .json({ code: 500, msg: '获取食材失败', error: err.message });
  }
};

// 新增食材 (含 price, source)
exports.createIngredient = async (req, res) => {
  const { name, category, unit, allergen_type, price, source } = req.body; // 👈 取 source
  try {
    const result = await pool.query(
      `INSERT INTO ingredients (name, category, unit, allergen_type, price, source) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        name,
        category,
        unit,
        allergen_type || '无',
        price || 0,
        source || '盒马鲜生',
      ]
    );
    res.json({ code: 200, msg: '新增成功', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ code: 500, msg: '新增失败', error: err.message });
  }
};

// 更新食材 (含 price, source)
exports.updateIngredient = async (req, res) => {
  const { id } = req.params;
  const { name, category, unit, allergen_type, price, source } = req.body; // 👈 取 source
  try {
    const result = await pool.query(
      `UPDATE ingredients 
       SET name=$1, category=$2, unit=$3, allergen_type=$4, price=$5, source=$6 
       WHERE id=$7 RETURNING *`,
      [
        name,
        category,
        unit,
        allergen_type,
        price || 0,
        source || '盒马鲜生',
        id,
      ]
    );
    res.json({ code: 200, msg: '更新成功', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ code: 500, msg: '更新失败', error: err.message });
  }
};

// 删除食材
exports.deleteIngredient = async (req, res) => {
  try {
    await pool.query('DELETE FROM ingredients WHERE id = $1', [req.params.id]);
    res.json({ code: 200, msg: '删除成功' });
  } catch (err) {
    if (err.code === '23503') {
      return res
        .status(400)
        .json({ code: 400, msg: '该食材已被菜品使用，无法删除' });
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
    console.error(err);
    res
      .status(500)
      .json({ code: 500, msg: '获取菜品失败', error: err.message });
  }
};

// 新增菜品
exports.createDish = async (req, res) => {
  const { name, photo_url, description, tags, ingredients } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const dishRes = await client.query(
      `INSERT INTO dishes (name, photo_url, description, tags) VALUES ($1, $2, $3, $4) RETURNING id`,
      [name, photo_url, description, tags || []]
    );
    const dishId = dishRes.rows[0].id;

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

// 图片上传
exports.uploadImage = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ code: 400, msg: '未上传文件' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ code: 200, msg: '上传成功', url: fileUrl });
};

// 更新菜品
exports.updateDish = async (req, res) => {
  const { id } = req.params;
  const { name, photo_url, description, tags, ingredients } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE dishes SET name=$1, photo_url=$2, description=$3, tags=$4 WHERE id=$5`,
      [name, photo_url, description, tags || [], id]
    );

    await client.query('DELETE FROM dish_ingredients WHERE dish_id = $1', [id]);

    if (ingredients && ingredients.length > 0) {
      for (const item of ingredients) {
        await client.query(
          `INSERT INTO dish_ingredients (dish_id, ingredient_id, quantity) VALUES ($1, $2, $3)`,
          [id, item.ingredient_id || item.id, item.quantity || 0]
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
exports.getMenus = async (req, res) => {
  const { start_date, end_date } = req.query;
  try {
    const query = `
      SELECT 
        wm.id, 
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
    res
      .status(500)
      .json({ code: 500, msg: '获取食谱失败', error: err.message });
  }
};

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

exports.removeMenuItem = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM weekly_menus WHERE id = $1', [id]);
    res.json({ code: 200, msg: '移除成功' });
  } catch (err) {
    res.status(500).json({ code: 500, msg: '移除失败' });
  }
};
// ==========================================
// 🛒 4. 智能采购 (Shopping List)
// ==========================================
exports.getShoppingList = async (req, res) => {
  const { start_date, end_date } = req.query;
  try {
    // 核心聚合查询：按 货源 > 分类 > 食材名 分组求和
    const query = `
      SELECT 
        i.source,
        i.category,
        i.name,
        i.unit,
        SUM(di.quantity) as total_quantity, -- 汇总数量
        i.price,
        SUM(di.quantity * i.price) as total_cost -- 估算成本
      FROM weekly_menus wm
      JOIN dish_ingredients di ON wm.dish_id = di.dish_id
      JOIN ingredients i ON di.ingredient_id = i.id
      WHERE wm.plan_date >= $1 AND wm.plan_date <= $2
      GROUP BY i.source, i.category, i.name, i.unit, i.price
      ORDER BY 
        CASE i.source 
          WHEN '盒马鲜生' THEN 1 
          WHEN '山姆' THEN 2 
          WHEN '麦德龙' THEN 3 
          WHEN '叮咚买菜' THEN 4 
          ELSE 5 
        END,
        i.category, 
        i.name
    `;

    const result = await pool.query(query, [start_date, end_date]);

    // 在后端直接把数据按“source”分组，方便前端渲染
    const groupedData = {};
    result.rows.forEach((row) => {
      if (!groupedData[row.source]) {
        groupedData[row.source] = {
          source: row.source,
          items: [],
          totalCost: 0,
        };
      }
      // 格式化数字，保留2位小数，去掉末尾无效的0
      row.total_quantity = parseFloat(
        parseFloat(row.total_quantity).toFixed(2)
      );
      row.total_cost = parseFloat(parseFloat(row.total_cost).toFixed(2));

      groupedData[row.source].items.push(row);
      groupedData[row.source].totalCost += row.total_cost;
    });

    // 转为数组返回
    const responseData = Object.values(groupedData);

    res.json({ code: 200, data: responseData });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ code: 500, msg: '生成采购单失败', error: err.message });
  }
};
// ==========================================
// 💰 5. 成本分析 (Cost Analysis)
// ==========================================
exports.getCostAnalysis = async (req, res) => {
  const { start_date, end_date } = req.query;
  try {
    // 1. 获取每日实际上课/用餐人数 (基于 daily_reports)
    const studentRes = await pool.query(`
      SELECT to_char(report_date, 'YYYY-MM-DD') as date, COUNT(*) as count
      FROM daily_reports
      WHERE report_date >= $1 AND report_date <= $2
      GROUP BY date
    `, [start_date, end_date]);
    
    const studentCounts = {};
    studentRes.rows.forEach(r => studentCounts[r.date] = parseInt(r.count));

    // 2. 计算每日食谱的理论总成本
    // 逻辑：菜单上的菜 -> 对应配方 -> 食材单价 * 数量
    const costRes = await pool.query(`
      SELECT 
        to_char(wm.plan_date, 'YYYY-MM-DD') as date,
        SUM(di.quantity * i.price) as total_cost
      FROM weekly_menus wm
      JOIN dish_ingredients di ON wm.dish_id = di.dish_id
      JOIN ingredients i ON di.ingredient_id = i.id
      WHERE wm.plan_date >= $1 AND wm.plan_date <= $2
      GROUP BY date
      ORDER BY date
    `, [start_date, end_date]);

    // 3. 合并数据
    const data = costRes.rows.map(row => {
      const count = studentCounts[row.date] || 0; // 当天用餐人数
      const total = parseFloat(parseFloat(row.total_cost).toFixed(2));
      
      // 如果没人打卡，人均成本就没法算(分母为0)，暂记为0或等于总成本
      const avg = count > 0 ? parseFloat((total / count).toFixed(2)) : 0;

      return {
        date: row.date,
        total_cost: total,
        student_count: count,
        avg_cost: avg
      };
    });

    res.json({ code: 200, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, msg: '获取成本数据失败', error: err.message });
  }
};