import { useCallback } from 'react';
import { triggerHaptic } from '../lib/haptics';
import { playTouchSound } from '../lib/touchSound';

/**
 * One call fires both feedback channels at whatever the person has set in
 * Settings. Wired into Button/IconButton/Fab/BottomNav so every tap in the
 * app gets consistent feedback without each page thinking about it.
 * @returns {() => void}
 */
export function useFeedback() {
  return useCallback(() => {
    triggerHaptic();
    playTouchSound();
  }, []);
}
