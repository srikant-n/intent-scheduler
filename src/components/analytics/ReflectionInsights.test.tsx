// Tests for ReflectionInsights: insights list, mood distribution, reflections feed.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReflectionInsights } from './ReflectionInsights';
import { makeSnapshot } from './testUtils';

describe('ReflectionInsights', () => {
  it('renders the heading and all insight strings', () => {
    render(<ReflectionInsights snapshot={makeSnapshot()} />);

    expect(screen.getByText('Reflection Insights')).toBeInTheDocument();
    expect(screen.getByText('You logged 9h of planned intent this week.')).toBeInTheDocument();
    expect(screen.getByText('Ad-hoc time made up 33% of reality.')).toBeInTheDocument();
  });

  it('renders mood distribution chips with percentages', () => {
    render(<ReflectionInsights snapshot={makeSnapshot()} />);

    expect(screen.getByText('Mood distribution')).toBeInTheDocument();
    // restorative 90m / 150m total = 60%; energizing 60m = 40%
    // 'Energizing' also appears as the reflection entry's mood badge.
    expect(screen.getByText(/Restorative/)).toBeInTheDocument();
    expect(screen.getAllByText(/Energizing/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/60%/)).toBeInTheDocument();
    expect(screen.getByText(/40%/)).toBeInTheDocument();
  });

  it('renders reflection entries with title, date, notes, and mood', () => {
    render(<ReflectionInsights snapshot={makeSnapshot()} />);

    expect(screen.getByText('Recent reflections')).toBeInTheDocument();
    expect(screen.getByText('Morning run')).toBeInTheDocument();
    expect(screen.getByText('Felt great afterwards')).toBeInTheDocument();
    // mood label appears in the distribution chip text and as the entry badge
    expect(screen.getAllByText(/Energizing/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/2026-11-18/)).toBeInTheDocument();
  });

  it('omits mood and reflection sections when empty', () => {
    const snapshot = makeSnapshot({ moods: [], reflections: [] });
    render(<ReflectionInsights snapshot={snapshot} />);

    expect(screen.queryByText('Mood distribution')).not.toBeInTheDocument();
    expect(screen.queryByText('Recent reflections')).not.toBeInTheDocument();
    // Insights still render
    expect(screen.getByText('You logged 9h of planned intent this week.')).toBeInTheDocument();
  });
});
