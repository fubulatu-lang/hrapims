import { useEffect, useState } from 'react';

const KEY = 'hrapims.darkMode';

/**
 * Dark mode is a device/display preference, not a session concern, so it's
 * intentionally separate from SessionContext and persists independently
 * of login state. Any component that calls this hook shares the same
 * value and can toggle it — call it once at the app root to apply the
 * class on first paint, and again anywhere you need a toggle control.
 * @returns {[boolean, (updater: boolean | ((prev: boolean) => boolean)) => void]}
 */
export function useDarkMode() {
  const [dark, setDarkState] = useState(() => localStorage.getItem(KEY) === 'true');

  useEffect(() => {
    document.body.classList.toggle('dark', dark);
  }, [dark]);

  const setDark = (updater) => {
    setDarkState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      localStorage.setItem(KEY, String(next));
      return next;
    });
  };

  return [dark, setDark];
}
