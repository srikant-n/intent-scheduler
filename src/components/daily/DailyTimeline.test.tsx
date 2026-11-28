// Tests for DailyTimeline: dual-track planner rendering, click-to-plan,
// drag-and-drop payloads, and untimed-log footer.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  Category,
  EnrichedScheduleBlock,
  EnrichedTimeLog,
  Intention,
  ScheduleBlock,
  TimeLog,
} from '@/types/database';
import { BLOCK_DRAG_MIME, LOG_DRAG_MIME, TASK_DRAG_MIME } from '@/utils/dragContext';
import { DailyTimeline } from './DailyTimeline';

const DATE = '2026-11-23'; // Monday

const category: Category = { id: 'cat-1', name: 'Deep Work', colorHex: '#4f46e5', createdAt: 't' };

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

function makeBlock(overrides: Partial<EnrichedScheduleBlock> = {}): EnrichedScheduleBlock {
  return {
    id: 'block-1',
    taskId: 'task-1',
    scheduledDate: DATE,
    startTime: '09:00',
    endTime: '10:00',
    plannedDurationMins: 60,
    notes: null,
    status: 'planned',
    rolledFromBlockId: null,
    createdAt: 't',
    task,
    ...overrides,
  };
}

function makeLog(overrides: Partial<EnrichedTimeLog> = {}): EnrichedTimeLog {
  return {
    id: 'log-1',
    taskId: 'task-1',
    scheduleBlockId: 'block-1',
    customTitle: null,
    categoryId: 'cat-1',
    logDate: DATE,
    startTime: '09:30',
    endTime: '10:30',
    durationMins: 60,
    notes: null,
    mood: null,
    isAdHoc: false,
    createdAt: 't',
    task,
    category,
    displayTitle: 'Write report',
    displayCategory: category,
    ...overrides,
  };
}

// jsdom lacks DragEvent, so dispatch a MouseEvent named 'drop' with a
// dataTransfer stub and real clientY coordinates.
function fireDrop(el: Element, clientY: number, getData: (mime: string) => string) {
  const event = new MouseEvent('drop', { bubbles: true, cancelable: true, clientY });
  Object.assign(event, { dataTransfer: { getData } });
  fireEvent(el, event);
}

interface Handlers {
  onDropTask: ReturnType<typeof vi.fn<(task: Intention, startTime: string) => void>>;
  onDropBlock: ReturnType<typeof vi.fn<(block: ScheduleBlock, startTime: string) => void>>;
  onBlockClick: ReturnType<typeof vi.fn<(block: ScheduleBlock) => void>>;
  onLogClick: ReturnType<typeof vi.fn<(log: TimeLog) => void>>;
  onPlannedSlotClick: ReturnType<typeof vi.fn<(startTime: string) => void>>;
  onActualSlotClick: ReturnType<typeof vi.fn<(startTime: string) => void>>;
  onDropLog: ReturnType<typeof vi.fn<(log: TimeLog, startTime: string) => void>>;
}

function renderTimeline(opts: { blocks?: EnrichedScheduleBlock[]; logs?: EnrichedTimeLog[]; date?: string } = {}) {
  const handlers: Handlers = {
    onDropTask: vi.fn<(task: Intention, startTime: string) => void>(),
    onDropBlock: vi.fn<(block: ScheduleBlock, startTime: string) => void>(),
    onBlockClick: vi.fn<(block: ScheduleBlock) => void>(),
    onLogClick: vi.fn<(log: TimeLog) => void>(),
    onPlannedSlotClick: vi.fn<(startTime: string) => void>(),
    onActualSlotClick: vi.fn<(startTime: string) => void>(),
    onDropLog: vi.fn<(log: TimeLog, startTime: string) => void>(),
  };
  render(
    <DailyTimeline
      date={opts.date ?? DATE}
      blocks={opts.blocks ?? [makeBlock()]}
      logs={opts.logs ?? [makeLog()]}
      categories={[category]}
      dayStartHour={8}
      dayEndHour={20}
      onDropTask={handlers.onDropTask}
      onDropBlock={handlers.onDropBlock}
      onBlockClick={handlers.onBlockClick}
      onLogClick={handlers.onLogClick}
      onPlannedSlotClick={handlers.onPlannedSlotClick}
      onActualSlotClick={handlers.onActualSlotClick}
      onDropLog={handlers.onDropLog}
    />,
  );
  return handlers;
}

