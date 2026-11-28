// Tests for DailyPage: day navigation, summary/menu rendering, intention
// filtering and quick-add, timeline drop/click wiring, form saves, rollover,
// quick log, and day-bound clamping for dragged logs.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category, Intention, ScheduleBlock, TimeLog } from '@/types/database';
import { todayISO } from '@/utils/time';
import { DailyPage } from './DailyPage';

const DATE = '2026-11-24';

const mocks = vi.hoisted(() => ({
  blocks: [] as ScheduleBlock[],
  logs: [] as TimeLog[],
  intentions: [] as Intention[],
  categories: [] as Category[],
  scheduleCreate: { mutateAsync: vi.fn(), mutate: vi.fn() },
  scheduleUpdate: { mutateAsync: vi.fn(), mutate: vi.fn() },
  scheduleRemove: { mutateAsync: vi.fn(), mutate: vi.fn() },
  timeCreate: { mutateAsync: vi.fn(), mutate: vi.fn() },
  timeUpdate: { mutateAsync: vi.fn(), mutate: vi.fn() },
  timeRemove: { mutateAsync: vi.fn(), mutate: vi.fn() },
  intentionCreate: { mutateAsync: vi.fn(), mutate: vi.fn() },
  timerStart: vi.fn(),
  getSetting: vi.fn(),
}));

vi.mock('@/hooks/useSchedule', () => ({
  useScheduleBlocks: () => ({ blocks: mocks.blocks, isLoading: false }),
  useScheduleMutations: () => ({
    create: mocks.scheduleCreate,
    update: mocks.scheduleUpdate,
    remove: mocks.scheduleRemove,
  }),
}));

vi.mock('@/hooks/useLogs', () => ({
  useTimeLogs: () => ({
    logs: mocks.logs,
    isLoading: false,
    create: mocks.timeCreate,
    update: mocks.timeUpdate,
    remove: mocks.timeRemove,
  }),
}));

vi.mock('@/hooks/useIntentions', () => ({
  useIntentions: () => ({ intentions: mocks.intentions, isLoading: false, create: mocks.intentionCreate }),
}));

vi.mock('@/hooks/useCategories', () => ({
  useCategories: () => ({ categories: mocks.categories }),
}));

vi.mock('@/hooks/useActiveTimer', () => ({
  useActiveTimer: () => ({ startTimer: mocks.timerStart }),
}));

vi.mock('@/db/queries', () => ({
  getSetting: mocks.getSetting,
}));

