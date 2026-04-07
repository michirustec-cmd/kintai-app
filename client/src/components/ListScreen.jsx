import { useEffect, useState } from 'react';
import { getRecords, getRecordsSummary, deleteRecord } from '../api';
import { minutesToDisplay, minutesToHours, getDayOfWeek, currentMonth } from '../utils/time';
import BottomNav from './BottomNav';

export default function ListScreen({ user, onNavigate, onEdit, onLogout, toast }) {
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [month, setMonth] = useState(currentMonth());

  useEffect(() => {
    loadData();
  }, [month, user.id]);

  async function loadData() {
    try {
      const [recs, sum] = await Promise.all([
        getRecords({ employee_id: user.id, month }),
        getRecordsSummary({ employee_id: user.id, month }),
      ]);
      setRecords(recs);
      setSummary(sum);
    } catch (e) {
      console.error(e);
    }
  }

  function changeMonth(delta) {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setMonth(newMonth);
  }

  function displayMonth() {
    const [y, m] = month.split('-').map(Number);
    return `${y}年${m}月`;
  }

  async function handleDelete(id) {
    if (!window.confirm('この勤務記録を削除しますか？')) return;
    try {
      await deleteRecord(id);
      toast('削除しました');
      loadData();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-header text-white px-4 py-3.5 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-base font-semibold">{user.name} - 勤務履歴</h1>
        <button onClick={onLogout} className="bg-white/15 px-3 py-1.5 rounded-md text-xs">ログアウト</button>
      </header>

      <div className="p-4 max-w-lg mx-auto">
        {/* 月ナビゲーション */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <button onClick={() => changeMonth(-1)} className="bg-blue-50 px-3.5 py-2 rounded-lg text-sm text-primary-dark">
            &lt; 前月
          </button>
          <span className="text-base font-semibold">{displayMonth()}</span>
          <button onClick={() => changeMonth(1)} className="bg-blue-50 px-3.5 py-2 rounded-lg text-sm text-primary-dark">
            翌月 &gt;
          </button>
        </div>

        {/* 月次サマリー */}
        {summary && summary.total_days > 0 && (
          <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
            <h2 className="text-sm text-gray-400 mb-2 font-medium">月次サマリー</h2>
            <div className="grid grid-cols-3 gap-2 text-center mb-3">
              <div>
                <div className="text-2xl font-bold text-header">{summary.total_days}</div>
                <div className="text-xs text-gray-400">出勤日数</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">{minutesToDisplay(summary.total_work_minutes)}</div>
                <div className="text-xs text-gray-400">総労働時間</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">{minutesToHours(summary.total_extra_minutes)}</div>
                <div className="text-xs text-gray-400">時間外計</div>
              </div>
            </div>
            <div className="flex justify-center gap-6 pt-2 border-t border-gray-100">
              <div className="text-center">
                <div className="text-lg font-bold text-orange-500">{minutesToHours(summary.total_early_minutes)}</div>
                <div className="text-xs text-gray-400">早出</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-danger">{minutesToHours(summary.total_overtime_minutes)}</div>
                <div className="text-xs text-gray-400">残業</div>
              </div>
            </div>
          </div>
        )}

        {/* 記録一覧 */}
        {records.length === 0 ? (
          <div className="text-center text-gray-400 py-10 text-sm">この月の記録はありません</div>
        ) : (
          records.map((r) => (
            <div key={r.id} className="bg-white rounded-xl p-3.5 mb-2.5 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-sm font-bold text-header">
                    {r.date.replace(/-/g, '/')} ({getDayOfWeek(r.date)})
                  </div>
                  <div className="text-sm text-primary mt-0.5">{r.site}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {r.start_time} 〜 {r.end_time}
                    <span className="ml-2">
                      実働 {minutesToDisplay(r.work_minutes)}
                    </span>
                    {r.early_minutes > 0 && (
                      <span className="ml-2 text-orange-500">
                        早出 {minutesToHours(r.early_minutes)}
                      </span>
                    )}
                    {r.overtime_minutes > 0 && (
                      <span className="ml-2 text-danger">
                        残業 {minutesToHours(r.overtime_minutes)}
                      </span>
                    )}
                    {r.extra_total_minutes > 0 && (
                      <span className="ml-2 text-purple-600 font-semibold">
                        時間外計 {minutesToHours(r.extra_total_minutes)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {r.note && (
                <div className="text-xs text-gray-500 mt-1.5 bg-gray-50 px-2 py-1.5 rounded-md">{r.note}</div>
              )}
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => onEdit(r)}
                  className="border border-gray-200 px-3 py-1 rounded-md text-xs text-gray-500"
                >
                  編集
                </button>
                <button
                  onClick={() => handleDelete(r.id)}
                  className="border border-red-200 px-3 py-1 rounded-md text-xs text-danger"
                >
                  削除
                </button>
              </div>
            </div>
          ))
        )}

        <div className="h-16" />
      </div>

      <BottomNav current="list" onNavigate={onNavigate} />
    </div>
  );
}
