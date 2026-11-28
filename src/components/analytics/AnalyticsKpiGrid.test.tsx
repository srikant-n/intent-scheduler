// Tests for AnalyticsKpiGrid: headline stat cards for the selected week.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AnalyticsKpiGrid } from './AnalyticsKpiGrid';
import { makeSnapshot } from './testUtils';

describe('AnalyticsKpiGrid', () => {
  it('renders all four KPI cards with formatted values', () => {
    render(<AnalyticsKpiGrid snapshot={makeSnapshot()} />);

    expect(screen.getByText('Planned Intent')).toBeInTheDocument();
    expect(screen.getByText('Actual Reality')).toBeInTheDocument();
    expect(screen.getByText('Spontaneous / Ad-hoc')).toBeInTheDocument();
    expect(screen.getByText('Estimation Drift')).toBeInTheDocument();

    // plannedMins 600 -> 10h; actualMins 540 -> 9h; adHoc 180 -> 3h
    expect(screen.getByText('10h')).toBeInTheDocument();
    expect(screen.getByText('9h')).toBeInTheDocument();
    expect(screen.getByText('3h')).toBeInTheDocument();
    expect(screen.getByText('B+')).toBeInTheDocument();
  });

  it('shows block/log counts and unplanned minutes in hints', () => {
    render(<AnalyticsKpiGrid snapshot={makeSnapshot({ blockCount: 6, logCount: 8, unplannedMins: 120 })} />);

    expect(screen.getByText('6 blocks')).toBeInTheDocument();
    expect(screen.getByText('8 logs')).toBeInTheDocument();
    expect(screen.getByText('2h unplanned')).toBeInTheDocument();
  });
});
