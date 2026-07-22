const KEY = 'hrapims.hapticLevel';

/**
 * 5 strengths: 0 is off, the rest ramp up in vibration duration. Level 1
 * ("the 2nd level" counting Off as the 1st) is specified as exactly 60ms.
 */
export const HAPTIC_LEVELS = [
  { value: 0, label: 'Off', ms: 0 },
  { value: 1, label: 'Light', ms: 60 },
  { value: 2, label: 'Medium', ms: 90 },
  { value: 3, label: 'Strong', ms: 120 },
  { value: 4, label: 'Max', ms: 160 },
];

export function getHapticLevel() {
  const n = parseInt(localStorage.getItem(KEY), 10);
  return Number.isNaN(n) ? 2 : Math.min(4, Math.max(0, n));
}

export function setHapticLevel(level) {
  localStorage.setItem(KEY, String(level));
}

/** Fires a vibration at the current stored level. No-op on devices/browsers without the Vibration API (e.g. iOS Safari) — fails silently rather than throwing. */
export function triggerHaptic() {
  const level = getHapticLevel();
  const ms = HAPTIC_LEVELS[level]?.ms || 0;
  if (ms > 0 && typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(ms); } catch { /* ignore */ }
  }
}
