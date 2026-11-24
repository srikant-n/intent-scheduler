import { describe, expect, it } from 'vitest';
import type { Category, Intention, ScheduleBlock, TimeLog } from '@/types/database';
import type { WeeklyCapacity } from './capacity';
import { buildWeeklySummary } from './weekly';

const WEEK = [
  '2026-11-23', // Mon
  '2026-11-24',
  '2026-11-25',
  '2026-11-26',
  '2026-11-27',
  '2026-11-28',
  '2026-11-29', // Sun
];

const CAPACITY: WeeklyCapacity = { 1: 600, 2: 600, 3: 600, 4: 600, 5: 600, 6: 600, 7: 600 };

function makeCategory(overrides: Partial<Category> = {}): Category {
  return { id: 'cat-1', name: 'Health', colorHex: '#059669', createdAt: '2026-01-01T00:00:00Z', ...overrides };
}

function makeTask(overrides: Partial<Intention> = {}): Intention {
  return {
    id: 'task-1',
    title: 'Morning run',
    categoryId: 'cat-1',
    isRecurring: true,
    defaultDurationMins: 60,
    targetSessionsPerWeek: 3,
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
    scheduledDate: '2026-11-23',
    startTime: '09:00',
    endTime: '10:00',
    plannedDurationMins: 60,
    notes: null,
    status: 'planned',
    rolledFromBlockId: null,
    createdAt: '2026-11-23T08:00:00Z',
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
    logDate: '2026-11-23',
    startTime: null,
    endTime: null,
    durationMins: 30,
    notes: null,
    mood: null,
    isAdHoc: true,
    createdAt: '2026-11-23T12:00:00Z',
    ...overrides,
  };
}

function summary(overrides: Partial<Parameters<typeof buildWeeklySummary>[0]> = {}) {
  return buildWeeklySummary({
    weekDates: WEEK,
    blocks: [],
    logs: [],
    intentions: [],
    categories: [],
    capacity: CAPACITY,
    ...overrides,
  });
}

describe('buildWeeklySummary — day rollups', () => {
  it('returns one entry per week date with capacity and iso weekday', () => {
    const result = summary();
    expect(result.days).toHaveLength(7);
    expect(result.days[0].date).toBe('2026-11-23');
    expect(result.days[0].isoWeekday).toBe(1);
    expect(result.days[6].isoWeekday).toBe(7);
    expect(result.days[0].capacityMins).toBe(600);
  });

  it('aggregates planned, actual, and unplanned minutes per day', () => {
    const blocks = [
      makeBlock({ id: 'b1', status: 'completed', plannedDurationMins: 60 }),
      makeBlock({ id: 'b2', status: 'dismissed', plannedDurationMins: 45 }), // excluded
    ];
    const logs = [
      makeLog({ id: 'l1', scheduleBlockId: 'b1', isAdHoc: false, durationMins: 75 }),
      makeLog({ id: 'l2', durationMins: 20, isAdHoc: false }), // unplanned via missing block
    ];
    const result = summary({ blocks, logs });
    const monday = result.days[0];
    expect(monday.plannedMins).toBe(60);
    expect(monday.actualMins).toBe(95);
    expect(monday.unplannedMins).toBe(20);
    expect(monday.blockCount).toBe(1);
    expect(monday.utilizationPct).toBe(10);
  });

  it('counts missed/rolled statuses correctly: missed plans, rolled/dismissed do not', () => {
    const blocks = [
      makeBlock({ id: 'm', status: 'missed', plannedDurationMins: 30, scheduledDate: '2026-11-25' }),
      makeBlock({ id: 'r', status: 'rolled', plannedDurationMins: 30, scheduledDate: '2026-11-25' }),
    ];
    const result = summary({ blocks });
    const wed = result.days[2];
    expect(wed.plannedMins).toBe(30);
    expect(wed.blockCount).toBe(1);
  });

  it('treats ad-hoc linked logs as unplanned', () => {
    const blocks = [makeBlock({ id: 'b1' })];
    const logs = [makeLog({ scheduleBlockId: 'b1', isAdHoc: true, durationMins: 50 })];
    const result = summary({ blocks, logs });
    expect(result.days[0].unplannedMins).toBe(50);
    expect(result.days[0].actualMins).toBe(50);
  });

  it('reports utilizationPct null only when capacity is zero', () => {
    const zero = summary({ capacity: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 } });
    expect(zero.days[0].utilizationPct).toBeNull();
    expect(zero.utilizationPct).toBeNull();
    // With capacity, an empty week is 0%, not null.
    expect(summary().days[0].utilizationPct).toBe(0);
  });

  it('counts pending rollover blocks by date', () => {
    const blocks = [
      makeBlock({ id: 'p1', scheduledDate: '2026-11-24' }),
      makeBlock({ id: 'p2', scheduledDate: '2026-11-24' }),
      makeBlock({ id: 'p3', scheduledDate: '2026-11-23' }), // not pending
    ];
    const result = summary({ blocks, pendingBlockIds: new Set(['p1', 'p2']) });
    expect(result.days[1].pendingRolloverCount).toBe(2);
    expect(result.days[0].pendingRolloverCount).toBe(0);
    expect(result.pendingRolloverCount).toBe(2);
  });
});

