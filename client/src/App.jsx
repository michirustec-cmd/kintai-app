import { useState, useCallback } from 'react';
import LoginScreen from './components/LoginScreen';
import InputScreen from './components/InputScreen';
import ListScreen from './components/ListScreen';
import AdminScreen from './components/AdminScreen';
import Toast from './components/Toast';

export default function App() {
  const [screen, setScreen] = useState('login'); // login, input, list, admin
  const [user, setUser] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const [toastType, setToastType] = useState('success');

  const toast = useCallback((msg, type = 'success') => {
    setToastMsg(msg);
    setToastType(type);
  }, []);

  function handleLogin(emp) {
    setUser(emp);
    setEditingRecord(null);
    setScreen('input');
  }

  function handleLogout() {
    setUser(null);
    setEditingRecord(null);
    setScreen('login');
  }

  function handleNavigate(target) {
    if (target === 'input') {
      setEditingRecord(null);
    }
    setScreen(target);
  }

  function handleEdit(record) {
    setEditingRecord(record);
    setScreen('input');
  }

  function handleSaved() {
    setEditingRecord(null);
  }

  return (
    <>
      {screen === 'login' && (
        <LoginScreen onLogin={handleLogin} onAdmin={() => setScreen('admin')} />
      )}
      {screen === 'input' && user && (
        <InputScreen
          user={user}
          editingRecord={editingRecord}
          onSaved={handleSaved}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          toast={toast}
        />
      )}
      {screen === 'list' && user && (
        <ListScreen
          user={user}
          onNavigate={handleNavigate}
          onEdit={handleEdit}
          onLogout={handleLogout}
          toast={toast}
        />
      )}
      {screen === 'admin' && (
        <AdminScreen onBack={() => setScreen('login')} toast={toast} />
      )}

      <Toast message={toastMsg} type={toastType} onClose={() => setToastMsg(null)} />
    </>
  );
}
