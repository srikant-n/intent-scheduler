// Tests for CategoryVariancePanel: stacked chart plus planned/actual/variance table.
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CategoryVariancePanel } from './CategoryVariancePanel';
import { makeSnapshot } from './testUtils';

const DATES = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'];

describe('CategoryVariancePanel', () => {
  it('renders the section heading and description', () => {
    render(<CategoryVariancePanel snapshot={makeSnapshot()} dates={DATES} />);

    expect(screen.getByText('Category Variance')).toBeInTheDocument();
    expect(screen.getByText(/Planned vs actual minutes per category/)).toBeInTheDocument();
  });

  it('renders a row per category with formatted minutes and tendency', () => {
    render(<CategoryVariancePanel snapshot={makeSnapshot()} dates={DATES} />);
    const table = screen.getByRole('table');

    for (const name of ['Deep Work', 'Health', 'Uncategorized']) {
      expect(within(table).getByText(name)).toBeInTheDocument();
    }

    // Deep Work: planned 300 -> 5h, actual 240 -> 4h, realization 80%
    expect(within(table).getByText('5h')).toBeInTheDocument();
    expect(within(table).getByText('4h')).toBeInTheDocument();
    expect(within(table).getByText('80%')).toBeInTheDocument();

    expect(within(table).getByText('on-track')).toBeInTheDocument();
    expect(within(table).getByText('over-realized')).toBeInTheDocument();
    expect(within(table).getByText('insufficient')).toBeInTheDocument();
  });

  it('renders an em dash for missing realization percentage', () => {
    render(<CategoryVariancePanel snapshot={makeSnapshot()} dates={DATES} />);
    const table = screen.getByRole('table');

    // Uncategorized has realizationPct null -> '—'
    expect(within(table).getByText('—')).toBeInTheDocument();
  });

  it('shows an empty-state row when there are no categories', () => {
    render(<CategoryVariancePanel snapshot={makeSnapshot({ categories: [], categoryStack: [] })} dates={DATES} />);

    expect(screen.getByText('No category data for this week.')).toBeInTheDocument();
  });
});
