import { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * SessionContext — deliberately minimal for now.
 *
 * This is a PSEUDO login: tapping "Staff" or "Administrator" sets a role
 * and nothing else. There are no credentials, no server-issued token, and
 * the API does not check this value — it is purely a client-side UI mode
 * switch (which screens/actions are shown).
 *
 * The backend (server/src/index.js) already has real, ready-to-enable
 * infrastructure for credential auth (bcrypt-hashed PINs + JWT sessions,
 * `/api/auth/login`, `/api/staff` management). When that's switched on,
 * this is the single place that needs to change: `login()` would call the
 * real endpoint and store a token instead of just a role string, and
 * `apiRequest` (src/lib/api.js) would read that token onto every request.
 * No page component needs to know the difference.
 */
const SessionContext = createContext(null);

const STORAGE_KEY = 'hrapims.session';

function readStoredRole() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && (parsed.role === 'STAFF' || parsed.role === 'ADMIN') ? parsed.role : null;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }) {
  const [role, setRole] = useState(readStoredRole);

  const login = useCallback((nextRole) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ role: nextRole }));
    setRole(nextRole);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setRole(null);
  }, []);

  const value = useMemo(
    () => ({ role, isAdmin: role === 'ADMIN', isAuthenticated: !!role, login, logout }),
    [role, login, logout]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** @returns {{role: 'STAFF'|'ADMIN'|null, isAdmin: boolean, isAuthenticated: boolean, login: (role: string) => void, logout: () => void}} */
export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
}
