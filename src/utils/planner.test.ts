import { describe, expect, it } from 'vitest';
import type { Category, Intention, ScheduleBlock, TimeLog } from '@/types/database';
import {
  computeDailySummary,
  enrichBlocks,
  enrichLogs,
  filterSortIntentions,
  groupIntentionsByCategory,
  isPendingRolloverBlock,
} from './planner';

function makeCategory(overrides: Partial<Category> = {}): Category {
  return { id: 'cat-1', name: 'Health', colorHex: '#059669', createdAt: '2026-01-01T00:00:00Z', ...overrides };
}

function makeIntention(overrides: Partial<Intention> = {}): Intention {
  return {
    id: 'task-1',
    title: 'Study Rust',
    categoryId: 'cat-1',
    isRecurring: false,
    defaultDurationMins: 45,
    targetSessionsPerWeek: null,
    preferredWeekdays: [],
    status: 'active',
    notes: null,
    priority: null,
    createdAt: '2026-11-01T00:00:00Z',
    ...overrides,
  };
}

function makeBlock(overrides: Partial<ScheduleBlock> = {}): ScheduleBlock {
  return {
    id: 'block-1',
    taskId: 'task-1',
    scheduledDate: '2026-11-22',
    startTime: '09:00',
    endTime: '10:00',
    plannedDurationMins: 60,
    notes: null,
    status: 'planned',
    rolledFromBlockId: null,
    createdAt: '2026-11-22T08:00:00Z',
    ...overrides,
  };
}

function makeLog(overrides: Partial<TimeLog> = {}): TimeLog {
  return {
    id: 'log-1',
    taskId: null,
    scheduleBlockId: null,
    customTitle: null,
    categoryId: null,
    logDate: '2026-11-22',
    startTime: null,
    endTime: null,
    durationMins: 30,
    notes: null,
    mood: null,
    isAdHoc: true,
    createdAt: '2026-11-22T12:00:00Z',
    ...overrides,
  };
}

describe('computeDailySummary', () => {
  it('sums planned and actual durations', () => {
    const blocks = [makeBlock({ plannedDurationMins: 60 }), makeBlock({ id: 'b2', plannedDurationMins: 30 })];
    const logs = [makeLog({ durationMins: 45 }), makeLog({ id: 'l2', durationMins: 15 })];
    const summary = computeDailySummary(blocks, logs);
    expect(summary.plannedMins).toBe(90);
    expect(summary.actualMins).toBe(60);
    expect(summary.alignment).toBe(67);
    expect(summary.blockCount).toBe(2);
    expect(summary.logCount).toBe(2);
  });

  it('excludes dismissed and rolled blocks from planned total', () => {
    const blocks = [
      makeBlock({ plannedDurationMins: 60 }),
      makeBlock({ id: 'b2', status: 'dismissed', plannedDurationMins: 30 }),
      makeBlock({ id: 'b3', status: 'rolled', plannedDurationMins: 30 }),
      makeBlock({ id: 'b4', status: 'completed', plannedDurationMins: 20 }),
    ];
    const summary = computeDailySummary(blocks, []);
    expect(summary.plannedMins).toBe(80);
  });

  it('computes unplannedMins from logs without scheduleBlockId', () => {
    const logs = [
      makeLog({ durationMins: 20 }),
      makeLog({ id: 'l2', scheduleBlockId: 'block-1', durationMins: 50 }),
    ];
    const summary = computeDailySummary([], logs);
    expect(summary.unplannedMins).toBe(20);
    expect(summary.actualMins).toBe(70);
  });

  it('alignment edge cases', () => {
    expect(computeDailySummary([], []).alignment).toBe(0);
    expect(computeDailySummary([], [makeLog({ durationMins: 30 })]).alignment).toBe(100);
    expect(computeDailySummary([makeBlock()], [makeLog({ durationMins: 30 })]).alignment).toBe(50);
  });
});

