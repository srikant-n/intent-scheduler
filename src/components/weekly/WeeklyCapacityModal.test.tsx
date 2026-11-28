// Tests for WeeklyCapacityModal: per-weekday minute inputs, clamping, save flow.
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WeeklyCapacityModal } from './WeeklyCapacityModal';
import type { WeeklyCapacity } from '@/utils/capacity';

const capacity: WeeklyCapacity = { 1: 480, 2: 480, 3: 420, 4: 420, 5: 360, 6: 240, 7: 240 };

function renderModal(cap: WeeklyCapacity = capacity) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(<WeeklyCapacityModal open onClose={onClose} capacity={cap} onSave={onSave} />);
  return { onSave, onClose };
}

describe('WeeklyCapacityModal', () => {
  it('renders a numeric input for each weekday Mon–Sun', () => {
    renderModal();

    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(7);
    for (const label of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(inputs[0]).toHaveValue(480);
    expect(inputs[4]).toHaveValue(360);
  });

  it('saves cleaned values: rounded, non-negative integers', async () => {
    const user = userEvent.setup();
    const { onSave, onClose } = renderModal();

    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '500.6' } });
    fireEvent.change(inputs[1], { target: { value: '-30' } });

    await user.click(screen.getByRole('button', { name: 'Save Capacity' }));

    expect(onSave).toHaveBeenCalledWith({ 1: 501, 2: 0, 3: 420, 4: 420, 5: 360, 6: 240, 7: 240 });
    expect(onClose).toHaveBeenCalled();
  });

  it('treats empty/non-numeric input as 0', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal();

    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[6], { target: { value: '' } });

    await user.click(screen.getByRole('button', { name: 'Save Capacity' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ 7: 0 }));
  });

  it('cancel closes without saving', async () => {
    const user = userEvent.setup();
    const { onSave, onClose } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('resets values from props each time the modal opens', () => {
    const { rerender } = render(
      <WeeklyCapacityModal open={false} onClose={vi.fn()} capacity={capacity} onSave={vi.fn()} />,
    );
    rerender(
      <WeeklyCapacityModal open onClose={vi.fn()} capacity={{ ...capacity, 1: 999 }} onSave={vi.fn()} />,
    );
    expect(screen.getAllByRole('spinbutton')[0]).toHaveValue(999);
  });
});