describe('buildWeeklySummary — totals and aggregates', () => {
  const intentions = [
    makeTask({ id: 'task-1', categoryId: 'cat-1', isRecurring: true }),
    makeTask({ id: 'task-2', title: 'Deep work', categoryId: 'cat-2', isRecurring: false }),
  ];
  const categories = [makeCategory(), makeCategory({ id: 'cat-2', name: 'Work', colorHex: '#2563eb' })];
  const blocks = [
    makeBlock({ id: 'b1', taskId: 'task-1', status: 'completed', plannedDurationMins: 60 }),
    makeBlock({ id: 'b2', taskId: 'task-2', status: 'planned', plannedDurationMins: 120, scheduledDate: '2026-11-24' }),
    makeBlock({ id: 'b3', taskId: 'task-1', status: 'missed', plannedDurationMins: 30, scheduledDate: '2026-11-25' }),
    makeBlock({ id: 'b4', taskId: 'task-1', status: 'dismissed', plannedDurationMins: 45 }),
    makeBlock({ id: 'b5', taskId: 'task-1', status: 'rolled', plannedDurationMins: 20, scheduledDate: '2026-11-24' }),
  ];
  const logs = [
    makeLog({ id: 'l1', scheduleBlockId: 'b1', isAdHoc: false, taskId: 'task-1', durationMins: 75 }),
    makeLog({ id: 'l2', durationMins: 20, isAdHoc: false }),
    makeLog({ id: 'l3', scheduleBlockId: 'b2', isAdHoc: true, taskId: 'task-2', logDate: '2026-11-24', durationMins: 100 }),
    makeLog({ id: 'l4', categoryId: 'cat-2', logDate: '2026-11-25', durationMins: 30 }),
  ];

  it('computes weekly totals', () => {
    const result = summary({ blocks, logs, intentions, categories });
    expect(result.totalPlannedMins).toBe(210); // 60 + 120 + 30 (missed counts)
    expect(result.totalActualMins).toBe(225); // 75 + 20 + 100 + 30
    expect(result.totalUnplannedMins).toBe(150); // l2 (20) + l3 adHoc (100) + l4 (30)
    expect(result.totalCapacityMins).toBe(4200);
    expect(result.utilizationPct).toBe(5);
    expect(result.pacingFidelityPct).toBe(107);
    expect(result.blockCount).toBe(3);
  });

  it('builds per-category balance sorted by combined minutes', () => {
    const result = summary({ blocks, logs, intentions, categories });
    expect(result.categoryBalance.map((c) => c.categoryId)).toEqual(['cat-2', 'cat-1', null]);
    const work = result.categoryBalance[0];
    expect(work.name).toBe('Work');
    expect(work.plannedMins).toBe(120);
    expect(work.actualMins).toBe(130); // l3 via task, l4 via own categoryId
    const health = result.categoryBalance[1];
    expect(health.name).toBe('Health');
    expect(health.plannedMins).toBe(90); // b1 + b3
    expect(health.actualMins).toBe(75); // l1 via task category
    const uncategorized = result.categoryBalance[2];
    expect(uncategorized.name).toBe('Uncategorized');
    expect(uncategorized.colorHex).toBe('#78716c');
    expect(uncategorized.actualMins).toBe(20); // l2
  });

  it('computes habit adherence from recurring intentions only', () => {
    const result = summary({ blocks, logs, intentions, categories });
    // task-1 recurring: b1 completed + b3 missed count; b4/b5 excluded by status.
    expect(result.habitAdherence).toEqual({ plannedSessions: 2, fulfilledSessions: 1, pct: 50 });
  });

  it('day summaries only count logs/blocks dated within the week', () => {
    const result = summary({
      blocks: [makeBlock({ scheduledDate: '2026-11-30', plannedDurationMins: 90 })],
      logs: [makeLog({ logDate: '2026-11-30', durationMins: 999 })],
    });
    expect(result.days.every((d) => d.actualMins === 0 && d.plannedMins === 0)).toBe(true);
    expect(result.totalActualMins).toBe(0);
    expect(result.totalPlannedMins).toBe(0);
  });

  it('returns null pct values with no data', () => {
    const result = summary({ intentions: [makeTask()], categories });
    expect(result.habitAdherence).toEqual({ plannedSessions: 0, fulfilledSessions: 0, pct: null });
    expect(result.pacingFidelityPct).toBeNull();
    expect(result.categoryBalance).toEqual([]);
  });
});
