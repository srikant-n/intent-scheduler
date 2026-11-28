import { describe, expect, it } from 'vitest';
import type { Category, Intention, ScheduleBlock, TimeLog } from '@/types/database';
import type { WeeklyCapacity } from './capacity';
import { buildAnalyticsSnapshot, weeklyCsvRows } from './analytics';

// Mon 2026-11-16 … Sun 2026-11-22 — entirely in the past relative to today,
// so 'planned' blocks with no linked logs count as pending rollover.
const WEEK = [
  '2026-11-16',
  '2026-11-17',
  '2026-11-18',
  '2026-11-19',
  '2026-11-20',
  '2026-11-21',
  '2026-11-22',
];

const CAPACITY: WeeklyCapacity = { 1: 600, 2: 600, 3: 600, 4: 600, 5: 600, 6: 600, 7: 600 };

const categories: Category[] = [
  { id: 'cat-1', name: 'Health', colorHex: '#059669', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'cat-2', name: 'Work', colorHex: '#2563eb', createdAt: '2026-01-01T00:00:00Z' },
];

const intentions: Intention[] = [
  {
    id: 'task-1',
    title: 'Morning run',
    categoryId: 'cat-1',
    isRecurring: true,
    defaultDurationMins: 60,
    targetSessionsPerWeek: 3,
    preferredWeekdays: [],
    preferredTime: null,
    status: 'active',
    notes: null,
    priority: null,
    createdAt: '2026-11-01T00:00:00Z',
  },
  {
    id: 'task-2',
    title: 'Deep work',
    categoryId: 'cat-2',
    isRecurring: false,
    defaultDurationMins: 120,
    targetSessionsPerWeek: null,
    preferredWeekdays: [],
    preferredTime: null,
    status: 'active',
    notes: null,
    priority: null,
    createdAt: '2026-11-01T00:00:00Z',
  },
];

function makeBlock(overrides: Partial<ScheduleBlock> = {}): ScheduleBlock {
  return {
    id: 'block-1',
    taskId: 'task-1',
    scheduledDate: '2026-11-16',
    startTime: '09:00',
    endTime: '10:00',
    plannedDurationMins: 60,
    notes: null,
    status: 'completed',
    rolledFromBlockId: null,
    createdAt: '2026-11-16T08:00:00Z',
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
    logDate: '2026-11-16',
    startTime: null,
    endTime: null,
    durationMins: 30,
    notes: null,
    mood: null,
    isAdHoc: false,
    createdAt: '2026-11-16T12:00:00Z',
    ...overrides,
  };
}

// Pre-week block (drift history only), in-week blocks of every status,
// and one future block that must be excluded everywhere.
const blocks: ScheduleBlock[] = [
  makeBlock({ id: 'b0', scheduledDate: '2026-11-10', plannedDurationMins: 50, status: 'completed' }),
  makeBlock({ id: 'b1', scheduledDate: '2026-11-16', plannedDurationMins: 60, status: 'completed' }),
  makeBlock({ id: 'b2', taskId: 'task-2', scheduledDate: '2026-11-17', plannedDurationMins: 120, status: 'planned' }),
  makeBlock({ id: 'b3', scheduledDate: '2026-11-18', plannedDurationMins: 60, status: 'rolled' }),
  makeBlock({ id: 'b4', scheduledDate: '2026-11-19', plannedDurationMins: 30, status: 'missed' }),
  makeBlock({ id: 'b5', scheduledDate: '2026-11-20', plannedDurationMins: 45, status: 'dismissed' }),
  makeBlock({ id: 'b6', scheduledDate: '2026-11-21', plannedDurationMins: 40, status: 'planned' }),
  makeBlock({ id: 'b7', scheduledDate: '2026-11-30', plannedDurationMins: 999, status: 'planned' }),
];

const logs: TimeLog[] = [
  makeLog({ id: 'l0', scheduleBlockId: 'b0', logDate: '2026-11-10', durationMins: 50 }),
  makeLog({ id: 'l1', scheduleBlockId: 'b1', logDate: '2026-11-16', durationMins: 75 }),
  makeLog({ id: 'l2', scheduleBlockId: 'b1', logDate: '2026-11-16', durationMins: 15 }),
  makeLog({ id: 'l3', scheduleBlockId: 'b2', taskId: 'task-2', logDate: '2026-11-17', durationMins: 100 }),
  makeLog({
    id: 'l4',
    logDate: '2026-11-18',
    durationMins: 30,
    isAdHoc: true,
    categoryId: 'cat-2',
    mood: 'distraction',
    customTitle: 'Coffee chat',
    notes: 'got sidetracked',
  }),
  makeLog({ id: 'l5', logDate: '2026-11-19', durationMins: 20, isAdHoc: false }),
  makeLog({
    id: 'l6',
    scheduleBlockId: 'b1',
    taskId: 'task-1',
    logDate: '2026-11-20',
    durationMins: 10,
    mood: 'restorative',
    notes: 'easy run',
  }),
  makeLog({ id: 'l7', logDate: '2026-11-25', durationMins: 999 }), // after week end
];

