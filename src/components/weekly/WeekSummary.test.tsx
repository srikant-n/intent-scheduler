// Tests for WeekSummary: planned/actual/fidelity tiles, fidelity badge
// thresholds, category balance bar, and pending-rollover badge.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { WeeklySummary } from '@/utils/weekly';
import { WeekSummary } from './WeekSummary';

const ANCHOR = '2026-11-18'; // Wednesday of Mon 2026-11-16 .. Sun 2026-11-22

function makeSummary(overrides: Partial<WeeklySummary> = {}): WeeklySummary {
  return {
    days: [],
    totalPlannedMins: 600,
    totalActualMins: 540,
    totalUnplannedMins: 120,
    totalCapacityMins: 2400,
    utilizationPct: 25,
    pacingFidelityPct: 90,
    blockCount: 6,
    pendingRolloverCount: 0,
    categoryBalance: [
      { categoryId: 'cat-1', name: 'Deep Work', colorHex: '#4f46e5', plannedMins: 400, actualMins: 300 },
      { categoryId: 'cat-2', name: 'Health', colorHex: '#059669', plannedMins: 200, actualMins: 240 },
    ],
    habitAdherence: { plannedSessions: 10, fulfilledSessions: 8, pct: 80 },
    ...overrides,
  };
}

describe('WeekSummary', () => {
  it('renders the week heading with ISO week number and range', () => {
    render(<WeekSummary summary={makeSummary()} anchorDate={ANCHOR} />);

    // Week containing 2026-11-16..22; range formatted like "Nov 16 – 22, 2026"
    expect(screen.getByText(/Week \d+ · Nov 16 – 22, 2026/)).toBeInTheDocument();
  });

  it('renders all four panel labels', () => {
    render(<WeekSummary summary={makeSummary()} anchorDate={ANCHOR} />);

    expect(screen.getByText('Planned Intent')).toBeInTheDocument();
    expect(screen.getByText('Actual Tracked')).toBeInTheDocument();
    expect(screen.getByText('Pacing Fidelity')).toBeInTheDocument();
    expect(screen.getByText('Balance Intent')).toBeInTheDocument();
  });

  it('formats planned/capacity and actual values', () => {
    render(<WeekSummary summary={makeSummary()} anchorDate={ANCHOR} />);

    expect(screen.getByText('10h / 40h')).toBeInTheDocument(); // 600 / 2400
    expect(screen.getByText('9h')).toBeInTheDocument(); // 540 actual
    expect(screen.getByText('90%')).toBeInTheDocument(); // fidelity
    expect(screen.getByText('25% of capacity scheduled')).toBeInTheDocument();
  });

  it('shows signed variance vs plan in the actual tile hint', () => {
    render(<WeekSummary summary={makeSummary()} anchorDate={ANCHOR} />);
    // actual 540 - planned 600 = -60 -> '−1h' plus ' • 2h unplanned'
    expect(screen.getByText(/vs plan/)).toBeInTheDocument();
    expect(screen.getByText(/2h unplanned/)).toBeInTheDocument();
  });

  it('shows habit adherence counts in the fidelity hint', () => {
    render(<WeekSummary summary={makeSummary()} anchorDate={ANCHOR} />);
    expect(screen.getByText('8/10 habit sessions completed')).toBeInTheDocument();
  });

  it.each([
    [95, 'High Flow'],
    [90, 'High Flow'],
    [80, 'Steady'],
    [70, 'Steady'],
    [50, 'Drifting'],
    [0, 'Drifting'],
  ])('fidelity %i%% -> %s badge', (pct, label) => {
    render(<WeekSummary summary={makeSummary({ pacingFidelityPct: pct })} anchorDate={ANCHOR} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('shows "No data" badge and dash when fidelity is null', () => {
    render(<WeekSummary summary={makeSummary({ pacingFidelityPct: null })} anchorDate={ANCHOR} />);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('renders category balance chips with percentages', () => {
    render(<WeekSummary summary={makeSummary()} anchorDate={ANCHOR} />);

    // balance uses planned shares: 400/600=67%, 200/600=33%
    expect(screen.getByText(/Deep Work 67%/)).toBeInTheDocument();
    expect(screen.getByText(/Health 33%/)).toBeInTheDocument();
    expect(screen.getByText('2 domains')).toBeInTheDocument();
  });

  it('shows "No planned time yet" when balance is empty', () => {
    render(<WeekSummary summary={makeSummary({ categoryBalance: [] })} anchorDate={ANCHOR} />);
    expect(screen.getByText('No planned time yet')).toBeInTheDocument();
  });

  it('shows pending rollover badge only when count > 0', () => {
    const { rerender } = render(<WeekSummary summary={makeSummary()} anchorDate={ANCHOR} />);
    expect(screen.queryByText(/pending rollover/)).not.toBeInTheDocument();

    rerender(<WeekSummary summary={makeSummary({ pendingRolloverCount: 3 })} anchorDate={ANCHOR} />);
    expect(screen.getByText('3 blocks pending rollover')).toBeInTheDocument();
  });
});
