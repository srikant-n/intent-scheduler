// Tests for QuickLogModal: ad-hoc time logging form validation and submission.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Category } from '@/types/database';
import { QuickLogModal } from './QuickLogModal';

const categories: Category[] = [
  { id: 'cat-1', name: 'Deep Work', colorHex: '#4f46e5', createdAt: 't' },
  { id: 'cat-2', name: 'Health', colorHex: '#059669', createdAt: 't' },
];

function renderModal() {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(<QuickLogModal open onClose={onClose} date="2026-11-22" categories={categories} onSave={onSave} />);
  return { onSave, onClose };
}

describe('QuickLogModal', () => {
  it('defaults to first category and 30-minute duration', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal();

    await user.type(screen.getByPlaceholderText(/Coffee with a friend/i), 'Lunch break');
    await user.click(screen.getByRole('button', { name: /Save to Reality/i }));

    expect(onSave).toHaveBeenCalledWith({
      customTitle: 'Lunch break',
      categoryId: 'cat-1',
      durationMins: 30,
      notes: '',
      mood: null,
    });
  });

  it('submits selected mood, category, and duration', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal();

    await user.type(screen.getByPlaceholderText(/Coffee with a friend/i), 'Walk');
    await user.selectOptions(screen.getByLabelText(/Category/i), 'cat-2');
    await user.selectOptions(screen.getByLabelText(/Duration/i), '45');
    await user.selectOptions(screen.getByLabelText(/Reflection/i), 'energizing');
    await user.type(screen.getByPlaceholderText(/Optional context/i), 'felt good');
    await user.click(screen.getByRole('button', { name: /Save to Reality/i }));

    expect(onSave).toHaveBeenCalledWith({
      customTitle: 'Walk',
      categoryId: 'cat-2',
      durationMins: 45,
      notes: 'felt good',
      mood: 'energizing',
    });
  });

  it('renders nothing when closed', () => {
    const onSave = vi.fn();
    const { container } = render(
      <QuickLogModal open={false} onClose={vi.fn()} date="2026-11-22" categories={categories} onSave={onSave} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
