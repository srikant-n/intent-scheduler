// Tests for RolloverAnalyticsPanel: rollover outcome cards and recent events.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RolloverAnalyticsPanel } from './RolloverAnalyticsPanel';
import { makeSnapshot } from './testUtils';

describe('RolloverAnalyticsPanel', () => {
  it('renders the heading and all four outcome cards', () => {
    render(<RolloverAnalyticsPanel snapshot={makeSnapshot()} />);

    expect(screen.getByText('Rollover Load')).toBeInTheDocument();
    expect(screen.getByText('Rolled over')).toBeInTheDocument();
    expect(screen.getByText('Dismissed')).toBeInTheDocument();
    expect(screen.getByText('Missed')).toBeInTheDocument();
    expect(screen.getByText('Pending now')).toBeInTheDocument();

    // counts: 2, 1, 1, 3
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    // rolledMins 120 -> 2h
    expect(screen.getByText('2h')).toBeInTheDocument();
  });

  it('renders recent rollover events with status and minutes', () => {
    render(<RolloverAnalyticsPanel snapshot={makeSnapshot()} />);

    expect(screen.getByText('Recent rollover events')).toBeInTheDocument();
    expect(screen.getByText('Deep dive')).toBeInTheDocument();
    expect(screen.getByText('Gym')).toBeInTheDocument();
    expect(screen.getByText(/2026-11-19 • rolled • 1h/)).toBeInTheDocument();
    expect(screen.getByText(/2026-11-20 • dismissed • 45m/)).toBeInTheDocument();
  });

  it('hides the events section when there are no events', () => {
    const snapshot = makeSnapshot();
    snapshot.rollover = { ...snapshot.rollover, events: [] };
    render(<RolloverAnalyticsPanel snapshot={snapshot} />);

    expect(screen.queryByText('Recent rollover events')).not.toBeInTheDocument();
    // Cards still render
    expect(screen.getByText('Rolled over')).toBeInTheDocument();
  });
});