describe('isPendingRolloverBlock', () => {
  const today = '2026-11-22';

  it('past planned blocks are pending', () => {
    expect(isPendingRolloverBlock(makeBlock({ scheduledDate: '2026-11-21' }), today, 600)).toBe(true);
  });

  it('today blocks are pending only after endTime', () => {
    const block = makeBlock({ scheduledDate: today, endTime: '10:00' });
    expect(isPendingRolloverBlock(block, today, 9 * 60 + 59)).toBe(false);
    expect(isPendingRolloverBlock(block, today, 10 * 60)).toBe(true);
    expect(isPendingRolloverBlock(block, today, 10 * 60 + 30)).toBe(true);
  });

  it('future blocks and non-planned statuses are not pending', () => {
    expect(isPendingRolloverBlock(makeBlock({ scheduledDate: '2026-11-23' }), today, 600)).toBe(false);
    expect(isPendingRolloverBlock(makeBlock({ status: 'completed', scheduledDate: '2026-11-20' }), today, 600)).toBe(false);
    expect(isPendingRolloverBlock(makeBlock({ status: 'dismissed', scheduledDate: '2026-11-20' }), today, 600)).toBe(false);
    expect(isPendingRolloverBlock(makeBlock({ status: 'missed', scheduledDate: '2026-11-20' }), today, 600)).toBe(false);
  });

  it('blocks with linked actual minutes are not pending', () => {
    const block = makeBlock({ scheduledDate: '2026-11-20' });
    expect(isPendingRolloverBlock(block, today, 600, true)).toBe(false);
    expect(isPendingRolloverBlock(block, today, 600, false)).toBe(true);
  });
});

describe('filterSortIntentions', () => {
  const categories = [makeCategory({ id: 'cat-a', name: 'Alpha' }), makeCategory({ id: 'cat-b', name: 'Beta' })];
  const items = [
    makeIntention({ id: 't1', title: 'Morning run', categoryId: 'cat-b', isRecurring: true, defaultDurationMins: 30, createdAt: '2026-11-10T00:00:00Z' }),
    makeIntention({ id: 't2', title: 'Rust study', categoryId: 'cat-a', isRecurring: false, defaultDurationMins: 90, notes: 'async patterns', createdAt: '2026-11-15T00:00:00Z' }),
    makeIntention({ id: 't3', title: 'Groceries', categoryId: null, isRecurring: false, defaultDurationMins: null, createdAt: '2026-11-12T00:00:00Z' }),
  ];
  const base = { filter: 'all' as const, search: '', sort: 'category' as const };

  it('filters recurring and one-off', () => {
    expect(filterSortIntentions(items, { ...base, filter: 'recurring' }, categories).map((i) => i.id)).toEqual(['t1']);
    expect(filterSortIntentions(items, { ...base, filter: 'one-off' }, categories).map((i) => i.id)).toEqual(['t2', 't3']);
    expect(filterSortIntentions(items, { ...base, filter: 'archived' }, categories)).toHaveLength(3);
  });

  it('searches title and notes case-insensitively', () => {
    expect(filterSortIntentions(items, { ...base, search: 'rust' }, categories).map((i) => i.id)).toEqual(['t2']);
    expect(filterSortIntentions(items, { ...base, search: 'ASYNC' }, categories).map((i) => i.id)).toEqual(['t2']);
    expect(filterSortIntentions(items, { ...base, search: '  ' }, categories)).toHaveLength(3);
  });

  it('sorts by duration desc/asc with null handling', () => {
    const desc = filterSortIntentions(items, { ...base, sort: 'duration-desc' }, categories);
    expect(desc.map((i) => i.id)).toEqual(['t2', 't1', 't3']);
    const asc = filterSortIntentions(items, { ...base, sort: 'duration-asc' }, categories);
    // null duration sorts last via 9999 fallback
    expect(asc.map((i) => i.id)).toEqual(['t1', 't2', 't3']);
  });

  it('sorts by recent createdAt', () => {
    const recent = filterSortIntentions(items, { ...base, sort: 'recent' }, categories);
    expect(recent.map((i) => i.id)).toEqual(['t2', 't3', 't1']);
  });

  it('sorts by category name then title; unknown category sorts last', () => {
    const sorted = filterSortIntentions(items, { ...base, sort: 'category' }, categories);
    // Alpha(t2) < Beta(t1) < uncategorized 'zzz'(t3)
    expect(sorted.map((i) => i.id)).toEqual(['t2', 't1', 't3']);
  });

  it('breaks category-sort ties by title', () => {
    const sameCat = [
      makeIntention({ id: 'a2', title: 'Zulu', categoryId: 'cat-a' }),
      makeIntention({ id: 'a1', title: 'Alpha', categoryId: 'cat-a' }),
    ];
    const sorted = filterSortIntentions(sameCat, { ...base, sort: 'category' }, categories);
    expect(sorted.map((i) => i.id)).toEqual(['a1', 'a2']);
  });
});

