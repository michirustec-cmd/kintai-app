const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { getDb, queryAll, queryOne, runAndSave, insertAndGetId } = require('./db');
const { generateExcel } = require('./excel');

const app = express();
app.use(cors());
app.use(express.json());

// ========== 勤務計算ヘルパー ==========
function toMin(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

async function getSettingsObj() {
  const rows = await queryAll('SELECT * FROM settings');
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
  if (r.day_type === 'off' || r.day_type === 'alloff') {
    return { ...r, work_minutes: 0, early_minutes: 0, overtime_minutes: 0, extra_total_minutes: 0 };
  }
  const start = toMin(r.start_time);
  let end = toMin(r.end_time);
  const { standardStart, standardEnd, defaultBreak } = settings;
  const breakMin = r.break_minutes != null ? r.break_minutes : defaultBreak;

  if (end <= start) end += 24 * 60;

  const earlyMinutes = Math.max(0, standardStart - start);
  const overtimeMinutes = Math.max(0, end - standardEnd);
  const workMinutes = (end - start) - breakMin;

  return {
    ...r,
    work_minutes: workMinutes,
    early_minutes: earlyMinutes,
    overtime_minutes: overtimeMinutes,
    extra_total_minutes: earlyMinutes + overtimeMinutes,
  };
}

// ========== Employees ==========
app.get('/api/employees', async (req, res) => {
  try {
    const rows = await queryAll('SELECT * FROM employees ORDER BY sort_order, id');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/employees', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: '社員名は必須です' });
  try {
    const id = await insertAndGetId('INSERT INTO employees (name) VALUES ($1)', [name.trim()]);
    res.json({ id, name: name.trim() });
  } catch (e) {
    if (e.message.includes('unique') || e.message.includes('duplicate')) return res.status(409).json({ error: 'この社員名は既に存在します' });
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/employees/:id', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: '社員名は必須です' });
  try {
    await runAndSave('UPDATE employees SET name = $1 WHERE id = $2', [name.trim(), Number(req.params.id)]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/employees/:id', async (req, res) => {
  try {
    const count = await queryOne('SELECT COUNT(*) as c FROM employees');
    if (parseInt(count.c) <= 1) return res.status(400).json({ error: '最低1名は必要です' });
    await runAndSave('DELETE FROM employees WHERE id = $1', [Number(req.params.id)]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ========== Sites ==========
app.get('/api/sites', async (req, res) => {
  try {
    const rows = await queryAll('SELECT * FROM sites ORDER BY district, id');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/sites', async (req, res) => {
  const { name, district } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: '現場名は必須です' });
  try {
    const id = await insertAndGetId('INSERT INTO sites (name, district) VALUES ($1, $2)', [name.trim(), district || 'A地区']);
    res.json({ id, name: name.trim(), district: district || 'A地区' });
  } catch (e) {
    if (e.message.includes('unique') || e.message.includes('duplicate')) return res.status(409).json({ error: 'この現場名は既に存在します' });
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/sites/:id', async (req, res) => {
  try {
    await runAndSave('DELETE FROM sites WHERE id = $1', [Number(req.params.id)]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ========== Records ==========
app.get('/api/records', async (req, res) => {
  try {
    const { employee_id, month } = req.query;
    let sql = `SELECT r.*, e.name as employee_name FROM records r JOIN employees e ON r.employee_id = e.id WHERE 1=1`;
    const params = [];
    let n = 1;

    if (employee_id) {
      sql += ` AND r.employee_id = $${n++}`;
      params.push(Number(employee_id));
    }
    if (month) {
      sql += ` AND r.date LIKE $${n++}`;
      params.push(month + '%');
    }
    sql += ' ORDER BY r.date DESC, e.name';

    const rows = await queryAll(sql, params);
    const settings = await getSettingsObj();
    const enriched = rows.map(r => calcRecord(r, settings));
    res.json(enriched);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/records/summary', async (req, res) => {
  try {
    const { employee_id, month } = req.query;
    let sql = `SELECT r.*, e.name as employee_name FROM records r JOIN employees e ON r.employee_id = e.id WHERE 1=1`;
    const params = [];
    let n = 1;

    if (employee_id) {
      sql += ` AND r.employee_id = $${n++}`;
      params.push(Number(employee_id));
    }
    if (month) {
      sql += ` AND r.date LIKE $${n++}`;
      params.push(month + '%');
    }

    const rows = await queryAll(sql, params);
    const settings = await getSettingsObj();

    let totalWorkMinutes = 0, totalEarlyMinutes = 0, totalOvertimeMinutes = 0;
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/records', async (req, res) => {
  try {
    const { employee_id, date, site, start_time, end_time, break_minutes, note, day_type } = req.body;
    if (!employee_id || !date) return res.status(400).json({ error: '必須項目を入力してください' });
    const id = await insertAndGetId(
      'INSERT INTO records (employee_id, date, site, start_time, end_time, break_minutes, day_type, note) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [Number(employee_id), date, site || '', start_time || '00:00', end_time || '00:00', break_minutes ?? 90, day_type || 'work', note || '']
    );
    res.json({ id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/records/:id', async (req, res) => {
  try {
    const { date, site, start_time, end_time, break_minutes, note, day_type } = req.body;
    await runAndSave(
      'UPDATE records SET date = $1, site = $2, start_time = $3, end_time = $4, break_minutes = $5, day_type = $6, note = $7 WHERE id = $8',
      [date, site, start_time, end_time, break_minutes ?? 90, day_type || 'work', note || '', Number(req.params.id)]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/records/:id', async (req, res) => {
  try {
    await runAndSave('DELETE FROM records WHERE id = $1', [Number(req.params.id)]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ========== Settings ==========
app.get('/api/settings', async (req, res) => {
  try {
    const rows = await queryAll('SELECT * FROM settings');
    const obj = {};
    rows.forEach(r => { obj[r.key] = r.value; });
    res.json(obj);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/settings', async (req, res) => {
  try {
    for (const [key, value] of Object.entries(req.body)) {
      await runAndSave(
        'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
        [key, String(value)]
      );
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ========== Excel Export ==========
app.get('/api/export', async (req, res) => {
  try {
    const { employee_id, month } = req.query;
    let sql = `SELECT r.*, e.name as employee_name FROM records r JOIN employees e ON r.employee_id = e.id WHERE 1=1`;
    const params = [];
    let n = 1;

    if (employee_id) {
      sql += ` AND r.employee_id = $${n++}`;
      params.push(Number(employee_id));
    }
    if (month) {
      sql += ` AND r.date LIKE $${n++}`;
      params.push(month + '%');
    }
    sql += ' ORDER BY r.date, e.name';

    const rows = await queryAll(sql, params);
    if (!rows.length) return res.status(404).json({ error: '出力するデータがありません' });

    const settings = await getSettingsObj();

    let employeeName = '';
    if (employee_id) {
      const emp = await queryOne('SELECT name FROM employees WHERE id = $1', [Number(employee_id)]);
      if (emp) employeeName = emp.name;
    }

    const { buffer, filename } = generateExcel(rows, employeeName, month || '全期間', settings);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(Buffer.from(buffer));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Always serve static files from client/dist if it exists
const distPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Start server
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
  });
}).catch(err => {
  console.error('DB初期化エラー:', err);
  process.exit(1);
});
