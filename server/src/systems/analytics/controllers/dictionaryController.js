const pool = require('../../../shared/config/db');

// ============================================
// 字典类型管理
// ============================================

// 获取类型列表（可按 geometry_type 筛选）
const getTypes = async (req, res) => {
  try {
    const { geometry_type } = req.query;
    
    let query = `
      SELECT 
        id, geometry_type, type_code, name_zh, name_en, color, icon, 
        sort_order, is_active, created_at, updated_at
      FROM feature_dictionary_types
      WHERE 1=1
    `;
    const params = [];
    
    if (geometry_type) {
      query += ` AND geometry_type = $1`;
      params.push(geometry_type);
    }
    
    query += ` ORDER BY geometry_type, sort_order, id`;
    
    const result = await pool.query(query, params);
    
    res.json({
      code: 200,
      msg: 'success',
      data: result.rows
    });
  } catch (err) {
    console.error('获取字典类型失败:', err);
    res.status(500).json({ code: 500, msg: '获取类型列表失败', error: err.message });
  }
};

// 获取单个类型详情（包含字段列表）
const getTypeById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 获取类型信息
    const typeResult = await pool.query(
      'SELECT * FROM feature_dictionary_types WHERE id = $1',
      [id]
    );
    
    if (typeResult.rows.length === 0) {
      return res.status(404).json({ code: 404, msg: '类型不存在' });
    }
    
    const type = typeResult.rows[0];
    
    // 获取该类型的字段列表
    const fieldsResult = await pool.query(
      `SELECT * FROM feature_dictionary_fields 
       WHERE type_id = $1 
       ORDER BY sort_order, id`,
      [id]
    );
    
    res.json({
      code: 200,
      msg: 'success',
      data: {
        ...type,
        fields: fieldsResult.rows
      }
    });
  } catch (err) {
    console.error('获取类型详情失败:', err);
    res.status(500).json({ code: 500, msg: '获取类型详情失败', error: err.message });
  }
};

