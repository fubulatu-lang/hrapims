import { useRef } from 'react';

const DEFAULT_THRESHOLD_MS = 500;

/**
 * Detects a press-and-hold (touch) or right-click (desktop) distinct from
 * a normal tap/click. The returned handlers are meant to be spread onto
 * the same element that also has a regular `onClick` — a long-press
 * suppresses the click that would otherwise follow it, so the two never
 * both fire for the same interaction.
 *
 * @param {(e: Event) => void} onLongPress
 * @param {{threshold?: number}} [options]
 * @example
 * const longPress = useLongPress(() => setPreviewOpen(true));
 * <button onClick={openDetail} {...longPress}>...</button>
 */
export function useLongPress(onLongPress, { threshold = DEFAULT_THRESHOLD_MS } = {}) {
  const timerRef = useRef(null);
  const firedRef = useRef(false);

  function start(e) {
    firedRef.current = false;
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      onLongPress(e);
    }, threshold);
  }
  function clear() {
    clearTimeout(timerRef.current);
  }
  function onClickCapture(e) {
    if (firedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      firedRef.current = false;
    }
  }
  function onContextMenu(e) {
    e.preventDefault();
    onLongPress(e);
  }

  return {
    onTouchStart: start,
    onTouchEnd: clear,
    onTouchMove: clear, // a moving finger is a scroll, not a hold
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: clear,
    onContextMenu,
    onClickCapture,
  };
}
