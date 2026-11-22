import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Category, Intention, TimeLog } from '@/types/database';
import { TimeLogFormModal } from './TimeLogFormModal';

const categories: Category[] = [{ id: 'cat-1', name: 'Deep Work', colorHex: '#4f46e5', createdAt: 't' }];
const tasks: Intention[] = [
  {
    id: 'task-1',
    title: 'Study Rust',
    categoryId: 'cat-1',
    isRecurring: false,
    defaultDurationMins: 45,
    status: 'active',
    notes: null,
    priority: null,
    createdAt: 't',
  },
];

function makeLog(overrides: Partial<TimeLog> = {}): TimeLog {
  return {
    id: 'log-1',
    taskId: 'task-1',
    scheduleBlockId: null,
    customTitle: 'Morning study',
    categoryId: 'cat-1',
    logDate: '2026-11-21',
    startTime: '08:00',
    endTime: '09:00',
    durationMins: 60,
    notes: 'good',
    mood: 'energizing',
    isAdHoc: false,
    createdAt: 't',
    ...overrides,
  };
}

function renderModal(props: Partial<Parameters<typeof TimeLogFormModal>[0]> = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(
    <TimeLogFormModal
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

describe('TimeLogFormModal', () => {
  it('submits ad-hoc log with taskId null by default', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal();

    await user.type(screen.getByPlaceholderText(/What did you actually do/i), 'Coffee');
    await user.click(screen.getByRole('button', { name: /Save Log/i }));

    expect(onSave).toHaveBeenCalledWith({
      taskId: null,
      customTitle: 'Coffee',
      categoryId: null,
      logDate: '2026-11-22',
      startTime: '',
      endTime: '',
      durationMins: 30,
      notes: '',
      mood: '',
    });
  });

  it('links a selected intention', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal();

    await user.selectOptions(screen.getByLabelText(/Link intention/i), 'task-1');
    await user.click(screen.getByRole('button', { name: /Save Log/i }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ taskId: 'task-1' }));
  });

  it('prefills all fields in edit mode', async () => {
    const user = userEvent.setup();
    const log = makeLog();
    const { onSave } = renderModal({ log });

    expect(screen.getByDisplayValue('Morning study')).toBeInTheDocument();
    expect(screen.getByDisplayValue('good')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Save Log/i }));
    expect(onSave).toHaveBeenCalledWith({
      taskId: 'task-1',
      customTitle: 'Morning study',
      categoryId: 'cat-1',
      logDate: '2026-11-21',
      startTime: '08:00',
      endTime: '09:00',
      durationMins: 60,
      notes: 'good',
      mood: 'energizing',
    });
  });
});
