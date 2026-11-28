// Tests for TopBar: viewed-date context label and live clock rendering.
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TopBar } from './TopBar';
import { todayISO } from '@/utils/time';

describe('TopBar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 24, 14, 30, 15)); // Tue Nov 24 2026 14:30:15 local
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows "Viewing today" when the date matches today', () => {
    render(<TopBar date={todayISO()} />);
    expect(screen.getByText('Viewing today')).toBeInTheDocument();
  });

  it('shows "Viewing <date>" for other dates', () => {
    render(<TopBar date="2026-11-16" />);
    expect(screen.getByText('Viewing 2026-11-16')).toBeInTheDocument();
  });

  it('renders the current date and time labels', () => {
    render(<TopBar date={todayISO()} />);

    // Locale-formatted; assert the header contains a time with seconds.
    expect(screen.getByText(/\d{1,2}:\d{2}:\d{2}/)).toBeInTheDocument();
  });

  it('ticks the clock forward when the interval fires', () => {
    render(<TopBar date={todayISO()} />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    // Still rendering after ticks — smoke check that the interval doesn't crash.
    expect(document.querySelector('header')).not.toBeNull();
  });
});
