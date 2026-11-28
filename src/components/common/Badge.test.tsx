// Tests for common/Badge (CategoryBadge): category pill rendering.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Category } from '@/types/database';
import { CategoryBadge } from './Badge';

const category: Category = { id: 'cat-1', name: 'Deep Work', colorHex: '#4f46e5', createdAt: 't' };

describe('CategoryBadge', () => {
  it('renders the category name', () => {
    render(<CategoryBadge category={category} />);
    expect(screen.getByText('Deep Work')).toBeInTheDocument();
  });

  it('applies the category color to the pill', () => {
    const { container } = render(<CategoryBadge category={category} />);
    const pill = container.querySelector('span');
    expect(pill).toHaveStyle({ color: '#4f46e5' });
  });

  it('renders nothing when category is null or undefined', () => {
    const { container, rerender } = render(<CategoryBadge category={null} />);
    expect(container).toBeEmptyDOMElement();

    rerender(<CategoryBadge category={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('merges a custom className', () => {
    const { container } = render(<CategoryBadge category={category} className="ml-2" />);
    expect(container.querySelector('span')).toHaveClass('ml-2');
  });
});
