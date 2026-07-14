import { useEffect, useState } from 'react';

// Module-level (not component-level) on purpose: AppShell remounts each
// page's component tree on every navigation (`key={view}`), which would
// normally reset local useState. Stashing values here instead means
// "back" from a patient's detail page lands on the same list page /
// search query the person left, exactly like a native app. This is
// intentionally scoped to the current tab session — it resets on a full
// page reload, which is the expected/acceptable boundary.
const store = {};

/**
 * Drop-in replacement for `useState` whose value survives the owning
 * component being unmounted and remounted (e.g. by in-app navigation),
 * as long as the browser tab stays open.
 *
 * @template T
 * @param {string} key - unique per screen, e.g. 'patientList' or 'search'
 * @param {T} initialValue
 * @returns {[T, (value: T | ((prev: T) => T)) => void]}
 *
 * @example
 * const [page, setPage] = usePageState('patientList.page', 1);
 */
export function usePageState(key, initialValue) {
  const [value, setValue] = useState(() => (key in store ? store[key] : initialValue));

  useEffect(() => {
    store[key] = value;
  }, [key, value]);

  return [value, setValue];
}
