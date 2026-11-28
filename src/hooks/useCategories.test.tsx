// Tests for useCategories + categoryById: category list query, CRUD mutations,
// and invalidation of the 'categories' query key.
import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { categoryById, useCategories } from './useCategories';
import { makeCategory, renderHookWithQueryClient } from './testUtils';

vi.mock('@/db/queries', () => ({
  bootstrapDatabase: vi.fn(),
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));

import { bootstrapDatabase, createCategory, deleteCategory, listCategories, updateCategory } from '@/db/queries';

const bootstrapMock = vi.mocked(bootstrapDatabase);
const listMock = vi.mocked(listCategories);
const createMock = vi.mocked(createCategory);
const updateMock = vi.mocked(updateCategory);
const deleteMock = vi.mocked(deleteCategory);

beforeEach(() => {
  vi.clearAllMocks();
  bootstrapMock.mockResolvedValue(undefined);
});

describe('useCategories', () => {
  it('bootstraps the database then returns the category list', async () => {
    const categories = [makeCategory(), makeCategory({ id: 'cat-2', name: 'Health' })];
    listMock.mockResolvedValue(categories);

    const { result } = renderHookWithQueryClient(() => useCategories());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(bootstrapMock).toHaveBeenCalledOnce();
    expect(result.current.categories).toEqual(categories);
  });

  it('returns an empty list while data is unavailable', () => {
    listMock.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHookWithQueryClient(() => useCategories());
    expect(result.current.categories).toEqual([]);
  });

  it('create calls createCategory and invalidates the list', async () => {
    const existing = makeCategory();
    const created = makeCategory({ id: 'cat-2', name: 'New' });
    listMock.mockResolvedValue([existing]);
    createMock.mockResolvedValue(created);

    const { result } = renderHookWithQueryClient(() => useCategories());
    await waitFor(() => expect(result.current.categories).toHaveLength(1));

    listMock.mockResolvedValue([existing, created]);
    await act(async () => {
      await result.current.create.mutateAsync({ name: 'New', colorHex: '#123456' });
    });

    expect(createMock).toHaveBeenCalledWith({ name: 'New', colorHex: '#123456' });
    await waitFor(() => expect(result.current.categories).toHaveLength(2));
  });

  it('update strips the id and calls updateCategory', async () => {
    listMock.mockResolvedValue([makeCategory()]);
    updateMock.mockResolvedValue(undefined);

    const { result } = renderHookWithQueryClient(() => useCategories());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.update.mutateAsync({ id: 'cat-1', name: 'Renamed', colorHex: '#abcdef' });
    });

    expect(updateMock).toHaveBeenCalledWith('cat-1', { name: 'Renamed', colorHex: '#abcdef' });
  });

  it('remove calls deleteCategory with the id', async () => {
    listMock.mockResolvedValue([makeCategory()]);
    deleteMock.mockResolvedValue(undefined);

    const { result } = renderHookWithQueryClient(() => useCategories());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.remove.mutateAsync('cat-1');
    });

    expect(deleteMock).toHaveBeenCalledWith('cat-1');
  });
});

describe('categoryById', () => {
  it('finds a category by id', () => {
    const cat = makeCategory({ id: 'cat-9' });
    expect(categoryById([cat], 'cat-9')).toBe(cat);
  });

  it('returns undefined for null, undefined, or unknown ids', () => {
    const cat = makeCategory();
    expect(categoryById([cat], null)).toBeUndefined();
    expect(categoryById([cat], undefined)).toBeUndefined();
    expect(categoryById([cat], 'missing')).toBeUndefined();
  });
});
