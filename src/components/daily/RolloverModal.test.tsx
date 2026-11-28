// Tests for RolloverModal: end-of-day review actions per pending block.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { EnrichedScheduleBlock, Intention } from '@/types/database';
import { RolloverModal } from './RolloverModal';

const task: Intention = {
  id: 'task-1',
  title: 'Deep Work Session',
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
  scheduledDate: '2026-11-22',
  startTime: '09:00',
  endTime: '10:00',
  plannedDurationMins: 60,
  notes: null,
  status: 'planned',
  rolledFromBlockId: null,
  createdAt: 't',
  task,
};

function renderModal(blocks: EnrichedScheduleBlock[] = [block]) {
  const handlers = {
    onClose: vi.fn(),
    onMoveNextDay: vi.fn().mockResolvedValue(undefined),
    onReturnToIntentions: vi.fn().mockResolvedValue(undefined),
    onDismiss: vi.fn().mockResolvedValue(undefined),
  };
  render(
    <RolloverModal
      open
      date="2026-11-22"
      blocks={blocks}
      onClose={handlers.onClose}
      onMoveNextDay={handlers.onMoveNextDay}
      onReturnToIntentions={handlers.onReturnToIntentions}
      onDismiss={handlers.onDismiss}
    />,
  );
  return handlers;
}

describe('RolloverModal', () => {
  it('renders the title and each block with its time range', () => {
    renderModal();

    expect(screen.getByText('End-of-Day Rollover')).toBeInTheDocument();
    expect(screen.getByText('Deep Work Session')).toBeInTheDocument();
    expect(screen.getByText(/9:00 AM – 10:00 AM • 1h/)).toBeInTheDocument();
  });

  it('shows the empty message when there are no blocks', () => {
    renderModal([]);
    expect(screen.getByText('No pending planned blocks need review.')).toBeInTheDocument();
  });

  it('move button targets the next day and calls onMoveNextDay', async () => {
    const user = userEvent.setup();
    const handlers = renderModal();

    await user.click(screen.getByRole('button', { name: /Move to 2026-11-23/ }));
    expect(handlers.onMoveNextDay).toHaveBeenCalledWith(block);
  });

  it('return button calls onReturnToIntentions', async () => {
    const user = userEvent.setup();
    const handlers = renderModal();

    await user.click(screen.getByRole('button', { name: /Return/ }));
    expect(handlers.onReturnToIntentions).toHaveBeenCalledWith(block);
  });

  it('dismiss button calls onDismiss', async () => {
    const user = userEvent.setup();
    const handlers = renderModal();

    await user.click(screen.getByRole('button', { name: /Dismiss/ }));
    expect(handlers.onDismiss).toHaveBeenCalledWith(block);
  });

  it('Done button closes the modal', async () => {
    const user = userEvent.setup();
    const handlers = renderModal();

    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(handlers.onClose).toHaveBeenCalledTimes(1);
  });

  it('falls back to a generic label when block has no task', () => {
    const orphan: EnrichedScheduleBlock = { ...block, id: 'block-2', task: undefined };
    renderModal([orphan]);
    expect(screen.getByText('Planned block')).toBeInTheDocument();
  });
});
