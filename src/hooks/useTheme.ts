import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSetting, setSetting } from '@/db/queries';
import type { AccentPreset, ThemeMode } from '@/types/database';

const THEME_KEY = 'theme_mode';
const ACCENT_KEY = 'accent_color';

function applyTheme(mode: ThemeMode, accent: AccentPreset, systemDark: boolean) {
  const dark = mode === 'dark' || (mode === 'system' && systemDark);
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.dataset.theme = mode;
  root.dataset.accent = accent;
  try {
    localStorage.setItem('intent-scheduler.theme', mode);
    localStorage.setItem('intent-scheduler.accent', accent);
  } catch {
    // localStorage is only a paint cache; SQLite remains authoritative.
  }
}

export function useTheme() {
  const queryClient = useQueryClient();
  const themeQuery = useQuery({ queryKey: ['setting', THEME_KEY], queryFn: () => getSetting(THEME_KEY) });
  const accentQuery = useQuery({ queryKey: ['setting', ACCENT_KEY], queryFn: () => getSetting(ACCENT_KEY) });

  const themeMode = (themeQuery.data as ThemeMode | null) ?? 'system';
  const accent = (accentQuery.data as AccentPreset | null) ?? 'ember';

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => applyTheme(themeMode, accent, media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [themeMode, accent]);

  const saveTheme = useMutation({
    mutationFn: (mode: ThemeMode) => setSetting(THEME_KEY, mode),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['setting', THEME_KEY] }),
  });

  const saveAccent = useMutation({
    mutationFn: (value: AccentPreset) => setSetting(ACCENT_KEY, value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['setting', ACCENT_KEY] }),
  });

  return {
    themeMode,
    accent,
    setThemeMode: saveTheme.mutate,
    setAccent: saveAccent.mutate,
    isLoading: themeQuery.isLoading || accentQuery.isLoading,
  };
}
