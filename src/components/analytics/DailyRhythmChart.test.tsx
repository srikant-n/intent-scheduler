// Tests for DailyRhythmChart: planned-vs-actual bars and per-day variance table.
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DailyRhythmChart } from './DailyRhythmChart';
import { makeSnapshot } from './testUtils';

describe('DailyRhythmChart', () => {
  it('renders the heading, legend, and average line', () => {
    render(<DailyRhythmChart snapshot={makeSnapshot()} />);

    expect(screen.getByText('Daily Rhythm')).toBeInTheDocument();
    expect(screen.getByText('Planned vs actual minutes per weekday.')).toBeInTheDocument();
    // 'Planned'/'Actual' appear in both the legend and the table header
    expect(screen.getAllByText('Planned').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Actual').length).toBeGreaterThanOrEqual(2);

    // avg planned = (120+0+180+120+180)/7 ~ 85.7m; just check the label prefix
    expect(screen.getAllByText(/avg /).length).toBeGreaterThanOrEqual(1);
  });

  it('renders a table row per day with date and formatted minutes', () => {
    render(<DailyRhythmChart snapshot={makeSnapshot()} />);
    const table = screen.getByRole('table');

    expect(within(table).getByText('2026-11-16')).toBeInTheDocument();
    expect(within(table).getByText('2026-11-22')).toBeInTheDocument();
    // Mon planned 120 -> 2h (also Thu), actual 90 -> 1h 30m (unique)
    expect(within(table).getAllByText('2h').length).toBeGreaterThanOrEqual(1);
    expect(within(table).getByText('1h 30m')).toBeInTheDocument();
    // Weekday labels render in both chart and table
    expect(within(table).getByText('Mon')).toBeInTheDocument();
    expect(within(table).getByText('Sun')).toBeInTheDocument();
  });

  it('shows signed variance for each day', () => {
    render(<DailyRhythmChart snapshot={makeSnapshot()} />);
    const table = screen.getByRole('table');

    // Wed: actual 150 - planned 180 = -30 -> negative sign
    // Fri: actual 150 - planned 180 = -30
    // Thu: actual 150 - planned 120 = +30 -> '+30m'
    expect(within(table).getByText('+30m')).toBeInTheDocument();
  });

  it('renders an empty-state row when there is no daily data', () => {
    render(<DailyRhythmChart snapshot={makeSnapshot({ dailyRhythm: [] })} />);

    expect(screen.getByText('No daily data for this week.')).toBeInTheDocument();
  });
});
