// Tests for WeeklyPage: week navigation/modes, board drop wiring, block form
// actions, habit distribution, capacity settings, rollover branches, and CSV export.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category, Intention, ScheduleBlock, TimeLog } from '@/types/database';
import { todayISO } from '@/utils/time';
import { WeeklyPage } from './WeeklyPage';

const mocks = vi.hoisted(() => ({
  blocks: [] as ScheduleBlock[],
  logs: [] as TimeLog[],
  allIntentions: [] as Intention[],
  categories: [] as Category[],
  capacity: {} as Record<number, number>,
  scheduleRange: vi.fn(),
  logsRange: vi.fn(),
  scheduleCreate: { mutateAsync: vi.fn(), mutate: vi.fn() },
  scheduleUpdate: { mutateAsync: vi.fn(), mutate: vi.fn() },
  scheduleRemove: { mutateAsync: vi.fn(), mutate: vi.fn() },
  logCreate: { mutateAsync: vi.fn(), mutate: vi.fn() },
  logUpdate: { mutateAsync: vi.fn(), mutate: vi.fn() },
  logRemove: { mutateAsync: vi.fn(), mutate: vi.fn() },
  capacityUpdate: { mutateAsync: vi.fn(), mutate: vi.fn() },
  timerStart: vi.fn(),
  getSetting: vi.fn(),
  runBatchActions: vi.fn(),
  weeklyCsvRows: vi.fn(),
  saveTextFile: vi.fn(),
}));

vi.mock('@/hooks/useSchedule', () => ({
  useScheduleRange: (startDate: string, endDate: string) => {
    mocks.scheduleRange(startDate, endDate);
    return { data: mocks.blocks, isLoading: false };
  },
  useScheduleMutations: () => ({
    create: mocks.scheduleCreate,
    update: mocks.scheduleUpdate,
    remove: mocks.scheduleRemove,
  }),
}));

vi.mock('@/hooks/useLogs', () => ({
  useTimeLogsRange: (startDate: string, endDate: string) => {
    mocks.logsRange(startDate, endDate);
    return { logs: mocks.logs, isLoading: false, create: mocks.logCreate, update: mocks.logUpdate, remove: mocks.logRemove };
  },
}));

vi.mock('@/hooks/useIntentions', () => ({
  useAllIntentions: () => ({ intentions: mocks.allIntentions }),
}));

vi.mock('@/hooks/useCategories', () => ({
  useCategories: () => ({ categories: mocks.categories }),
}));

vi.mock('@/hooks/useWeeklyCapacity', () => ({
  useWeeklyCapacity: () => ({ capacity: mocks.capacity, update: mocks.capacityUpdate }),
}));

vi.mock('@/hooks/useActiveTimer', () => ({
  useActiveTimer: () => ({ startTimer: mocks.timerStart }),
}));

vi.mock('@/db/queries', () => ({
  getSetting: mocks.getSetting,
  runBatchActions: mocks.runBatchActions,
}));

vi.mock('@/utils/fileExport', () => ({
  saveTextFile: mocks.saveTextFile,
}));

vi.mock('@/utils/analytics', () => ({
  weeklyCsvRows: mocks.weeklyCsvRows,
}));

vi.mock('@/components/weekly/WeeklyBoard', () => ({
  WeeklyBoard: (props: {
    days: { date: string }[];
    blocksByDate: Map<string, ScheduleBlock[]>;
    mode: string;
    onAdd: (date: string) => void;
    onBlockClick: (block: ScheduleBlock) => void;
    onDropTask: (task: Intention, date: string) => void;
    onDropBlock: (block: ScheduleBlock, date: string) => void;
  }) => {
    const firstBlock = Array.from(props.blocksByDate.values()).flat()[0];
    const droppedTask: Intention = {
      id: 'task-drop',
      title: 'Dropped task',
      categoryId: null,
      isRecurring: false,
      defaultDurationMins: 30,
      targetSessionsPerWeek: null,
      preferredWeekdays: [],
      preferredTime: null,
      status: 'active',
      notes: null,
      priority: null,
      createdAt: 't',
    };
    return (
      <div data-testid="weekly-board" data-mode={props.mode} data-days={props.days.length}>
        <button onClick={() => props.onAdd(props.days[0].date)}>mock-board-add</button>
        <button onClick={() => firstBlock && props.onBlockClick(firstBlock)}>mock-board-block-click</button>
        <button onClick={() => firstBlock && props.onDropBlock(firstBlock, props.days[1]?.date ?? props.days[0].date)}>mock-board-drop-block</button>
        <button onClick={() => props.onDropTask(droppedTask, props.days[0].date)}>mock-board-drop-task</button>
      </div>
    );
  },
}));

