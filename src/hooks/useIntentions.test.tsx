// Tests for useIntentions + useAllIntentions: status-filtered queries, CRUD
// mutations, and invalidation of 'intentions' + 'schedule' keys.
import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAllIntentions, useIntentions } from './useIntentions';
import { makeIntention, renderHookWithQueryClient } from './testUtils';

vi.mock('@/db/queries', () => ({
  listIntentions: vi.fn(),
  listAllIntentions: vi.fn(),
  createIntention: vi.fn(),
  updateIntention: vi.fn(),
  archiveIntention: vi.fn(),
  restoreIntention: vi.fn(),
  deleteIntention: vi.fn(),
}));

import {
  archiveIntention,
  createIntention,
  deleteIntention,
  listAllIntentions,
  listIntentions,
  restoreIntention,
  updateIntention,
} from '@/db/queries';

const listMock = vi.mocked(listIntentions);
const listAllMock = vi.mocked(listAllIntentions);
const createMock = vi.mocked(createIntention);
const updateMock = vi.mocked(updateIntention);
const archiveMock = vi.mocked(archiveIntention);
const restoreMock = vi.mocked(restoreIntention);
const deleteMock = vi.mocked(deleteIntention);

beforeEach(() => vi.clearAllMocks());

describe('useIntentions', () => {
  it('queries intentions for the given status (default active)', async () => {
    const items = [makeIntention()];
    listMock.mockResolvedValue(items);

    const { result } = renderHookWithQueryClient(() => useIntentions());
    await waitFor(() => expect(result.current.intentions).toEqual(items));
    expect(listMock).toHaveBeenCalledWith('active');
  });

  it('passes a custom status through to the query', async () => {
    listMock.mockResolvedValue([]);
    renderHookWithQueryClient(() => useIntentions('archived'));
    await waitFor(() => expect(listMock).toHaveBeenCalledWith('archived'));
  });

  it('create calls createIntention and invalidates intentions + schedule', async () => {
    const created = makeIntention({ id: 'task-2', title: 'New task' });
    listMock.mockResolvedValue([]);
    createMock.mockResolvedValue(created);

    const { result, queryClient } = renderHookWithQueryClient(() => useIntentions());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const input = { title: 'New task', categoryId: null, isRecurring: false, defaultDurationMins: null };
    await act(async () => {
      await result.current.create.mutateAsync(input);
    });

    expect(createMock).toHaveBeenCalledWith(input);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['intentions'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['schedule'] });
  });

  it('update strips the id before calling updateIntention', async () => {
    listMock.mockResolvedValue([makeIntention()]);
    updateMock.mockResolvedValue(undefined);

    const { result } = renderHookWithQueryClient(() => useIntentions());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const update = { title: 'Renamed', categoryId: 'cat-1', isRecurring: false, defaultDurationMins: 60 };
    await act(async () => {
      await result.current.update.mutateAsync({ id: 'task-1', ...update });
    });

    expect(updateMock).toHaveBeenCalledWith('task-1', update);
  });

  it('archive, restore, and remove delegate to their query functions', async () => {
    listMock.mockResolvedValue([makeIntention()]);
    archiveMock.mockResolvedValue(undefined);
    restoreMock.mockResolvedValue(undefined);
    deleteMock.mockResolvedValue(undefined);

    const { result } = renderHookWithQueryClient(() => useIntentions());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.archive.mutateAsync('task-1');
      await result.current.restore.mutateAsync('task-1');
      await result.current.remove.mutateAsync('task-1');
    });

    expect(archiveMock).toHaveBeenCalledWith('task-1', expect.anything());
    expect(restoreMock).toHaveBeenCalledWith('task-1', expect.anything());
    expect(deleteMock).toHaveBeenCalledWith('task-1', expect.anything());
  });
});

describe('useAllIntentions', () => {
  it('queries all intentions regardless of status', async () => {
    const items = [makeIntention(), makeIntention({ id: 'task-2', status: 'archived' })];
    listAllMock.mockResolvedValue(items);

    const { result } = renderHookWithQueryClient(() => useAllIntentions());
    await waitFor(() => expect(result.current.intentions).toEqual(items));
    expect(listAllMock).toHaveBeenCalledOnce();
    expect(listMock).not.toHaveBeenCalled();
  });

  it('exposes only create and update mutations', async () => {
    listAllMock.mockResolvedValue([]);
    const { result } = renderHookWithQueryClient(() => useAllIntentions());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current).not.toHaveProperty('archive');
    expect(result.current).not.toHaveProperty('restore');
    expect(result.current).not.toHaveProperty('remove');
    expect(result.current.create).toBeDefined();
    expect(result.current.update).toBeDefined();
  });
});
