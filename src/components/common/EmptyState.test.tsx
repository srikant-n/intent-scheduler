// Tests for common/EmptyState: title, description, icon, and action slot.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState title="Nothing here" description="Add something to get started." />);

    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByText('Add something to get started.')).toBeInTheDocument();
  });

  it('renders without description', () => {
    render(<EmptyState title="Empty" />);
    expect(screen.getByText('Empty')).toBeInTheDocument();
    expect(screen.queryByRole('paragraph')).not.toBeInTheDocument();
  });

  it('renders the action node and wires its handler', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <EmptyState
        title="No tasks"
        action={<button onClick={onAction}>Create task</button>}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Create task' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('renders an icon when provided', () => {
    const { container } = render(<EmptyState title="Icon test" icon={<svg data-testid="icon" />} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
