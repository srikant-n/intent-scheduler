// Tests for useDragScroll: pointer-drag panning on a scroll container.
// jsdom lacks PointerEvent/setPointerCapture, so events are dispatched as
// MouseEvent-typed 'pointer*' events and setPointerCapture is stubbed.
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDragScroll } from './useDragScroll';

function Harness() {
  const { ref, onPointerDown } = useDragScroll();
  return (
    <div ref={ref} data-testid="scroller" onPointerDown={onPointerDown} className="cursor-grab">
      <button type="button">inside button</button>
      <span data-testid="pad">drag pad</span>
    </div>
  );
}

function pointerEvent(type: string, init: { clientX?: number; clientY?: number; button?: number; pointerId?: number } = {}) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
    button: init.button ?? 0,
  });
  Object.assign(event, { pointerId: init.pointerId ?? 1 });
  return event;
}

function setup() {
  render(<Harness />);
  const scroller = screen.getByTestId('scroller');
  scroller.setPointerCapture = vi.fn();
  return { scroller, pad: screen.getByTestId('pad'), button: screen.getByRole('button') };
}

beforeEach(() => vi.clearAllMocks());

describe('useDragScroll', () => {
  it('scrolls the container opposite to drag movement past the threshold', () => {
    const { scroller, pad } = setup();

    pad.dispatchEvent(pointerEvent('pointerdown', { clientX: 100, clientY: 100 }));
    expect(scroller.setPointerCapture).toHaveBeenCalledWith(1);

    // First move crosses the 4px threshold and starts the drag.
    scroller.dispatchEvent(pointerEvent('pointermove', { clientX: 60, clientY: 100 }));
    expect(scroller.classList.contains('cursor-grabbing')).toBe(true);
    expect(scroller.scrollLeft).toBe(40);

    scroller.dispatchEvent(pointerEvent('pointermove', { clientX: 30, clientY: 120 }));
    expect(scroller.scrollLeft).toBe(70);
    expect(scroller.scrollTop).toBe(-20);

    scroller.dispatchEvent(pointerEvent('pointerup'));
    expect(scroller.classList.contains('cursor-grabbing')).toBe(false);
    expect(scroller.classList.contains('cursor-grab')).toBe(true);
  });

  it('ignores movement below the drag threshold', () => {
    const { scroller, pad } = setup();

    pad.dispatchEvent(pointerEvent('pointerdown', { clientX: 100, clientY: 100 }));
    scroller.dispatchEvent(pointerEvent('pointermove', { clientX: 98, clientY: 99 })); // ~2.2px

    expect(scroller.scrollLeft).toBe(0);
    expect(scroller.scrollTop).toBe(0);
    expect(scroller.classList.contains('cursor-grabbing')).toBe(false);
  });

  it('ignores drags that start on interactive elements', () => {
    const { scroller, button } = setup();

    button.dispatchEvent(pointerEvent('pointerdown', { clientX: 100, clientY: 100 }));
    expect(scroller.setPointerCapture).not.toHaveBeenCalled();

    scroller.dispatchEvent(pointerEvent('pointermove', { clientX: 0, clientY: 0 }));
    expect(scroller.scrollLeft).toBe(0);
    expect(scroller.scrollTop).toBe(0);
  });

  it('ignores non-primary mouse buttons', () => {
    const { scroller, pad } = setup();

    pad.dispatchEvent(pointerEvent('pointerdown', { clientX: 100, clientY: 100, button: 2 }));
    expect(scroller.setPointerCapture).not.toHaveBeenCalled();

    scroller.dispatchEvent(pointerEvent('pointermove', { clientX: 0, clientY: 0 }));
    expect(scroller.scrollLeft).toBe(0);
  });

  it('stops scrolling after pointerup/pointercancel', () => {
    const { scroller, pad } = setup();

    pad.dispatchEvent(pointerEvent('pointerdown', { clientX: 100, clientY: 100 }));
    scroller.dispatchEvent(pointerEvent('pointermove', { clientX: 50, clientY: 100 }));
    expect(scroller.scrollLeft).toBe(50);

    scroller.dispatchEvent(pointerEvent('pointerup'));
    scroller.dispatchEvent(pointerEvent('pointermove', { clientX: 0, clientY: 0 }));
    expect(scroller.scrollLeft).toBe(50);
  });
});
