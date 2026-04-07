const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
});

async function getDb() {
  // Create tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employees (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER DEFAULT 0
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sites (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      district TEXT DEFAULT 'A地区'
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS records (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      date TEXT NOT NULL,
      site TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      break_minutes INTEGER DEFAULT 60,
      day_type TEXT DEFAULT 'work',
      note TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // マイグレーション: 新しい列を安全に追加
  const migrations = [
    "ALTER TABLE sites ADD COLUMN IF NOT EXISTS district TEXT DEFAULT 'A地区'",
    "ALTER TABLE records ADD COLUMN IF NOT EXISTS day_type TEXT DEFAULT 'work'",
  ];
  for (const sql of migrations) {
    try { await pool.query(sql); } catch (e) { /* already exists */ }
  }

  // Insert default data if empty
  const empCount = await pool.query('SELECT COUNT(*) as c FROM employees');
  if (parseInt(empCount.rows[0].c) === 0) {
    const names = ['田中', '佐藤', '鈴木', '山田'];
    for (let i = 0; i < names.length; i++) {
      await pool.query('INSERT INTO employees (name, sort_order) VALUES ($1, $2)', [names[i], i]);
    }
  }

  const siteCount = await pool.query('SELECT COUNT(*) as c FROM sites');
  if (parseInt(siteCount.rows[0].c) === 0) {
    const sites = ['A邸', 'B邸', 'C邸', 'D社ビル', '公共施設'];
    for (const name of sites) {
      await pool.query('INSERT INTO sites (name) VALUES ($1)', [name]);
    }
  }

  // Upsert default settings
  const defaultSettings = {
    standard_hours: '8',
    standard_start: '08:00',
    standard_end: '17:30',
    default_break: '90',
  };
  for (const [key, value] of Object.entries(defaultSettings)) {
    await pool.query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
      [key, value]
    );
  }

  console.log('  データベース初期化完了');
  return pool;
}

// Helper: run query and return array of objects
async function queryAll(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

// Helper: run query and return first row
async function queryOne(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows.length > 0 ? result.rows[0] : null;
}

// Helper: run INSERT/UPDATE/DELETE
async function runAndSave(sql, params = []) {
  await pool.query(sql, params);
}

// Helper: run INSERT and return id
async function insertAndGetId(sql, params = []) {
  const result = await pool.query(sql + ' RETURNING id', params);
  return result.rows[0].id;
}

module.exports = { getDb, queryAll, queryOne, runAndSave, insertAndGetId };
