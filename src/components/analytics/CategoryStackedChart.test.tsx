// Tests for CategoryStackedChart: stacked weekday bars and legend.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CategoryStackedChart } from './CategoryStackedChart';
import { makeSnapshot } from './testUtils';

// Mon 2026-11-16 through Sun 2026-11-22.
const DATES = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'];

describe('CategoryStackedChart', () => {
  it('renders one bar per date with weekday labels', () => {
    const { container } = render(<CategoryStackedChart slices={makeSnapshot().categoryStack} dates={DATES} />);

    // WEEKDAY_LABELS are Mon..Sun
    for (const label of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // 7 bars rendered
    expect(container.querySelectorAll('.flex-1.flex-col.items-center').length).toBeGreaterThan(0);
  });

  it('renders legend entries for each unique category', () => {
    render(<CategoryStackedChart slices={makeSnapshot().categoryStack} dates={DATES} />);

    expect(screen.getByText('Deep Work')).toBeInTheDocument();
    expect(screen.getByText('Health')).toBeInTheDocument();
    expect(screen.getByText('Uncategorized')).toBeInTheDocument();
  });

  it('renders empty bars when there are no slices', () => {
    const { container } = render(<CategoryStackedChart slices={[]} dates={DATES} />);

    // Bars still render (min height) and no legend entries appear.
    expect(container.querySelector('.flex.h-40')).toBeInTheDocument();
    expect(screen.queryByText('Deep Work')).not.toBeInTheDocument();
  });

  it('deduplicates legend entries for the same category across days', () => {
    const slices = [
      { date: '2026-11-16', categoryId: 'cat-1', name: 'Deep Work', colorHex: '#4f46e5', minutes: 30 },
      { date: '2026-11-17', categoryId: 'cat-1', name: 'Deep Work', colorHex: '#4f46e5', minutes: 60 },
    ];
    render(<CategoryStackedChart slices={slices} dates={DATES} />);

    expect(screen.getAllByText('Deep Work')).toHaveLength(1);
  });
});
