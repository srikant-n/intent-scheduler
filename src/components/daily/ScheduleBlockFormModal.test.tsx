import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Category, Intention } from '@/types/database';
import { ScheduleBlockFormModal } from './ScheduleBlockFormModal';

const categories: Category[] = [{ id: 'cat-1', name: 'Deep Work', colorHex: '#4f46e5', createdAt: 't' }];
const tasks: Intention[] = [
  {
    id: 'task-1',
    title: 'Study Rust',
    categoryId: 'cat-1',
    isRecurring: false,
    defaultDurationMins: 45,
    targetSessionsPerWeek: null,
    preferredWeekdays: [],
    preferredTime: null,
    status: 'active',
    notes: null,
    priority: null,
    createdAt: 't',
  },
];

function renderModal(props: Partial<Parameters<typeof ScheduleBlockFormModal>[0]> = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(
    <ScheduleBlockFormModal
      open
      onClose={onClose}
      date="2026-11-22"
      tasks={tasks}
      categories={categories}
      onSave={onSave}
      {...props}
    />,
  );
  return { onSave, onClose };
}

describe('ScheduleBlockFormModal', () => {
  it('keeps end time in sync when duration changes', async () => {
    const user = userEvent.setup();
    renderModal({ defaultStartTime: '09:00' });

    const endInput = screen.getByLabelText('End') as HTMLInputElement;
    const durationInput = screen.getByLabelText('Duration') as HTMLInputElement;
    // falls back to the selected task's default duration (45)
    expect(endInput.value).toBe('09:45');
    expect(durationInput.value).toBe('45');

    await user.clear(durationInput);
    await user.type(durationInput, '30');
    expect(endInput.value).toBe('09:30');
  });

  it('keeps duration in sync when end time changes', async () => {
    const user = userEvent.setup();
    renderModal({ defaultStartTime: '09:00' });

    const endInput = screen.getByLabelText('End') as HTMLInputElement;
    const durationInput = screen.getByLabelText('Duration') as HTMLInputElement;

    await user.clear(endInput);
    await user.type(endInput, '11:30');
    expect(durationInput.value).toBe('150');
  });

  it('submits mapped block values', async () => {
    const user = userEvent.setup();
    const { onSave, onClose } = renderModal({ defaultStartTime: '14:00' });

    await user.clear(screen.getByLabelText('Duration'));
    await user.type(screen.getByLabelText('Duration'), '45');
    await user.click(screen.getByRole('button', { name: /Save Block/i }));

    expect(onSave).toHaveBeenCalledWith({
      taskId: 'task-1',
      scheduledDate: '2026-11-22',
      startTime: '14:00',
      endTime: '14:45',
      plannedDurationMins: 45,
      notes: '',
      status: 'planned',
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('prefills notes, status, and times when editing a block', () => {
    renderModal({
      block: {
        id: 'b1',
        taskId: 'task-1',
        scheduledDate: '2026-11-22',
        startTime: '09:00',
        endTime: '10:00',
        plannedDurationMins: 60,
        notes: 'plan notes',
        status: 'completed',
        rolledFromBlockId: null,
        createdAt: 't',
      },
    });
    expect(screen.getByDisplayValue('plan notes')).toBeInTheDocument();
    expect((screen.getByLabelText('Status') as HTMLSelectElement).value).toBe('completed');
    expect((screen.getByLabelText('Start') as HTMLInputElement).value).toBe('09:00');
    expect((screen.getByLabelText('Duration') as HTMLInputElement).value).toBe('60');
  });

  it('reflects status selection in the saved payload', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal({ defaultStartTime: '14:00' });

    await user.selectOptions(screen.getByLabelText('Status'), 'missed');
    await user.click(screen.getByRole('button', { name: /Save Block/i }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ status: 'missed' }));
  });

  it('honors defaultTaskId when no block is given', () => {
    const extra: Intention = { ...tasks[0], id: 'task-2', title: 'Write docs' };
    renderModal({ tasks: [...tasks, extra], defaultTaskId: 'task-2' });
    expect((screen.getByLabelText('Intention') as HTMLSelectElement).value).toBe('task-2');
  });

  it('invokes delete, start-timer, and log-actual handlers', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const onStartTimer = vi.fn().mockResolvedValue(undefined);
    const onLogActual = vi.fn().mockResolvedValue(undefined);
    renderModal({
      block: {
        id: 'b1',
        taskId: 'task-1',
        scheduledDate: '2026-11-22',
        startTime: '09:00',
        endTime: '10:00',
        plannedDurationMins: 60,
        notes: null,
        status: 'planned',
        rolledFromBlockId: null,
        createdAt: 't',
      },
      onDelete,
      onStartTimer,
      onLogActual,
    });

    await user.click(screen.getByRole('button', { name: /^Delete$/i }));
    await user.click(screen.getByRole('button', { name: /Start Timer/i }));
    await user.click(screen.getByRole('button', { name: /Log Actual/i }));

    expect(onDelete).toHaveBeenCalled();
    expect(onStartTimer).toHaveBeenCalled();
    expect(onLogActual).toHaveBeenCalledWith(60);
  });

  it('shows action buttons only when editing an existing block', () => {
    const { unmount } = render(
      <ScheduleBlockFormModal
        open
        onClose={vi.fn()}
        date="2026-11-22"
        tasks={tasks}
        categories={categories}
        onSave={vi.fn()}
        block={{
          id: 'b1',
          taskId: 'task-1',
          scheduledDate: '2026-11-22',
          startTime: '09:00',
          endTime: '10:00',
          plannedDurationMins: 60,
          notes: null,
          status: 'planned',
          rolledFromBlockId: null,
          createdAt: 't',
        }}
        onDelete={vi.fn()}
        onStartTimer={vi.fn()}
        onLogActual={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start Timer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Log Actual/i })).toBeInTheDocument();
    unmount();

    renderModal();
    expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Start Timer/i })).not.toBeInTheDocument();
  });
});
