const XLSX = require('xlsx');

function fmt(minutes) {
  if (minutes <= 0) return '0:00';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

function fmtH(minutes) {
  if (minutes <= 0) return '0H';
  const h = Math.round((minutes / 60) * 10) / 10;
  return `${h % 1 === 0 ? h.toFixed(0) : h}H`;
}

function toMin(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function calcRow(r, settings) {
  const start = toMin(r.start_time);
  const end = toMin(r.end_time);
  const breakMin = r.break_minutes != null ? r.break_minutes : settings.defaultBreak;
  const workMinutes = (end - start) - breakMin;
  const earlyMinutes = Math.max(0, settings.standardStart - start);
  const overtimeMinutes = Math.max(0, end - settings.standardEnd);
  return { workMinutes, earlyMinutes, overtimeMinutes, breakMin };
}

function generateExcel(records, employeeName, yearMonth, settings) {
  const wb = XLSX.utils.book_new();

  const colWidths = [
    { wch: 12 }, // 日付
    { wch: 14 }, // 現場名
    { wch: 7 },  // 出勤
    { wch: 7 },  // 退勤
    { wch: 9 },  // 実労働
    { wch: 9 },  // 早出
    { wch: 9 },  // 残業
    { wch: 9 },  // 時間外計
    { wch: 20 }, // 備考
  ];

  // --- 社員ごとにグループ化 ---
  const grouped = {};
  records.forEach(r => {
    const name = r.employee_name;
    if (!grouped[name]) grouped[name] = [];
    grouped[name].push(r);
  });

  const employeeNames = Object.keys(grouped);
  const summaryRows = [];

  // --- 社員ごとに個別シートを作成 ---
  employeeNames.forEach(name => {
    const empRecords = grouped[name];
    let totalWork = 0, totalEarly = 0, totalOt = 0;

    const data = empRecords.map(r => {
      const c = calcRow(r, settings);
      totalWork += c.workMinutes;
      totalEarly += c.earlyMinutes;
      totalOt += c.overtimeMinutes;

      return {
        '日付': r.date,
        '現場名': r.site,
        '出勤': r.start_time,
        '退勤': r.end_time,
        '実労働': fmtH(c.workMinutes),
        '早出': c.earlyMinutes > 0 ? fmtH(c.earlyMinutes) : '',
        '残業': c.overtimeMinutes > 0 ? fmtH(c.overtimeMinutes) : '',
        '時間外計': (c.earlyMinutes + c.overtimeMinutes) > 0 ? fmtH(c.earlyMinutes + c.overtimeMinutes) : '',
        '備考': r.note || '',
      };
    });

    // 空行 + 合計行
    data.push({});
    data.push({
      '日付': '【合計】',
      '現場名': `${empRecords.length}日出勤`,
      '出勤': '',
      '退勤': '',
      '実労働': fmtH(totalWork),
      '早出': fmtH(totalEarly),
      '残業': fmtH(totalOt),
      '時間外計': fmtH(totalEarly + totalOt),
      '備考': '',
    });

    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = colWidths;

    // シート名は最大31文字
    const sheetName = name.length > 31 ? name.slice(0, 31) : name;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // サマリー用に集計を記録
    summaryRows.push({
      '社員名': name,
      '出勤日数': empRecords.length,
      '総労働時間': fmtH(totalWork),
      '早出合計': fmtH(totalEarly),
      '残業合計': fmtH(totalOt),
      '時間外合計': fmtH(totalEarly + totalOt),
    });
  });

  // --- 全体サマリーシート（複数人の場合のみ） ---
  if (employeeNames.length > 1) {
    // 全体合計
    let grandWork = 0, grandEarly = 0, grandOt = 0, grandDays = 0;
    summaryRows.forEach(r => {
      grandDays += r['出勤日数'];
    });
    records.forEach(r => {
      const c = calcRow(r, settings);
      grandWork += c.workMinutes;
      grandEarly += c.earlyMinutes;
      grandOt += c.overtimeMinutes;
    });

    summaryRows.push({});
    summaryRows.push({
      '社員名': '【全体合計】',
      '出勤日数': grandDays,
      '総労働時間': fmtH(grandWork),
      '早出合計': fmtH(grandEarly),
      '残業合計': fmtH(grandOt),
      '時間外合計': fmtH(grandEarly + grandOt),
    });

    const summaryWs = XLSX.utils.json_to_sheet(summaryRows);
    summaryWs['!cols'] = [
      { wch: 12 }, // 社員名
      { wch: 10 }, // 出勤日数
      { wch: 12 }, // 総労働
      { wch: 10 }, // 早出
      { wch: 10 }, // 残業
      { wch: 10 }, // 時間外
    ];

    // サマリーシートを先頭に挿入
    XLSX.utils.book_append_sheet(wb, summaryWs, '全体サマリー');
    // シート順を並べ替え（サマリーを先頭に）
    const names = wb.SheetNames;
    const last = names.pop();
    names.unshift(last);
    wb.SheetNames = names;
  }

  const title = employeeName
    ? `${yearMonth}_${employeeName}`
    : `${yearMonth}_全社員`;

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return { buffer, filename: `勤務表_${title}.xlsx` };
}

module.exports = { generateExcel };
