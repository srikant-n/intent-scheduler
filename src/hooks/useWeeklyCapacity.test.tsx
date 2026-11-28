// Tests for useWeeklyCapacity: JSON setting parsed over defaults, and update
// mutation persisting serialized capacity + invalidating the query.
import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_WEEKLY_CAPACITY, WEEKLY_CAPACITY_KEY } from '@/utils/capacity';
import { useWeeklyCapacity } from './useWeeklyCapacity';
import { renderHookWithQueryClient } from './testUtils';

vi.mock('@/db/queries', () => ({
  getSetting: vi.fn(),
  setSetting: vi.fn(),
}));

import { getSetting, setSetting } from '@/db/queries';

const getSettingMock = vi.mocked(getSetting);
const setSettingMock = vi.mocked(setSetting);

const settingsStore: Record<string, string> = {};

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of Object.keys(settingsStore)) delete settingsStore[key];
  getSettingMock.mockImplementation(async (key) => settingsStore[key] ?? null);
  setSettingMock.mockImplementation(async (key, value) => {
    settingsStore[key] = value;
  });
});

describe('useWeeklyCapacity', () => {
  it('falls back to default capacity when no setting is stored', async () => {
    const { result } = renderHookWithQueryClient(() => useWeeklyCapacity());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.capacity).toEqual(DEFAULT_WEEKLY_CAPACITY);
    expect(getSettingMock).toHaveBeenCalledWith(WEEKLY_CAPACITY_KEY);
  });

  it('parses stored JSON capacity over the defaults', async () => {
    settingsStore[WEEKLY_CAPACITY_KEY] = JSON.stringify({ '1': 300, '6': 0 });

    const { result } = renderHookWithQueryClient(() => useWeeklyCapacity());

    await waitFor(() => expect(result.current.capacity[1]).toBe(300));
    expect(result.current.capacity[6]).toBe(0);
    // untouched days keep defaults
    expect(result.current.capacity[2]).toBe(DEFAULT_WEEKLY_CAPACITY[2]);
  });

  it('falls back to defaults on malformed JSON', async () => {
    settingsStore[WEEKLY_CAPACITY_KEY] = '{not json';

    const { result } = renderHookWithQueryClient(() => useWeeklyCapacity());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.capacity).toEqual(DEFAULT_WEEKLY_CAPACITY);
  });

  it('update persists serialized capacity and refreshes the query', async () => {
    const { result } = renderHookWithQueryClient(() => useWeeklyCapacity());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const next = { ...DEFAULT_WEEKLY_CAPACITY, 3: 240 };
    await act(async () => {
      await result.current.update.mutateAsync(next);
    });

    expect(setSettingMock).toHaveBeenCalledWith(WEEKLY_CAPACITY_KEY, expect.any(String));
    expect(JSON.parse(settingsStore[WEEKLY_CAPACITY_KEY])).toMatchObject({ '3': 240 });
    await waitFor(() => expect(result.current.capacity[3]).toBe(240));
  });
});
