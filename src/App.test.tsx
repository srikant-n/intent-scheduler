// Tests for App shell wiring: database bootstrap, view switching, date state,
// quick-log handoff to DailyPage, and layout chrome.
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const mocks = vi.hoisted(() => ({
  bootstrapDatabase: vi.fn().mockResolvedValue(undefined),
  intentions: [
    {
      id: 'task-1',
      title: 'Write report',
      categoryId: null,
      isRecurring: false,
      defaultDurationMins: 60,
      targetSessionsPerWeek: null,
      preferredWeekdays: [],
      preferredTime: null,
      status: 'active',
      notes: null,
      priority: null,
      createdAt: '2026-11-01T08:00:00Z',
    },
  ],
}));

vi.mock('@/db/queries', () => ({
  bootstrapDatabase: mocks.bootstrapDatabase,
}));

vi.mock('@/hooks/useIntentions', () => ({
  useIntentions: () => ({ intentions: mocks.intentions }),
}));

vi.mock('@/components/layout/Sidebar', () => ({
  Sidebar: ({ view, onChange, intentionsCount, onQuickLog }: {
    view: string;
    onChange: (view: 'daily' | 'weekly' | 'intentions' | 'analytics' | 'vault') => void;
    intentionsCount: number;
    onQuickLog: () => void;
  }) => (
    <aside data-testid="sidebar" data-view={view} data-count={intentionsCount}>
      <button onClick={() => onChange('intentions')}>mock-nav-intentions</button>
      <button onClick={() => onChange('weekly')}>mock-nav-weekly</button>
      <button onClick={onQuickLog}>mock-quick-log</button>
    </aside>
  ),
}));

vi.mock('@/components/layout/TopBar', () => ({
  TopBar: ({ date }: { date: string }) => <header data-testid="topbar" data-date={date} />,
}));

vi.mock('@/components/layout/ActiveTimerBar', () => ({
  ActiveTimerBar: () => <div data-testid="active-timer-bar" />,
}));

vi.mock('@/pages/DailyPage', () => ({
  DailyPage: ({ date, quickLogOpen, onDateChange, onOpenIntentions }: {
    date: string;
    quickLogOpen: boolean;
    onDateChange: (date: string) => void;
    onOpenIntentions: () => void;
  }) => (
    <section data-testid="daily-page" data-date={date} data-quick-log={String(quickLogOpen)}>
      <button onClick={() => onDateChange('2026-11-25')}>mock-daily-date</button>
      <button onClick={onOpenIntentions}>mock-open-intentions</button>
    </section>
  ),
}));

vi.mock('@/pages/IntentionsPage', () => ({
  IntentionsPage: () => <section data-testid="intentions-page" />,
}));

vi.mock('@/pages/WeeklyPage', () => ({
  WeeklyPage: ({ date }: { date: string }) => <section data-testid="weekly-page" data-date={date} />,
}));

vi.mock('@/pages/AnalyticsPage', () => ({
  AnalyticsPage: () => <section data-testid="analytics-page" />,
}));

vi.mock('@/pages/VaultPage', () => ({
  VaultPage: () => <section data-testid="vault-page" />,
}));

describe('App', () => {
  beforeEach(() => vi.clearAllMocks());

  it('bootstraps the database and renders the daily view by default', () => {
    render(<App />);

    expect(mocks.bootstrapDatabase).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-view', 'daily');
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-count', '1');
    expect(screen.getByTestId('daily-page')).toBeInTheDocument();
    expect(screen.getByTestId('active-timer-bar')).toBeInTheDocument();
  });

  it('switches views and shares the selected date with weekly/analytics pages', () => {
    render(<App />);

    fireEvent.click(screen.getByText('mock-daily-date'));
    expect(screen.getByTestId('daily-page')).toHaveAttribute('data-date', '2026-11-25');

    fireEvent.click(screen.getByText('mock-nav-weekly'));
    expect(screen.getByTestId('weekly-page')).toHaveAttribute('data-date', '2026-11-25');
    expect(screen.getByTestId('topbar')).toHaveAttribute('data-date', '2026-11-25');
  });

  it('opens DailyPage quick log from the sidebar quick-log action', () => {
    render(<App />);

    expect(screen.getByTestId('daily-page')).toHaveAttribute('data-quick-log', 'false');
    fireEvent.click(screen.getByText('mock-quick-log'));

    expect(screen.getByTestId('daily-page')).toHaveAttribute('data-quick-log', 'true');
  });

  it('routes DailyPage intentions shortcut to the intentions view', () => {
    render(<App />);

    fireEvent.click(screen.getByText('mock-open-intentions'));

    expect(screen.getByTestId('intentions-page')).toBeInTheDocument();
    expect(screen.queryByTestId('daily-page')).not.toBeInTheDocument();
  });
});
