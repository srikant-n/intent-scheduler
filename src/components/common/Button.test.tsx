// Tests for common/Button: click handling, variants, sizes, disabled state.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders children and fires onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire onClick when disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Save</Button>);

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('applies variant and size classes', () => {
    const { rerender } = render(<Button variant="primary" size="sm">Go</Button>);
    expect(screen.getByRole('button', { name: 'Go' })).toHaveClass('bg-accent', 'px-2.5');

    rerender(<Button variant="danger" size="lg">Delete</Button>);
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('bg-danger-soft', 'px-4');
  });

  it('defaults to secondary/md variant', () => {
    render(<Button>Plain</Button>);
    expect(screen.getByRole('button', { name: 'Plain' })).toHaveClass('bg-surface-high', 'px-3.5');
  });

  it('forwards extra button attributes', () => {
    render(<Button type="submit" aria-label="Submit form">Go</Button>);
    const button = screen.getByRole('button', { name: 'Submit form' });
    expect(button).toHaveAttribute('type', 'submit');
  });
});
