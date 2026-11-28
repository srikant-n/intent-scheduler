// Tests for WeeklyDayColumn: capacity bar, block list, status pills,
// add-task button, and drag-and-drop of intentions/blocks.
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Category, EnrichedScheduleBlock, Intention } from '@/types/database';
import type { WeeklyDaySummary } from '@/utils/weekly';
import { todayISO } from '@/utils/time';
import { BLOCK_DRAG_MIME } from '@/utils/dragContext';
import { WeeklyDayColumn } from './WeeklyDayColumn';

const category: Category = { id: 'cat-1', name: 'Deep Work', colorHex: '#4f46e5', createdAt: 't' };

const task: Intention = {
  id: 'task-1',
  title: 'Write report',
  categoryId: 'cat-1',
  isRecurring: false,
  defaultDurationMins: 60,
  targetSessionsPerWeek: null,
  preferredWeekdays: [],
  preferredTime: null,
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

function makeSummary(overrides: Partial<WeeklyDaySummary> = {}): WeeklyDaySummary {
  return {
    date: '2026-11-16', // Monday, in the past relative to test run date
    isoWeekday: 1,
    plannedMins: 120,
    actualMins: 0,
    unplannedMins: 0,
    capacityMins: 480,
    utilizationPct: 25,
    blockCount: 0,
    pendingRolloverCount: 0,
    ...overrides,
  };
}

function renderColumn(opts: { summary?: WeeklyDaySummary; blocks?: EnrichedScheduleBlock[] } = {}) {
  const handlers = {
    onAdd: vi.fn(),
    onBlockClick: vi.fn(),
    onDropTask: vi.fn(),
    onDropBlock: vi.fn(),
  };
  render(
    <WeeklyDayColumn
      summary={opts.summary ?? makeSummary()}
      blocks={opts.blocks ?? []}
      actualByBlock={new Map()}
      categoryOf={() => category}
      mode="draft"
      onAdd={handlers.onAdd}
      onBlockClick={handlers.onBlockClick}
      onDropTask={handlers.onDropTask}
      onDropBlock={handlers.onDropBlock}
    />,
  );
  return handlers;
}

function columnRoot(): Element {
  const el = document.querySelector('.min-h-140');
  expect(el).not.toBeNull();
  return el!;
}

function fireDropOnColumn(getData: (mime: string) => string) {
  const event = new MouseEvent('drop', { bubbles: true, cancelable: true });
  Object.assign(event, { dataTransfer: { getData } });
  fireEvent(columnRoot(), event);
}

describe('WeeklyDayColumn', () => {
  it('renders the day header, planned total, and capacity line', () => {
    renderColumn();

    // formatDateShort('2026-11-16') -> "Mon, Nov 16"; header shows "Mon 16"
    expect(screen.getByText(/Mon 16/)).toBeInTheDocument();
    expect(screen.getByText('2h')).toBeInTheDocument(); // plannedMins 120
    expect(screen.getByText(/Cap: 8h \(25%\)/)).toBeInTheDocument();
  });

  it('shows the Today badge when the summary date is today', () => {
    renderColumn({ summary: makeSummary({ date: todayISO(), isoWeekday: 2 }) });
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('renders block cards and wires block clicks', async () => {
    const user = userEvent.setup();
    const handlers = renderColumn({ blocks: [block] });

    expect(screen.getByText('Write report')).toBeInTheDocument();
    await user.click(screen.getByText('Write report'));
    expect(handlers.onBlockClick).toHaveBeenCalledWith(block);
  });

  it('shows the empty drop-zone hint when there are no blocks', () => {
    renderColumn({ blocks: [] });
    expect(screen.getByText('Drop intentions here')).toBeInTheDocument();
  });

  it('calls onAdd when the Add Task button is clicked', async () => {
    const user = userEvent.setup();
    const handlers = renderColumn();

    await user.click(screen.getByRole('button', { name: /Add Task/ }));
    expect(handlers.onAdd).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ capacityMins: 0, plannedMins: 0, actualMins: 0, utilizationPct: null }, 'No capacity set'],
    [{ pendingRolloverCount: 2 }, '2 pending rollover'],
    [{ plannedMins: 100, actualMins: 100, capacityMins: 480 }, 'Spot-on'],
    [{ plannedMins: 100, actualMins: 200, capacityMins: 480 }, /over/],
    [{ plannedMins: 100, actualMins: 50, capacityMins: 480 }, /under/],
    [{ plannedMins: 0, actualMins: 0, capacityMins: 120, utilizationPct: 100 }, 'Over capacity'],
    [{ plannedMins: 300, capacityMins: 480, utilizationPct: 62.5 }, '3h unallocated'],
    // utilizationPct null bypasses the >=100 'Over capacity' check so the
    // planned>=capacity branch yields 'Fully allocated'.
    [{ plannedMins: 480, capacityMins: 480, utilizationPct: null }, 'Fully allocated'],
  ])('status pill %# -> %s', (overrides, expected) => {
    const { unmount } = render(
      <WeeklyDayColumn
        summary={makeSummary(overrides as Partial<WeeklyDaySummary>)}
        blocks={[]}
        actualByBlock={new Map()}
        categoryOf={() => undefined}
        mode="draft"
        onAdd={vi.fn()}
        onBlockClick={vi.fn()}
        onDropTask={vi.fn()}
        onDropBlock={vi.fn()}
      />,
    );
    expect(screen.getByText(expected as string)).toBeInTheDocument();
    unmount();
  });

  it('shows "Ready" for future days with no plan', () => {
    renderColumn({ summary: makeSummary({ date: '2099-01-05', isoWeekday: 1, plannedMins: 0, capacityMins: 480, utilizationPct: 0 }) });
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('drops a schedule block payload and calls onDropBlock', () => {
    const handlers = renderColumn();
    fireDropOnColumn((mime) => (mime === BLOCK_DRAG_MIME ? JSON.stringify(block) : ''));
    expect(handlers.onDropBlock).toHaveBeenCalledWith(block);
    expect(handlers.onDropTask).not.toHaveBeenCalled();
  });

  it('drops an intention payload and calls onDropTask', () => {
    const handlers = renderColumn();
    const intention: Intention = { ...task, id: 'task-new', title: 'New task' };
    fireDropOnColumn((mime) => (mime === 'application/x-intent-scheduler-task' ? JSON.stringify(intention) : ''));
    expect(handlers.onDropTask).toHaveBeenCalledWith(intention);
    expect(handlers.onDropBlock).not.toHaveBeenCalled();
  });

  it('ignores drops with no recognized payload', () => {
    const handlers = renderColumn();
    fireDropOnColumn(() => '');
    expect(handlers.onDropTask).not.toHaveBeenCalled();
    expect(handlers.onDropBlock).not.toHaveBeenCalled();
  });

  it('ignores malformed JSON payloads', () => {
    const handlers = renderColumn();
    fireDropOnColumn(() => '{oops');
    expect(handlers.onDropTask).not.toHaveBeenCalled();
    expect(handlers.onDropBlock).not.toHaveBeenCalled();
  });
});
