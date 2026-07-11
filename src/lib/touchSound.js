const KEY = 'hrapims.soundLevel';

/** 5 volume levels, 0 is off. Synthesized (no audio file to ship/host). */
export const SOUND_LEVELS = [
  { value: 0, label: 'Off', volume: 0 },
  { value: 1, label: 'Quiet', volume: 0.25 },
  { value: 2, label: 'Medium', volume: 0.5 },
  { value: 3, label: 'Loud', volume: 0.75 },
  { value: 4, label: 'Max', volume: 1 },
];

export function getSoundLevel() {
  const n = parseInt(localStorage.getItem(KEY), 10);
  return Number.isNaN(n) ? 0 : Math.min(4, Math.max(0, n));
}

export function setSoundLevel(level) {
  localStorage.setItem(KEY, String(level));
}

let audioCtx = null;
function getContext() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  return audioCtx;
}

/**
 * Plays a short synthesized click. Deliberately tiny/percussive (a decaying
 * sine blip) rather than a loud tone — this fires on every tap, so it needs
 * to disappear into the background at normal volumes.
 */
export function playTouchSound() {
  const level = getSoundLevel();
  const volume = SOUND_LEVELS[level]?.volume || 0;
  if (volume <= 0) return;
  const ctx = getContext();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 900;
    gain.gain.setValueAtTime(volume * 0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  } catch { /* audio blocked/unavailable — fail silently */ }
}
