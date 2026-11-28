// Tests for useTheme: settings-backed theme mode + accent, DOM/localStorage
// application, OS dark-mode listener, and persist mutations.
import { act, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTheme } from './useTheme';
import { renderHookWithQueryClient } from './testUtils';

vi.mock('@/db/queries', () => ({
  getSetting: vi.fn(),
  setSetting: vi.fn(),
}));

import { getSetting, setSetting } from '@/db/queries';

const getSettingMock = vi.mocked(getSetting);
const setSettingMock = vi.mocked(setSetting);

// In-memory app_settings stand-in so invalidated queries see persisted values.
const settingsStore: Record<string, string> = {};

// jsdom has no matchMedia; provide a controllable stub.
function stubMatchMedia(initialMatches: boolean) {
  const listeners = new Set<() => void>();
  const mql = {
    matches: initialMatches,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: (_type: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_type: string, cb: () => void) => listeners.delete(cb),
    addListener: (cb: () => void) => listeners.add(cb),
    removeListener: (cb: () => void) => listeners.delete(cb),
    dispatchEvent: () => false,
  };
  window.matchMedia = vi.fn(() => mql) as unknown as typeof window.matchMedia;
  return {
    setMatches(value: boolean) {
      mql.matches = value;
      listeners.forEach((listener) => listener());
    },
    listenerCount: () => listeners.size,
  };
}

const root = document.documentElement;

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of Object.keys(settingsStore)) delete settingsStore[key];
  getSettingMock.mockImplementation(async (key) => settingsStore[key] ?? null);
  setSettingMock.mockImplementation(async (key, value) => {
    settingsStore[key] = value;
  });
  root.className = '';
  delete root.dataset.theme;
  delete root.dataset.accent;
  localStorage.clear();
});

afterEach(() => {
  root.className = '';
  delete root.dataset.theme;
  delete root.dataset.accent;
});

describe('useTheme', () => {
  it('defaults to system theme and ember accent when settings are empty', async () => {
    stubMatchMedia(false);
    const { result } = renderHookWithQueryClient(() => useTheme());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.themeMode).toBe('system');
    expect(result.current.accent).toBe('ember');
  });

  it('reads theme mode and accent from app_settings', async () => {
    stubMatchMedia(false);
    getSettingMock.mockImplementation(async (key) => (key === 'theme_mode' ? 'dark' : key === 'accent_color' ? 'violet' : null));

    const { result } = renderHookWithQueryClient(() => useTheme());

    await waitFor(() => expect(result.current.themeMode).toBe('dark'));
    expect(result.current.accent).toBe('violet');
  });

  it('applies dark class, data attributes, and localStorage cache', async () => {
    stubMatchMedia(false);
    getSettingMock.mockImplementation(async (key) => (key === 'theme_mode' ? 'dark' : 'indigo'));

    renderHookWithQueryClient(() => useTheme());

    await waitFor(() => expect(root.classList.contains('dark')).toBe(true));
    expect(root.dataset.theme).toBe('dark');
    expect(root.dataset.accent).toBe('indigo');
    expect(localStorage.getItem('intent-scheduler.theme')).toBe('dark');
    expect(localStorage.getItem('intent-scheduler.accent')).toBe('indigo');
  });

  it('system mode follows the OS prefers-color-scheme and live updates', async () => {
    const media = stubMatchMedia(true);
    getSettingMock.mockImplementation(async (key) => (key === 'theme_mode' ? 'system' : 'ember'));

    renderHookWithQueryClient(() => useTheme());

    await waitFor(() => expect(root.classList.contains('dark')).toBe(true));

    act(() => media.setMatches(false));
    expect(root.classList.contains('dark')).toBe(false);
    expect(root.dataset.theme).toBe('system');

    act(() => media.setMatches(true));
    expect(root.classList.contains('dark')).toBe(true);
  });

  it('setThemeMode persists via setSetting and invalidates the setting query', async () => {
    stubMatchMedia(false);
    const { result, queryClient } = renderHookWithQueryClient(() => useTheme());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    act(() => result.current.setThemeMode('light'));

    await waitFor(() => expect(setSettingMock).toHaveBeenCalledWith('theme_mode', 'light'));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['setting', 'theme_mode'] });
  });

  it('setAccent persists via setSetting', async () => {
    stubMatchMedia(false);
    const { result } = renderHookWithQueryClient(() => useTheme());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setAccent('emerald'));

    await waitFor(() => expect(setSettingMock).toHaveBeenCalledWith('accent_color', 'emerald'));
    await waitFor(() => expect(root.dataset.accent).toBe('emerald'));
  });
});
