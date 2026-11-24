import { useCallback, useRef } from 'react';

// Pointer-drag panning for scrollable boards (weekly planner). Ignnores drags
// that start on interactive elements so buttons/inputs keep working; requires
// DRAG_THRESHOLD px of movement before scrolling kicks in.
const DRAG_THRESHOLD = 4;
const INTERACTIVE_SELECTOR = 'button, a, input, select, textarea, [draggable="true"], [contenteditable="true"]';

/** Attach `ref` + `onPointerDown` to a scroll container for click-and-drag panning. */
export function useDragScroll() {
  const ref = useRef<HTMLDivElement | null>(null);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return;
    const el = ref.current;
    if (!el) return;

    const startX = event.clientX;
    const startY = event.clientY;
    let lastX = event.clientX;
    let lastY = event.clientY;
    let dragging = false;

    const onMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - lastX;
      const dy = moveEvent.clientY - lastY;
      lastX = moveEvent.clientX;
      lastY = moveEvent.clientY;
      if (!dragging) {
        if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < DRAG_THRESHOLD) return;
        dragging = true;
        el.classList.add('cursor-grabbing');
        el.classList.remove('cursor-grab');
      }
      el.scrollLeft -= dx;
      el.scrollTop -= dy;
      moveEvent.preventDefault();
    };

    const onUp = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.classList.remove('cursor-grabbing');
      el.classList.add('cursor-grab');
    };

    el.setPointerCapture(event.pointerId);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  }, []);

  return { ref, onPointerDown };
}
