import { useRef } from 'react';

const MIN_DISTANCE = 60; // px — short flicks shouldn't trigger navigation
const MAX_OFF_AXIS_RATIO = 1.5; // how much more horizontal than vertical movement must be

/**
 * Returns touch event handlers that call `onSwipeLeft`/`onSwipeRight` when
 * the person swipes horizontally past a threshold. Spread the result onto
 * whatever container should be swipeable.
 * @param {() => void} [onSwipeLeft]
 * @param {() => void} [onSwipeRight]
 * @example
 * const swipeHandlers = useSwipeGesture(goToNextTab, goToPrevTab);
 * <div {...swipeHandlers}>{page}</div>
 */
export function useSwipeGesture(onSwipeLeft, onSwipeRight) {
  const start = useRef(null);

  function onTouchStart(e) {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
  }

  function onTouchEnd(e) {
    if (!start.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.current.x;
    const dy = t.clientY - start.current.y;
    start.current = null;
    if (Math.abs(dx) < MIN_DISTANCE) return;
    if (Math.abs(dx) < Math.abs(dy) * MAX_OFF_AXIS_RATIO) return; // too vertical — probably a scroll
    if (dx < 0) onSwipeLeft?.();
    else onSwipeRight?.();
  }

  return { onTouchStart, onTouchEnd };
}
