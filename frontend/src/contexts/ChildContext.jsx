import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

/**
 * ChildContext: for parent users, tracks the currently-selected child so that
 * every parent-portal page (Home, Pay, Attendance, Homework) can share the
 * same active-child selection. Persists the choice in localStorage.
 */
const ChildContext = createContext(null);

const STORAGE_KEY = 'stv:activeChildId';

function normaliseChildIds(user) {
  const ids = new Set(user?.linked_student_ids || []);
  if (user?.linked_student_id) ids.add(user.linked_student_id);
  return Array.from(ids).filter(Boolean);
}

export function ChildProvider({ children }) {
  const { user } = useAuth();
  const [children_, setChildren] = useState([]);          // hydrated student docs
  const [activeChildId, setActiveChildId] = useState(null);
  const [loading, setLoading] = useState(false);

  const childIds = useMemo(() => normaliseChildIds(user), [user]);

  useEffect(() => {
    if (!user || user.role !== 'parent' || childIds.length === 0) {
      setChildren([]);
      setActiveChildId(null);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const results = await Promise.all(
          childIds.map((id) => api.get(`/students/${id}`).then((r) => r.data).catch(() => null))
        );
        const filtered = results.filter(Boolean);
        setChildren(filtered);
        // Choose an active child: previously chosen (if still linked) else the first.
        const stored = localStorage.getItem(STORAGE_KEY);
        const chosen = stored && filtered.some((c) => c.id === stored) ? stored : (filtered[0]?.id || null);
        setActiveChildId(chosen);
        if (chosen) localStorage.setItem(STORAGE_KEY, chosen);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, childIds.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectChild = useCallback((id) => {
    setActiveChildId(id);
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const activeChild = useMemo(
    () => children_.find((c) => c.id === activeChildId) || null,
    [children_, activeChildId],
  );

  const value = useMemo(
    () => ({ children: children_, activeChild, activeChildId, selectChild, loading, hasMultiple: children_.length > 1 }),
    [children_, activeChild, activeChildId, selectChild, loading],
  );
  return <ChildContext.Provider value={value}>{children}</ChildContext.Provider>;
}

export function useChild() {
  const ctx = useContext(ChildContext);
  if (!ctx) {
    // Default no-op when outside a provider (non-parent pages).
    return { children: [], activeChild: null, activeChildId: null, selectChild: () => {}, loading: false, hasMultiple: false };
  }
  return ctx;
}
