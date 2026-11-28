import { describe, expect, it } from 'vitest';
import type { Intention, ScheduleBlock } from '@/types/database';
import type { WeeklyCapacity } from './capacity';
import {
  blocksOverlapOnDate,
  computeHabitDistribution,
  firstAvailableSlot,
} from './habitDistribution';

const WEEK = [
  '2026-11-23', // Mon
  '2026-11-24',
  '2026-11-25',
  '2026-11-26',
  '2026-11-27', // Fri
  '2026-11-28',
  '2026-11-29', // Sun
];

const FULL_WEEK_CAPACITY: WeeklyCapacity = { 1: 600, 2: 600, 3: 600, 4: 600, 5: 600, 6: 600, 7: 600 };

function makeTask(overrides: Partial<Intention> = {}): Intention {
  return {
    id: 'task-1',
    title: 'Read',
    categoryId: null,
    isRecurring: true,
    defaultDurationMins: 60,
    targetSessionsPerWeek: 2,
    preferredWeekdays: [],
    preferredTime: null,
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

function options(overrides: Partial<Parameters<typeof computeHabitDistribution>[1]> = {}) {
  return {
    weekDates: WEEK,
    existingBlocks: [] as ScheduleBlock[],
    capacity: FULL_WEEK_CAPACITY,
    dayStartHour: 8,
    dayEndHour: 20,
    snapInterval: 30,
    ...overrides,
  };
}

describe('firstAvailableSlot', () => {
  it('returns the first snapped slot within day bounds', () => {
    expect(firstAvailableSlot([], '2026-11-23', 60, 8 * 60, 20 * 60, 30)).toEqual({
      startTime: '08:00',
      endTime: '09:00',
    });
  });

  it('snaps a non-aligned day start to the interval', () => {
    // 08:05 snapped to nearest 30min → 08:00
    expect(firstAvailableSlot([], '2026-11-23', 60, 8 * 60 + 5, 20 * 60, 30)?.startTime).toBe('08:00');
  });

  it('skips ranges overlapping existing blocks on the same date', () => {
    const blocks = [makeBlock({ startTime: '08:00', endTime: '10:00' })];
    expect(firstAvailableSlot(blocks, '2026-11-23', 60, 8 * 60, 20 * 60, 30)).toEqual({
      startTime: '10:00',
      endTime: '11:00',
    });
  });

  it('ignores blocks on other dates and dismissed/rolled blocks', () => {
    const blocks = [
      makeBlock({ scheduledDate: '2026-11-24', startTime: '08:00', endTime: '20:00' }),
      makeBlock({ id: 'b2', status: 'dismissed', startTime: '08:00', endTime: '20:00' }),
      makeBlock({ id: 'b3', status: 'rolled', startTime: '08:00', endTime: '20:00' }),
    ];
    expect(firstAvailableSlot(blocks, '2026-11-23', 60, 8 * 60, 20 * 60, 30)?.startTime).toBe('08:00');
  });

  it('returns null when the duration cannot fit', () => {
    const blocks = [makeBlock({ startTime: '08:00', endTime: '20:00' })];
    expect(firstAvailableSlot(blocks, '2026-11-23', 60, 8 * 60, 20 * 60, 30)).toBeNull();
    // Duration longer than the whole day window.
    expect(firstAvailableSlot([], '2026-11-23', 13 * 60, 8 * 60, 20 * 60, 30)).toBeNull();
  });
});

describe('blocksOverlapOnDate', () => {
  const blocks = [makeBlock({ id: 'b1', startTime: '09:00', endTime: '10:00' })];

  it('detects overlaps on the same date', () => {
    expect(blocksOverlapOnDate(blocks, '2026-11-23', '09:30', '10:30')).toBe(true);
    expect(blocksOverlapOnDate(blocks, '2026-11-23', '08:00', '09:00')).toBe(false); // adjacent
    expect(blocksOverlapOnDate(blocks, '2026-11-24', '09:30', '10:30')).toBe(false); // other date
  });

  it('excludes a block by id for move/resize checks', () => {
    expect(blocksOverlapOnDate(blocks, '2026-11-23', '09:30', '10:30', 'b1')).toBe(false);
    expect(blocksOverlapOnDate(blocks, '2026-11-23', '09:30', '10:30', 'other')).toBe(true);
  });

  it('ignores dismissed and rolled blocks', () => {
    const inactive = [
      makeBlock({ id: 'b1', status: 'dismissed' }),
      makeBlock({ id: 'b2', status: 'rolled' }),
    ];
    expect(blocksOverlapOnDate(inactive, '2026-11-23', '09:30', '10:30')).toBe(false);
  });
});

describe('computeHabitDistribution', () => {
  it('places the full deficit when nothing is planned yet', () => {
    const result = computeHabitDistribution([makeTask({ targetSessionsPerWeek: 2 })], options());
    expect(result.skips).toHaveLength(0);
    expect(result.proposals).toHaveLength(2);
    // Preferred is empty → all days tie; ties break toward most remaining
    // capacity, so each session lands on the emptiest day at 08:00.
    expect(result.proposals.map((p) => p.scheduledDate)).toEqual(['2026-11-23', '2026-11-24']);
    expect(result.proposals.map((p) => p.startTime)).toEqual(['08:00', '08:00']);
    expect(result.proposals[0].plannedDurationMins).toBe(60);
  });

  it('prefers the task preferred weekdays', () => {
    const result = computeHabitDistribution(
      [makeTask({ targetSessionsPerWeek: 1, preferredWeekdays: [5] })],
      options(),
    );
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0].scheduledDate).toBe('2026-11-27'); // Friday
  });

  it('places sessions at the preferred time when the slot is free', () => {
    const result = computeHabitDistribution(
      [makeTask({ targetSessionsPerWeek: 1, preferredTime: '10:30' })],
      options(),
    );
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0].startTime).toBe('10:30');
    expect(result.proposals[0].endTime).toBe('11:30');
  });

  it('uses the nearest free slot around the preferred time', () => {
    const existing = [makeBlock({ taskId: 'other-task', startTime: '10:00', endTime: '11:00' })];
    const result = computeHabitDistribution(
      [makeTask({ targetSessionsPerWeek: 1, preferredWeekdays: [1], preferredTime: '10:30' })],
      options({ existingBlocks: existing }),
    );
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0].scheduledDate).toBe('2026-11-23');
    expect(result.proposals[0].startTime).toBe('11:00');
  });

  it('counts existing planned blocks toward the weekly target', () => {
    const existing = [makeBlock({ id: 'existing', taskId: 'task-1', status: 'planned' })];
    const result = computeHabitDistribution(
      [makeTask({ targetSessionsPerWeek: 2 })],
      options({ existingBlocks: existing }),
    );
    // One session already planned → deficit is 1.
    expect(result.proposals).toHaveLength(1);
    expect(result.skips).toHaveLength(0);
  });

  it('does not count dismissed/rolled blocks toward the target', () => {
    const existing = [
      makeBlock({ id: 'd', status: 'dismissed' }),
      makeBlock({ id: 'r', status: 'rolled' }),
    ];
    const result = computeHabitDistribution(
      [makeTask({ targetSessionsPerWeek: 1 })],
      options({ existingBlocks: existing }),
    );
    expect(result.proposals).toHaveLength(1);
  });

  it('reports a skip when capacity runs out', () => {
    const result = computeHabitDistribution(
      [makeTask({ targetSessionsPerWeek: 2 })],
      options({ capacity: { 1: 60 } }), // only Monday has 60 mins
    );
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0].scheduledDate).toBe('2026-11-23');
    expect(result.skips).toHaveLength(1);
    expect(result.skips[0].requested).toBe(2);
    expect(result.skips[0].placed).toBe(1);
    expect(result.skips[0].task.id).toBe('task-1');
  });

  it('avoids collisions between proposals placed in the same run', () => {
    const result = computeHabitDistribution(
      [makeTask({ targetSessionsPerWeek: 3, defaultDurationMins: 60 })],
      // Only Monday has capacity → all three proposals must fit on one day.
      options({ capacity: { 1: 600 } }),
    );
    expect(result.proposals).toHaveLength(3);
    expect(result.proposals.every((p) => p.scheduledDate === '2026-11-23')).toBe(true);
    const starts = result.proposals.map((p) => p.startTime);
    expect(new Set(starts).size).toBe(3);
    expect(starts).toEqual(['08:00', '09:00', '10:00']);
  });

  it('ignores non-recurring, archived, and zero-target intentions', () => {
    const result = computeHabitDistribution(
      [
        makeTask({ id: 'one-off', isRecurring: false }),
        makeTask({ id: 'archived', status: 'archived' }),
        makeTask({ id: 'zero', targetSessionsPerWeek: 0 }),
        makeTask({ id: 'null-target', targetSessionsPerWeek: null }),
      ],
      options(),
    );
    expect(result.proposals).toHaveLength(0);
    expect(result.skips).toHaveLength(0);
  });

  it('uses defaultDurationMins fallback of 30', () => {
    const result = computeHabitDistribution(
      [makeTask({ targetSessionsPerWeek: 1, defaultDurationMins: null })],
      options(),
    );
    expect(result.proposals[0].plannedDurationMins).toBe(30);
    expect(result.proposals[0].endTime).toBe('08:30');
  });
});
