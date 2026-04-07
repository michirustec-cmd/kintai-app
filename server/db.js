const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'kintai.db');

let db = null;

async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  // Load existing DB or create new
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER DEFAULT 0
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      site TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      break_minutes INTEGER DEFAULT 60,
      note TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Insert default data if empty
  const empCount = db.exec("SELECT COUNT(*) as c FROM employees")[0].values[0][0];
  if (empCount === 0) {
    ['田中', '佐藤', '鈴木', '山田'].forEach((name, i) => {
      db.run('INSERT INTO employees (name, sort_order) VALUES (?, ?)', [name, i]);
    });
  }

  const siteCount = db.exec("SELECT COUNT(*) as c FROM sites")[0].values[0][0];
  if (siteCount === 0) {
    ['A邸', 'B邸', 'C邸', 'D社ビル', '公共施設'].forEach(name => {
      db.run('INSERT INTO sites (name) VALUES (?)', [name]);
    });
  }

  // Upsert default settings (add missing keys without overwriting existing)
  const defaultSettings = {
    standard_hours: '8',
    standard_start: '08:00',
    standard_end: '17:30',
    default_break: '90',
  };
  for (const [key, value] of Object.entries(defaultSettings)) {
    db.run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", [key, value]);
  }

  saveDb();
  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

// Helper: run query and return array of objects
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// Helper: run query and return first row as object
function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// Helper: run INSERT/UPDATE/DELETE and save
function runAndSave(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

// Helper: get last insert rowid
function lastInsertId() {
  return db.exec("SELECT last_insert_rowid()")[0].values[0][0];
}

module.exports = { getDb, saveDb, queryAll, queryOne, runAndSave, lastInsertId };
