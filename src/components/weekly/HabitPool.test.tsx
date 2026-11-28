// Tests for HabitPool: recurring intention cards, adherence, cadence labels,
// configure button, and drag payload.
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Category, EnrichedScheduleBlock, Intention } from '@/types/database';
import { HabitPool } from './HabitPool';

const category: Category = { id: 'cat-1', name: 'Deep Work', colorHex: '#4f46e5', createdAt: 't' };

function makeHabit(overrides: Partial<Intention> = {}): Intention {
  return {
    id: 'habit-1',
    title: 'Morning pages',
    categoryId: 'cat-1',
    isRecurring: true,
    defaultDurationMins: 30,
    targetSessionsPerWeek: 4,
    preferredWeekdays: [],
    preferredTime: null,
    status: 'active',
    notes: null,
    priority: null,
    createdAt: 't',
    ...overrides,
  };
}

function makeBlock(overrides: Partial<EnrichedScheduleBlock> = {}): EnrichedScheduleBlock {
  return {
    id: 'block-1',
    taskId: 'habit-1',
    scheduledDate: '2026-11-16',
    startTime: '08:00',
    endTime: '08:30',
    plannedDurationMins: 30,
    notes: null,
    status: 'planned',
    rolledFromBlockId: null,
    createdAt: 't',
    ...overrides,
  };
}

function renderPool(opts: { intentions?: Intention[]; blocks?: EnrichedScheduleBlock[] } = {}) {
  const onConfigure = vi.fn();
  render(
    <HabitPool
      intentions={opts.intentions ?? [makeHabit()]}
      blocks={opts.blocks ?? []}
      categories={[category]}
      onConfigure={onConfigure}
    />,
  );
  return onConfigure;
}

describe('HabitPool', () => {
  it('renders only recurring active intentions', () => {
    renderPool({
      intentions: [
        makeHabit({ id: 'h1', title: 'Recurring habit' }),
        makeHabit({ id: 'h2', title: 'One-off', isRecurring: false }),
        makeHabit({ id: 'h3', title: 'Archived habit', status: 'archived' }),
      ],
    });

    expect(screen.getByText('Recurring habit')).toBeInTheDocument();
    expect(screen.queryByText('One-off')).not.toBeInTheDocument();
    expect(screen.queryByText('Archived habit')).not.toBeInTheDocument();
    expect(screen.getByText('1 ready')).toBeInTheDocument();
  });

  it('shows category, cadence, duration, and planned/target counts', () => {
    renderPool({
      blocks: [
        makeBlock({ id: 'b1', status: 'completed' }),
        makeBlock({ id: 'b2', status: 'completed', scheduledDate: '2026-11-17' }),
        makeBlock({ id: 'b3', status: 'planned', scheduledDate: '2026-11-18' }),
        makeBlock({ id: 'b4', status: 'dismissed', scheduledDate: '2026-11-19' }),
      ],
    });

    expect(screen.getByText(/Deep Work • 4×\/wk/)).toBeInTheDocument();
    expect(screen.getByText('30m')).toBeInTheDocument();
    // sessions exclude dismissed: 2 completed + 1 planned = 3 planned / 4 target
    expect(screen.getByText('3 planned / 4')).toBeInTheDocument();
    // adherence = 2/4 = 50%
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('shows adherence-free fallback when there is no weekly target', () => {
    renderPool({ intentions: [makeHabit({ targetSessionsPerWeek: null, preferredWeekdays: [1, 3] })] });

    expect(screen.getByText(/2×\/wk/)).toBeInTheDocument();
    expect(screen.getByText('0/0 done')).toBeInTheDocument();
  });

  it('shows "Recurring" cadence when no target and no preferred weekdays', () => {
    renderPool({ intentions: [makeHabit({ targetSessionsPerWeek: null, preferredWeekdays: [] })] });
    expect(screen.getByText(/Uncategorized • Recurring|Deep Work • Recurring/)).toBeInTheDocument();
  });

  it('shows "No estimate" when the habit has no default duration', () => {
    renderPool({ intentions: [makeHabit({ defaultDurationMins: null })] });
    expect(screen.getByText('No estimate')).toBeInTheDocument();
  });

  it('shows the empty-state message when there are no habits', () => {
    renderPool({ intentions: [] });
    expect(screen.getByText(/No recurring intentions yet/)).toBeInTheDocument();
  });

  it('calls onConfigure from the Configure Routines button', async () => {
    const user = userEvent.setup();
    const onConfigure = renderPool();

    await user.click(screen.getByRole('button', { name: /Configure Routines/ }));
    expect(onConfigure).toHaveBeenCalledTimes(1);
  });

  it('sets the intention drag payload on drag start', () => {
    renderPool();
    const card = screen.getByText('Morning pages').closest('[draggable="true"]');
    expect(card).not.toBeNull();

    const setData = vi.fn();
    const event = new MouseEvent('dragstart', { bubbles: true });
    Object.assign(event, { dataTransfer: { setData, effectAllowed: '' } });
    fireEvent(card!, event);

    expect(setData).toHaveBeenCalledWith(
      'application/x-intent-scheduler-task',
      JSON.stringify(makeHabit()),
    );
  });
});
