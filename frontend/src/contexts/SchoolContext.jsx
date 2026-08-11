import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setActiveSchoolRef } from '@/lib/api';
import { useAuth } from './AuthContext';

const SchoolContext = createContext(null);

export const SchoolProvider = ({ children }) => {
  const { user } = useAuth();
  const [schools, setSchools] = useState([]);
  const [activeSchoolId, setActiveSchoolIdState] = useState(null);
  const [loading, setLoading] = useState(false);

  // Wrapper that keeps state, localStorage and module-level ref in sync.
  const applyActive = useCallback((id) => {
    setActiveSchoolRef(id);
    setActiveSchoolIdState(id);
  }, []);

  const loadSchools = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await api.get('/auth/my-schools');
      setSchools(data);
      const stored = localStorage.getItem('stv_school');
      if (data.find((s) => s.id === stored)) applyActive(stored);
      else if (user.school_id && data.find((s) => s.id === user.school_id)) applyActive(user.school_id);
      else if (data.length) applyActive(data[0].id);
      else applyActive(null);
    } finally { setLoading(false); }
  }, [user, applyActive]);

  useEffect(() => { loadSchools(); }, [loadSchools]);

  // Clear active school when the user logs out
  useEffect(() => {
    if (!user) {
      setSchools([]);
      applyActive(null);
    }
  }, [user, applyActive]);

  const switchSchool = (id) => {
    applyActive(id);
    // Force page components to re-fetch by dispatching an event
    window.dispatchEvent(new CustomEvent('stv:school-changed', { detail: id }));
  };

  const activeSchool = schools.find((s) => s.id === activeSchoolId) || null;

  return (
    <SchoolContext.Provider value={{ schools, activeSchool, activeSchoolId, switchSchool, refresh: loadSchools, loading }}>
      {children}
    </SchoolContext.Provider>
  );
};

export const useSchool = () => useContext(SchoolContext);
