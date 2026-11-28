// Tests for WeeklyBoard: renders day columns and forwards per-day callbacks.
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { EnrichedScheduleBlock, Intention } from '@/types/database';
import type { WeeklyDaySummary } from '@/utils/weekly';
import { BLOCK_DRAG_MIME } from '@/utils/dragContext';
import { WeeklyBoard } from './WeeklyBoard';

function makeSummary(date: string, isoWeekday: number): WeeklyDaySummary {
  return {
    date,
    isoWeekday,
    plannedMins: 60,
    actualMins: 0,
    unplannedMins: 0,
    capacityMins: 480,
    utilizationPct: 12.5,
    blockCount: 0,
    pendingRolloverCount: 0,
  };
}

const DAYS = [makeSummary('2026-11-16', 1), makeSummary('2026-11-17', 2)];

const task: Intention = {
  id: 'task-1',
  title: 'Write report',
  categoryId: null,
  isRecurring: false,
  defaultDurationMins: 60,
  targetSessionsPerWeek: null,
  preferredWeekdays: [],
  status: 'active',
  notes: null,
  priority: null,
  createdAt: 't',
};

const block: EnrichedScheduleBlock = {
  id: 'block-1',
  taskId: 'task-1',
  scheduledDate: '2026-11-16',
  startTime: '09:00',
  endTime: '10:00',
  plannedDurationMins: 60,
  notes: null,
  status: 'planned',
  rolledFromBlockId: null,
  createdAt: 't',
  task,
};

function renderBoard(opts: { days?: WeeklyDaySummary[]; blocksByDate?: Map<string, EnrichedScheduleBlock[]> } = {}) {
  const handlers = {
    onAdd: vi.fn(),
    onBlockClick: vi.fn(),
    onDropTask: vi.fn(),
    onDropBlock: vi.fn(),
  };
  render(
    <WeeklyBoard
      days={opts.days ?? DAYS}
      blocksByDate={opts.blocksByDate ?? new Map()}
      actualByBlock={new Map()}
      categoryOf={() => undefined}
      mode="draft"
      onAdd={handlers.onAdd}
      onBlockClick={handlers.onBlockClick}
      onDropTask={handlers.onDropTask}
      onDropBlock={handlers.onDropBlock}
    />,
  );
  return handlers;
}

describe('WeeklyBoard', () => {
  it('renders one column per day', () => {
    renderBoard();
    expect(screen.getAllByText(/Add Task/)).toHaveLength(2);
    expect(screen.getByText(/Mon 16/)).toBeInTheDocument();
    expect(screen.getByText(/Tue 17/)).toBeInTheDocument();
  });

  it('passes the column date to onAdd', async () => {
    const user = userEvent.setup();
    const handlers = renderBoard();

    await user.click(screen.getAllByRole('button', { name: /Add Task/ })[1]);
    expect(handlers.onAdd).toHaveBeenCalledWith('2026-11-17');
  });

  it('renders blocks for their date and forwards block clicks', async () => {
    const user = userEvent.setup();
    const handlers = renderBoard({
      blocksByDate: new Map([['2026-11-16', [block]]]),
    });

    await user.click(screen.getByText('Write report'));
    expect(handlers.onBlockClick).toHaveBeenCalledWith(block);
  });

  it('forwards intention drops with the column date', () => {
    const handlers = renderBoard();
    const columns = document.querySelectorAll('.min-h-140');
    expect(columns).toHaveLength(2);

    const intention: Intention = { ...task, id: 'task-new' };
    const event = new MouseEvent('drop', { bubbles: true, cancelable: true });
    Object.assign(event, {
      dataTransfer: { getData: (mime: string) => (mime === 'application/x-intent-scheduler-task' ? JSON.stringify(intention) : '') },
    });
    fireEvent(columns[1], event);

    expect(handlers.onDropTask).toHaveBeenCalledWith(intention, '2026-11-17');
  });

  it('forwards block drops with the column date', () => {
    const handlers = renderBoard();
    const columns = document.querySelectorAll('.min-h-140');

    const moved: EnrichedScheduleBlock = { ...block, id: 'block-moved', scheduledDate: '2026-11-17' };
    const event = new MouseEvent('drop', { bubbles: true, cancelable: true });
    Object.assign(event, {
      dataTransfer: { getData: (mime: string) => (mime === BLOCK_DRAG_MIME ? JSON.stringify(moved) : '') },
    });
    fireEvent(columns[0], event);

    expect(handlers.onDropBlock).toHaveBeenCalledWith(moved, '2026-11-16');
  });
});
