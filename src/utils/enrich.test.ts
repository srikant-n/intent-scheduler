import { describe, expect, it } from 'vitest';
import type { Category, EnrichedScheduleBlock, EnrichedTimeLog, Intention } from '@/types/database';
import {
  blockCategory,
  blockCategoryId,
  enrichBlocks,
  enrichLogs,
  logCategoryId,
} from './enrich';

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

function makeBlock(overrides: Partial<EnrichedScheduleBlock> = {}): EnrichedScheduleBlock {
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

function makeLog(overrides: Partial<EnrichedTimeLog> = {}): EnrichedTimeLog {
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
    displayTitle: '',
    ...overrides,
  };
}

describe('enrichBlocks', () => {
  it('attaches the matching task and leaves task undefined for unknown ids', () => {
    const task = makeIntention({ id: 'task-1', title: 'Study' });
    const enriched = enrichBlocks(
      [makeBlock({ taskId: 'task-1' }), makeBlock({ id: 'b2', taskId: 'missing' })],
      [task],
    );
    expect(enriched[0].task?.title).toBe('Study');
    expect(enriched[1].task).toBeUndefined();
    // Original fields preserved.
    expect(enriched[0].plannedDurationMins).toBe(60);
  });
});

describe('enrichLogs', () => {
  const categories = [makeCategory({ id: 'cat-1', name: 'Health' }), makeCategory({ id: 'cat-2', name: 'Admin' })];
  const task = makeIntention({ id: 'task-1', title: 'Run', categoryId: 'cat-1' });

  it('resolves task, category, and display fields', () => {
    const [enriched] = enrichLogs([makeLog({ taskId: 'task-1' })], [task], categories);
    expect(enriched.task?.title).toBe('Run');
    expect(enriched.category?.name).toBe('Health');
    expect(enriched.displayCategory?.name).toBe('Health');
    expect(enriched.displayTitle).toBe('Run');
  });

  it('customTitle wins over task title and category name', () => {
    const [enriched] = enrichLogs(
      [makeLog({ taskId: 'task-1', categoryId: 'cat-2', customTitle: 'Custom label' })],
      [task],
      categories,
    );
    expect(enriched.displayTitle).toBe('Custom label');
    // Log's own categoryId beats the task's.
    expect(enriched.category?.name).toBe('Admin');
    expect(enriched.displayCategory?.name).toBe('Admin');
  });

  it('falls back to category name then "Activity" for displayTitle', () => {
    const logs = enrichLogs(
      [
        makeLog({ id: 'l1', categoryId: 'cat-1' }),
        makeLog({ id: 'l2', categoryId: 'missing' }),
        makeLog({ id: 'l3' }),
      ],
      [],
      categories,
    );
    expect(logs[0].displayTitle).toBe('Health');
    expect(logs[1].displayTitle).toBe('Activity');
    expect(logs[1].displayCategory).toBeUndefined();
    expect(logs[2].displayTitle).toBe('Activity');
    expect(logs[2].task).toBeUndefined();
  });
});

describe('blockCategoryId / blockCategory', () => {
  const categories = [makeCategory({ id: 'cat-1', name: 'Health' })];

  it('returns the task category id or null when there is no task', () => {
    const task = makeIntention({ id: 'task-1', categoryId: 'cat-1' });
    const withTask = makeBlock({ taskId: 'task-1', task });
    const withoutTask = makeBlock({ id: 'b2', task: undefined });
    expect(blockCategoryId(withTask)).toBe('cat-1');
    expect(blockCategoryId(withoutTask)).toBeNull();
  });

  it('resolves the category object, undefined when task has no category', () => {
    const categorized = makeBlock({ task: makeIntention({ categoryId: 'cat-1' }) });
    const uncategorized = makeBlock({ id: 'b2', task: makeIntention({ categoryId: null }) });
    expect(blockCategory(categorized, categories)?.name).toBe('Health');
    expect(blockCategory(uncategorized, categories)).toBeUndefined();
    expect(blockCategory(makeBlock({ task: undefined }), categories)).toBeUndefined();
  });
});

describe('logCategoryId', () => {
  it('prefers the log categoryId, then the task categoryId, then null', () => {
    const task = makeIntention({ categoryId: 'cat-1' });
    expect(logCategoryId(makeLog({ categoryId: 'cat-2', task }))).toBe('cat-2');
    expect(logCategoryId(makeLog({ taskId: 'task-1', task }))).toBe('cat-1');
    expect(logCategoryId(makeLog({}))).toBeNull();
    expect(logCategoryId(makeLog({ taskId: 'missing', task: undefined }))).toBeNull();
  });
});
