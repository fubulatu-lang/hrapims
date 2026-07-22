import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../lib/api';
import { registerLogoutHandler } from '../lib/authEvents';

/**
 * Real credential auth: username + password, verified server-side against
 * a bcrypt hash, session is a JWT stored here and attached to every API
 * request by lib/api.js. This replaced the earlier pseudo (role-only, no
 * credentials) login — see the v2.2.0 README section for why that existed
 * and what changed.
 *
 * Designed to leave room for MFA/SSO later without another rewrite: `login`
 * is already async and already the single seam between "the person proved
 * who they are" and "we have a session" — swapping in an MFA step or an
 * SSO redirect means changing what happens *inside* login/exchangeToken,
 * not how any page calls it.
 */
const SessionContext = createContext(null);

const STORAGE_KEY = 'hrapims.session';

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.token && parsed.staff ? parsed : null;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }) {
  const [session, setSession] = useState(readStored);

  const persist = (next) => {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
    setSession(next);
  };

  /** @returns {Promise<{mustChangePassword: boolean}>} */
  const login = useCallback(async (username, password) => {
    const data = await apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    persist({ token: data.token, staff: data.staff });
    return { mustChangePassword: !!data.staff.mustChangePassword };
  }, []);

  const logout = useCallback(() => {
    persist(null);
  }, []);

  // So lib/api.js can force a logout on a 401 without importing React.
  useEffect(() => { registerLogoutHandler(logout); }, [logout]);

  /** Called after a forced first-login password change succeeds. */
  const clearMustChangePassword = useCallback(() => {
    setSession((s) => {
      if (!s) return s;
      const next = { ...s, staff: { ...s.staff, mustChangePassword: false } };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    staff: session?.staff || null,
    role: session?.staff?.role || null,
    isAdmin: session?.staff?.role === 'ADMIN',
    isAuthenticated: !!session,
    mustChangePassword: !!session?.staff?.mustChangePassword,
    // Server-computed at login (role defaults + any per-staff overrides,
    // see PERMISSION_DEFAULTS in server/src/index.js) — this is a UI
    // convenience for showing/hiding actions, not the actual security
    // boundary, which is re-checked server-side on every gated request.
    can: (key) => !!session?.staff?.permissions?.[key],
    login,
    logout,
    clearMustChangePassword,
  }), [session, login, logout, clearMustChangePassword]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/**
 * @returns {{
 *   staff: {id:string, firstName:string, lastName:string, role:string, username:string, permissions:Object<string,boolean>}|null,
 *   role: 'STAFF'|'ADMIN'|null, isAdmin: boolean, isAuthenticated: boolean,
 *   mustChangePassword: boolean,
 *   can: (permissionKey: string) => boolean,
 *   login: (username: string, password: string) => Promise<{mustChangePassword: boolean}>,
 *   logout: () => void,
 *   clearMustChangePassword: () => void,
 * }}
 */
export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
}
