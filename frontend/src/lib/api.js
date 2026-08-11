import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

// Module-level cache of the currently active school. Updated synchronously
// by SchoolContext BEFORE any React state update fires. Prevents the race
// where a school-scoped API call is dispatched before localStorage has been
// updated by the switching logic.
let _activeSchoolId = null;
try { _activeSchoolId = localStorage.getItem('stv_school') || null; } catch (e) { /* ignore */ }
export const setActiveSchoolRef = (id) => {
  _activeSchoolId = id || null;
  try {
    if (id) localStorage.setItem('stv_school', id);
    else localStorage.removeItem('stv_school');
  } catch (e) { /* ignore quota */ }
};
export const getActiveSchoolRef = () => _activeSchoolId;

export const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('stv_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const schoolId = _activeSchoolId || localStorage.getItem('stv_school');
  if (schoolId) config.headers['X-School-Id'] = schoolId;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err.response && err.response.status;
    const url = (err.config && err.config.url) || '';
    // Only treat 401 as session expiry when NOT coming from the login endpoint itself.
    // A failed login attempt (bad credentials) must not wipe a valid existing session.
    if (status === 401 && !url.includes('/auth/login')) {
      localStorage.removeItem('stv_token');
      // Notify listeners (AuthContext) to clear user state
      window.dispatchEvent(new Event('stv:auth-expired'));
    }
    return Promise.reject(err);
  }
);

export const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const shortMoney = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function downloadAsPdf(path, filename) {
  const resp = await api.get(path, { responseType: 'blob' });
  downloadBlob(resp.data, filename);
}
