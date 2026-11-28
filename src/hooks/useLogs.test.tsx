// Tests for useTimeLogs + useTimeLogsRange: day/range queries and CRUD
// mutations that invalidate 'logs' + 'schedule'.
import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTimeLogs, useTimeLogsRange } from './useLogs';
import { makeLog, renderHookWithQueryClient } from './testUtils';

vi.mock('@/db/queries', () => ({
  listTimeLogs: vi.fn(),
  listTimeLogsRange: vi.fn(),
  createTimeLog: vi.fn(),
  updateTimeLog: vi.fn(),
  deleteTimeLog: vi.fn(),
}));

import { createTimeLog, deleteTimeLog, listTimeLogs, listTimeLogsRange, updateTimeLog } from '@/db/queries';

const listMock = vi.mocked(listTimeLogs);
const listRangeMock = vi.mocked(listTimeLogsRange);
const createMock = vi.mocked(createTimeLog);
const updateMock = vi.mocked(updateTimeLog);
const deleteMock = vi.mocked(deleteTimeLog);

beforeEach(() => vi.clearAllMocks());

describe('useTimeLogs', () => {
  it('returns logs for the requested date', async () => {
    const logs = [makeLog()];
    listMock.mockResolvedValue(logs);

    const { result } = renderHookWithQueryClient(() => useTimeLogs('2026-11-24'));
    await waitFor(() => expect(result.current.logs).toEqual(logs));
    expect(listMock).toHaveBeenCalledWith('2026-11-24');
  });

  it('defaults to an empty list before data loads', () => {
    listMock.mockReturnValue(new Promise(() => {}));
    const { result } = renderHookWithQueryClient(() => useTimeLogs('2026-11-24'));
    expect(result.current.logs).toEqual([]);
  });

  it('create calls createTimeLog and invalidates logs + schedule', async () => {
    listMock.mockResolvedValue([]);
    const created = makeLog({ id: 'log-2' });
    createMock.mockResolvedValue(created);

    const { result, queryClient } = renderHookWithQueryClient(() => useTimeLogs('2026-11-24'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const input = { logDate: '2026-11-24', durationMins: 30, customTitle: 'Coffee' };
    await act(async () => {
      await result.current.create.mutateAsync(input);
    });

    expect(createMock).toHaveBeenCalledWith(input);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['logs'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['schedule'] });
  });

  it('update strips the id before calling updateTimeLog', async () => {
    listMock.mockResolvedValue([makeLog()]);
    updateMock.mockResolvedValue(undefined);

    const { result } = renderHookWithQueryClient(() => useTimeLogs('2026-11-24'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const update = { durationMins: 45, mood: 'energizing' as const };
    await act(async () => {
      await result.current.update.mutateAsync({ id: 'log-1', ...update });
    });

    expect(updateMock).toHaveBeenCalledWith('log-1', update);
  });

  it('remove calls deleteTimeLog with the id', async () => {
    listMock.mockResolvedValue([makeLog()]);
    deleteMock.mockResolvedValue(undefined);

    const { result } = renderHookWithQueryClient(() => useTimeLogs('2026-11-24'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.remove.mutateAsync('log-1');
    });

    expect(deleteMock).toHaveBeenCalledWith('log-1', expect.anything());
  });
});

describe('useTimeLogsRange', () => {
  it('queries logs across the given date range', async () => {
    const logs = [makeLog({ logDate: '2026-11-20' }), makeLog({ id: 'log-2', logDate: '2026-11-21' })];
    listRangeMock.mockResolvedValue(logs);

    const { result } = renderHookWithQueryClient(() => useTimeLogsRange('2026-11-20', '2026-11-22'));
    await waitFor(() => expect(result.current.logs).toEqual(logs));
    expect(listRangeMock).toHaveBeenCalledWith('2026-11-20', '2026-11-22');
    expect(listMock).not.toHaveBeenCalled();
  });

  it('mutations invalidate logs + schedule like the day variant', async () => {
    listRangeMock.mockResolvedValue([]);
    deleteMock.mockResolvedValue(undefined);

    const { result, queryClient } = renderHookWithQueryClient(() => useTimeLogsRange('2026-11-20', '2026-11-22'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    await act(async () => {
      await result.current.remove.mutateAsync('log-9');
    });

    expect(deleteMock).toHaveBeenCalledWith('log-9', expect.anything());
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['logs'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['schedule'] });
  });
});
