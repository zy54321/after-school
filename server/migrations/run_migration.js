/**
 * Migration Runner
 * 用于执行 SQL migration 文件
 * 
 * 使用方式：
 * node migrations/run_migration.js 002_family_market.sql
 * node migrations/run_migration.js 002_family_market_seed.sql
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function runMigration(fileName) {
  const filePath = path.join(__dirname, fileName);
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ 文件不存在: ${filePath}`);
    process.exit(1);
  }
  
  const sql = fs.readFileSync(filePath, 'utf8');
  
  console.log(`\n🚀 开始执行 migration: ${fileName}`);
  console.log('='.repeat(50));
  
  const client = await pool.connect();
  
  try {
    // 分割 SQL 语句（简单处理，按分号分割）
    // 注意：这里使用整体执行，因为 PL/pgSQL 块不能简单分割
    await client.query(sql);
    
    console.log(`\n✅ Migration 执行成功: ${fileName}`);
  } catch (err) {
    console.error(`\n❌ Migration 执行失败: ${err.message}`);
    console.error('详细错误:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// 获取命令行参数
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('使用方式: node migrations/run_migration.js <filename.sql>');
  console.log('示例: node migrations/run_migration.js 002_family_market.sql');
  process.exit(1);
}

runMigration(args[0]);