vi.mock('@/components/weekly/WeekSummary', () => ({
  WeekSummary: () => <div data-testid="week-summary" />,
}));

vi.mock('@/components/weekly/HabitPool', () => ({
  HabitPool: ({ onConfigure }: { onConfigure: () => void }) => (
    <button onClick={onConfigure}>mock-configure-habits</button>
  ),
}));

vi.mock('@/components/weekly/HabitDistributionModal', () => ({
  HabitDistributionModal: ({ open, weekDates, intentions, onApply, onClose }: {
    open: boolean;
    weekDates: string[];
    intentions: Intention[];
    onApply: (proposals: unknown[]) => Promise<void>;
    onClose: () => void;
  }) => {
    if (!open) return null;
    return (
      <div data-testid="habit-modal">
        <button
          onClick={() => {
            const task = intentions[0];
            void onApply(task ? [{
              task,
              scheduledDate: weekDates[0],
              startTime: '09:00',
              endTime: '09:30',
              plannedDurationMins: 30,
            }] : []).then(onClose);
          }}
        >
          mock-apply-habits
        </button>
      </div>
    );
  },
}));

vi.mock('@/components/weekly/WeeklyCapacityModal', () => ({
  WeeklyCapacityModal: ({ open, capacity, onSave, onClose }: {
    open: boolean;
    capacity: Record<number, number>;
    onSave: (capacity: Record<number, number>) => Promise<void>;
    onClose: () => void;
  }) => {
    if (!open) return null;
    return (
      <div data-testid="capacity-modal">
        <button onClick={() => { void onSave({ ...capacity, 1: 300 }).then(onClose); }}>mock-save-capacity</button>
      </div>
    );
  },
}));

vi.mock('@/components/weekly/WeeklyRolloverModal', () => ({
  WeeklyRolloverModal: ({ open, blocks, onApply, onClose }: {
    open: boolean;
    blocks: ScheduleBlock[];
    onApply: (action: string, blocks: ScheduleBlock[], reschedule?: { date: string; startTime: string }) => Promise<{ succeeded: number; failed: number }>;
    onClose: () => void;
  }) => {
    if (!open) return null;
    const run = (action: string) => () => {
      void onApply(action, blocks, { date: '2026-11-25', startTime: '10:00' }).then(onClose);
    };
    return (
      <div data-testid="weekly-rollover-modal" data-count={blocks.length}>
        <button onClick={run('next-day')}>mock-rollover-next-day</button>
        <button onClick={run('next-monday')}>mock-rollover-next-monday</button>
        <button onClick={run('reschedule')}>mock-rollover-reschedule</button>
        <button onClick={run('dismiss')}>mock-rollover-dismiss</button>
        <button onClick={run('return')}>mock-rollover-return</button>
      </div>
    );
  },
}));