describe('groupIntentionsByCategory', () => {
  const categories = [makeCategory({ id: 'cat-a', name: 'Alpha' }), makeCategory({ id: 'cat-b', name: 'Beta' })];

  it('groups by categoryId and sorts groups by category name, uncategorized last', () => {
    const items = [
      makeIntention({ id: 't1', categoryId: 'cat-b' }),
      makeIntention({ id: 't2', categoryId: 'cat-a' }),
      makeIntention({ id: 't3', categoryId: null }),
      makeIntention({ id: 't4', categoryId: 'cat-a' }),
    ];
    const grouped = groupIntentionsByCategory(items, categories);
    expect(grouped.map(([key]) => key)).toEqual(['cat-a', 'cat-b', 'uncategorized']);
    expect(grouped[0][1].map((i) => i.id)).toEqual(['t2', 't4']);
    expect(grouped[2][1].map((i) => i.id)).toEqual(['t3']);
  });
});

describe('enrichBlocks', () => {
  it('joins tasks onto blocks', () => {
    const task = makeIntention({ id: 'task-1', title: 'Study' });
    const blocks = [makeBlock({ taskId: 'task-1' }), makeBlock({ id: 'b2', taskId: 'missing' })];
    const enriched = enrichBlocks(blocks, [task]);
    expect(enriched[0].task?.title).toBe('Study');
    expect(enriched[1].task).toBeUndefined();
  });
});

describe('enrichLogs', () => {
  const categories = [makeCategory({ id: 'cat-1', name: 'Health' })];

  it('resolves task, category, and displayTitle fallbacks', () => {
    const task = makeIntention({ id: 'task-1', title: 'Run', categoryId: 'cat-1' });
    const logs = [
      makeLog({ id: 'l1', taskId: 'task-1', customTitle: 'Morning run' }),
      makeLog({ id: 'l2', taskId: 'task-1' }),
      makeLog({ id: 'l3', customTitle: 'Custom', categoryId: 'cat-1' }),
      makeLog({ id: 'l4' }),
      makeLog({ id: 'l5', taskId: 'task-1', categoryId: 'cat-1' }),
    ];
    const enriched = enrichLogs(logs, [task], categories);
    expect(enriched[0].displayTitle).toBe('Morning run'); // customTitle wins
    expect(enriched[1].displayTitle).toBe('Run'); // task title
    expect(enriched[2].displayTitle).toBe('Custom');
    expect(enriched[3].displayTitle).toBe('Activity'); // fallback
    expect(enriched[4].displayTitle).toBe('Run');
    expect(enriched[1].displayCategory?.name).toBe('Health'); // via task.categoryId
    expect(enriched[0].category?.name).toBe('Health');
  });

  it('log categoryId wins over task categoryId', () => {
    const other = makeCategory({ id: 'cat-2', name: 'Admin' });
    const task = makeIntention({ id: 'task-1', title: 'Run', categoryId: 'cat-1' });
    const log = makeLog({ id: 'l1', taskId: 'task-1', categoryId: 'cat-2' });
    const [enriched] = enrichLogs([log], [task], [makeCategory(), other]);
    expect(enriched.category?.name).toBe('Admin');
  });

  it('falls back to category name for displayTitle, then Activity', () => {
    const logs = [
      makeLog({ id: 'l1', categoryId: 'cat-1' }), // no task/customTitle -> category name
      makeLog({ id: 'l2', categoryId: 'missing' }), // unknown category -> Activity
      makeLog({ id: 'l3' }), // nothing at all -> Activity
    ];
    const enriched = enrichLogs(logs, [], categories);
    expect(enriched[0].displayTitle).toBe('Health');
    expect(enriched[0].displayCategory?.name).toBe('Health');
    expect(enriched[1].displayTitle).toBe('Activity');
    expect(enriched[1].displayCategory).toBeUndefined();
    expect(enriched[2].displayTitle).toBe('Activity');
  });
});
