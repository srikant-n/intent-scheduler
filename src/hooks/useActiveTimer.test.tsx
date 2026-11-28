// Tests for useActiveTimer: persisted timer state, elapsed computation,
// pause/resume, and stop/discard flows that write time_logs + complete blocks.
// The DB layer is mocked; `stored` simulates the persisted app_settings value.
import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useActiveTimer } from './useActiveTimer';
import { makeIntention, makeLog, makeTimer, renderHookWithQueryClient } from './testUtils';
import type { ActiveTimerState } from '@/types/database';

vi.mock('@/db/queries', () => ({
  getActiveTimer: vi.fn(),
  saveActiveTimer: vi.fn(),
  createTimeLog: vi.fn(),
  updateScheduleBlock: vi.fn(),
}));

import { createTimeLog, getActiveTimer, saveActiveTimer, updateScheduleBlock } from '@/db/queries';

const getTimerMock = vi.mocked(getActiveTimer);
const saveTimerMock = vi.mocked(saveActiveTimer);
const createLogMock = vi.mocked(createTimeLog);
const updateBlockMock = vi.mocked(updateScheduleBlock);

let stored: ActiveTimerState | null;

beforeEach(() => {
  vi.clearAllMocks();
  stored = null;
  getTimerMock.mockImplementation(async () => stored);
  saveTimerMock.mockImplementation(async (value) => {
    stored = value;
  });
  createLogMock.mockResolvedValue(makeLog());
  updateBlockMock.mockResolvedValue(undefined);
});

describe('useActiveTimer — idle state', () => {
  it('reports no timer, zero elapsed, and not paused when nothing is persisted', async () => {
    const { result } = renderHookWithQueryClient(() => useActiveTimer());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.timer).toBeNull();
    expect(result.current.elapsed).toBe(0);
    expect(result.current.elapsedLabel).toBe('00:00:00');
    expect(result.current.isPaused).toBe(false);
  });

  it('timer controls are no-ops without an active timer', async () => {
    const { result } = renderHookWithQueryClient(() => useActiveTimer());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.pauseTimer();
      await result.current.resumeTimer();
      await result.current.stopTimer();
      await result.current.discardTimer();
    });

    expect(saveTimerMock).not.toHaveBeenCalled();
    expect(createLogMock).not.toHaveBeenCalled();
  });
});

describe('useActiveTimer — starting', () => {
  it('startTimer derives state from a task and persists it', async () => {
    const { result } = renderHookWithQueryClient(() => useActiveTimer());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.startTimer({ task: makeIntention() });
    });

    expect(saveTimerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-1',
        scheduleBlockId: null,
        customTitle: 'Write report',
        categoryId: 'cat-1',
        accumulatedPausedMs: 0,
        pausedAt: null,
        targetDurationMins: 60,
      }),
    );
    await waitFor(() => expect(result.current.timer?.customTitle).toBe('Write report'));
    expect(result.current.isPaused).toBe(false);
  });

  it('startTimer supports quick-log custom titles and explicit overrides', async () => {
    const { result } = renderHookWithQueryClient(() => useActiveTimer());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.startTimer({ customTitle: 'Coffee', categoryId: 'cat-2', targetDurationMins: 15 });
    });

    expect(saveTimerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: null,
        scheduleBlockId: null,
        customTitle: 'Coffee',
        categoryId: 'cat-2',
        targetDurationMins: 15,
      }),
    );
  });

  it('starting a new timer logs and completes the previous one first', async () => {
    stored = makeTimer({ scheduleBlockId: 'block-1' });
    const { result } = renderHookWithQueryClient(() => useActiveTimer());
    await waitFor(() => expect(result.current.timer?.id).toBe('timer-1'));

    await act(async () => {
      await result.current.startTimer({ customTitle: 'Next task' });
    });

    // Previous run was logged (~10 min elapsed) and its block marked completed.
    expect(createLogMock).toHaveBeenCalledTimes(1);
    const logArg = createLogMock.mock.calls[0][0];
    expect(logArg).toMatchObject({
      taskId: 'task-1',
      scheduleBlockId: 'block-1',
      customTitle: 'Write report',
      categoryId: 'cat-1',
      isAdHoc: false,
    });
    expect(logArg.durationMins).toBeGreaterThanOrEqual(9);
    expect(updateBlockMock).toHaveBeenCalledWith('block-1', { status: 'completed' });

    // The persisted state was cleared, then replaced by the new timer.
    const savedValues = saveTimerMock.mock.calls.map((call) => call[0]);
    expect(savedValues[0]).toBeNull();
    expect(savedValues[savedValues.length - 1]).toMatchObject({ customTitle: 'Next task', taskId: null });
    await waitFor(() => expect(result.current.timer?.customTitle).toBe('Next task'));
  });
});

