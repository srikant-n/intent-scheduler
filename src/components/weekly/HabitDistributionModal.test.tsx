// Tests for HabitDistributionModal: proposal preview, unmet targets,
// apply flow, and empty states.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Intention, ScheduleBlock } from '@/types/database';
import type { WeeklyCapacity } from '@/utils/capacity';
import { HabitDistributionModal } from './HabitDistributionModal';

const WEEK_DATES = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'];
const CAPACITY: WeeklyCapacity = { 1: 480, 2: 480, 3: 480, 4: 480, 5: 480, 6: 480, 7: 480 };

function makeHabit(overrides: Partial<Intention> = {}): Intention {
  return {
    id: 'habit-1',
    title: 'Morning pages',
    categoryId: null,
    isRecurring: true,
    defaultDurationMins: 60,
    targetSessionsPerWeek: 2,
    preferredWeekdays: [],
    status: 'active',
    notes: null,
    priority: null,
    createdAt: 't',
    ...overrides,
  };
}

function renderModal(opts: { intentions?: Intention[]; existingBlocks?: ScheduleBlock[]; capacity?: WeeklyCapacity } = {}) {
  const onApply = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(
    <HabitDistributionModal
      open
      onClose={onClose}
      weekDates={WEEK_DATES}
      intentions={opts.intentions ?? [makeHabit()]}
      existingBlocks={opts.existingBlocks ?? []}
      capacity={opts.capacity ?? CAPACITY}
      dayStartHour={8}
      dayEndHour={20}
      snapInterval={15}
      onApply={onApply}
    />,
  );
  return { onApply, onClose };
}

describe('HabitDistributionModal', () => {
  it('shows the empty message when no recurring intention has a weekly target', () => {
    renderModal({ intentions: [makeHabit({ targetSessionsPerWeek: null })] });
    expect(screen.getByText(/No recurring intentions have a weekly target/)).toBeInTheDocument();
  });

  it('previews proposed blocks for a habit with a target', () => {
    renderModal();

    expect(screen.getByText(/2 proposed blocks/)).toBeInTheDocument();
    expect(screen.getAllByText('Morning pages')).toHaveLength(2);
    // Apply button reflects proposal count
    expect(screen.getByRole('button', { name: 'Create 2 blocks' })).toBeInTheDocument();
  });

  it('applies proposals via onApply and shows the applied state', async () => {
    const user = userEvent.setup();
    const { onApply, onClose } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Create 2 blocks' }));

    expect(onApply).toHaveBeenCalledTimes(1);
    const proposals = onApply.mock.calls[0][0];
    expect(proposals).toHaveLength(2);
    expect(proposals[0]).toMatchObject({ task: expect.objectContaining({ id: 'habit-1' }), plannedDurationMins: 60 });

    expect(await screen.findByText(/Distribution applied/)).toBeInTheDocument();
    // After applying, the create button is hidden and the footer offers Close
    // (the modal header X button is also named "Close" — take the footer one).
    expect(screen.queryByRole('button', { name: /Create \d+ blocks/ })).not.toBeInTheDocument();
    const closeButtons = screen.getAllByRole('button', { name: 'Close' });
    await user.click(closeButtons[closeButtons.length - 1]);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows unmet targets when capacity is too small', () => {
    // 30 minutes of capacity per day -> at most one 60m slot won't fit anywhere.
    const tiny: WeeklyCapacity = { 1: 30, 2: 30, 3: 30, 4: 30, 5: 30, 6: 30, 7: 30 };
    renderModal({ capacity: tiny });

    expect(screen.getByText('Unmet targets')).toBeInTheDocument();
    expect(screen.getByText(/placed 0 of 2 sessions/)).toBeInTheDocument();
  });

  it('reduces proposals by already-planned sessions', () => {
    const existing: ScheduleBlock[] = [
      {
        id: 'existing-1',
        taskId: 'habit-1',
        scheduledDate: '2026-11-16',
        startTime: '08:00',
        endTime: '09:00',
        plannedDurationMins: 60,
        notes: null,
        status: 'planned',
        rolledFromBlockId: null,
        createdAt: 't',
      },
    ];
    renderModal({ existingBlocks: existing });

    // target 2 - alreadyPlanned 1 = 1 proposal
    expect(screen.getByText(/1 proposed block/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create 1 block' })).toBeInTheDocument();
  });

  it('cancel closes without applying', async () => {
    const user = userEvent.setup();
    const { onApply, onClose } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });
});
