// Tests for ActiveTimerBar: hidden when idle, title/category resolution,
// pause/resume/stop/discard actions.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveTimerState, Category, Intention } from '@/types/database';
import { ActiveTimerBar } from './ActiveTimerBar';

const timerState = vi.hoisted(() => ({
  timer: null as ActiveTimerState | null,
  elapsedLabel: '00:12:34',
  isPaused: false,
  pauseTimer: vi.fn(),
  resumeTimer: vi.fn(),
  stopTimer: vi.fn(),
  discardTimer: vi.fn(),
}));

const categoriesState = vi.hoisted(() => ({ categories: [] as Category[] }));
const intentionsState = vi.hoisted(() => ({ intentions: [] as Intention[] }));

vi.mock('@/hooks/useActiveTimer', () => ({
  useActiveTimer: () => timerState,
}));

vi.mock('@/hooks/useCategories', () => ({
  useCategories: () => categoriesState,
  categoryById: (categories: Category[], id: string | null | undefined) =>
    categories.find((c) => c.id === id),
}));

vi.mock('@/hooks/useIntentions', () => ({
  useIntentions: () => intentionsState,
}));

const task: Intention = {
  id: 'task-1',
  title: 'Write report',
  categoryId: 'cat-1',
  isRecurring: false,
  defaultDurationMins: 60,
  targetSessionsPerWeek: null,
  preferredWeekdays: [],
  status: 'active',
  notes: null,
  priority: null,
  createdAt: 't',
};

const category: Category = { id: 'cat-1', name: 'Deep Work', colorHex: '#4f46e5', createdAt: 't' };

function makeTimer(overrides: Partial<ActiveTimerState> = {}): ActiveTimerState {
  return {
    id: 'timer-1',
    taskId: 'task-1',
    scheduleBlockId: null,
    customTitle: null,
    categoryId: null,
    startedAt: new Date().toISOString(),
    accumulatedPausedMs: 0,
    pausedAt: null,
    targetDurationMins: null,
    notes: null,
    ...overrides,
  };
}

describe('ActiveTimerBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    timerState.timer = null;
    timerState.elapsedLabel = '00:12:34';
    timerState.isPaused = false;
    categoriesState.categories = [category];
    intentionsState.intentions = [task];
  });

  it('renders nothing when no timer is active', () => {
    const { container } = render(<ActiveTimerBar />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the linked task title, category, elapsed time, and recording state', () => {
    timerState.timer = makeTimer({ targetDurationMins: 60 });
    render(<ActiveTimerBar />);

    expect(screen.getByText('Write report')).toBeInTheDocument();
    expect(screen.getByText('Deep Work')).toBeInTheDocument();
    expect(screen.getByText('00:12:34')).toBeInTheDocument();
    expect(screen.getByText('recording')).toBeInTheDocument();
    expect(screen.getByText('target 1h')).toBeInTheDocument();
  });

  it('prefers customTitle over the task title', () => {
    timerState.timer = makeTimer({ taskId: null, customTitle: 'Quick coffee' });
    render(<ActiveTimerBar />);
    expect(screen.getByText('Quick coffee')).toBeInTheDocument();
  });

  it('falls back to "Active session" with no task or custom title', () => {
    timerState.timer = makeTimer({ taskId: null });
    render(<ActiveTimerBar />);
    expect(screen.getByText('Active session')).toBeInTheDocument();
  });

  it('shows paused state with Resume instead of Pause', () => {
    timerState.timer = makeTimer({ pausedAt: new Date().toISOString() });
    timerState.isPaused = true;
    render(<ActiveTimerBar />);

    expect(screen.getByText('paused')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Resume/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pause/ })).not.toBeInTheDocument();
  });

  it('pause button calls pauseTimer while recording', async () => {
    const user = userEvent.setup();
    timerState.timer = makeTimer();
    render(<ActiveTimerBar />);

    await user.click(screen.getByRole('button', { name: /Pause/ }));
    expect(timerState.pauseTimer).toHaveBeenCalledTimes(1);
  });

  it('resume button calls resumeTimer while paused', async () => {
    const user = userEvent.setup();
    timerState.timer = makeTimer({ pausedAt: new Date().toISOString() });
    timerState.isPaused = true;
    render(<ActiveTimerBar />);

    await user.click(screen.getByRole('button', { name: /Resume/ }));
    expect(timerState.resumeTimer).toHaveBeenCalledTimes(1);
  });

  it('stop button calls stopTimer', async () => {
    const user = userEvent.setup();
    timerState.timer = makeTimer();
    render(<ActiveTimerBar />);

    await user.click(screen.getByRole('button', { name: /Stop/ }));
    expect(timerState.stopTimer).toHaveBeenCalledTimes(1);
  });

  it('discard button calls discardTimer', async () => {
    const user = userEvent.setup();
    timerState.timer = makeTimer();
    render(<ActiveTimerBar />);

    await user.click(screen.getByTitle('Discard without saving'));
    expect(timerState.discardTimer).toHaveBeenCalledTimes(1);
  });
});
