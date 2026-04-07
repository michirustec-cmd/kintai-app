const BASE = '/api';

async function request(path, options = {}, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(BASE + path, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'エラーが発生しました' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      // For blob responses (Excel export)
      if (res.headers.get('content-type')?.includes('spreadsheetml')) {
        return res;
      }
      return res.json();
    } catch (e) {
      // サーバーがスリープから復帰中の場合、リトライ
      if (attempt < retries && (e.name === 'TypeError' || e.message.includes('Failed to fetch'))) {
        await new Promise(r => setTimeout(r, 3000)); // 3秒待ってリトライ
        continue;
      }
      throw e;
    }
  }
}

// Employees
export const getEmployees = () => request('/employees');
export const addEmployee = (name) => request('/employees', { method: 'POST', body: JSON.stringify({ name }) });
export const updateEmployee = (id, name) => request(`/employees/${id}`, { method: 'PUT', body: JSON.stringify({ name }) });
export const deleteEmployee = (id) => request(`/employees/${id}`, { method: 'DELETE' });

// Sites
export const getSites = () => request('/sites');
export const addSite = (name) => request('/sites', { method: 'POST', body: JSON.stringify({ name }) });
export const deleteSite = (id) => request(`/sites/${id}`, { method: 'DELETE' });

// Records
export const getRecords = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return request(`/records?${q}`);
};
export const getRecordsSummary = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return request(`/records/summary?${q}`);
};
export const addRecord = (data) => request('/records', { method: 'POST', body: JSON.stringify(data) });
export const updateRecord = (id, data) => request(`/records/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteRecord = (id) => request(`/records/${id}`, { method: 'DELETE' });

// Settings
export const getSettings = () => request('/settings');
export const updateSettings = (data) => request('/settings', { method: 'PUT', body: JSON.stringify(data) });

// Excel Export
export async function exportExcel(params = {}) {
  const q = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE}/export?${q}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'エクスポートエラー' }));
    throw new Error(err.error);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') || '';
  const match = disposition.match(/filename\*=UTF-8''(.+)/);
  const filename = match ? decodeURIComponent(match[1]) : '勤務表.xlsx';

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
