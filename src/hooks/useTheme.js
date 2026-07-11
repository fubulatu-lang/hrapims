import { useEffect, useState } from 'react';

const KEY = 'hrapims.theme';
export const THEMES = [
  { value: 'light', label: 'Light', icon: 'light_mode' },
  { value: 'dark', label: 'Dark', icon: 'dark_mode' },
  { value: 'midnight', label: 'Midnight (AMOLED)', icon: 'bedtime' },
];

function applyTheme(theme) {
  document.body.classList.toggle('dark', theme === 'dark' || theme === 'midnight');
  document.body.classList.toggle('midnight', theme === 'midnight');
}

/**
 * Three themes instead of a light/dark boolean: `light`, `dark`, and
 * `midnight` (true black backgrounds for AMOLED screens — saves battery
 * and gives real blacks instead of dark grey). `midnight` layers on top
 * of `dark`'s color roles (same CSS class) plus a `.midnight` override
 * that flattens the surface tones to pure black — see index.css.
 * @returns {['light'|'dark'|'midnight', (t: string) => void]}
 */
export function useTheme() {
  const [theme, setThemeState] = useState(() => localStorage.getItem(KEY) || 'light');

  useEffect(() => { applyTheme(theme); }, [theme]);

  const setTheme = (next) => {
    localStorage.setItem(KEY, next);
    setThemeState(next);
  };

  return [theme, setTheme];
}
