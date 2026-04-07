export default function BottomNav({ current, onNavigate }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white flex border-t border-gray-200 z-10 pb-[env(safe-area-inset-bottom)]">
      <button
        onClick={() => onNavigate('input')}
        className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs ${
          current === 'input' ? 'text-primary' : 'text-gray-400'
        }`}
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
        入力
      </button>
      <button
        onClick={() => onNavigate('list')}
        className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs ${
          current === 'list' ? 'text-primary' : 'text-gray-400'
        }`}
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        </svg>
        履歴
      </button>
    </div>
  );
}
