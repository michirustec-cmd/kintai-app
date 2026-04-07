import { useEffect } from 'react';

export default function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onClose, 2000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div
      className={`fixed bottom-20 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl text-white text-sm font-semibold z-50 transition-opacity ${
        type === 'error' ? 'bg-danger' : 'bg-success'
      }`}
    >
      {message}
    </div>
  );
}