vi.mock('@/components/daily/ScheduleBlockFormModal', () => ({
  ScheduleBlockFormModal: (props: {
    open: boolean;
    onClose: () => void;
    date: string;
    block?: ScheduleBlock | null;
    tasks: Intention[];
    defaultStartTime?: string;
    defaultTaskId?: string;
    onSave: (values: Record<string, unknown>) => Promise<void>;
    onDelete?: () => Promise<void>;
    onStartTimer?: () => Promise<void>;
    onLogActual?: (durationMins: number) => Promise<void>;
  }) => {
    if (!props.open) return null;
    const taskId = props.block?.taskId ?? props.defaultTaskId ?? props.tasks[0]?.id ?? 'task-1';
    const startTime = props.block?.startTime ?? props.defaultStartTime ?? '09:00';
    const duration = props.block?.plannedDurationMins ?? props.tasks.find((task) => task.id === taskId)?.defaultDurationMins ?? 30;
    const [hours, minutes] = startTime.split(':').map(Number);
    const endTotal = (hours || 0) * 60 + (minutes || 0) + duration;
    const endTime = `${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`;
    return (
      <div data-testid="block-form" data-block={props.block?.id ?? ''} data-date={props.date} data-start={props.defaultStartTime ?? ''} data-task={props.defaultTaskId ?? ''}>
        <button
          onClick={() => {
            void props.onSave({
              taskId,
              scheduledDate: props.date,
              startTime,
              endTime,
              plannedDurationMins: duration,
              notes: '',
              status: props.block?.status ?? 'planned',
            }).then(props.onClose);
          }}
        >
          mock-save-block
        </button>
        {props.onDelete && <button onClick={() => { void props.onDelete?.().then(props.onClose); }}>mock-delete-block</button>}
        {props.onStartTimer && <button onClick={() => { void props.onStartTimer?.().then(props.onClose); }}>mock-start-timer</button>}
        {props.onLogActual && <button onClick={() => { void props.onLogActual?.(45).then(props.onClose); }}>mock-log-actual</button>}
      </div>
    );
  },
}));

function makeCategory(overrides: Partial<Category> = {}): Category {
  return { id: 'cat-1', name: 'Deep Work', colorHex: '#4f46e5', createdAt: 't', ...overrides };
}

function makeIntention(overrides: Partial<Intention> = {}): Intention {
  return {
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
    createdAt: '2026-11-01T08:00:00Z',
    ...overrides,
  };
}

function makeBlock(overrides: Partial<ScheduleBlock> = {}): ScheduleBlock {
  return {
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
    ...overrides,
  };
}

