// Tests for ManageCategoriesModal: list, create, edit, and two-click delete,
// with useCategories mocked out.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category } from '@/types/database';
import { ManageCategoriesModal } from './ManageCategoriesModal';

const categories: Category[] = [
  { id: 'cat-1', name: 'Deep Work', colorHex: '#4f46e5', createdAt: 't' },
  { id: 'cat-2', name: 'Health', colorHex: '#059669', createdAt: 't' },
];

// Hoisted mock state so tests can swap the category list per case.
const state = vi.hoisted(() => ({
  categories: [] as Category[],
  create: { mutateAsync: vi.fn() },
  update: { mutateAsync: vi.fn() },
  remove: { mutateAsync: vi.fn() },
}));

vi.mock('@/hooks/useCategories', () => ({
  useCategories: () => state,
}));

function renderModal(open = true) {
  const onClose = vi.fn();
  render(<ManageCategoriesModal open={open} onClose={onClose} />);
  return onClose;
}

describe('ManageCategoriesModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.categories = categories;
    state.create.mutateAsync.mockResolvedValue(undefined);
    state.update.mutateAsync.mockResolvedValue(undefined);
    state.remove.mutateAsync.mockResolvedValue(undefined);
  });

  it('renders the title and all categories', () => {
    renderModal();
    expect(screen.getByText('Manage Categories')).toBeInTheDocument();
    expect(screen.getByText('Deep Work')).toBeInTheDocument();
    expect(screen.getByText('Health')).toBeInTheDocument();
    expect(screen.getByText('#4f46e5')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    renderModal(false);
    expect(screen.queryByText('Manage Categories')).not.toBeInTheDocument();
  });

  it('shows the empty-state message when there are no categories', () => {
    state.categories = [];
    renderModal();
    expect(screen.getByText(/No categories yet/)).toBeInTheDocument();
  });

  it('creates a category with the default palette color', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText('e.g. Finance'), 'Finance');
    await user.click(screen.getByRole('button', { name: /^Add$/ }));

    expect(state.create.mutateAsync).toHaveBeenCalledWith({ name: 'Finance', colorHex: '#ea580c' });
  });

  it('does not submit an empty category name', async () => {
    const user = userEvent.setup();
    renderModal();

    const addButton = screen.getByRole('button', { name: /^Add$/ });
    expect(addButton).toBeDisabled();
    await user.type(screen.getByPlaceholderText('e.g. Finance'), '   ');
    expect(addButton).toBeDisabled();
    expect(state.create.mutateAsync).not.toHaveBeenCalled();
  });

  it('edits a category name and saves via update', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getAllByTitle('Edit category')[0]);
    const nameInput = screen.getByDisplayValue('Deep Work');
    await user.clear(nameInput);
    await user.type(nameInput, 'Deep Focus');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(state.update.mutateAsync).toHaveBeenCalledWith({ id: 'cat-1', name: 'Deep Focus', colorHex: '#4f46e5' });
  });

  it('cancel exits edit mode without saving', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getAllByTitle('Edit category')[0]);
    await user.click(screen.getByRole('button', { name: /Cancel/ }));

    expect(state.update.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText('Deep Work')).toBeInTheDocument();
  });

  it('requires two clicks to delete a category', async () => {
    const user = userEvent.setup();
    renderModal();

    const deleteButtons = screen.getAllByTitle('Delete category');
    await user.click(deleteButtons[0]);

    // First click only arms the confirmation — remove not called yet.
    expect(state.remove.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText(/Click the trash icon again to confirm/)).toBeInTheDocument();

    // Second click (title changed to confirm prompt) deletes.
    await user.click(screen.getByTitle('Click again to confirm delete'));
    expect(state.remove.mutateAsync).toHaveBeenCalledWith('cat-1');
  });
});
