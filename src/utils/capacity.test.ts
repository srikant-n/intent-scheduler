import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WEEKLY_CAPACITY,
  WEEKDAY_LABELS,
  capacityForWeekday,
  parseWeeklyCapacity,
  serializeWeeklyCapacity,
  weeklyCapacityTotal,
} from './capacity';

describe('parseWeeklyCapacity', () => {
  it('returns defaults for null/undefined/empty input', () => {
    expect(parseWeeklyCapacity(null)).toEqual(DEFAULT_WEEKLY_CAPACITY);
    expect(parseWeeklyCapacity(undefined)).toEqual(DEFAULT_WEEKLY_CAPACITY);
    expect(parseWeeklyCapacity('')).toEqual(DEFAULT_WEEKLY_CAPACITY);
  });

  it('returns defaults for malformed JSON', () => {
    expect(parseWeeklyCapacity('not json')).toEqual(DEFAULT_WEEKLY_CAPACITY);
    expect(parseWeeklyCapacity('{"1":')).toEqual(DEFAULT_WEEKLY_CAPACITY);
  });

  it('merges stored values over defaults', () => {
    const result = parseWeeklyCapacity('{"1":240,"7":45}');
    expect(result[1]).toBe(240);
    expect(result[7]).toBe(45);
    expect(result[2]).toBe(DEFAULT_WEEKLY_CAPACITY[2]);
  });

  it('rounds fractional values and rejects negatives/non-finite', () => {
    const result = parseWeeklyCapacity('{"1":90.6,"2":-10,"3":"abc","4":null}');
    expect(result[1]).toBe(91);
    expect(result[2]).toBe(DEFAULT_WEEKLY_CAPACITY[2]);
    expect(result[3]).toBe(DEFAULT_WEEKLY_CAPACITY[3]);
    // Number(null) === 0 which is finite and >= 0, so day 4 becomes 0.
    expect(result[4]).toBe(0);
  });

  it('accepts zero capacity', () => {
    const result = parseWeeklyCapacity('{"6":0}');
    expect(result[6]).toBe(0);
  });
});

describe('serializeWeeklyCapacity', () => {
  it('emits keys ordered Mon(1)…Sun(7) with missing days as 0', () => {
    expect(serializeWeeklyCapacity({ 7: 30, 1: 200 })).toBe('{"1":200,"2":0,"3":0,"4":0,"5":0,"6":0,"7":30}');
  });

  it('round-trips through parseWeeklyCapacity', () => {
    const capacity = { 1: 100, 3: 50, 5: 75 };
    const parsed = parseWeeklyCapacity(serializeWeeklyCapacity(capacity));
    expect(parsed[1]).toBe(100);
    expect(parsed[3]).toBe(50);
    expect(parsed[5]).toBe(75);
  });
});

describe('capacityForWeekday / weeklyCapacityTotal / WEEKDAY_LABELS', () => {
  it('returns capacity for a weekday and 0 for missing keys', () => {
    expect(capacityForWeekday({ 1: 120 }, 1)).toBe(120);
    expect(capacityForWeekday({ 1: 120 }, 4)).toBe(0);
  });

  it('sums all values', () => {
    expect(weeklyCapacityTotal({ 1: 60, 3: 30, 7: 10 })).toBe(100);
    expect(weeklyCapacityTotal({})).toBe(0);
  });

  it('has labels for all 7 ISO weekdays', () => {
    expect(WEEKDAY_LABELS[1]).toBe('Mon');
    expect(WEEKDAY_LABELS[7]).toBe('Sun');
    expect(Object.keys(WEEKDAY_LABELS)).toHaveLength(7);
  });
});
