// Tests for IntentionsPage: filtering/sorting/grouping, quick-add payload,
// schedule-to-today, archive/restore/delete flows, and modal wiring.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category, Intention } from '@/types/database';
import { minutesToTime, timeToMinutes, todayISO } from '@/utils/time';
import { IntentionsPage } from './IntentionsPage';

const mocks = vi.hoisted(() => ({
  activeIntentions: [] as Intention[],
  archivedIntentions: [] as Intention[],
  categories: [] as Category[],
  create: { mutateAsync: vi.fn(), mutate: vi.fn() },
  update: { mutateAsync: vi.fn(), mutate: vi.fn() },
  archive: { mutateAsync: vi.fn(), mutate: vi.fn() },
  restore: { mutateAsync: vi.fn(), mutate: vi.fn() },
  remove: { mutateAsync: vi.fn(), mutate: vi.fn() },
  scheduleCreate: { mutateAsync: vi.fn(), mutate: vi.fn() },
  scheduleUpdate: { mutateAsync: vi.fn(), mutate: vi.fn() },
  scheduleRemove: { mutateAsync: vi.fn(), mutate: vi.fn() },
}));

vi.mock('@/hooks/useIntentions', () => ({
  useIntentions: (status: 'active' | 'archived' = 'active') => ({
    intentions: status === 'archived' ? mocks.archivedIntentions : mocks.activeIntentions,
    isLoading: false,
    create: mocks.create,
    update: mocks.update,
    archive: mocks.archive,
    restore: mocks.restore,
    remove: mocks.remove,
  }),
}));

vi.mock('@/hooks/useCategories', () => ({
  useCategories: () => ({ categories: mocks.categories, isLoading: false }),
  categoryById: (categories: Category[], id: string | null | undefined) => categories.find((category) => category.id === id),
}));

vi.mock('@/hooks/useSchedule', () => ({
  useScheduleMutations: () => ({
    create: mocks.scheduleCreate,
    update: mocks.scheduleUpdate,
    remove: mocks.scheduleRemove,
  }),
}));

vi.mock('@/components/intentions/IntentionFormModal', () => ({
  IntentionFormModal: ({ open, intention, onSave, onClose }: {
    open: boolean;
    intention?: Intention | null;
    onSave: (values: Record<string, unknown>) => Promise<void>;
    onClose: () => void;
  }) => {
    if (!open) return null;
    return (
      <div data-testid="intention-form" data-intention={intention?.id ?? 'new'}>
        <button
          onClick={() => {
            void onSave({
              title: 'Saved intention',
              categoryId: null,
              isRecurring: false,
              defaultDurationMins: null,
              targetSessionsPerWeek: null,
              preferredWeekdays: [],
              preferredTime: null,
              notes: '',
              priority: '',
            }).then(onClose);
          }}
        >
          mock-save-intention
        </button>
      </div>
    );
  },
}));

