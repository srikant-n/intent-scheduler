// Tests for WeeklyBlockCard: draft/reality display modes, status icon,
// variance display, and click/drag wiring.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Category, EnrichedScheduleBlock, Intention } from '@/types/database';
import { WeeklyBlockCard } from './WeeklyBlockCard';

const category: Category = { id: 'cat-1', name: 'Deep Work', colorHex: '#4f46e5', createdAt: 't' };

const task: Intention = {
  id: 'task-1',
  title: 'Write report',
  categoryId: 'cat-1',
  isRecurring: false,
  defaultDurationMins: 60,
  targetSessionsPerWeek: null,
  preferredWeekdays: [],
  status: 'active',
  notes: null,
  priority: null,
  createdAt: 't',
};

function makeBlock(overrides: Partial<EnrichedScheduleBlock> = {}): EnrichedScheduleBlock {
  return {
    id: 'block-1',
    taskId: 'task-1',
    scheduledDate: '2026-11-23',
    startTime: '09:00',
    endTime: '10:00',
    plannedDurationMins: 60,
    notes: null,
    status: 'planned',
    rolledFromBlockId: null,
    createdAt: 't',
    task,
    ...overrides,
  };
}

function renderCard(props: Partial<Parameters<typeof WeeklyBlockCard>[0]> = {}) {
  const onClick = vi.fn();
  render(
    <WeeklyBlockCard
      block={makeBlock()}
      category={category}
      actualMins={0}
      mode="draft"
      onClick={onClick}
      {...props}
    />,
  );
  return onClick;
}

describe('WeeklyBlockCard', () => {
  it('renders task title, category badge, and planned time in draft mode', () => {
    renderCard();

    expect(screen.getByText('Write report')).toBeInTheDocument();
    expect(screen.getByText('Deep Work')).toBeInTheDocument();
    expect(screen.getByText(/9:00 AM – 10:00 AM/)).toBeInTheDocument();
    expect(screen.getByText('1h')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = renderCard();
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows actuals and signed variance in reality mode', () => {
    renderCard({ mode: 'reality', actualMins: 90 });

    expect(screen.getByText('Actual 1h 30m')).toBeInTheDocument();
    // variance = 90 - 60 = +30m
    expect(screen.getByText('+30m')).toBeInTheDocument();
  });

  it('shows negative variance styling value in reality mode', () => {
    renderCard({ mode: 'reality', actualMins: 30 });
    expect(screen.getByText(/Actual 30m/)).toBeInTheDocument();
  });

  it('shows "No actuals logged" in reality mode without actuals', () => {
    renderCard({ mode: 'reality', actualMins: 0 });
    expect(screen.getByText('No actuals logged')).toBeInTheDocument();
  });

  it('falls back to "Planned block" when the block has no task', () => {
    renderCard({ block: makeBlock({ task: undefined }) });
    expect(screen.getByText('Planned block')).toBeInTheDocument();
  });

  it('marks completed blocks with a struck-through title', () => {
    renderCard({ block: makeBlock({ status: 'completed' }) });
    const title = screen.getByText('Write report');
    expect(title).toHaveClass('line-through');
  });

  it('shows the rolled marker for blocks rolled from an earlier date', () => {
    const { container } = render(
      <WeeklyBlockCard block={makeBlock({ rolledFromBlockId: 'orig-1' })} actualMins={0} mode="draft" onClick={vi.fn()} />,
    );
    expect(container.textContent).toContain('↺');
  });

  it('is draggable and forwards drag start when onDragStart is provided', () => {
    const onDragStart = vi.fn();
    renderCard({ onDragStart });

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('draggable', 'true');

    const event = new MouseEvent('dragstart', { bubbles: true });
    Object.assign(event, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
    fireEvent(button, event);
    expect(onDragStart).toHaveBeenCalled();
  });
});
