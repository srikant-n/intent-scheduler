// Tests for WeeklyRolloverModal: multi-select, batch actions, reschedule
// parameters, and result reporting.
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { EnrichedScheduleBlock, Intention } from '@/types/database';
import { WeeklyRolloverModal } from './WeeklyRolloverModal';

const task: Intention = {
  id: 'task-1',
  title: 'Deep Work',
  categoryId: null,
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

function makeBlock(id: string, title: string): EnrichedScheduleBlock {
  return {
    id,
    taskId: 'task-1',
    scheduledDate: '2026-11-16',
    startTime: '09:00',
    endTime: '10:00',
    plannedDurationMins: 60,
    notes: null,
    status: 'planned',
    rolledFromBlockId: null,
    createdAt: 't',
    task: { ...task, title },
  };
}

const BLOCKS = [makeBlock('b1', 'Block One'), makeBlock('b2', 'Block Two')];

function renderModal(blocks: EnrichedScheduleBlock[] = BLOCKS) {
  const onApply = vi.fn().mockResolvedValue({ succeeded: 2, failed: 0 });
  const onClose = vi.fn();
  render(<WeeklyRolloverModal open onClose={onClose} blocks={blocks} onApply={onApply} />);
  return { onApply, onClose };
}

describe('WeeklyRolloverModal', () => {
  it('shows the empty message when there are no pending blocks', () => {
    renderModal([]);
    expect(screen.getByText('No pending planned blocks need review this week.')).toBeInTheDocument();
  });

  it('lists each block with date, time, and duration', () => {
    renderModal();
    expect(screen.getByText('Block One')).toBeInTheDocument();
    expect(screen.getByText('Block Two')).toBeInTheDocument();
    expect(screen.getAllByText(/2026-11-16 • 9:00 AM–10:00 AM • 1h/)).toHaveLength(2);
  });

  it('select-all toggles every block and updates the chosen count', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('checkbox', { name: /Select all/ }));
    expect(screen.getByText('Batch actions (2 selected)')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /Select all/ }));
    expect(screen.getByText('Batch actions (0 selected)')).toBeInTheDocument();
  });

  it('runs a batch action with only the selected blocks', async () => {
    const user = userEvent.setup();
    const { onApply } = renderModal();

    // Select only the first block via its row checkbox (second checkbox overall:
    // first is "Select all").
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]);

    await user.click(screen.getByRole('button', { name: /\+1 day/ }));
    expect(onApply).toHaveBeenCalledWith('next-day', [BLOCKS[0]], expect.anything());
  });

  it('passes reschedule date/time to onApply', async () => {
    const user = userEvent.setup();
    const { onApply } = renderModal();

    await user.click(screen.getByRole('checkbox', { name: /Select all/ }));

    const dateInput = screen.getByLabelText(/Reschedule date/);
    const timeInput = screen.getByLabelText(/Start time/);
    fireEvent.change(dateInput, { target: { value: '2026-11-25' } });
    fireEvent.change(timeInput, { target: { value: '14:30' } });

    await user.click(screen.getByRole('button', { name: /Move selected here/ }));
    expect(onApply).toHaveBeenCalledWith('reschedule', BLOCKS, { date: '2026-11-25', startTime: '14:30' });
  });

  it.each([
    ['Next Monday', 'next-monday'],
    ['Dismiss', 'dismiss'],
    ['Return to intentions', 'return'],
  ])('"%s" button applies the %s action', async (label, action) => {
    const user = userEvent.setup();
    const { onApply } = renderModal();

    await user.click(screen.getByRole('checkbox', { name: /Select all/ }));
    await user.click(screen.getByRole('button', { name: new RegExp(label) }));
    expect(onApply).toHaveBeenCalledWith(action, BLOCKS, expect.anything());
  });

  it('disables batch buttons when nothing is selected', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /\+1 day/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Next Monday/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Dismiss$/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Return to intentions/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Move selected here/ })).toBeDisabled();
  });

  it('shows the applied result summary', async () => {
    const user = userEvent.setup();
    const { onApply } = renderModal();
    onApply.mockResolvedValue({ succeeded: 1, failed: 1 });

    await user.click(screen.getByRole('checkbox', { name: /Select all/ }));
    await user.click(screen.getByRole('button', { name: /Dismiss/ }));

    expect(await screen.findByText(/Applied: 1 succeeded, 1 failed/)).toBeInTheDocument();
  });

  it('Done closes the modal and clears the result', async () => {
    const user = userEvent.setup();
    const { onApply, onClose } = renderModal();
    onApply.mockResolvedValue({ succeeded: 2, failed: 0 });

    await user.click(screen.getByRole('checkbox', { name: /Select all/ }));
    await user.click(screen.getByRole('button', { name: /Dismiss/ }));
    await screen.findByText(/Applied: 2 succeeded/);

    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalled();
  });
});
