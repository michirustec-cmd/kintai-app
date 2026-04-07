const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { getDb, queryAll, queryOne, runAndSave, lastInsertId } = require('./db');
const { generateExcel } = require('./excel');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));
}

// ========== 勤務計算ヘルパー ==========
function toMin(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function getSettings() {
  const rows = queryAll('SELECT * FROM settings');
  const s = {};
  rows.forEach(r => { s[r.key] = r.value; });
  return {
    standardStart: toMin(s.standard_start || '08:00'),
    standardEnd: toMin(s.standard_end || '17:30'),
    standardHours: parseFloat(s.standard_hours || '8'),
    defaultBreak: parseInt(s.default_break || '90'),
  };
}

function calcRecord(r, settings) {
  // 休み・全休の場合は計算不要
  if (r.day_type === 'off' || r.day_type === 'alloff') {
    return { ...r, work_minutes: 0, early_minutes: 0, overtime_minutes: 0, extra_total_minutes: 0 };
  }
  const start = toMin(r.start_time);
  let end = toMin(r.end_time);
  const { standardStart, standardEnd, standardHours, defaultBreak } = settings;
  const breakMin = r.break_minutes != null ? r.break_minutes : defaultBreak;

  // 日をまたぐ場合（退勤時刻が出勤時刻より前 = 翌日）
  if (end <= start) {
    end += 24 * 60; // +24時間
  }

  // 早出: 定時開始より前に出勤した分
  const earlyMinutes = Math.max(0, standardStart - start);
  // 残業: 定時終了より後に退勤した分
  const overtimeMinutes = Math.max(0, end - standardEnd);
  // 実労働時間 = 拘束時間 - 休憩
  const totalMinutes = end - start;
  const workMinutes = totalMinutes - breakMin;

  return {
    ...r,
    work_minutes: workMinutes,
    early_minutes: earlyMinutes,
    overtime_minutes: overtimeMinutes,
    extra_total_minutes: earlyMinutes + overtimeMinutes,
  };
}

// ========== Employees ==========
app.get('/api/employees', (req, res) => {
  const rows = queryAll('SELECT * FROM employees ORDER BY sort_order, id');
  res.json(rows);
});

app.post('/api/employees', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: '社員名は必須です' });
  try {
    runAndSave('INSERT INTO employees (name) VALUES (?)', [name.trim()]);
    res.json({ id: lastInsertId(), name: name.trim() });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'この社員名は既に存在します' });
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/employees/:id', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: '社員名は必須です' });
  runAndSave('UPDATE employees SET name = ? WHERE id = ?', [name.trim(), Number(req.params.id)]);
  res.json({ success: true });
});

app.delete('/api/employees/:id', (req, res) => {
  const count = queryOne('SELECT COUNT(*) as c FROM employees');
  if (count.c <= 1) return res.status(400).json({ error: '最低1名は必要です' });
  runAndSave('DELETE FROM employees WHERE id = ?', [Number(req.params.id)]);
  res.json({ success: true });
});

// ========== Sites ==========
app.get('/api/sites', (req, res) => {
  const rows = queryAll('SELECT * FROM sites ORDER BY district, id');
  res.json(rows);
});

app.post('/api/sites', (req, res) => {
  const { name, district } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: '現場名は必須です' });
  try {
    runAndSave('INSERT INTO sites (name, district) VALUES (?, ?)', [name.trim(), district || 'A地区']);
    res.json({ id: lastInsertId(), name: name.trim(), district: district || 'A地区' });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'この現場名は既に存在します' });
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/sites/:id', (req, res) => {
  runAndSave('DELETE FROM sites WHERE id = ?', [Number(req.params.id)]);
  res.json({ success: true });
});

// ========== Records ==========
app.get('/api/records', (req, res) => {
  const { employee_id, month } = req.query;
  let sql = `
    SELECT r.*, e.name as employee_name
    FROM records r
    JOIN employees e ON r.employee_id = e.id
    WHERE 1=1
  `;
  const params = [];

  if (employee_id) {
    sql += ' AND r.employee_id = ?';
    params.push(Number(employee_id));
  }
  if (month) {
    sql += " AND r.date LIKE ?";
    params.push(month + '%');
  }

  sql += ' ORDER BY r.date DESC, e.name';
  const rows = queryAll(sql, params);
  const settings = getSettings();
  const enriched = rows.map(r => calcRecord(r, settings));
  res.json(enriched);
});

