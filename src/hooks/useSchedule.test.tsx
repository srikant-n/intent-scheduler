// Tests for useScheduleBlocks, useScheduleRange, and useScheduleMutations:
// day/range block queries and CRUD mutations invalidating 'schedule' + 'logs'.
import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useScheduleBlocks, useScheduleMutations, useScheduleRange } from './useSchedule';
import { makeBlock, renderHookWithQueryClient } from './testUtils';

vi.mock('@/db/queries', () => ({
  listScheduleBlocks: vi.fn(),
  listScheduleBlocksRange: vi.fn(),
  createScheduleBlock: vi.fn(),
  updateScheduleBlock: vi.fn(),
  deleteScheduleBlock: vi.fn(),
}));

import {
  createScheduleBlock,
  deleteScheduleBlock,
  listScheduleBlocks,
  listScheduleBlocksRange,
  updateScheduleBlock,
} from '@/db/queries';

const listMock = vi.mocked(listScheduleBlocks);
const listRangeMock = vi.mocked(listScheduleBlocksRange);
const createMock = vi.mocked(createScheduleBlock);
const updateMock = vi.mocked(updateScheduleBlock);
const deleteMock = vi.mocked(deleteScheduleBlock);

beforeEach(() => vi.clearAllMocks());

describe('useScheduleBlocks', () => {
  it('returns blocks for the requested date', async () => {
    const blocks = [makeBlock()];
    listMock.mockResolvedValue(blocks);

    const { result } = renderHookWithQueryClient(() => useScheduleBlocks('2026-11-24'));
    await waitFor(() => expect(result.current.blocks).toEqual(blocks));
    expect(listMock).toHaveBeenCalledWith('2026-11-24');
  });

  it('create calls createScheduleBlock and invalidates schedule + logs', async () => {
    listMock.mockResolvedValue([]);
    const created = makeBlock({ id: 'block-2' });
    createMock.mockResolvedValue(created);

    const { result, queryClient } = renderHookWithQueryClient(() => useScheduleBlocks('2026-11-24'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const input = {
      taskId: 'task-1',
      scheduledDate: '2026-11-24',
      startTime: '09:00',
      endTime: '10:00',
      plannedDurationMins: 60,
    };
    await act(async () => {
      await result.current.create.mutateAsync(input);
    });

    expect(createMock).toHaveBeenCalledWith(input);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['schedule'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['logs'] });
  });

  it('update strips the id before calling updateScheduleBlock', async () => {
    listMock.mockResolvedValue([makeBlock()]);
    updateMock.mockResolvedValue(undefined);

    const { result } = renderHookWithQueryClient(() => useScheduleBlocks('2026-11-24'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.update.mutateAsync({ id: 'block-1', status: 'completed' });
    });

    expect(updateMock).toHaveBeenCalledWith('block-1', { status: 'completed' });
  });

  it('remove calls deleteScheduleBlock with the id', async () => {
    listMock.mockResolvedValue([makeBlock()]);
    deleteMock.mockResolvedValue(undefined);

    const { result } = renderHookWithQueryClient(() => useScheduleBlocks('2026-11-24'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.remove.mutateAsync('block-1');
    });

    expect(deleteMock).toHaveBeenCalledWith('block-1', expect.anything());
  });
});

describe('useScheduleRange', () => {
  it('queries blocks across the given range (read-only)', async () => {
    const blocks = [makeBlock({ scheduledDate: '2026-11-20' })];
    listRangeMock.mockResolvedValue(blocks);

    const { result } = renderHookWithQueryClient(() => useScheduleRange('2026-11-16', '2026-11-22'));
    await waitFor(() => expect(result.current.data).toEqual(blocks));
    expect(listRangeMock).toHaveBeenCalledWith('2026-11-16', '2026-11-22');
    expect(listMock).not.toHaveBeenCalled();
  });
});

describe('useScheduleMutations', () => {
  it('exposes create/update/remove mutations that invalidate schedule + logs', async () => {
    createMock.mockResolvedValue(makeBlock());
    updateMock.mockResolvedValue(undefined);
    deleteMock.mockResolvedValue(undefined);

    const { result, queryClient } = renderHookWithQueryClient(() => useScheduleMutations());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      await result.current.create.mutateAsync({
        taskId: 'task-1',
        scheduledDate: '2026-11-24',
        startTime: '09:00',
        endTime: '10:00',
        plannedDurationMins: 60,
      });
      await result.current.update.mutateAsync({ id: 'block-1', status: 'missed' });
      await result.current.remove.mutateAsync('block-1');
    });

    expect(createMock).toHaveBeenCalledOnce();
    expect(updateMock).toHaveBeenCalledWith('block-1', { status: 'missed' });
    expect(deleteMock).toHaveBeenCalledWith('block-1', expect.anything());
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['schedule'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['logs'] });
  });
});
