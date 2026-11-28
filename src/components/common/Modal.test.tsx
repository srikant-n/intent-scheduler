// Tests for common/Modal: open/close behavior, Escape key, backdrop click.
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

function renderModal(onClose = vi.fn(), open = true) {
  render(
    <Modal open={open} onClose={onClose} title="Test Modal" subtitle="Sub text">
      <p>Modal body</p>
    </Modal>,
  );
  return onClose;
}

describe('Modal', () => {
  it('renders title, subtitle, and children when open', () => {
    renderModal();
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Sub text')).toBeInTheDocument();
    expect(screen.getByText('Modal body')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    renderModal(vi.fn(), false);
    expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
  });

  it('closes when the close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = renderModal();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape keydown', () => {
    const onClose = renderModal();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on backdrop mousedown but not on content mousedown', () => {
    const onClose = renderModal();

    // mousedown on the dialog content should not close (stopPropagation)
    fireEvent.mouseDown(screen.getByText('Modal body'));
    expect(onClose).not.toHaveBeenCalled();

    // mousedown on the backdrop (outer fixed container) closes
    const backdrop = screen.getByText('Test Modal').closest('.fixed');
    expect(backdrop).not.toBeNull();
    fireEvent.mouseDown(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders footer content when provided', () => {
    render(
      <Modal open onClose={vi.fn()} title="T" footer={<button>Footer action</button>}>
        body
      </Modal>,
    );
    expect(screen.getByRole('button', { name: 'Footer action' })).toBeInTheDocument();
  });
});