vi.mock('@/components/intentions/ManageCategoriesModal', () => ({
  ManageCategoriesModal: ({ open }: { open: boolean }) => <div data-testid="manage-categories" data-open={String(open)} />,
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.categories = [makeCategory(), makeCategory({ id: 'cat-2', name: 'Health', colorHex: '#059669' })];
  mocks.activeIntentions = [
    makeIntention(),
    makeIntention({
      id: 'task-2',
      title: 'Morning walk',
      categoryId: 'cat-2',
      isRecurring: true,
      defaultDurationMins: 30,
      targetSessionsPerWeek: 3,
      preferredWeekdays: [1, 3, 5],
      createdAt: '2026-11-02T08:00:00Z',
    }),
  ];
  mocks.archivedIntentions = [makeIntention({ id: 'task-3', title: 'Old project', status: 'archived' })];
  for (const mutation of [mocks.create, mocks.update, mocks.scheduleCreate, mocks.scheduleUpdate]) {
    mutation.mutateAsync.mockResolvedValue(undefined);
  }
});

describe('IntentionsPage', () => {
  it('renders grouped active intentions with filter tabs and summary counts', () => {
    render(<IntentionsPage />);

    expect(screen.getByRole('heading', { name: 'The Menu' })).toBeInTheDocument();
    expect(screen.getByText('Write report')).toBeInTheDocument();
    expect(screen.getByText('Morning walk')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /All Tasks/ })).toHaveTextContent('(2)');
    expect(screen.getByRole('button', { name: /Recurring Habitual/ })).toHaveTextContent('(1)');
    expect(screen.getByRole('button', { name: /Archived/ })).toHaveTextContent('(1)');
    expect(screen.getByText('Est. workload')).toBeInTheDocument();
  });

  it('filters by cadence, search text, and category taxonomy', async () => {
    const user = userEvent.setup();
    render(<IntentionsPage />);

    await user.click(screen.getByRole('button', { name: /Recurring Habitual/ }));
    expect(screen.getByText('Morning walk')).toBeInTheDocument();
    expect(screen.queryByText('Write report')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /All Tasks/ }));
    await user.type(screen.getByPlaceholderText(/Filter intentions by title/), 'report');
    expect(screen.getByText('Write report')).toBeInTheDocument();
    expect(screen.queryByText('Morning walk')).not.toBeInTheDocument();

    await user.clear(screen.getByPlaceholderText(/Filter intentions by title/));
    await user.click(screen.getByRole('button', { name: /Health/ }));
    expect(screen.getByText('Morning walk')).toBeInTheDocument();
    expect(screen.queryByText('Write report')).not.toBeInTheDocument();
  });

  it('shows archived intentions and restores them', async () => {
    const user = userEvent.setup();
    render(<IntentionsPage />);

    await user.click(screen.getByRole('button', { name: /Archived/ }));
    expect(screen.getByText('Old project')).toBeInTheDocument();

    await user.click(screen.getAllByTitle('Restore')[0]);
    expect(mocks.restore.mutate).toHaveBeenCalledWith('task-3');
  });

  it('archives an active intention from its row action', async () => {
    const user = userEvent.setup();
    render(<IntentionsPage />);

    await user.click(screen.getAllByTitle('Archive')[0]);
    expect(mocks.archive.mutate).toHaveBeenCalledWith('task-1');
  });

  it('quick-add creates a normalized one-off intention', async () => {
    const user = userEvent.setup();
    render(<IntentionsPage />);

    await user.type(screen.getByPlaceholderText('e.g. Read a book'), 'Call accountant');
    await user.click(screen.getByRole('button', { name: /Save Intention/ }));

    await waitFor(() => expect(mocks.create.mutateAsync).toHaveBeenCalledWith({
      title: 'Call accountant',
      categoryId: 'cat-1',
      isRecurring: false,
      defaultDurationMins: 45,
      targetSessionsPerWeek: null,
      preferredWeekdays: [],
      preferredTime: null,
      notes: null,
      priority: null,
    }));
  });

  it('add-to-today schedules the intention at the next snapped slot', async () => {
    render(<IntentionsPage />);

    fireEvent.click(screen.getAllByRole('button', { name: /Add to Today/ })[0]);

    await waitFor(() => expect(mocks.scheduleCreate.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'task-1',
      scheduledDate: todayISO(),
      plannedDurationMins: 60,
      startTime: expect.stringMatching(/^\d{2}:\d{2}$/),
    })));
    const input = mocks.scheduleCreate.mutateAsync.mock.calls[0][0] as { startTime: string; endTime: string };
    expect(input.endTime).toBe(minutesToTime(timeToMinutes(input.startTime) + 60));
  });

  it('opens the create form and normalizes empty optional fields on save', async () => {
    const user = userEvent.setup();
    render(<IntentionsPage />);

    await user.click(screen.getByRole('button', { name: /New Intention/ }));
    expect(screen.getByTestId('intention-form')).toHaveAttribute('data-intention', 'new');

    await user.click(screen.getByText('mock-save-intention'));
    await waitFor(() => expect(mocks.create.mutateAsync).toHaveBeenCalledWith({
      title: 'Saved intention',
      categoryId: null,
      isRecurring: false,
      defaultDurationMins: null,
      targetSessionsPerWeek: null,
      preferredWeekdays: [],
      preferredTime: null,
      notes: null,
      priority: null,
    }));
  });

  it('opens the edit form for an existing intention and updates by id', async () => {
    const user = userEvent.setup();
    render(<IntentionsPage />);

    await user.click(screen.getAllByTitle('Edit')[0]);
    expect(screen.getByTestId('intention-form')).toHaveAttribute('data-intention', 'task-1');

    await user.click(screen.getByText('mock-save-intention'));
    await waitFor(() => expect(mocks.update.mutateAsync).toHaveBeenCalledWith({
      id: 'task-1',
      title: 'Saved intention',
      categoryId: null,
      isRecurring: false,
      defaultDurationMins: null,
      targetSessionsPerWeek: null,
      preferredWeekdays: [],
      preferredTime: null,
      notes: null,
      priority: null,
    }));
  });

  it('requires confirmation before deleting an intention', async () => {
    const user = userEvent.setup();
    render(<IntentionsPage />);

    await user.click(screen.getAllByTitle('Delete')[0]);
    expect(screen.getByText('Delete intention?')).toBeInTheDocument();
    expect(mocks.remove.mutate).not.toHaveBeenCalled();

    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    await user.click(deleteButtons[deleteButtons.length - 1]);
    expect(mocks.remove.mutate).toHaveBeenCalledWith('task-1');
  });

  it('opens the manage categories modal', async () => {
    const user = userEvent.setup();
    render(<IntentionsPage />);

    await user.click(screen.getByRole('button', { name: /Manage Categories/ }));
    expect(screen.getByTestId('manage-categories')).toHaveAttribute('data-open', 'true');
  });
});
