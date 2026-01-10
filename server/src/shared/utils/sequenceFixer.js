/**
 * 序列修复工具
 * 自动修复 PostgreSQL 序列未同步问题
 */
const pool = require('../config/db');

/**
 * 修复指定表的序列
 * @param {string} tableName - 表名
 * @param {string} idColumn - ID 列名（默认为 'id'）
 * @returns {Promise<boolean>} 是否修复成功
 */
async function fixSequence(tableName, idColumn = 'id') {
  try {
    const seqName = pg_get_serial_sequence(tableName, idColumn);
    if (!seqName) {
      console.warn(`表 ${tableName} 没有序列`);
      return false;
    }

    // 获取表中最大ID
    const maxIdResult = await pool.query(
      `SELECT COALESCE(MAX(${idColumn}), 0) as max_id FROM ${tableName}`
    );
    const maxId = parseInt(maxIdResult.rows[0].max_id) || 0;

    // 设置序列值
    await pool.query(`SELECT setval($1, $2, true)`, [
      seqName.replace(/"/g, ''),
      Math.max(maxId, 1)
    ]);

    console.log(`✅ 已修复表 ${tableName} 的序列，设置为 ${Math.max(maxId, 1)}`);
    return true;
  } catch (error) {
    console.error(`修复表 ${tableName} 序列失败:`, error);
    return false;
  }
}

/**
 * 获取序列名称（PostgreSQL 内置函数）
 * @param {string} tableName - 表名
 * @param {string} columnName - 列名
 * @returns {string} 序列名称
 */
function pg_get_serial_sequence(tableName, columnName) {
  // 这里需要执行 SQL 查询来获取序列名
  // 由于这是同步函数，我们需要在调用时使用异步方式
  return `"${tableName}_${columnName}_seq"`;
}

/**
 * 异步修复序列（使用 SQL 查询获取序列名）
 * @param {string} tableName - 表名
 * @param {string} idColumn - ID 列名（默认为 'id'）
 * @returns {Promise<boolean>} 是否修复成功
 */
async function fixSequenceAsync(tableName, idColumn = 'id') {
  try {
    // 获取序列名
    const seqResult = await pool.query(
      `SELECT pg_get_serial_sequence($1, $2) as seq_name`,
      [tableName, idColumn]
    );

    if (!seqResult.rows[0] || !seqResult.rows[0].seq_name) {
      console.warn(`表 ${tableName} 没有序列`);
      return false;
    }

    const seqName = seqResult.rows[0].seq_name;

    // 获取表中最大ID
    const maxIdResult = await pool.query(
      `SELECT COALESCE(MAX(${idColumn}), 0) as max_id FROM ${tableName}`
    );
    const maxId = parseInt(maxIdResult.rows[0].max_id) || 0;

    // 设置序列值
    await pool.query(`SELECT setval($1, $2, true)`, [
      seqName,
      Math.max(maxId, 1)
    ]);

    console.log(`✅ 已修复表 ${tableName} 的序列，设置为 ${Math.max(maxId, 1)}`);
    return true;
  } catch (error) {
    console.error(`修复表 ${tableName} 序列失败:`, error);
    return false;
  }
}

/**
 * 批量修复多个表的序列
 * @param {Array<string>} tableNames - 表名数组
 * @returns {Promise<Object>} 修复结果
 */
async function fixSequencesBatch(tableNames) {
  const results = {};
  for (const tableName of tableNames) {
    results[tableName] = await fixSequenceAsync(tableName);
  }
  return results;
}

module.exports = {
  fixSequenceAsync,
  fixSequencesBatch,
};