function snapshot() {
  return buildAnalyticsSnapshot({
    weekDates: WEEK,
    allBlocks: blocks,
    allLogs: logs,
    intentions,
    categories,
    capacity: CAPACITY,
  });
}

describe('buildAnalyticsSnapshot — headline metrics', () => {
  it('scopes planned/actual/unplanned to the week and week-scoped statuses', () => {
    const s = snapshot();
    expect(s.weekStart).toBe('2026-11-16');
    expect(s.weekEnd).toBe('2026-11-22');
    // planned/completed/missed count; rolled & dismissed excluded; b7 out of week.
    expect(s.plannedMins).toBe(250); // b1 60 + b2 120 + b4 30 + b6 40
    expect(s.actualMins).toBe(250); // l1+l2+l3+l4+l5+l6
    expect(s.unplannedMins).toBe(50); // l4 (ad hoc) + l5 (no block)
    expect(s.adHocMins).toBe(30); // l4 only
    expect(s.blockCount).toBe(4);
    expect(s.logCount).toBe(6);
    expect(s.capacityMins).toBe(4200);
    expect(s.capacityUtilizationPct).toBe(6);
    expect(s.pacingFidelityPct).toBe(100);
  });

  it('builds daily rhythm for all 7 days', () => {
    const s = snapshot();
    expect(s.dailyRhythm).toHaveLength(7);
    expect(s.dailyRhythm[0]).toMatchObject({ date: '2026-11-16', isoWeekday: 1, plannedMins: 60, actualMins: 90 });
    expect(s.dailyRhythm[2]).toMatchObject({ date: '2026-11-18', plannedMins: 0, actualMins: 30 }); // rolled block
    expect(s.dailyRhythm[3]).toMatchObject({ date: '2026-11-19', plannedMins: 30, actualMins: 20 }); // missed counts
    expect(s.dailyRhythm[5]).toMatchObject({ date: '2026-11-21', plannedMins: 40, actualMins: 0 });
  });
});

describe('buildAnalyticsSnapshot — category variance and stack', () => {
  it('computes variance and tendency per category', () => {
    const s = snapshot();
    const byId = new Map(s.categories.map((c) => [c.categoryId, c]));

    const health = byId.get('cat-1')!;
    expect(health.name).toBe('Health');
    expect(health.plannedMins).toBe(130); // b1 + b4 + b6
    expect(health.actualMins).toBe(10); // l6 via task category
    expect(health.tendency).toBe('under-realized');
    expect(health.realizationPct).toBe(8);

    const work = byId.get('cat-2')!;
    expect(work.plannedMins).toBe(120);
    expect(work.actualMins).toBe(130); // l3 via task, l4 via own categoryId
    expect(work.tendency).toBe('on-track');

    const none = byId.get(null)!;
    expect(none.name).toBe('Uncategorized');
    expect(none.plannedMins).toBe(0);
    expect(none.actualMins).toBe(110); // l1+l2 (linked but no task) + l5
    expect(none.tendency).toBe('over-realized');
    expect(none.variancePct).toBeNull();

    // Sorted by actualMins desc.
    expect(s.categories.map((c) => c.categoryId)).toEqual(['cat-2', null, 'cat-1']);
  });

  it('builds per-day category slices resolving log category then task category', () => {
    const s = snapshot();
    const monday = s.categoryStack.filter((d) => d.date === '2026-11-16');
    expect(monday).toHaveLength(1);
    expect(monday[0]).toMatchObject({ categoryId: null, name: 'Uncategorized', minutes: 90 });

    const tuesday = s.categoryStack.filter((d) => d.date === '2026-11-17');
    expect(tuesday[0]).toMatchObject({ categoryId: 'cat-2', name: 'Work', minutes: 100 });

    const thursday = s.categoryStack.filter((d) => d.date === '2026-11-19');
    expect(thursday[0]).toMatchObject({ categoryId: null, minutes: 20 }); // l5 no task/category
  });
});

describe('buildAnalyticsSnapshot — estimation drift', () => {
  it('compares planned vs linked actual across history up to week end', () => {
    const s = snapshot();
    // Sessions: b0 (50/50), b1 (60/100), b2 (120/100). b4/b6 have no linked logs; b3/b5 excluded.
    expect(s.drift.sessions).toBe(3);
    expect(s.drift.avgVarianceMins).toBe(7); // (0 + 40 - 20) / 3
    expect(s.drift.avgAbsVarianceMins).toBe(20);
    expect(s.drift.grade).toBe('C');
    expect(s.drift.recentSessions.map((r) => r.blockId)).toEqual(['b2', 'b1', 'b0']);
  });

  it('flags per-task bias only with enough sessions', () => {
    const s = snapshot();
    const run = s.drift.tasks.find((t) => t.taskId === 'task-1')!;
    expect(run.title).toBe('Morning run');
    expect(run.sessions).toBe(2); // b0 + b1
    expect(run.bias).toBe('underestimated'); // consistently over planned
    const work = s.drift.tasks.find((t) => t.taskId === 'task-2')!;
    expect(work.sessions).toBe(1);
    expect(work.bias).toBe('insufficient');
  });
});