// 创建新类型
const createType = async (req, res) => {
  try {
    const { geometry_type, type_code, name_zh, name_en, color, icon, sort_order, is_active } = req.body;
    
    // 验证必填字段
    if (!geometry_type || !type_code || !name_zh || !name_en) {
      return res.status(400).json({ code: 400, msg: '缺少必填字段' });
    }
    
    // 验证 geometry_type
    if (!['Point', 'LineString', 'Polygon'].includes(geometry_type)) {
      return res.status(400).json({ code: 400, msg: 'geometry_type 必须是 Point, LineString 或 Polygon' });
    }
    
    const query = `
      INSERT INTO feature_dictionary_types 
      (geometry_type, type_code, name_zh, name_en, color, icon, sort_order, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const values = [
      geometry_type,
      type_code,
      name_zh,
      name_en,
      color || '#409EFF',
      icon || null,
      sort_order || 0,
      is_active !== undefined ? is_active : true
    ];
    
    const result = await pool.query(query, values);
    
    res.json({
      code: 200,
      msg: '创建成功',
      data: result.rows[0]
    });
  } catch (err) {
    if (err.code === '23505') { // 唯一约束违反
      return res.status(400).json({ code: 400, msg: '类型代码已存在' });
    }
    console.error('创建类型失败:', err);
    res.status(500).json({ code: 500, msg: '创建类型失败', error: err.message });
  }
};

// 更新类型
const updateType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name_zh, name_en, color, icon, sort_order, is_active } = req.body;
    
    // 检查类型是否存在
    const checkResult = await pool.query(
      'SELECT id FROM feature_dictionary_types WHERE id = $1',
      [id]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ code: 404, msg: '类型不存在' });
    }
    
    const query = `
      UPDATE feature_dictionary_types
      SET name_zh = COALESCE($1, name_zh),
          name_en = COALESCE($2, name_en),
          color = COALESCE($3, color),
          icon = COALESCE($4, icon),
          sort_order = COALESCE($5, sort_order),
          is_active = COALESCE($6, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
    `;
    
    const values = [name_zh, name_en, color, icon, sort_order, is_active, id];
    
    const result = await pool.query(query, values);
    
    res.json({
      code: 200,
      msg: '更新成功',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('更新类型失败:', err);
    res.status(500).json({ code: 500, msg: '更新类型失败', error: err.message });
  }
};

// 删除类型（检查是否被使用）
const deleteType = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查类型是否存在
    const typeResult = await pool.query(
      'SELECT type_code FROM feature_dictionary_types WHERE id = $1',
      [id]
    );
    
    if (typeResult.rows.length === 0) {
      return res.status(404).json({ code: 404, msg: '类型不存在' });
    }
    
    const typeCode = typeResult.rows[0].type_code;
    
    // 检查是否有要素使用此类型
    const usageResult = await pool.query(
      'SELECT COUNT(*) as count FROM market_features WHERE category = $1',
      [typeCode]
    );
    
    const usageCount = parseInt(usageResult.rows[0].count);
    
    if (usageCount > 0) {
      return res.status(400).json({
        code: 400,
        msg: `该类型正在被 ${usageCount} 个要素使用，无法删除。请先处理相关数据或禁用该类型。`
      });
    }
    
    // 删除类型（CASCADE 会自动删除关联的字段）
    await pool.query('DELETE FROM feature_dictionary_types WHERE id = $1', [id]);
    
    res.json({
      code: 200,
      msg: '删除成功'
    });
  } catch (err) {
    console.error('删除类型失败:', err);
    res.status(500).json({ code: 500, msg: '删除类型失败', error: err.message });
  }
};

// ============================================
// 字典字段管理
// ============================================

// 获取字段列表（按 type_id 筛选）
const getFields = async (req, res) => {
  try {
    const { type_id } = req.query;
    
    if (!type_id) {
      return res.status(400).json({ code: 400, msg: '缺少 type_id 参数' });
    }
    
    const query = `
      SELECT * FROM feature_dictionary_fields
      WHERE type_id = $1
      ORDER BY sort_order, id
    `;
    
    const result = await pool.query(query, [type_id]);
    
    // 🟢 解析 JSONB 字段（validation_rule 和 options）
    const fields = result.rows.map(field => {
      // 解析 validation_rule
      if (field.validation_rule) {
        try {
          field.validation_rule = typeof field.validation_rule === 'string' 
            ? JSON.parse(field.validation_rule) 
            : field.validation_rule;
        } catch (e) {
          console.error('解析 validation_rule 失败:', e);
          field.validation_rule = null;
        }
      }
      // 解析 options
      if (field.options) {
        try {
          field.options = typeof field.options === 'string' 
            ? JSON.parse(field.options) 
            : field.options;
        } catch (e) {
          console.error('解析 options 失败:', e);
          field.options = null;
        }
      }
      return field;
    });
    
    res.json({
      code: 200,
      msg: 'success',
      data: fields
    });
  } catch (err) {
    console.error('获取字段列表失败:', err);
    res.status(500).json({ code: 500, msg: '获取字段列表失败', error: err.message });
  }
};

// 获取单个字段详情
const getFieldById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM feature_dictionary_fields WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ code: 404, msg: '字段不存在' });
    }
    
    res.json({
      code: 200,
      msg: 'success',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('获取字段详情失败:', err);
    res.status(500).json({ code: 500, msg: '获取字段详情失败', error: err.message });
  }
};

// 创建字段
const createField = async (req, res) => {
  try {
    const {
      type_id, field_key, name_zh, name_en, field_type,
      is_required, default_value, placeholder_zh, placeholder_en,
      suffix, validation_rule, options, sort_order
    } = req.body;
    
    // 验证必填字段
    if (!type_id || !field_key || !name_zh || !name_en || !field_type) {
      return res.status(400).json({ code: 400, msg: '缺少必填字段' });
    }
    
    // 验证 field_type
    const validFieldTypes = ['text', 'number', 'date', 'boolean', 'select', 'rate', 'textarea', 'url'];
    if (!validFieldTypes.includes(field_type)) {
      return res.status(400).json({ code: 400, msg: `field_type 必须是以下之一: ${validFieldTypes.join(', ')}` });
    }
    
    // 验证 type_id 是否存在
    const typeCheck = await pool.query(
      'SELECT id FROM feature_dictionary_types WHERE id = $1',
      [type_id]
    );
    
    if (typeCheck.rows.length === 0) {
      return res.status(404).json({ code: 404, msg: '类型不存在' });
    }
    
    const query = `
      INSERT INTO feature_dictionary_fields
      (type_id, field_key, name_zh, name_en, field_type, is_required, 
       default_value, placeholder_zh, placeholder_en, suffix, 
       validation_rule, options, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    
    const values = [
      type_id,
      field_key,
      name_zh,
      name_en,
      field_type,
      is_required || false,
      default_value || null,
      placeholder_zh || null,
      placeholder_en || null,
      suffix || null,
      validation_rule ? JSON.stringify(validation_rule) : null,
      options ? JSON.stringify(options) : null,
      sort_order || 0
    ];
    
    const result = await pool.query(query, values);
    
    res.json({
      code: 200,
      msg: '创建成功',
      data: result.rows[0]
    });
  } catch (err) {
    if (err.code === '23505') { // 唯一约束违反
      return res.status(400).json({ code: 400, msg: '该类型下字段键已存在' });
    }
    console.error('创建字段失败:', err);
    res.status(500).json({ code: 500, msg: '创建字段失败', error: err.message });
  }
};

// 更新字段
const updateField = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name_zh, name_en, field_type, is_required, default_value,
      placeholder_zh, placeholder_en, suffix, validation_rule,
      options, sort_order
    } = req.body;
    
    // 检查字段是否存在
    const checkResult = await pool.query(
      'SELECT id FROM feature_dictionary_fields WHERE id = $1',
      [id]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ code: 404, msg: '字段不存在' });
    }
    
    const query = `
      UPDATE feature_dictionary_fields
      SET name_zh = COALESCE($1, name_zh),
          name_en = COALESCE($2, name_en),
          field_type = COALESCE($3, field_type),
          is_required = COALESCE($4, is_required),
          default_value = COALESCE($5, default_value),
          placeholder_zh = COALESCE($6, placeholder_zh),
          placeholder_en = COALESCE($7, placeholder_en),
          suffix = COALESCE($8, suffix),
          validation_rule = COALESCE($9::jsonb, validation_rule),
          options = COALESCE($10::jsonb, options),
          sort_order = COALESCE($11, sort_order),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $12
      RETURNING *
    `;
    
    const values = [
      name_zh, name_en, field_type, is_required, default_value,
      placeholder_zh, placeholder_en, suffix,
      validation_rule ? JSON.stringify(validation_rule) : null,
      options ? JSON.stringify(options) : null,
      sort_order, id
    ];
    
    const result = await pool.query(query, values);
    
    res.json({
      code: 200,
      msg: '更新成功',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('更新字段失败:', err);
    res.status(500).json({ code: 500, msg: '更新字段失败', error: err.message });
  }
};

