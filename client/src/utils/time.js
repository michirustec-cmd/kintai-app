/** 時間文字列 "HH:MM" を分数に変換 */
export function timeToMinutes(time) {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** 分数を "H:MM" 形式に変換 */
export function minutesToDisplay(minutes) {
  if (minutes <= 0) return '0:00';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** 分数を "1.5H" 形式に変換 */
export function minutesToHours(minutes) {
  if (minutes <= 0) return '0H';
  const h = Math.round((minutes / 60) * 10) / 10;
  // 整数なら小数点なし (8H)、端数あれば表示 (1.5H)
  return `${h % 1 === 0 ? h.toFixed(0) : h}H`;
}

/** 実労働時間（分）を計算 */
export function calcWorkMinutes(startTime, endTime, breakMinutes = 60) {
  const total = timeToMinutes(endTime) - timeToMinutes(startTime);
  return total - breakMinutes;
}

/** 残業時間（分）を計算 */
export function calcOvertimeMinutes(workMinutes, standardHours = 8) {
  return Math.max(0, workMinutes - standardHours * 60);
}

/** 今日の日付を "YYYY-MM-DD" 形式で返す */
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 今月を "YYYY-MM" 形式で返す */
export function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 曜日を取得 */
export function getDayOfWeek(dateStr) {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return days[new Date(dateStr).getDay()];
}
