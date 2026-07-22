import { createContext, useContext, useMemo, useState } from 'react';

/**
 * Minimal in-memory navigation: a `{ name, params }` pair plus a stack for
 * the back button. Deliberately NOT react-router — this app has no need
 * for deep-linkable URLs (it's a kiosk-style internal tool), and a second
 * router dependency isn't worth it for nine screens. If that changes
 * (e.g. you want a shareable link to a specific patient), swapping this
 * context's `navigate`/`back` for react-router's `useNavigate` touches
 * exactly one file — no page component imports this module directly,
 * they all go through the `useNavigation()` hook below.
 */
const NavigationContext = createContext(null);

export function NavigationProvider({ initialView = 'dashboard', children }) {
  const [stack, setStack] = useState([{ name: initialView, params: {} }]);

  const navigate = (name, params = {}) => setStack((s) => [...s, { name, params }]);
  const replace = (name, params = {}) => setStack((s) => [...s.slice(0, -1), { name, params }]);
  const goTo = (name, params = {}) => setStack([{ name, params }]); // reset stack (used by bottom nav taps)
  const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));

  const current = stack[stack.length - 1];
  const value = useMemo(() => ({ view: current.name, params: current.params, navigate, replace, goTo, back }), [current]);

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used within a NavigationProvider');
  return ctx;
}