vi.mock('@/components/daily/DailyTimeline', () => ({
  DailyTimeline: (props: {
    blocks: ScheduleBlock[];
    logs: TimeLog[];
    onDropTask: (task: Intention, startTime: string) => void;
    onDropBlock: (block: ScheduleBlock, startTime: string) => void;
    onDropLog: (log: TimeLog, startTime: string) => void;
    onBlockClick: (block: ScheduleBlock) => void;
    onLogClick: (log: TimeLog) => void;
    onPlannedSlotClick: (startTime: string) => void;
    onActualSlotClick: (startTime: string) => void;
  }) => {
    const droppedTask: Intention = {
      id: 'task-drop',
      title: 'Dropped task',
      categoryId: null,
      isRecurring: false,
      defaultDurationMins: 45,
      targetSessionsPerWeek: null,
      preferredWeekdays: [],
      status: 'active',
      notes: null,
      priority: null,
      createdAt: 't',
    };
    return (
      <div data-testid="daily-timeline" data-blocks={props.blocks.length} data-logs={props.logs.length}>
        <button onClick={() => props.onDropTask(droppedTask, '10:00')}>mock-drop-task</button>
        <button onClick={() => props.blocks[0] && props.onDropBlock(props.blocks[0], '10:30')}>mock-drop-block</button>
        <button onClick={() => props.logs[0] && props.onDropLog(props.logs[0], '21:30')}>mock-drop-log</button>
        <button onClick={() => props.blocks[0] && props.onBlockClick(props.blocks[0])}>mock-block-click</button>
        <button onClick={() => props.logs[0] && props.onLogClick(props.logs[0])}>mock-log-click</button>
        <button onClick={() => props.onPlannedSlotClick('10:00')}>mock-planned-slot</button>
        <button onClick={() => props.onActualSlotClick('11:00')}>mock-actual-slot</button>
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
    onSave: (values: Record<string, unknown>) => Promise<void>;
    onDelete?: () => Promise<void>;
    onStartTimer?: () => Promise<void>;
    onLogActual?: (durationMins: number) => Promise<void>;
  }) => {
    if (!props.open) return null;
    const taskId = props.block?.taskId ?? props.tasks[0]?.id ?? 'task-1';
    const startTime = props.block?.startTime ?? props.defaultStartTime ?? '09:00';
    const duration = props.block?.plannedDurationMins ?? props.tasks.find((task) => task.id === taskId)?.defaultDurationMins ?? 60;
    const [hours, minutes] = startTime.split(':').map(Number);
    const endTotal = (hours || 0) * 60 + (minutes || 0) + duration;
    const endTime = `${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`;
    return (
      <div data-testid="block-form" data-block={props.block?.id ?? ''} data-start={props.defaultStartTime ?? ''}>
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

vi.mock('@/components/daily/TimeLogFormModal', () => ({
  TimeLogFormModal: (props: {
    open: boolean;
    onClose: () => void;
    date: string;
    log?: TimeLog | null;
    defaultStartTime?: string;
    onSave: (values: Record<string, unknown>) => Promise<void>;
    onDelete?: () => Promise<void>;
  }) => {
    if (!props.open) return null;
    return (
      <div data-testid="log-form" data-log={props.log?.id ?? ''} data-start={props.defaultStartTime ?? ''}>
        <button
          onClick={() => {
            void props.onSave({
              taskId: null,
              customTitle: 'Reality entry',
              categoryId: null,
              logDate: props.date,
              startTime: props.defaultStartTime ?? '',
              endTime: '',
              durationMins: 30,
              notes: '',
              mood: '',
            }).then(props.onClose);
          }}
        >
          mock-save-log
        </button>
        {props.onDelete && <button onClick={() => { void props.onDelete?.().then(props.onClose); }}>mock-delete-log</button>}
      </div>
    );
  },
}));

vi.mock('@/components/daily/QuickLogModal', () => ({
  QuickLogModal: ({ open, onSave, onClose }: {
    open: boolean;
    onSave: (values: Record<string, unknown>) => Promise<void>;
    onClose: () => void;
  }) => {
    if (!open) return null;
    return (
      <div data-testid="quick-log-modal">
        <button
          onClick={() => {
            void onSave({ customTitle: 'Quick coffee', categoryId: 'cat-1', durationMins: 30, notes: '', mood: null }).then(onClose);
          }}
        >
          mock-save-quick-log
        </button>
      </div>
    );
  },
}));

vi.mock('@/components/daily/RolloverModal', () => ({
  RolloverModal: ({ open, blocks, onMoveNextDay, onReturnToIntentions, onDismiss, onClose }: {
    open: boolean;
    blocks: ScheduleBlock[];
    onMoveNextDay: (block: ScheduleBlock) => Promise<void>;
    onReturnToIntentions: (block: ScheduleBlock) => Promise<void>;
    onDismiss: (block: ScheduleBlock) => Promise<void>;
    onClose: () => void;
  }) => {
    if (!open) return null;
    const block = blocks[0];
    if (!block) return null;
    return (
      <div data-testid="rollover-modal" data-count={blocks.length}>
        <button onClick={() => { void onMoveNextDay(block).then(onClose); }}>mock-move-next-day</button>
        <button onClick={() => { void onReturnToIntentions(block).then(onClose); }}>mock-return-block</button>
        <button onClick={() => { void onDismiss(block).then(onClose); }}>mock-dismiss-block</button>
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
    scheduledDate: DATE,
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

function makeLog(overrides: Partial<TimeLog> = {}): TimeLog {
  return {
    id: 'log-1',
    taskId: 'task-1',
    scheduleBlockId: null,
    customTitle: null,
    categoryId: 'cat-1',
    logDate: DATE,
    startTime: '09:00',
    endTime: '11:00',
    durationMins: 120,
    notes: null,
    mood: null,
    isAdHoc: true,
    createdAt: 't',
    ...overrides,
  };
}

function renderDaily(overrides: Partial<Parameters<typeof DailyPage>[0]> = {}) {
  const props = {
    date: DATE,
    onDateChange: vi.fn(),
    quickLogOpen: false,
    onQuickLogOpenChange: vi.fn(),
    onOpenIntentions: vi.fn(),
    ...overrides,
  };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const rendered = render(<DailyPage {...props} />, { wrapper });
  return { ...props, unmount: rendered.unmount };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.blocks = [];
  mocks.logs = [];
  mocks.intentions = [makeIntention()];
  mocks.categories = [makeCategory()];
  mocks.getSetting.mockImplementation(async (key: string) => {
    if (key === 'day_start_hour') return '6';
    if (key === 'day_end_hour') return '22';
    return null;
  });
  for (const mutation of [mocks.scheduleCreate, mocks.scheduleUpdate, mocks.timeCreate, mocks.timeUpdate, mocks.intentionCreate]) {
    mutation.mutateAsync.mockResolvedValue(undefined);
  }
  mocks.timerStart.mockResolvedValue(undefined);
});

describe('DailyPage', () => {
  it('renders the daily journal, stats, intentions menu, and navigation callbacks', () => {
    const props = renderDaily();

    expect(screen.getByText('Daily Journal')).toBeInTheDocument();
    expect(screen.getByText('Intentions Menu')).toBeInTheDocument();
    expect(screen.getByText('Write report')).toBeInTheDocument();
    expect(screen.getByText('Intent Target')).toBeInTheDocument();
    expect(screen.getByText('Tracked Reality')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Prev/ }));
    expect(props.onDateChange).toHaveBeenLastCalledWith('2026-11-23');
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(props.onDateChange).toHaveBeenLastCalledWith(todayISO());
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(props.onDateChange).toHaveBeenLastCalledWith('2026-11-25');

    fireEvent.click(screen.getByRole('button', { name: /Spontaneous/ }));
    expect(props.onQuickLogOpenChange).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'Manage' }));
    expect(props.onOpenIntentions).toHaveBeenCalledOnce();
  });

  it('filters the intentions menu by cadence and quick-adds a new intention', async () => {
    const user = userEvent.setup();
    mocks.intentions = [
      makeIntention(),
      makeIntention({ id: 'task-2', title: 'Morning walk', isRecurring: true, defaultDurationMins: 30 }),
    ];
    renderDaily();

    await user.click(screen.getByRole('button', { name: /Recurring \(1\)/ }));
    expect(screen.getByText('Morning walk')).toBeInTheDocument();
    expect(screen.queryByText('Write report')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /All \(2\)/ }));
    await user.type(screen.getByPlaceholderText('Quick add intention…'), 'New errand{Enter}');

    await waitFor(() => expect(mocks.intentionCreate.mutateAsync).toHaveBeenCalledWith({
      title: 'New errand',
      categoryId: null,
      isRecurring: false,
      defaultDurationMins: null,
    }));
  });

  it('drops an intention onto the intent track and creates a sized block', async () => {
    renderDaily();

    fireEvent.click(screen.getByText('mock-drop-task'));

    await waitFor(() => expect(mocks.scheduleCreate.mutateAsync).toHaveBeenCalledWith({
      taskId: 'task-drop',
      scheduledDate: DATE,
      startTime: '10:00',
      endTime: '10:45',
      plannedDurationMins: 45,
    }));
  });

  it('retimes a dropped block while preserving planned duration', async () => {
    mocks.blocks = [makeBlock()];
    renderDaily();

    fireEvent.click(screen.getByText('mock-drop-block'));

    await waitFor(() => expect(mocks.scheduleUpdate.mutateAsync).toHaveBeenCalledWith({
      id: 'block-1',
      startTime: '10:30',
      endTime: '11:30',
      plannedDurationMins: 60,
    }));
  });

  it('clamps a dragged reality log inside configured day bounds', async () => {
    mocks.logs = [makeLog()];
    renderDaily();

    fireEvent.click(screen.getByText('mock-drop-log'));

    await waitFor(() => expect(mocks.timeUpdate.mutateAsync).toHaveBeenCalledWith({
      id: 'log-1',
      startTime: '20:00',
      endTime: '22:00',
    }));
  });

  it('opens the block form from an empty planned slot and creates the block', async () => {
    renderDaily();

    fireEvent.click(screen.getByText('mock-planned-slot'));
    expect(screen.getByTestId('block-form')).toHaveAttribute('data-start', '10:00');

    fireEvent.click(screen.getByText('mock-save-block'));
    await waitFor(() => expect(mocks.scheduleCreate.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'task-1',
      scheduledDate: DATE,
      startTime: '10:00',
      endTime: '11:00',
      plannedDurationMins: 60,
      status: 'planned',
    })));
  });

  it('updates an existing block from the block form', async () => {
    mocks.blocks = [makeBlock()];
    renderDaily();

    fireEvent.click(screen.getByText('mock-block-click'));
    expect(screen.getByTestId('block-form')).toHaveAttribute('data-block', 'block-1');

    fireEvent.click(screen.getByText('mock-save-block'));
    await waitFor(() => expect(mocks.scheduleUpdate.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      id: 'block-1',
      scheduledDate: DATE,
      startTime: '09:00',
      endTime: '10:00',
      plannedDurationMins: 60,
    })));
  });

  it('supports timer, log-actual, and delete actions for a selected block', async () => {
    mocks.blocks = [makeBlock()];
    renderDaily();

    fireEvent.click(screen.getByText('mock-block-click'));
    fireEvent.click(screen.getByText('mock-start-timer'));
    expect(mocks.timerStart).toHaveBeenCalledWith(expect.objectContaining({
      task: expect.objectContaining({ id: 'task-1' }),
      block: expect.objectContaining({ id: 'block-1' }),
      targetDurationMins: 60,
    }));

    fireEvent.click(screen.getByText('mock-block-click'));
    fireEvent.click(screen.getByText('mock-log-actual'));
    await waitFor(() => expect(mocks.timeCreate.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'task-1',
      scheduleBlockId: 'block-1',
      categoryId: 'cat-1',
      logDate: DATE,
      durationMins: 45,
      isAdHoc: false,
    })));
    await waitFor(() => expect(mocks.scheduleUpdate.mutateAsync).toHaveBeenCalledWith({ id: 'block-1', status: 'completed' }));

    fireEvent.click(screen.getByText('mock-block-click'));
    fireEvent.click(screen.getByText('mock-delete-block'));
    await waitFor(() => expect(mocks.scheduleRemove.mutateAsync).toHaveBeenCalledWith('block-1'));
  });

  it('moves a pending block to tomorrow with rollover lineage', async () => {
    mocks.blocks = [makeBlock({ scheduledDate: '2020-01-01' })];
    renderDaily();

    fireEvent.click(screen.getByRole('button', { name: /Rollover/ }));
    expect(screen.getByTestId('rollover-modal')).toHaveAttribute('data-count', '1');
    fireEvent.click(screen.getByText('mock-move-next-day'));

    await waitFor(() => expect(mocks.scheduleCreate.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'task-1',
      scheduledDate: '2020-01-02',
      rolledFromBlockId: 'block-1',
    })));
    await waitFor(() => expect(mocks.scheduleUpdate.mutateAsync).toHaveBeenCalledWith({ id: 'block-1', status: 'rolled' }));
  });

  it('returns and dismisses pending blocks through the rollover modal', async () => {
    mocks.blocks = [makeBlock({ scheduledDate: '2020-01-01' })];
    const { unmount } = renderDaily();

    fireEvent.click(screen.getByRole('button', { name: /Rollover/ }));
    fireEvent.click(screen.getByText('mock-dismiss-block'));
    await waitFor(() => expect(mocks.scheduleUpdate.mutateAsync).toHaveBeenCalledWith({ id: 'block-1', status: 'dismissed' }));
    unmount();

    renderDaily();
    fireEvent.click(screen.getByRole('button', { name: /Rollover/ }));
    fireEvent.click(screen.getByText('mock-return-block'));
    await waitFor(() => expect(mocks.scheduleRemove.mutateAsync).toHaveBeenCalledWith('block-1'));
  });

  it('saves a spontaneous quick log as ad-hoc reality', async () => {
    renderDaily({ quickLogOpen: true });

    fireEvent.click(screen.getByText('mock-save-quick-log'));

    await waitFor(() => expect(mocks.timeCreate.mutateAsync).toHaveBeenCalledWith({
      customTitle: 'Quick coffee',
      categoryId: 'cat-1',
      logDate: DATE,
      durationMins: 30,
      notes: null,
      mood: null,
      isAdHoc: true,
    }));
  });

  it('opens the reality form from an actual slot and saves an ad-hoc log', async () => {
    renderDaily();

    fireEvent.click(screen.getByText('mock-actual-slot'));
    expect(screen.getByTestId('log-form')).toHaveAttribute('data-start', '11:00');

    fireEvent.click(screen.getByText('mock-save-log'));
    await waitFor(() => expect(mocks.timeCreate.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      taskId: null,
      customTitle: 'Reality entry',
      logDate: DATE,
      startTime: '11:00',
      durationMins: 30,
      isAdHoc: true,
    })));
  });
});
