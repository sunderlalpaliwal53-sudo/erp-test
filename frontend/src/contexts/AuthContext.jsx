import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    const token = localStorage.getItem('stv_token');
    if (!token) { setUser(null); setLoading(false); return; }
    try {
      const { data } = await api.get('/auth/me');
      setUser(data);
    } catch (e) {
      localStorage.removeItem('stv_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMe(); }, [loadMe]);

  // Listen for global 401/session-expired events (fired by axios interceptor)
  useEffect(() => {
    const h = () => setUser(null);
    window.addEventListener('stv:auth-expired', h);
    return () => window.removeEventListener('stv:auth-expired', h);
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email: (email || '').trim().toLowerCase(), password });
    localStorage.setItem('stv_token', data.access_token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('stv_token');
    localStorage.removeItem('stv_school');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh: loadMe }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
