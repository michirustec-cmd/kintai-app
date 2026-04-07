const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'kintai.db');
const backupDir = path.join(__dirname, '..', 'backups');

let db = null;

// 起動時にDBのバックアップを保存
function backupDatabase() {
  if (!fs.existsSync(dbPath)) return;
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
  const backupPath = path.join(backupDir, `kintai_backup_${timestamp}.db`);
  fs.copyFileSync(dbPath, backupPath);
  console.log(`  バックアップ保存: ${backupPath}`);

  // 古いバックアップを10件まで保持（それ以上は削除）
  const files = fs.readdirSync(backupDir).filter(f => f.startsWith('kintai_backup_')).sort();
  while (files.length > 10) {
    const old = files.shift();
    fs.unlinkSync(path.join(backupDir, old));
  }
}

// バックアップから復元
function restoreFromLatestBackup(SQL) {
  if (!fs.existsSync(backupDir)) return null;
  const files = fs.readdirSync(backupDir).filter(f => f.startsWith('kintai_backup_')).sort();
  if (files.length === 0) return null;
  const latest = files[files.length - 1];
  const backupPath = path.join(backupDir, latest);
  console.log(`  バックアップから復元: ${latest}`);
  const fileBuffer = fs.readFileSync(backupPath);
  return new SQL.Database(fileBuffer);
}

async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  // 起動時に既存DBをバックアップ
  backupDatabase();

  // Load existing DB or create new
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    // DBがない場合、バックアップから復元を試みる
    const restored = restoreFromLatestBackup(SQL);
    if (restored) {
      db = restored;
      // 復元したDBを保存
      const data = db.export();
      fs.writeFileSync(dbPath, Buffer.from(data));
    } else {
      db = new SQL.Database();
    }
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
      name TEXT NOT NULL UNIQUE,
      district TEXT DEFAULT 'A地区'
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
      day_type TEXT DEFAULT 'work',
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
