// Tests for EstimationDriftPanel: aggregate stats, task bias, recent sessions.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EstimationDriftPanel } from './EstimationDriftPanel';
import { makeSnapshot } from './testUtils';

describe('EstimationDriftPanel', () => {
  it('renders the heading and aggregate stat cards', () => {
    render(<EstimationDriftPanel snapshot={makeSnapshot()} />);

    expect(screen.getByText('Estimation Drift')).toBeInTheDocument();
    expect(screen.getByText('Sessions')).toBeInTheDocument();
    expect(screen.getByText('Avg Variance')).toBeInTheDocument();
    expect(screen.getByText('Avg Abs Drift')).toBeInTheDocument();
    expect(screen.getByText('Grade')).toBeInTheDocument();

    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('B+')).toBeInTheDocument();
    // avgAbsVarianceMins 45 -> 45m
    expect(screen.getByText('45m')).toBeInTheDocument();
  });

  it('renders task-level drift rows with bias labels', () => {
    render(<EstimationDriftPanel snapshot={makeSnapshot()} />);

    expect(screen.getByText('Task-level drift')).toBeInTheDocument();
    expect(screen.getAllByText('Write report').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('4 sessions')).toBeInTheDocument();
    expect(screen.getByText('Underestimated')).toBeInTheDocument();
  });

  it('singularizes session count for one session', () => {
    const snapshot = makeSnapshot();
    snapshot.drift.tasks = [{ ...snapshot.drift.tasks[0], sessions: 1 }];
    render(<EstimationDriftPanel snapshot={snapshot} />);

    expect(screen.getByText('1 session')).toBeInTheDocument();
  });

  it('renders recent drifted sessions with planned -> actual', () => {
    render(<EstimationDriftPanel snapshot={makeSnapshot()} />);

    expect(screen.getByText('Recent drifted sessions')).toBeInTheDocument();
    // 'Write report' appears in both task list and recent sessions
    expect(screen.getAllByText('Write report').length).toBeGreaterThanOrEqual(2);
    // planned 60 -> 1h, actual 90 -> 1h 30m
    expect(screen.getByText(/1h → 1h 30m/)).toBeInTheDocument();
  });

  it('shows empty-state message when there are no sessions', () => {
    const snapshot = makeSnapshot();
    snapshot.drift = { sessions: 0, avgVarianceMins: 0, avgAbsVarianceMins: 0, grade: '—', tasks: [], recentSessions: [] };
    render(<EstimationDriftPanel snapshot={snapshot} />);

    expect(screen.getByText(/No blocks with linked actual logs yet/)).toBeInTheDocument();
    expect(screen.queryByText('Task-level drift')).not.toBeInTheDocument();
    expect(screen.queryByText('Recent drifted sessions')).not.toBeInTheDocument();
  });
});
