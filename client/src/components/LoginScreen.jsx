import { useEffect, useState } from 'react';
import { getEmployees } from '../api';

const BG_COLORS = ['bg-white', 'bg-emerald-50', 'bg-amber-50', 'bg-purple-50'];

export default function LoginScreen({ onLogin, onAdmin }) {
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    getEmployees().then(setEmployees).catch(console.error);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-header to-primary flex flex-col items-center justify-center px-4">
      <h1 className="text-white text-2xl font-bold mb-2">勤怠管理</h1>
      <p className="text-white/70 text-sm mb-8">社員を選んでください</p>

      <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
        {employees.map((emp, i) => (
          <button
            key={emp.id}
            onClick={() => onLogin(emp)}
            className={`${BG_COLORS[i % 4]} rounded-xl py-5 px-4 text-lg font-semibold text-header shadow-md active:scale-95 transition-transform`}
          >
            {emp.name}
          </button>
        ))}
      </div>

      <div className="mt-10">
        <button
          onClick={onAdmin}
          className="bg-white/15 border border-white/30 text-white px-5 py-2.5 rounded-lg text-sm"
        >
          管理画面
        </button>
      </div>
    </div>
  );
}
