const pool = require('../../../shared/config/db');

// ==========================================
// 🥦 1. 食材管理 (Ingredients)
// ==========================================

// 获取食材列表
exports.getIngredients = async (req, res) => {
  try {
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

// 新增食材
exports.createIngredient = async (req, res) => {
  const { name, category, unit, allergen_type, price, source } = req.body;
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

// 更新食材
exports.updateIngredient = async (req, res) => {
  const { id } = req.params;
  const { name, category, unit, allergen_type, price, source } = req.body;
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

// 获取菜品库
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
              'unit', i.unit,
              'source', i.source
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
  if (!req.file) return res.status(400).json({ code: 400, msg: '未上传文件' });
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
  try {
    await pool.query('DELETE FROM weekly_menus WHERE id = $1', [req.params.id]);
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
    const countRes = await pool.query('SELECT count(*) FROM students');
    const studentCount = parseInt(countRes.rows[0].count) || 0;

    const query = `
      SELECT 
        i.source,
        i.category,
        i.name,
        i.unit,
        SUM(di.quantity) as benchmark_total,
        i.price
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
        END, i.category, i.name
    `;

    const result = await pool.query(query, [start_date, end_date]);

    const groupedData = {};
    result.rows.forEach((row) => {
      if (!groupedData[row.source]) {
        groupedData[row.source] = {
          source: row.source,
          items: [],
          totalCost: 0,
        };
      }

      const actualQuantity =
        (parseFloat(row.benchmark_total) / 10) * studentCount;
      const actualCost = actualQuantity * parseFloat(row.price);

      const item = {
        category: row.category,
        name: row.name,
        unit: row.unit,
        price: row.price,
        total_quantity: parseFloat(actualQuantity.toFixed(2)),
        total_cost: parseFloat(actualCost.toFixed(2)),
      };

      groupedData[row.source].items.push(item);
      groupedData[row.source].totalCost += item.total_cost;
    });

    Object.values(groupedData).forEach((g) => {
      g.totalCost = parseFloat(g.totalCost.toFixed(2));
    });

    res.json({ code: 200, data: Object.values(groupedData) });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ code: 500, msg: '生成采购单失败', error: err.message });
  }
};

// ==========================================
// 💰 5. 成本分析 (Cost Analysis) - 双维度升级
// ==========================================
exports.getCostAnalysis = async (req, res) => {
  const { start_date, end_date } = req.query;
  try {
    // 1. 获取兜底人数
    const activeRes = await pool.query('SELECT count(*) FROM students');
    const activeCount = parseInt(activeRes.rows[0].count) || 0;

    // 2. 获取每日实际人数
    const studentRes = await pool.query(
      `SELECT to_char(report_date, 'YYYY-MM-DD') as date, COUNT(*) as count
       FROM daily_reports
       WHERE report_date >= $1 AND report_date <= $2
       GROUP BY date`,
      [start_date, end_date]
    );
    const studentCounts = {};
    studentRes.rows.forEach((r) => (studentCounts[r.date] = parseInt(r.count)));

    // 3. 计算“10人基准成本” (每日总计)
    const costRes = await pool.query(
      `SELECT 
         to_char(wm.plan_date, 'YYYY-MM-DD') as date,
         SUM(di.quantity * i.price) as benchmark_cost_10
       FROM weekly_menus wm
       JOIN dish_ingredients di ON wm.dish_id = di.dish_id
       JOIN ingredients i ON di.ingredient_id = i.id
       WHERE wm.plan_date >= $1 AND wm.plan_date <= $2
       GROUP BY date
       ORDER BY date`,
      [start_date, end_date]
    );

    // ⭐ 4. 新增：计算分类成本与分类数量 (每日分品类)
    const categoryRes = await pool.query(
      `SELECT 
         to_char(wm.plan_date, 'YYYY-MM-DD') as date,
         i.category,
         SUM(di.quantity * i.price) as benchmark_cost_10,
         SUM(di.quantity) as benchmark_qty_10 -- 👈 新增数量聚合
       FROM weekly_menus wm
       JOIN dish_ingredients di ON wm.dish_id = di.dish_id
       JOIN ingredients i ON di.ingredient_id = i.id
       WHERE wm.plan_date >= $1 AND wm.plan_date <= $2
       GROUP BY date, i.category`,
      [start_date, end_date]
    );

    // 预处理分类数据
    const dailyCats = {};
    categoryRes.rows.forEach((r) => {
      if (!dailyCats[r.date]) dailyCats[r.date] = [];
      dailyCats[r.date].push({
        category: r.category,
        cost: parseFloat(r.benchmark_cost_10),
        qty: parseFloat(r.benchmark_qty_10), // 记录基准数量
      });
    });

    // 5. 合并计算
    const structureMap = {};
    const structureQtyMap = {}; // 👈 用于累加数量

    const trendData = costRes.rows.map((row) => {
      const count = studentCounts[row.date] || activeCount;
      const benchmarkTotal = parseFloat(row.benchmark_cost_10);

      const realTotalCost = (benchmarkTotal / 10) * count;
      const avg = count > 0 ? realTotalCost / count : 0;

      // 核心：累加分类成本与数量
      const dayCats = dailyCats[row.date] || [];
      dayCats.forEach((item) => {
        // 金额累加
        const catRealCost = (item.cost / 10) * count;
        if (!structureMap[item.category]) structureMap[item.category] = 0;
        structureMap[item.category] += catRealCost;

        // 数量累加
        const catRealQty = (item.qty / 10) * count;
        if (!structureQtyMap[item.category]) structureQtyMap[item.category] = 0;
        structureQtyMap[item.category] += catRealQty;
      });

      return {
        date: row.date,
        total_cost: parseFloat(realTotalCost.toFixed(2)),
        student_count: count,
        avg_cost: parseFloat(avg.toFixed(2)),
      };
    });

    // 格式化成本饼图数据
    const structureData = Object.entries(structureMap)
      .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value);

    // 格式化数量饼图数据
    const structureQtyData = Object.entries(structureQtyMap)
      .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value);

    // 返回新结构: { trend, structure, structureQty }
    res.json({
      code: 200,
      data: {
        trend: trendData,
        structure: structureData,
        structureQty: structureQtyData,
      },
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ code: 500, msg: '获取成本数据失败', error: err.message });
  }
};

