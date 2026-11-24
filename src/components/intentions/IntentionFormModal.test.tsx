// Tests for IntentionFormModal: create/edit intention form fields,
// recurrence/duration/weekday inputs, and validation.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Category, Intention } from '@/types/database';
import { IntentionFormModal } from './IntentionFormModal';

const categories: Category[] = [
  { id: 'cat-1', name: 'Deep Work', colorHex: '#4f46e5', createdAt: 't' },
  { id: 'cat-2', name: 'Health', colorHex: '#059669', createdAt: 't' },
];

function makeIntention(overrides: Partial<Intention> = {}): Intention {
  return {
    id: 'task-1',
    title: 'Study Rust',
    categoryId: 'cat-1',
    isRecurring: true,
    defaultDurationMins: 60,
    targetSessionsPerWeek: null,
    preferredWeekdays: [],
    status: 'active',
    notes: 'async',
    priority: 'high',
    createdAt: 't',
    ...overrides,
  };
}

function renderModal(props: Partial<Parameters<typeof IntentionFormModal>[0]> = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(
    <IntentionFormModal open onClose={onClose} categories={categories} onSave={onSave} {...props} />,
  );
  return { onSave, onClose };
}

describe('IntentionFormModal', () => {
  it('submits mapped values with defaults', async () => {
    const user = userEvent.setup();
    const { onSave, onClose } = renderModal();

    await user.type(screen.getByPlaceholderText(/Study Rust async patterns/i), 'New task');
    await user.selectOptions(screen.getByLabelText(/Default duration/i), '');
    await user.selectOptions(screen.getByLabelText(/Cadence/i), 'recurring');
    await user.click(screen.getByRole('button', { name: /Save Intention/i }));

    expect(onSave).toHaveBeenCalledWith({
      title: 'New task',
      categoryId: 'cat-1',
      isRecurring: true,
      defaultDurationMins: null,
      targetSessionsPerWeek: null,
      preferredWeekdays: [],
      notes: '',
      priority: '',
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('maps priority select and notes', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal();

    await user.type(screen.getByPlaceholderText(/Study Rust async patterns/i), 'Task');
    await user.selectOptions(screen.getByLabelText(/Priority/i), 'medium');
    await user.type(screen.getByPlaceholderText(/Optional context/i), 'some notes');
    await user.click(screen.getByRole('button', { name: /Save Intention/i }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ priority: 'medium', notes: 'some notes', isRecurring: false, defaultDurationMins: 45 }),
    );
  });

  it('shows habit fields only for recurring cadence', async () => {
    const user = userEvent.setup();
    renderModal();

    expect(screen.queryByLabelText(/Sessions per week/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Mon')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/Cadence/i), 'recurring');
    expect(screen.getByLabelText(/Sessions per week/i)).toBeInTheDocument();
    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getByText('Sun')).toBeInTheDocument();
  });

  it('submits sessions/week target and sorted preferred weekdays', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal();

    await user.type(screen.getByPlaceholderText(/Study Rust async patterns/i), 'Gym');
    await user.selectOptions(screen.getByLabelText(/Cadence/i), 'recurring');
    await user.selectOptions(screen.getByLabelText(/Sessions per week/i), '3');
    await user.click(screen.getByText('Fri'));
    await user.click(screen.getByText('Mon'));
    await user.click(screen.getByText('Wed'));
    await user.click(screen.getByRole('button', { name: /Save Intention/i }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ isRecurring: true, targetSessionsPerWeek: 3, preferredWeekdays: [1, 3, 5] }),
    );
  });

  it('clears habit fields when switched back to one-off', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal();

    await user.type(screen.getByPlaceholderText(/Study Rust async patterns/i), 'Task');
    await user.selectOptions(screen.getByLabelText(/Cadence/i), 'recurring');
    await user.selectOptions(screen.getByLabelText(/Sessions per week/i), '5');
    await user.click(screen.getByText('Tue'));
    await user.selectOptions(screen.getByLabelText(/Cadence/i), 'one-off');
    await user.click(screen.getByRole('button', { name: /Save Intention/i }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ isRecurring: false, targetSessionsPerWeek: null, preferredWeekdays: [] }),
    );
  });

  it('prefills habit fields in edit mode', async () => {
    const user = userEvent.setup();
    const intention = makeIntention({ targetSessionsPerWeek: 4, preferredWeekdays: [1, 3] });
    const { onSave } = renderModal({ intention });

    expect((screen.getByLabelText(/Sessions per week/i) as HTMLSelectElement).value).toBe('4');
    expect(screen.getByText('Mon')).toHaveClass('border-accent');
    expect(screen.getByText('Wed')).toHaveClass('border-accent');
    expect(screen.getByText('Tue')).not.toHaveClass('border-accent');

    await user.click(screen.getByRole('button', { name: /Save Intention/i }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ targetSessionsPerWeek: 4, preferredWeekdays: [1, 3] }),
    );
  });

  it('prefills fields in edit mode', async () => {
    const user = userEvent.setup();
    const intention = makeIntention();
    const { onSave } = renderModal({ intention });

    const titleInput = screen.getByDisplayValue('Study Rust');
    expect(titleInput).toBeInTheDocument();
    expect(screen.getByDisplayValue('async')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Save Intention/i }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Study Rust', isRecurring: true, defaultDurationMins: 60, priority: 'high', categoryId: 'cat-1' }),
    );
  });
});