describe('DailyTimeline', () => {
  it('renders track headers and block/log counts', () => {
    renderTimeline();

    expect(screen.getByText('Intent')).toBeInTheDocument();
    expect(screen.getByText('Reality')).toBeInTheDocument();
    expect(screen.getByText('Time Ruler')).toBeInTheDocument();
    expect(screen.getByText('1 Blocks')).toBeInTheDocument();
    // 'Write report' appears on both the planned block and the reality log
    expect(screen.getAllByText('Write report').length).toBeGreaterThanOrEqual(2);
  });

  it('hides dismissed and rolled blocks', () => {
    renderTimeline({
      blocks: [
        makeBlock({ id: 'b1', status: 'dismissed', task: { ...task, title: 'Dismissed task' } }),
        makeBlock({ id: 'b2', status: 'rolled', task: { ...task, title: 'Rolled task' } }),
        makeBlock({ id: 'b3', status: 'planned' }),
      ],
    });

    expect(screen.queryByText('Dismissed task')).not.toBeInTheDocument();
    expect(screen.queryByText('Rolled task')).not.toBeInTheDocument();
    // 'Write report' appears on both the planned block and the reality log
    expect(screen.getAllByText('Write report').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('1 Blocks')).toBeInTheDocument();
  });

  it('shows "On Intent" badge for linked logs and "Unplanned" for ad-hoc', () => {
    renderTimeline({
      logs: [
        makeLog({ id: 'log-1', scheduleBlockId: 'block-1' }),
        makeLog({
          id: 'log-2',
          scheduleBlockId: null,
          isAdHoc: true,
          customTitle: 'Coffee break',
          displayTitle: 'Coffee break',
          startTime: '12:00',
          endTime: '12:30',
          durationMins: 30,
        }),
      ],
    });

    // 'On Intent' appears in the header legend and on the linked log badge
    expect(screen.getAllByText('On Intent').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Unplanned')).toBeInTheDocument();
    expect(screen.getByText('Coffee break')).toBeInTheDocument();
  });

  it('renders duration-only logs in the footer and wires clicks', () => {
    const handlers = renderTimeline({
      logs: [
        makeLog({ id: 'log-timed' }),
        makeLog({
          id: 'log-untimed',
          startTime: null,
          endTime: null,
          customTitle: 'Reading',
          displayTitle: 'Reading',
          durationMins: 45,
        }),
      ],
    });

    expect(screen.getByText('Duration-only logs')).toBeInTheDocument();
    const chip = screen.getByRole('button', { name: /Reading • 45m/ });
    fireEvent.click(chip);
    expect(handlers.onLogClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'log-untimed' }));
  });

  it('calls onBlockClick when a planned block is clicked', () => {
    const handlers = renderTimeline();
    // First 'Write report' in DOM order is the planned-track block button.
    fireEvent.click(screen.getAllByText('Write report')[0]);
    expect(handlers.onBlockClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'block-1' }));
    expect(handlers.onLogClick).not.toHaveBeenCalled();
  });

  it('calls onLogClick when a timed log is clicked', () => {
    const handlers = renderTimeline();
    // Log button contains displayTitle; block also shows 'Write report' — the log
    // button is the one inside the Reality track. Use the 'Actual:' label parent.
    const actualLabels = screen.getAllByText(/Actual: 1h/);
    fireEvent.click(actualLabels[0].closest('button')!);
    expect(handlers.onLogClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'log-1' }));
  });

  it('calls onPlannedSlotClick with a snapped time when the intent track is clicked', () => {
    const handlers = renderTimeline({ blocks: [], logs: [] });

    // Track height: (20-8)h * 56px = 672px. clientY 336 -> midpoint -> 14:00.
    const tracks = document.querySelectorAll('.relative.border-r');
    expect(tracks.length).toBeGreaterThan(0);
    fireEvent.click(tracks[0], { clientY: 336 });
    expect(handlers.onPlannedSlotClick).toHaveBeenCalledWith('14:00');
  });

  it('calls onActualSlotClick when the reality track is clicked', () => {
    const handlers = renderTimeline({ blocks: [], logs: [] });

    // Reality track is the last .relative track div (no border-r class).
    const rulerAndTracks = document.querySelectorAll('.grid > div');
    const realityTrack = rulerAndTracks[rulerAndTracks.length - 1];
    fireEvent.click(realityTrack, { clientY: 168 }); // quarter -> 11:00
    expect(handlers.onActualSlotClick).toHaveBeenCalledWith('11:00');
  });

  it('drops an intention payload onto the planned track', () => {
    const handlers = renderTimeline({ blocks: [], logs: [] });
    const intention: Intention = { ...task, id: 'task-new', title: 'New task' };

    const plannedTrack = document.querySelector('.relative.border-r');
    expect(plannedTrack).not.toBeNull();
    fireDrop(plannedTrack!, 336, (mime) => (mime === TASK_DRAG_MIME ? JSON.stringify(intention) : ''));

    expect(handlers.onDropTask).toHaveBeenCalledWith(intention, '14:00');
    expect(handlers.onDropBlock).not.toHaveBeenCalled();
  });

  it('drops a schedule block payload onto the planned track', () => {
    const handlers = renderTimeline({ blocks: [], logs: [] });
    const moved: ScheduleBlock = { ...makeBlock(), id: 'block-moved' };

    const plannedTrack = document.querySelector('.relative.border-r');
    fireDrop(plannedTrack!, 168, (mime) => (mime === BLOCK_DRAG_MIME ? JSON.stringify(moved) : ''));

    expect(handlers.onDropBlock).toHaveBeenCalledWith(moved, '11:00');
    expect(handlers.onDropTask).not.toHaveBeenCalled();
  });

  it('drops a time log payload onto the reality track', () => {
    const handlers = renderTimeline({ blocks: [], logs: [] });
    const movedLog: TimeLog = { ...makeLog(), id: 'log-moved' };

    const rulerAndTracks = document.querySelectorAll('.grid > div');
    const realityTrack = rulerAndTracks[rulerAndTracks.length - 1];
    fireDrop(realityTrack, 504, (mime) => (mime === LOG_DRAG_MIME ? JSON.stringify(movedLog) : ''));

    expect(handlers.onDropLog).toHaveBeenCalledWith(movedLog, '17:00');
  });

  it('ignores drops with no recognized payload', () => {
    const handlers = renderTimeline({ blocks: [], logs: [] });
    const plannedTrack = document.querySelector('.relative.border-r');

    fireDrop(plannedTrack!, 336, () => '');

    expect(handlers.onDropTask).not.toHaveBeenCalled();
    expect(handlers.onDropBlock).not.toHaveBeenCalled();
  });

  it('ignores malformed JSON payloads', () => {
    const handlers = renderTimeline({ blocks: [], logs: [] });
    const plannedTrack = document.querySelector('.relative.border-r');

    fireDrop(plannedTrack!, 336, () => '{not json');

    expect(handlers.onDropTask).not.toHaveBeenCalled();
    expect(handlers.onDropBlock).not.toHaveBeenCalled();
  });

  it('renders hour ruler labels', () => {
    renderTimeline({ blocks: [], logs: [] });
    expect(screen.getByText('8:00 AM')).toBeInTheDocument();
    expect(screen.getByText('8:00 PM')).toBeInTheDocument();
  });
});