// ==========================================
// 📱 6. 家长端公开食谱 (Public Weekly Menu)
// ==========================================
exports.getPublicWeeklyMenu = async (req, res) => {
  const { start_date, end_date } = req.query;
  try {
    const menuQuery = `
      SELECT 
        to_char(wm.plan_date, 'YYYY-MM-DD') as date, 
        wm.meal_type, 
        d.name as dish_name, 
        d.photo_url, 
        d.tags,
        d.id as dish_id
      FROM weekly_menus wm
      JOIN dishes d ON wm.dish_id = d.id
      WHERE wm.plan_date >= $1 AND wm.plan_date <= $2
      ORDER BY wm.plan_date, wm.meal_type
    `;
    const menuRes = await pool.query(menuQuery, [start_date, end_date]);

    const sourcingQuery = `
      SELECT DISTINCT
        wm.dish_id,
        i.name as ingredient_name,
        i.source
      FROM weekly_menus wm
      JOIN dish_ingredients di ON wm.dish_id = di.dish_id
      JOIN ingredients i ON di.ingredient_id = i.id
      WHERE wm.plan_date >= $1 AND wm.plan_date <= $2
    `;
    const sourcingRes = await pool.query(sourcingQuery, [start_date, end_date]);

    const menuList = menuRes.rows.map((dish) => {
      const ingredients = sourcingRes.rows.filter(
        (s) => s.dish_id === dish.dish_id
      );
      return {
        ...dish,
        ingredients: ingredients.map((i) => ({
          name: i.ingredient_name,
          source: i.source,
        })),
      };
    });

    const groupedByDate = {};
    let curr = new Date(start_date);
    const end = new Date(end_date);
    while (curr <= end) {
      const dateStr = curr.toISOString().split('T')[0];
      groupedByDate[dateStr] = {
        date: dateStr,
        meals: { lunch: [], dinner: [], snack: [] },
      };
      curr.setDate(curr.getDate() + 1);
    }

    menuList.forEach((item) => {
      if (groupedByDate[item.date]) {
        const type = ['lunch', 'dinner', 'snack'].includes(item.meal_type)
          ? item.meal_type
          : 'lunch';
        groupedByDate[item.date].meals[type].push(item);
      }
    });

    res.json({ code: 200, data: Object.values(groupedByDate) });
  } catch (err) {
    res
      .status(500)
      .json({ code: 500, msg: '获取公开食谱失败', error: err.message });
  }
};