function seedPendingBlock() {
  mocks.blocks = [makeBlock({ id: 'block-pending', scheduledDate: '2020-01-01', taskId: 'task-1' })];
  mocks.allIntentions = [makeIntention()];
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.blocks = [];
  mocks.logs = [];
  mocks.allIntentions = [makeIntention()];
  mocks.categories = [makeCategory()];
  mocks.capacity = { 1: 180, 2: 180, 3: 180, 4: 180, 5: 180, 6: 120, 7: 90 };
  mocks.getSetting.mockImplementation(async (key: string) => {
    if (key === 'day_start_hour') return '6';
    if (key === 'day_end_hour') return '22';
    if (key === 'snap_interval_minutes') return '15';
    return null;
  });
  mocks.runBatchActions.mockImplementation(async (items: unknown[], action: (item: unknown) => Promise<void>) => {
    const succeeded: unknown[] = [];
    const failed: { item: unknown; error: string }[] = [];
    for (const item of items) {
      try {
        await action(item);
        succeeded.push(item);
      } catch (error) {
        failed.push({ item, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return { succeeded, failed };
  });
  mocks.weeklyCsvRows.mockReturnValue([{ date: '2026-11-16', planned: 60 }]);
  mocks.saveTextFile.mockResolvedValue(true);
  for (const mutation of [mocks.scheduleCreate, mocks.scheduleUpdate, mocks.logCreate, mocks.capacityUpdate]) {
    mutation.mutateAsync.mockResolvedValue(undefined);
  }
});

function renderWeekly(onDateChange: (date: string) => void = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<WeeklyPage date="2026-11-18" onDateChange={onDateChange} />, { wrapper });
}

describe('WeeklyPage', () => {
  it('queries the selected week range and renders board, summary, and habit pool', () => {
    renderWeekly();

    expect(mocks.scheduleRange).toHaveBeenCalledWith('2026-11-16', '2026-11-22');
    expect(mocks.logsRange).toHaveBeenCalledWith('2026-11-16', '2026-11-22');
    expect(screen.getByTestId('weekly-board')).toHaveAttribute('data-days', '7');
    expect(screen.getByTestId('week-summary')).toBeInTheDocument();
    expect(screen.getByText('mock-configure-habits')).toBeInTheDocument();
  });

  it('navigates weeks, toggles board mode, and exports CSV', async () => {
    const onDateChange = vi.fn();
    renderWeekly(onDateChange);

    fireEvent.click(screen.getByTitle('Previous Week'));
    expect(onDateChange).toHaveBeenLastCalledWith('2026-11-11');
    fireEvent.click(screen.getByTitle('Next Week'));
    expect(onDateChange).toHaveBeenLastCalledWith('2026-11-25');
    fireEvent.click(screen.getByRole('button', { name: 'This Week' }));
    expect(onDateChange).toHaveBeenLastCalledWith(todayISO());

    fireEvent.click(screen.getByRole('button', { name: /Review Reality/ }));
    expect(screen.getByTestId('weekly-board')).toHaveAttribute('data-mode', 'reality');

    fireEvent.click(screen.getByTitle('Export Week CSV'));
    await waitFor(() => expect(mocks.saveTextFile).toHaveBeenCalledWith(
      'intent-scheduler-week-2026-11-16.csv',
      expect.stringContaining('date'),
    ));
    expect(await screen.findByText('CSV exported.')).toBeInTheDocument();
  });

  it('drops an intention onto the first day and creates a block from the form', async () => {
    renderWeekly();

    fireEvent.click(screen.getByText('mock-board-drop-task'));
    expect(screen.getByTestId('block-form')).toHaveAttribute('data-date', '2026-11-16');
    expect(screen.getByTestId('block-form')).toHaveAttribute('data-start', '06:00');
    expect(screen.getByTestId('block-form')).toHaveAttribute('data-task', 'task-drop');

    fireEvent.click(screen.getByText('mock-save-block'));
    await waitFor(() => expect(mocks.scheduleCreate.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'task-drop',
      scheduledDate: '2026-11-16',
      startTime: '06:00',
      endTime: '06:30',
      plannedDurationMins: 30,
      status: 'planned',
    })));
  });

  it('confirms before moving a block onto an overlapping day', async () => {
    mocks.blocks = [
      makeBlock({ id: 'block-a', scheduledDate: '2026-11-16', taskId: 'task-1' }),
      makeBlock({ id: 'block-b', scheduledDate: '2026-11-17', taskId: 'task-1', startTime: '09:30', endTime: '10:30' }),
    ];
    renderWeekly();

    fireEvent.click(screen.getByText('mock-board-drop-block'));
    expect(screen.getByText('Overlapping block')).toBeInTheDocument();
    expect(mocks.scheduleUpdate.mutateAsync).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Move anyway' }));
    await waitFor(() => expect(mocks.scheduleUpdate.mutateAsync).toHaveBeenCalledWith({
      id: 'block-a',
      scheduledDate: '2026-11-17',
    }));
  });

  it('applies habit distribution proposals as planned blocks', async () => {
    mocks.allIntentions = [makeIntention({
      id: 'habit-1',
      title: 'Stretch',
      isRecurring: true,
      defaultDurationMins: 30,
      targetSessionsPerWeek: 1,
      preferredWeekdays: [],
      preferredTime: null,
    })];
    renderWeekly();

    fireEvent.click(screen.getByRole('button', { name: /Distribute Habits/ }));
    fireEvent.click(screen.getByText('mock-apply-habits'));

    await waitFor(() => expect(mocks.scheduleCreate.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'habit-1',
      scheduledDate: '2026-11-16',
      startTime: '09:00',
      endTime: '09:30',
      plannedDurationMins: 30,
      status: 'planned',
    })));
  });

  it('saves weekly capacity through the capacity modal', async () => {
    renderWeekly();

    fireEvent.click(screen.getByRole('button', { name: /Weekly Target/ }));
    fireEvent.click(screen.getByText('mock-save-capacity'));

    await waitFor(() => expect(mocks.capacityUpdate.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ 1: 300 })));
  });

  it('edits an existing block through the shared block form', async () => {
    mocks.blocks = [makeBlock({ id: 'block-edit', taskId: 'task-1' })];
    renderWeekly();

    fireEvent.click(screen.getByText('mock-board-block-click'));
    expect(screen.getByTestId('block-form')).toHaveAttribute('data-block', 'block-edit');

    fireEvent.click(screen.getByText('mock-save-block'));
    await waitFor(() => expect(mocks.scheduleUpdate.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      id: 'block-edit',
      scheduledDate: '2026-11-16',
      startTime: '09:00',
      endTime: '10:00',
      plannedDurationMins: 60,
    })));
  });

  it('starts the active timer and logs actual time for a selected block', async () => {
    mocks.blocks = [makeBlock({ id: 'block-actions', taskId: 'task-1' })];
    renderWeekly();

    fireEvent.click(screen.getByText('mock-board-block-click'));
    fireEvent.click(screen.getByText('mock-start-timer'));
    expect(mocks.timerStart).toHaveBeenCalledWith(expect.objectContaining({
      task: expect.objectContaining({ id: 'task-1' }),
      block: expect.objectContaining({ id: 'block-actions' }),
      targetDurationMins: 60,
    }));

    fireEvent.click(screen.getByText('mock-board-block-click'));
    fireEvent.click(screen.getByText('mock-log-actual'));
    await waitFor(() => expect(mocks.logCreate.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'task-1',
      scheduleBlockId: 'block-actions',
      logDate: '2026-11-16',
      durationMins: 45,
      isAdHoc: false,
    })));
    await waitFor(() => expect(mocks.scheduleUpdate.mutateAsync).toHaveBeenCalledWith({ id: 'block-actions', status: 'completed' }));
  });

  it('deletes a block from the shared block form', async () => {
    mocks.blocks = [makeBlock({ id: 'block-delete', taskId: 'task-1' })];
    renderWeekly();

    fireEvent.click(screen.getByText('mock-board-block-click'));
    fireEvent.click(screen.getByText('mock-delete-block'));
    await waitFor(() => expect(mocks.scheduleRemove.mutateAsync).toHaveBeenCalledWith('block-delete'));
  });

  it('moves a pending block to the next day with rollover lineage', async () => {
    seedPendingBlock();
    renderWeekly();

    fireEvent.click(screen.getByRole('button', { name: /Rollover/ }));
    expect(screen.getByTestId('weekly-rollover-modal')).toHaveAttribute('data-count', '1');
    fireEvent.click(screen.getByText('mock-rollover-next-day'));

    await waitFor(() => expect(mocks.scheduleCreate.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'task-1',
      scheduledDate: '2020-01-02',
      rolledFromBlockId: 'block-pending',
    })));
    await waitFor(() => expect(mocks.scheduleUpdate.mutateAsync).toHaveBeenCalledWith({ id: 'block-pending', status: 'rolled' }));
  });

  it('moves a pending block to next Monday with lineage', async () => {
    seedPendingBlock();
    renderWeekly();

    fireEvent.click(screen.getByRole('button', { name: /Rollover/ }));
    fireEvent.click(screen.getByText('mock-rollover-next-monday'));

    await waitFor(() => expect(mocks.scheduleCreate.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      scheduledDate: '2020-01-06',
      rolledFromBlockId: 'block-pending',
    })));
    await waitFor(() => expect(mocks.scheduleUpdate.mutateAsync).toHaveBeenCalledWith({ id: 'block-pending', status: 'rolled' }));
  });

  it('reschedules a pending block with lineage and adjusted times', async () => {
    seedPendingBlock();
    renderWeekly();

    fireEvent.click(screen.getByRole('button', { name: /Rollover/ }));
    fireEvent.click(screen.getByText('mock-rollover-reschedule'));

    await waitFor(() => expect(mocks.scheduleCreate.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      scheduledDate: '2026-11-25',
      startTime: '10:00',
      endTime: '11:00',
      rolledFromBlockId: 'block-pending',
    })));
    await waitFor(() => expect(mocks.scheduleUpdate.mutateAsync).toHaveBeenCalledWith({ id: 'block-pending', status: 'rolled' }));
  });

  it('dismisses and returns pending blocks through batch rollover', async () => {
    seedPendingBlock();
    const { unmount } = renderWeekly();

    fireEvent.click(screen.getByRole('button', { name: /Rollover/ }));
    fireEvent.click(screen.getByText('mock-rollover-dismiss'));
    await waitFor(() => expect(mocks.scheduleUpdate.mutateAsync).toHaveBeenCalledWith({ id: 'block-pending', status: 'dismissed' }));
    unmount();

    renderWeekly();
    fireEvent.click(screen.getAllByRole('button', { name: /Rollover/ })[0]);
    fireEvent.click(screen.getByText('mock-rollover-return'));
    await waitFor(() => expect(mocks.scheduleRemove.mutateAsync).toHaveBeenCalledWith('block-pending'));
  });
});