describe('useActiveTimer — pause/resume', () => {
  it('pauseTimer stamps pausedAt; isPaused reflects it', async () => {
    stored = makeTimer();
    const { result } = renderHookWithQueryClient(() => useActiveTimer());
    await waitFor(() => expect(result.current.timer).not.toBeNull());

    await act(async () => {
      await result.current.pauseTimer();
    });

    expect(saveTimerMock).toHaveBeenLastCalledWith(expect.objectContaining({ pausedAt: expect.any(String) }));
    await waitFor(() => expect(result.current.isPaused).toBe(true));
  });

  it('pauseTimer is a no-op when already paused', async () => {
    stored = makeTimer({ pausedAt: new Date().toISOString() });
    const { result } = renderHookWithQueryClient(() => useActiveTimer());
    await waitFor(() => expect(result.current.isPaused).toBe(true));

    await act(async () => {
      await result.current.pauseTimer();
    });

    expect(saveTimerMock).not.toHaveBeenCalled();
  });

  it('resumeTimer folds paused wall-time into accumulatedPausedMs', async () => {
    stored = makeTimer({
      pausedAt: new Date(Date.now() - 30_000).toISOString(),
      accumulatedPausedMs: 5_000,
    });
    const { result } = renderHookWithQueryClient(() => useActiveTimer());
    await waitFor(() => expect(result.current.isPaused).toBe(true));

    await act(async () => {
      await result.current.resumeTimer();
    });

    const saved = saveTimerMock.mock.calls.at(-1)?.[0];
    expect(saved).toMatchObject({ pausedAt: null });
    expect(saved?.accumulatedPausedMs).toBeGreaterThan(5_000);
    await waitFor(() => expect(result.current.isPaused).toBe(false));
  });

  it('resumeTimer is a no-op when not paused', async () => {
    stored = makeTimer();
    const { result } = renderHookWithQueryClient(() => useActiveTimer());
    await waitFor(() => expect(result.current.timer).not.toBeNull());

    await act(async () => {
      await result.current.resumeTimer();
    });

    expect(saveTimerMock).not.toHaveBeenCalled();
  });
});

describe('useActiveTimer — elapsed & stop/discard', () => {
  it('exposes a ticking elapsed value and formatted label', async () => {
    stored = makeTimer({ startedAt: new Date(Date.now() - 90_000).toISOString() });
    const { result } = renderHookWithQueryClient(() => useActiveTimer());
    await waitFor(() => expect(result.current.timer).not.toBeNull());

    expect(result.current.elapsed).toBeGreaterThan(0);
    expect(result.current.elapsedLabel).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('stopTimer writes a time log, completes the linked block, and clears state', async () => {
    stored = makeTimer({ scheduleBlockId: 'block-1' });
    const { result } = renderHookWithQueryClient(() => useActiveTimer());
    await waitFor(() => expect(result.current.timer?.id).toBe('timer-1'));

    await act(async () => {
      await result.current.stopTimer();
    });

    expect(createLogMock).toHaveBeenCalledTimes(1);
    expect(createLogMock.mock.calls[0][0]).toMatchObject({ scheduleBlockId: 'block-1', isAdHoc: false });
    expect(updateBlockMock).toHaveBeenCalledWith('block-1', { status: 'completed' });
    expect(saveTimerMock).toHaveBeenLastCalledWith(null);
    await waitFor(() => expect(result.current.timer).toBeNull());
  });

  it('discardTimer clears state without writing a log', async () => {
    stored = makeTimer({ scheduleBlockId: 'block-1' });
    const { result } = renderHookWithQueryClient(() => useActiveTimer());
    await waitFor(() => expect(result.current.timer?.id).toBe('timer-1'));

    await act(async () => {
      await result.current.discardTimer();
    });

    expect(createLogMock).not.toHaveBeenCalled();
    expect(updateBlockMock).not.toHaveBeenCalled();
    expect(saveTimerMock).toHaveBeenLastCalledWith(null);
    await waitFor(() => expect(result.current.timer).toBeNull());
  });
});
