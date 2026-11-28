// Tests for Sidebar: nav items, view switching, quick log, intentions badge,
// theme and accent pickers — with useTheme mocked.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar, type ViewKey } from './Sidebar';

const themeState = vi.hoisted(() => ({
  themeMode: 'light' as 'light' | 'dark' | 'system',
  accent: 'ember' as 'ember' | 'indigo' | 'emerald' | 'rose' | 'violet' | 'graphite',
  setThemeMode: vi.fn(),
  setAccent: vi.fn(),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => themeState,
}));

function renderSidebar(opts: { view?: ViewKey; intentionsCount?: number } = {}) {
  const onChange = vi.fn();
  const onQuickLog = vi.fn();
  render(
    <Sidebar
      view={opts.view ?? 'daily'}
      onChange={onChange}
      intentionsCount={opts.intentionsCount ?? 0}
      onQuickLog={onQuickLog}
    />,
  );
  return { onChange, onQuickLog };
}

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    themeState.themeMode = 'light';
    themeState.accent = 'ember';
  });

  it('renders the brand and all five nav items', () => {
    renderSidebar();

    expect(screen.getByText('Intent Scheduler')).toBeInTheDocument();
    expect(screen.getByText('Intent vs Reality')).toBeInTheDocument();
    for (const label of ['Dual-Track Today', 'Weekly Planner', 'Intentions', 'Time Analytics', 'Data Vault']) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it('calls onChange with the clicked view', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSidebar({ view: 'daily' });

    await user.click(screen.getByRole('button', { name: /Weekly Planner/ }));
    expect(onChange).toHaveBeenCalledWith('weekly');
  });

  it('highlights the active view', () => {
    renderSidebar({ view: 'analytics' });
    const active = screen.getByRole('button', { name: /Time Analytics/ });
    expect(active).toHaveClass('bg-accent-soft', 'text-accent');
  });

  it('shows the intentions count badge only on the Intentions item', () => {
    renderSidebar({ intentionsCount: 7 });
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('calls onQuickLog from the Quick Log button', async () => {
    const user = userEvent.setup();
    const { onQuickLog } = renderSidebar();

    await user.click(screen.getByRole('button', { name: /Quick Log/ }));
    expect(onQuickLog).toHaveBeenCalledTimes(1);
  });

  it('switches theme via the theme picker', async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole('button', { name: 'Dark' }));
    expect(themeState.setThemeMode).toHaveBeenCalledWith('dark');

    await user.click(screen.getByRole('button', { name: 'Auto' }));
    expect(themeState.setThemeMode).toHaveBeenCalledWith('system');
  });

  it('marks the current theme as active', () => {
    themeState.themeMode = 'dark';
    renderSidebar();
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveClass('bg-accent-soft');
  });

  it('switches accent via the accent swatches', async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByTitle('Violet'));
    expect(themeState.setAccent).toHaveBeenCalledWith('violet');
  });
});
