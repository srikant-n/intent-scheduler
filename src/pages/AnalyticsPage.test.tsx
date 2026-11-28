// Tests for AnalyticsPage: history-range queries, snapshot construction,
// loading state, analytics panel composition, and week navigation.
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { todayISO } from '@/utils/time';
import { AnalyticsPage } from './AnalyticsPage';

const mocks = vi.hoisted(() => ({
  blocks: [] as unknown[],
  blocksLoading: false,
  logs: [] as unknown[],
  logsLoading: false,
  allIntentions: [] as unknown[],
  categories: [] as unknown[],
  capacity: {} as Record<number, number>,
  scheduleRange: vi.fn(),
  logsRange: vi.fn(),
  buildSnapshot: vi.fn(),
  snapshot: { weekStart: 'mock-snapshot' },
}));

vi.mock('@/hooks/useSchedule', () => ({
  useScheduleRange: (startDate: string, endDate: string) => {
    mocks.scheduleRange(startDate, endDate);
    return { data: mocks.blocks, isLoading: mocks.blocksLoading };
  },
}));

vi.mock('@/hooks/useLogs', () => ({
  useTimeLogsRange: (startDate: string, endDate: string) => {
    mocks.logsRange(startDate, endDate);
    return { logs: mocks.logs, isLoading: mocks.logsLoading };
  },
}));

vi.mock('@/hooks/useIntentions', () => ({
  useAllIntentions: () => ({ intentions: mocks.allIntentions }),
}));

vi.mock('@/hooks/useCategories', () => ({
  useCategories: () => ({ categories: mocks.categories }),
}));

vi.mock('@/hooks/useWeeklyCapacity', () => ({
  useWeeklyCapacity: () => ({ capacity: mocks.capacity }),
}));

vi.mock('@/utils/analytics', () => ({
  buildAnalyticsSnapshot: mocks.buildSnapshot,
}));

vi.mock('@/components/analytics/AnalyticsKpiGrid', () => ({
  AnalyticsKpiGrid: ({ snapshot }: { snapshot: { weekStart: string } }) => <div data-testid="kpi-grid" data-snapshot={snapshot.weekStart} />,
}));
vi.mock('@/components/analytics/CategoryVariancePanel', () => ({
  CategoryVariancePanel: () => <div data-testid="category-variance" />,
}));
vi.mock('@/components/analytics/DailyRhythmChart', () => ({
  DailyRhythmChart: () => <div data-testid="daily-rhythm" />,
}));
vi.mock('@/components/analytics/EstimationDriftPanel', () => ({
  EstimationDriftPanel: () => <div data-testid="estimation-drift" />,
}));
vi.mock('@/components/analytics/RolloverAnalyticsPanel', () => ({
  RolloverAnalyticsPanel: () => <div data-testid="rollover-analytics" />,
}));
vi.mock('@/components/analytics/ReflectionInsights', () => ({
  ReflectionInsights: () => <div data-testid="reflection-insights" />,
}));

describe('AnalyticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.blocks = [];
    mocks.blocksLoading = false;
    mocks.logs = [];
    mocks.logsLoading = false;
    mocks.allIntentions = [];
    mocks.categories = [];
    mocks.capacity = {};
    mocks.buildSnapshot.mockReturnValue(mocks.snapshot);
  });

  it('queries all history through the selected week end and renders analytics panels', () => {
    render(<AnalyticsPage date="2026-11-18" onDateChange={vi.fn()} />);

    expect(mocks.scheduleRange).toHaveBeenCalledWith('2000-01-01', '2026-11-22');
    expect(mocks.logsRange).toHaveBeenCalledWith('2000-01-01', '2026-11-22');
    expect(mocks.buildSnapshot).toHaveBeenCalledOnce();
    const input = mocks.buildSnapshot.mock.calls[0][0];
    expect(input.weekDates).toHaveLength(7);
    expect(input.weekDates[0]).toBe('2026-11-16');
    expect(input.weekDates[6]).toBe('2026-11-22');

    expect(screen.getByTestId('kpi-grid')).toHaveAttribute('data-snapshot', 'mock-snapshot');
    expect(screen.getByTestId('category-variance')).toBeInTheDocument();
    expect(screen.getByTestId('daily-rhythm')).toBeInTheDocument();
    expect(screen.getByTestId('estimation-drift')).toBeInTheDocument();
    expect(screen.getByTestId('rollover-analytics')).toBeInTheDocument();
    expect(screen.getByTestId('reflection-insights')).toBeInTheDocument();
  });

  it('shows a loading state while schedule or log history is pending', () => {
    mocks.blocksLoading = true;
    render(<AnalyticsPage date="2026-11-18" onDateChange={vi.fn()} />);

    expect(screen.getByText('Loading analytics…')).toBeInTheDocument();
    expect(screen.queryByTestId('kpi-grid')).not.toBeInTheDocument();
  });

  it('navigates by week and back to the current week', () => {
    const onDateChange = vi.fn();
    render(<AnalyticsPage date="2026-11-18" onDateChange={onDateChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Prev/ }));
    expect(onDateChange).toHaveBeenLastCalledWith('2026-11-11');

    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(onDateChange).toHaveBeenLastCalledWith('2026-11-25');

    fireEvent.click(screen.getByRole('button', { name: 'This Week' }));
    expect(onDateChange).toHaveBeenLastCalledWith(todayISO());
  });
});
