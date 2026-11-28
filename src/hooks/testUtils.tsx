// Shared helpers for hook tests: a QueryClientProvider wrapper for renderHook
// and minimal entity fixtures matching the shapes in src/types/database.ts.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { ActiveTimerState, Category, Intention, ScheduleBlock, TimeLog } from '@/types/database';

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

/** renderHook wrapped in a fresh QueryClientProvider (retries disabled). */
export function renderHookWithQueryClient<TResult>(hook: () => TResult) {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, ...renderHook(hook, { wrapper }) };
}

export function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-1',
    name: 'Deep Work',
    colorHex: '#4f46e5',
    createdAt: '2026-11-01T08:00:00Z',
    ...overrides,
  };
}

export function makeIntention(overrides: Partial<Intention> = {}): Intention {
  return {
    id: 'task-1',
    title: 'Write report',
    categoryId: 'cat-1',
    isRecurring: false,
    defaultDurationMins: 60,
    targetSessionsPerWeek: null,
    preferredWeekdays: [],
    preferredTime: null,
    status: 'active',
    notes: null,
    priority: null,
    createdAt: '2026-11-01T08:00:00Z',
    ...overrides,
  };
}

export function makeBlock(overrides: Partial<ScheduleBlock> = {}): ScheduleBlock {
  return {
    id: 'block-1',
    taskId: 'task-1',
    scheduledDate: '2026-11-24',
    startTime: '09:00',
    endTime: '10:00',
    plannedDurationMins: 60,
    notes: null,
    status: 'planned',
    rolledFromBlockId: null,
    createdAt: '2026-11-24T08:00:00Z',
    ...overrides,
  };
}

export function makeLog(overrides: Partial<TimeLog> = {}): TimeLog {
  return {
    id: 'log-1',
    taskId: 'task-1',
    scheduleBlockId: null,
    customTitle: null,
    categoryId: 'cat-1',
    logDate: '2026-11-24',
    startTime: '09:00',
    endTime: '10:00',
    durationMins: 60,
    notes: null,
    mood: null,
    isAdHoc: false,
    createdAt: '2026-11-24T10:00:00Z',
    ...overrides,
  };
}

export function makeTimer(overrides: Partial<ActiveTimerState> = {}): ActiveTimerState {
  return {
    id: 'timer-1',
    taskId: 'task-1',
    scheduleBlockId: null,
    customTitle: 'Write report',
    categoryId: 'cat-1',
    startedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
    accumulatedPausedMs: 0,
    pausedAt: null,
    targetDurationMins: 60,
    notes: null,
    ...overrides,
  };
}