// 删除字段
const deleteField = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查字段是否存在
    const checkResult = await pool.query(
      'SELECT id FROM feature_dictionary_fields WHERE id = $1',
      [id]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ code: 404, msg: '字段不存在' });
    }
    
    // 删除字段（注意：已存在的要素数据中的该字段不会被删除，只是不再显示在表单中）
    await pool.query('DELETE FROM feature_dictionary_fields WHERE id = $1', [id]);
    
    res.json({
      code: 200,
      msg: '删除成功'
    });
  } catch (err) {
    console.error('删除字段失败:', err);
    res.status(500).json({ code: 500, msg: '删除字段失败', error: err.message });
  }
};

// ============================================
// 完整配置获取（用于前端）
// ============================================

// 获取完整配置（类型+字段，按 geometry_type 筛选）
const getFullConfig = async (req, res) => {
  try {
    const { geometry_type } = req.query;
    
    let typeQuery = `
      SELECT id, geometry_type, type_code, name_zh, name_en, color, icon, sort_order, is_active
      FROM feature_dictionary_types
      WHERE is_active = true
    `;
    const params = [];
    
    if (geometry_type) {
      typeQuery += ` AND geometry_type = $1`;
      params.push(geometry_type);
    }
    
    typeQuery += ` ORDER BY geometry_type, sort_order, id`;
    
    const typesResult = await pool.query(typeQuery, params);
    
    // 获取所有类型的字段
    const typeIds = typesResult.rows.map(t => t.id);
    
    let fieldsResult = { rows: [] };
    if (typeIds.length > 0) {
      const fieldsQuery = `
        SELECT * FROM feature_dictionary_fields
        WHERE type_id = ANY($1)
        ORDER BY type_id, sort_order, id
      `;
      fieldsResult = await pool.query(fieldsQuery, [typeIds]);
    }
    
    // 组装数据：将字段按 type_id 分组
    const fieldsByType = {};
    fieldsResult.rows.forEach(field => {
      if (!fieldsByType[field.type_id]) {
        fieldsByType[field.type_id] = [];
      }
      // 解析 JSONB 字段
      if (field.validation_rule) {
        field.validation_rule = typeof field.validation_rule === 'string' 
          ? JSON.parse(field.validation_rule) 
          : field.validation_rule;
      }
      if (field.options) {
        field.options = typeof field.options === 'string' 
          ? JSON.parse(field.options) 
          : field.options;
      }
      fieldsByType[field.type_id].push(field);
    });
    
    // 合并类型和字段
    const config = typesResult.rows.map(type => ({
      ...type,
      fields: fieldsByType[type.id] || []
    }));
    
    res.json({
      code: 200,
      msg: 'success',
      data: config
    });
  } catch (err) {
    console.error('获取完整配置失败:', err);
    res.status(500).json({ code: 500, msg: '获取完整配置失败', error: err.message });
  }
};

module.exports = {
  // 类型管理
  getTypes,
  getTypeById,
  createType,
  updateType,
  deleteType,
  // 字段管理
  getFields,
  getFieldById,
  createField,
  updateField,
  deleteField,
  // 完整配置
  getFullConfig
};

