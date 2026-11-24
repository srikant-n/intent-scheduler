import { beforeEach, describe, expect, it } from 'vitest';
import {
  BLOCK_DRAG_MIME,
  LOG_DRAG_MIME,
  TASK_DRAG_MIME,
  getDragSourceHeight,
  setDragSourceHeight,
} from './dragContext';

describe('drag source height store', () => {
  beforeEach(() => {
    setDragSourceHeight(0);
  });

  it('defaults to 0', () => {
    expect(getDragSourceHeight()).toBe(0);
  });

  it('stores and returns the last set height', () => {
    setDragSourceHeight(120);
    expect(getDragSourceHeight()).toBe(120);
    setDragSourceHeight(45);
    expect(getDragSourceHeight()).toBe(45);
    setDragSourceHeight(0);
    expect(getDragSourceHeight()).toBe(0);
  });
});

describe('drag MIME constants', () => {
  it('are distinct application/x-intent-scheduler types', () => {
    expect(TASK_DRAG_MIME).toBe('application/x-intent-scheduler-task');
    expect(BLOCK_DRAG_MIME).toBe('application/x-intent-scheduler-block');
    expect(LOG_DRAG_MIME).toBe('application/x-intent-scheduler-log');
    expect(new Set([TASK_DRAG_MIME, BLOCK_DRAG_MIME, LOG_DRAG_MIME]).size).toBe(3);
  });
});
