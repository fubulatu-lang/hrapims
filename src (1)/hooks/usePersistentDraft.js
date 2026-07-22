import { useEffect, useRef, useState } from 'react';

/**
 * Keeps `value` mirrored into localStorage (debounced) and restores it on
 * mount. Intended for the "new patient" form: if the app is closed
 * mid-entry, reopening it picks up exactly where the person left off.
 *
 * @template T
 * @param {string} key
 * @param {T} initialValue
 * @returns {[T, (value: T | ((prev: T) => T)) => void, () => void]} [value, setValue, clearDraft]
 *
 * @example
 * const [draft, setDraft, clearDraft] = usePersistentDraft('hrapims.draft.newPatient', emptyPatient);
 * <TextField value={draft.firstName} onChange={(v) => setDraft(d => ({ ...d, firstName: v }))} />
 * <Button onClick={clearDraft}>Clear</Button>
 */
export function usePersistentDraft(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? { ...initialValue, ...JSON.parse(raw) } : initialValue;
    } catch {
      return initialValue;
    }
  });
  const saveTimer = useRef(null);

  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full/unavailable — not fatal */ }
    }, 300);
    return () => clearTimeout(saveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, value]);

  function clearDraft() {
    localStorage.removeItem(key);
    setValue(initialValue);
  }

  return [value, setValue, clearDraft];
}