app.get('/api/records/summary', (req, res) => {
  const { employee_id, month } = req.query;
  let sql = `
    SELECT r.*, e.name as employee_name
    FROM records r
    JOIN employees e ON r.employee_id = e.id
    WHERE 1=1
  `;
  const params = [];

  if (employee_id) {
    sql += ' AND r.employee_id = ?';
    params.push(Number(employee_id));
  }
  if (month) {
    sql += " AND r.date LIKE ?";
    params.push(month + '%');
  }

  const rows = queryAll(sql, params);
  const settings = getSettings();

  let totalWorkMinutes = 0;
  let totalEarlyMinutes = 0;
  let totalOvertimeMinutes = 0;

  rows.forEach(r => {
    const c = calcRecord(r, settings);
    totalWorkMinutes += c.work_minutes;
    totalEarlyMinutes += c.early_minutes;
    totalOvertimeMinutes += c.overtime_minutes;
  });

  res.json({
    total_days: rows.length,
    total_work_minutes: totalWorkMinutes,
    total_early_minutes: totalEarlyMinutes,
    total_overtime_minutes: totalOvertimeMinutes,
    total_extra_minutes: totalEarlyMinutes + totalOvertimeMinutes,
    standard_hours: settings.standardHours,
  });
});

app.post('/api/records', (req, res) => {
  const { employee_id, date, site, start_time, end_time, break_minutes, note, day_type } = req.body;
  if (!employee_id || !date) {
    return res.status(400).json({ error: '必須項目を入力してください' });
  }
  runAndSave(
    'INSERT INTO records (employee_id, date, site, start_time, end_time, break_minutes, day_type, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [Number(employee_id), date, site || '', start_time || '00:00', end_time || '00:00', break_minutes ?? 90, day_type || 'work', note || '']
  );
  res.json({ id: lastInsertId() });
});

app.put('/api/records/:id', (req, res) => {
  const { date, site, start_time, end_time, break_minutes, note, day_type } = req.body;
  runAndSave(
    'UPDATE records SET date = ?, site = ?, start_time = ?, end_time = ?, break_minutes = ?, day_type = ?, note = ? WHERE id = ?',
    [date, site, start_time, end_time, break_minutes ?? 90, day_type || 'work', note || '', Number(req.params.id)]
  );
  res.json({ success: true });
});

app.delete('/api/records/:id', (req, res) => {
  runAndSave('DELETE FROM records WHERE id = ?', [Number(req.params.id)]);
  res.json({ success: true });
});

// ========== Settings ==========
app.get('/api/settings', (req, res) => {
  const rows = queryAll('SELECT * FROM settings');
  const obj = {};
  rows.forEach(r => { obj[r.key] = r.value; });
  res.json(obj);
});

app.put('/api/settings', (req, res) => {
  for (const [key, value] of Object.entries(req.body)) {
    runAndSave('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
  }
  res.json({ success: true });
});


// ========== Excel Export ==========
app.get('/api/export', (req, res) => {
  const { employee_id, month } = req.query;
  let sql = `
    SELECT r.*, e.name as employee_name
    FROM records r
    JOIN employees e ON r.employee_id = e.id
    WHERE 1=1
  `;
  const params = [];

  if (employee_id) {
    sql += ' AND r.employee_id = ?';
    params.push(Number(employee_id));
  }
  if (month) {
    sql += " AND r.date LIKE ?";
    params.push(month + '%');
  }
  sql += ' ORDER BY r.date, e.name';

  const rows = queryAll(sql, params);
  if (!rows.length) return res.status(404).json({ error: '出力するデータがありません' });

  const settings = getSettings();

  let employeeName = '';
  if (employee_id) {
    const emp = queryOne('SELECT name FROM employees WHERE id = ?', [Number(employee_id)]);
    if (emp) employeeName = emp.name;
  }

  const { buffer, filename } = generateExcel(rows, employeeName, month || '全期間', settings);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.send(Buffer.from(buffer));
});

// Always serve static files from client/dist if it exists
const distPath = path.join(__dirname, '..', 'client', 'dist');
const fs = require('fs');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Start server after DB is ready
const PORT = process.env.PORT || 3001;
const os = require('os');

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

getDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    const ip = getLocalIP();
    console.log('');
    console.log('  勤怠管理サーバー起動！');
    console.log(`  PC:     http://localhost:${PORT}`);
    console.log(`  スマホ: http://${ip}:${PORT}`);
    console.log('');
    console.log('  スマホで上のURLを開いて「ホーム画面に追加」してください');
    console.log('');
  });
}).catch(err => {
  console.error('DB初期化エラー:', err);
  process.exit(1);
});