describe('buildAnalyticsSnapshot — rollover, moods, reflections, insights', () => {
  it('collects rolled/dismissed/missed events and pending blocks', () => {
    const s = snapshot();
    expect(s.rollover.rolledCount).toBe(1);
    expect(s.rollover.dismissedCount).toBe(1);
    expect(s.rollover.missedCount).toBe(1);
    expect(s.rollover.rolledMins).toBe(60);
    expect(s.rollover.dismissedMins).toBe(45);
    expect(s.rollover.missedMins).toBe(30);
    // b6 is 'planned', past date, no linked actual → pending. b2 has linked actual → not pending.
    expect(s.rollover.pendingCount).toBe(1);
    expect(s.rollover.pendingMins).toBe(40);
    // Events sorted by scheduledDate desc.
    expect(s.rollover.events.map((e) => e.blockId)).toEqual(['b5', 'b4', 'b3']);
    expect(s.rollover.events[0]).toMatchObject({ taskTitle: 'Morning run', status: 'dismissed', minutes: 45 });
  });

  it('groups mood buckets and surfaces reflections', () => {
    const s = snapshot();
    const byMood = new Map(s.moods.map((m) => [m.mood, m]));
    expect(byMood.get('distraction')).toMatchObject({ count: 1, minutes: 30 });
    expect(byMood.get('restorative')).toMatchObject({ count: 1, minutes: 10 });

    // Only logs with notes or mood appear, newest date first.
    expect(s.reflections).toHaveLength(2);
    expect(s.reflections[0]).toMatchObject({ logId: 'l6', title: 'Morning run', mood: 'restorative' });
    expect(s.reflections[1]).toMatchObject({ logId: 'l4', title: 'Coffee chat', mood: 'distraction' });
  });

  it('produces rule-based insights', () => {
    const s = snapshot();
    expect(s.insights.length).toBeGreaterThanOrEqual(4);
    expect(s.insights.some((i) => i.includes('well aligned'))).toBe(true);
    expect(s.insights.some((i) => i.includes('Health'))).toBe(true);
    expect(s.insights.some((i) => i.includes('Morning run'))).toBe(true);
    expect(s.insights.some((i) => i.includes('rollover'))).toBe(true);
  });

  it('falls back to a not-enough-data insight when empty', () => {
    const s = buildAnalyticsSnapshot({
      weekDates: WEEK,
      allBlocks: [],
      allLogs: [],
      intentions: [],
      categories: [],
      capacity: {},
    });
    expect(s.plannedMins).toBe(0);
    expect(s.actualMins).toBe(0);
    expect(s.capacityUtilizationPct).toBeNull();
    expect(s.pacingFidelityPct).toBeNull();
    expect(s.drift.grade).toBe('—');
    expect(s.insights).toContain('Not enough data yet — log a few days to unlock reflection insights.');
  });
});

describe('weeklyCsvRows', () => {
  it('emits one sorted row per in-week block with linked actuals', () => {
    const rows = weeklyCsvRows({ weekDates: WEEK, blocks, logs, intentions });
    // b0 (pre-week) and b7 (post-week) excluded → 6 rows, sorted by date.
    expect(rows).toHaveLength(6);
    expect(rows.map((r) => r.date)).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
    ]);

    const b1 = rows[0];
    expect(b1).toMatchObject({
      week_start: '2026-11-16',
      week_end: '2026-11-22',
      weekday: 1,
      planned_minutes: 60,
      status: 'completed',
      task_title: 'Morning run',
      category_id: 'cat-1',
      is_recurring: 1,
      target_sessions_per_week: 3,
      actual_minutes: 100, // l1 + l2 + l6
      variance_minutes: 40,
    });

    const b2 = rows[1];
    expect(b2).toMatchObject({
      task_title: 'Deep work',
      category_id: 'cat-2',
      is_recurring: 0,
      target_sessions_per_week: null,
      actual_minutes: 100,
      variance_minutes: -20,
    });

    // Blocks without linked logs get null variance.
    expect(rows[2].variance_minutes).toBeNull(); // b3 rolled
    expect(rows[5].variance_minutes).toBeNull(); // b6 planned, no logs
    expect(rows[5].status).toBe('planned');
  });

  it('returns empty array for an empty week', () => {
    expect(weeklyCsvRows({ weekDates: WEEK, blocks: [], logs: [], intentions: [] })).toEqual([]);
  });
});
