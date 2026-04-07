import { useEffect, useState } from 'react';
import {
  getEmployees, addEmployee, updateEmployee, deleteEmployee,
  getSites, addSite, deleteSite,
  getRecords, exportExcel, getSettings, updateSettings,
} from '../api';
import { minutesToDisplay, minutesToHours, currentMonth, getDayOfWeek } from '../utils/time';

export default function AdminScreen({ onBack, toast }) {
  const [tab, setTab] = useState('records');
  const [employees, setEmployees] = useState([]);
  const [sites, setSites] = useState([]);
  const [records, setRecords] = useState([]);
  const [filterEmp, setFilterEmp] = useState('');
  const [filterMonth, setFilterMonth] = useState(currentMonth());
  const [newSiteName, setNewSiteName] = useState('');
  const [standardHours, setStandardHours] = useState('8');
  const [standardStart, setStandardStart] = useState('08:00');
  const [standardEnd, setStandardEnd] = useState('17:30');
  const [defaultBreak, setDefaultBreak] = useState('90');

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    loadRecords();
  }, [filterEmp, filterMonth]);

  async function loadAll() {
    try {
      const [emps, sts, settings] = await Promise.all([getEmployees(), getSites(), getSettings()]);
      setEmployees(emps);
      setSites(sts);
      if (settings.standard_hours) setStandardHours(settings.standard_hours);
      if (settings.standard_start) setStandardStart(settings.standard_start);
      if (settings.standard_end) setStandardEnd(settings.standard_end);
      if (settings.default_break) setDefaultBreak(settings.default_break);
    } catch (e) {
      console.error(e);
    }
  }

  async function loadRecords() {
    try {
      const params = {};
      if (filterEmp) params.employee_id = filterEmp;
      if (filterMonth) params.month = filterMonth;
      const recs = await getRecords(params);
      // Sort ascending for admin view
      recs.sort((a, b) => a.date.localeCompare(b.date) || a.employee_name.localeCompare(b.employee_name));
      setRecords(recs);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleExport() {
    try {
      const params = {};
      if (filterEmp) params.employee_id = filterEmp;
      if (filterMonth) params.month = filterMonth;
      await exportExcel(params);
      toast('Excelを出力しました');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function handleAddEmployee() {
    const name = window.prompt('新しい社員名を入力');
    if (!name?.trim()) return;
    try {
      await addEmployee(name.trim());
      loadAll();
      toast('社員を追加しました');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function handleUpdateEmployee(id, oldName) {
    const name = window.prompt('社員名を変更', oldName);
    if (!name?.trim() || name.trim() === oldName) return;
    try {
      await updateEmployee(id, name.trim());
      loadAll();
      toast('社員名を変更しました');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function handleDeleteEmployee(id, name) {
    if (!window.confirm(`${name}を削除しますか？`)) return;
    try {
      await deleteEmployee(id);
      loadAll();
      toast('社員を削除しました');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function handleAddSite() {
    if (!newSiteName.trim()) return;
    try {
      await addSite(newSiteName.trim());
      setNewSiteName('');
      loadAll();
      toast('現場名を追加しました');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function handleDeleteSite(id, name) {
    if (!window.confirm(`${name}を削除しますか？`)) return;
    try {
      await deleteSite(id);
      loadAll();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function handleSaveSettings() {
    try {
      await updateSettings({
        standard_hours: standardHours,
        standard_start: standardStart,
        standard_end: standardEnd,
        default_break: defaultBreak,
      });
      toast('設定を保存しました');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-header text-white px-4 py-3.5 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-base font-semibold">管理画面</h1>
        <button onClick={onBack} className="bg-white/15 px-3 py-1.5 rounded-md text-xs">戻る</button>
      </header>

      <div className="p-4 max-w-lg mx-auto">
        {/* タブ */}
        <div className="flex gap-1 bg-gray-200 rounded-xl p-1 mb-4">
          {['records', 'settings'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
                tab === t ? 'bg-white text-gray-800 font-semibold shadow-sm' : 'text-gray-500'
              }`}
            >
              {t === 'records' ? '勤務一覧' : '設定'}
            </button>
          ))}
        </div>

        {tab === 'records' && (
          <>
            {/* フィルター */}
            <div className="flex gap-2 mb-3 flex-wrap">
              <select
                value={filterEmp}
                onChange={(e) => setFilterEmp(e.target.value)}
                className="p-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="">全社員</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
              <input
                type="month"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="p-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>

            {/* テーブル */}
            {records.length === 0 ? (
              <div className="text-center text-gray-400 py-10 text-sm">データがありません</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse bg-white rounded-xl overflow-hidden shadow-sm text-xs">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="p-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">日付</th>
                      <th className="p-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">社員</th>
                      <th className="p-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">現場</th>
                      <th className="p-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">出勤</th>
                      <th className="p-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">退勤</th>
                      <th className="p-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">実働</th>
                      <th className="p-2.5 text-left font-semibold text-orange-500 whitespace-nowrap">早出</th>
                      <th className="p-2.5 text-left font-semibold text-danger whitespace-nowrap">残業</th>
                      <th className="p-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">備考</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50 border-t border-gray-100">
                        <td className="p-2.5 whitespace-nowrap">{r.date.slice(5).replace('-', '/')}</td>
                        <td className="p-2.5">{r.employee_name}</td>
                        <td className="p-2.5">{r.site}</td>
                        <td className="p-2.5">{r.start_time}</td>
                        <td className="p-2.5">{r.end_time}</td>
                        <td className="p-2.5">{minutesToDisplay(r.work_minutes)}</td>
                        <td className="p-2.5 text-orange-500">{r.early_minutes > 0 ? minutesToHours(r.early_minutes) : '-'}</td>
                        <td className="p-2.5 text-danger">{r.overtime_minutes > 0 ? minutesToHours(r.overtime_minutes) : '-'}</td>
                        <td className="p-2.5 max-w-[120px] truncate">{r.note || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <button
              onClick={handleExport}
              className="w-full bg-green-600 text-white py-3 rounded-lg text-sm font-semibold mt-3 active:bg-green-700"
            >
              Excel(.xlsx) 出力
            </button>
          </>
        )}

        {tab === 'settings' && (
          <>
            {/* 社員管理 */}
            <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
              <h2 className="text-sm text-gray-400 mb-3 font-medium">社員管理</h2>
              {employees.map((e) => (
                <div key={e.id} className="flex items-center gap-2 mb-2">
                  <span className="flex-1 p-2 bg-gray-50 rounded-lg text-sm">{e.name}</span>
                  <button
                    onClick={() => handleUpdateEmployee(e.id, e.name)}
                    className="border border-gray-200 px-2.5 py-1.5 rounded-lg text-xs text-gray-500"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDeleteEmployee(e.id, e.name)}
                    className="bg-danger text-white w-8 h-8 rounded-lg text-base"
                  >
                    &times;
                  </button>
                </div>
              ))}
              <button
                onClick={handleAddEmployee}
                className="bg-gray-100 px-4 py-2 rounded-lg text-sm text-gray-500 mt-1"
              >
                + 社員を追加
              </button>
            </div>

            {/* 現場名管理 */}
            <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
              <h2 className="text-sm text-gray-400 mb-3 font-medium">現場名管理</h2>
              <div className="flex flex-wrap gap-2 mb-3">
                {sites.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleDeleteSite(s.id, s.name)}
                    title="クリックで削除"
                    className="bg-blue-50 text-primary-dark border border-blue-200 px-3 py-1.5 rounded-full text-sm"
                  >
                    {s.name} &times;
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                  placeholder="新しい現場名"
                  className="flex-1 p-2 border border-gray-200 rounded-lg text-sm"
                />
                <button onClick={handleAddSite} className="bg-primary text-white px-3.5 rounded-lg text-sm">追加</button>
              </div>
            </div>

            {/* 勤務時間設定 */}
            <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
              <h2 className="text-sm text-gray-400 mb-3 font-medium">勤務時間設定</h2>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">定時開始</label>
                  <input
                    type="time"
                    value={standardStart}
                    onChange={(e) => setStandardStart(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-lg text-base"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">定時終了</label>
                  <input
                    type="time"
                    value={standardEnd}
                    onChange={(e) => setStandardEnd(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-lg text-base"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">所定労働時間</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={standardHours}
                      onChange={(e) => setStandardHours(e.target.value)}
                      min="1" max="24" step="0.5"
                      className="w-20 p-2.5 border border-gray-200 rounded-lg text-base"
                    />
                    <span className="text-sm text-gray-500">時間</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">休憩時間</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={defaultBreak}
                      onChange={(e) => setDefaultBreak(e.target.value)}
                      min="0" step="15"
                      className="w-20 p-2.5 border border-gray-200 rounded-lg text-base"
                    />
                    <span className="text-sm text-gray-500">分</span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-400 mb-3">
                定時開始より前 → 早出 ／ 定時終了より後 → 残業
              </p>

              <button
                onClick={handleSaveSettings}
                className="w-full bg-primary text-white py-2.5 rounded-lg text-sm font-semibold"
              >
                設定を保存
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
