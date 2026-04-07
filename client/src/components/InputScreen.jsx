import { useEffect, useState } from 'react';
import { getSites, addSite as apiAddSite, addRecord, updateRecord } from '../api';
import { todayISO } from '../utils/time';
import BottomNav from './BottomNav';

const DISTRICTS = ['A地区', 'B地区', 'C地区', 'その他'];
const DAY_TYPES = [
  { value: 'work', label: '出勤' },
  { value: 'off', label: '休み' },
  { value: 'alloff', label: '全休' },
];

export default function InputScreen({ user, editingRecord, onSaved, onNavigate, onLogout, toast }) {
  const [sites, setSites] = useState([]);
  const [date, setDate] = useState(todayISO());
  const [dayType, setDayType] = useState('work');
  const [district, setDistrict] = useState('A地区');
  const [site, setSite] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:30');
  const [breakMin, setBreakMin] = useState(90);
  const [note, setNote] = useState('');
  const [newSiteName, setNewSiteName] = useState('');

  useEffect(() => {
    loadSites();
  }, []);

  useEffect(() => {
    if (editingRecord) {
      setDate(editingRecord.date);
      setDayType(editingRecord.day_type || 'work');
      setSite(editingRecord.site);
      setStartTime(editingRecord.start_time);
      setEndTime(editingRecord.end_time);
      setBreakMin(editingRecord.break_minutes ?? 90);
      setNote(editingRecord.note || '');
    } else {
      resetForm();
    }
  }, [editingRecord]);

  function resetForm() {
    setDate(todayISO());
    setDayType('work');
    setSite('');
    setStartTime('08:00');
    setEndTime('17:30');
    setBreakMin(90);
    setNote('');
  }

  async function loadSites() {
    try {
      const data = await getSites();
      setSites(data);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleAddSite() {
    if (!newSiteName.trim()) return;
    try {
      await apiAddSite(newSiteName.trim(), district);
      setNewSiteName('');
      loadSites();
      toast('現場名を登録しました');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function handleSave() {
    if (dayType === 'work' && (!date || !site.trim() || !startTime || !endTime)) {
      toast('日付・現場名・勤務時間を入力してください', 'error');
      return;
    }
    if (dayType !== 'work' && !date) {
      toast('日付を入力してください', 'error');
      return;
    }
    const dayLabel = dayType === 'off' ? '休み' : dayType === 'alloff' ? '全休' : '';
    const saveSite = dayType === 'work' ? site.trim() : dayLabel;
    const saveStart = dayType === 'work' ? startTime : '00:00';
    const saveEnd = dayType === 'work' ? endTime : '00:00';
    const saveBreak = dayType === 'work' ? breakMin : 0;
    try {
      if (editingRecord) {
        await updateRecord(editingRecord.id, {
          date, site: saveSite, start_time: saveStart, end_time: saveEnd, break_minutes: saveBreak, note, day_type: dayType,
        });
        toast('勤務を更新しました');
      } else {
        await addRecord({
          employee_id: user.id, date, site: saveSite, start_time: saveStart, end_time: saveEnd, break_minutes: saveBreak, note, day_type: dayType,
        });
        toast('保存しました');
      }
      resetForm();
      onSaved();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-header text-white px-4 py-3.5 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-base font-semibold">{user.name} - 勤務入力</h1>
        <button onClick={onLogout} className="bg-white/15 px-3 py-1.5 rounded-md text-xs">ログアウト</button>
      </header>

      <div className="p-4 max-w-lg mx-auto">
        {/* 出勤/休み切替 */}
        <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {DAY_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setDayType(t.value)}
                className={`flex-1 py-2.5 rounded-md text-sm font-semibold transition-colors ${
                  dayType === t.value
                    ? t.value === 'work' ? 'bg-primary text-white shadow-sm'
                    : t.value === 'off' ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-gray-600 text-white shadow-sm'
                    : 'text-gray-500'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* 日付 */}
        <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
          <h2 className="text-sm text-gray-400 mb-2 font-medium">日付</h2>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full p-2.5 border border-gray-200 rounded-lg text-base focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>

        {/* 地区・現場名 */}
        {dayType === 'work' && <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
          <h2 className="text-sm text-gray-400 mb-2 font-medium">地区</h2>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-3">
            {DISTRICTS.map((d) => (
              <button
                key={d}
                onClick={() => setDistrict(d)}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                  district === d
                    ? 'bg-white text-header shadow-sm'
                    : 'text-gray-500'
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          <h2 className="text-sm text-gray-400 mb-2 font-medium">現場名</h2>
          <div className="flex flex-wrap gap-2 mb-2.5">
            {sites.filter((s) => s.district === district || (!s.district && district === 'A地区')).map((s) => (
              <button
                key={s.id}
                onClick={() => setSite(s.name)}
                className={`px-3.5 py-2 rounded-full text-sm border transition-colors ${
                  site === s.name
                    ? 'bg-primary text-white border-primary'
                    : 'bg-blue-50 text-primary-dark border-blue-200'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={site}
            onChange={(e) => setSite(e.target.value)}
            placeholder="現場名を入力（またはボタンで選択）"
            className="w-full p-2.5 border border-gray-200 rounded-lg text-base focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={newSiteName}
              onChange={(e) => setNewSiteName(e.target.value)}
              placeholder="新しい現場名を登録"
              className="flex-1 p-2 border border-gray-200 rounded-lg text-sm"
            />
            <button onClick={handleAddSite} className="bg-primary text-white px-3.5 rounded-lg text-sm whitespace-nowrap">
              登録
            </button>
          </div>
        </div>}

        {/* 勤務時間 */}
        {dayType === 'work' && <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
          <h2 className="text-sm text-gray-400 mb-2 font-medium">勤務時間</h2>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">出勤</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full p-2.5 border border-gray-200 rounded-lg text-base focus:outline-none focus:border-primary"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">退勤</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full p-2.5 border border-gray-200 rounded-lg text-base focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>}

        {/* 休み・全休メッセージ */}
        {dayType !== 'work' && (
          <div className="bg-white rounded-xl p-6 mb-4 shadow-sm text-center">
            <div className="text-4xl mb-2">{dayType === 'off' ? '🏖️' : '📅'}</div>
            <div className="text-lg font-semibold text-gray-600">
              {dayType === 'off' ? '休み' : '全休'}として記録します
            </div>
          </div>
        )}

        {/* 備考 */}
        <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
          <h2 className="text-sm text-gray-400 mb-2 font-medium">備考</h2>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="備考があれば入力"
            className="w-full p-2.5 border border-gray-200 rounded-lg text-base h-16 resize-y font-[inherit] focus:outline-none focus:border-primary"
          />
        </div>

        <button onClick={handleSave} className="w-full bg-primary text-white py-3.5 rounded-xl text-base font-semibold active:bg-primary-dark">
          {editingRecord ? '更新する' : '保存する'}
        </button>

        <div className="h-16" />
      </div>

      <BottomNav current="input" onNavigate={onNavigate} />
    </div>
  );
}
