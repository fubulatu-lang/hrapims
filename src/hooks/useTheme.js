import { useEffect, useState } from 'react';

const KEY = 'hrapims.theme';

/**
 * Every theme the app supports. Adding a 6th theme is a two-step change:
 * add a token block in src/index.css under `[data-theme="..."]`, then add
 * one entry here — no component anywhere references a color value
 * directly, so nothing else needs to change (this is the config-driven
 * approach the design system is built around).
 */
export const THEMES = [
  { value: 'light', label: 'Light', icon: 'light_mode' },
  { value: 'dark', label: 'Dark', icon: 'dark_mode' },
  { value: 'midnight', label: 'Midnight (AMOLED)', icon: 'bedtime' },
  { value: 'slate', label: 'Slate', icon: 'water_drop' },
  { value: 'emerald', label: 'Emerald', icon: 'eco' },
];

function applyTheme(theme) {
  document.body.dataset.theme = theme;
}

/**
 * Reads/writes the active theme, applied via a `data-theme` attribute on
 * `<body>` so every color in the app updates from one CSS token swap —
 * no per-component dark-mode branching anywhere.
 * @returns {[string, (t: string) => void]}
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
