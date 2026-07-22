import { useState } from 'react';

const KEY = 'hrapims.patientSort';

/**
 * Sort preference, remembered across screens and visits (so choosing
 * "Name" on the Patients list also applies when you go to Search).
 * @returns {{sortBy: string, sortDir: 'asc'|'desc', setSort: (by: string, dir: 'asc'|'desc') => void, queryParams: string}}
 */
export function useSort() {
  const [state, setState] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (raw && raw.sortBy && raw.sortDir) return raw;
    } catch { /* ignore */ }
    return { sortBy: 'created', sortDir: 'desc' };
  });

  function setSort(sortBy, sortDir) {
    const next = { sortBy, sortDir };
    localStorage.setItem(KEY, JSON.stringify(next));
    setState(next);
  }

  const queryParams = `sortBy=${state.sortBy}&sortDir=${state.sortDir}`;
  return { sortBy: state.sortBy, sortDir: state.sortDir, setSort, queryParams };
}
