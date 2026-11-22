import { describe, expect, it } from 'vitest';
import {
  addDaysISO,
  deriveLogTimes,
  elapsedMs,
  formatDateLong,
  formatDateShort,
  formatDuration,
  formatElapsed,
  formatTime12,
  formatWeekRangeISO,
  isValidISODate,
  isValidTime,
  localTimeFromDate,
  minutesToTime,
  parseISODate,
  snapMinutes,
  timeToMinutes,
  toISODate,
  todayISO,
  uuid,
  weekDatesISO,
} from './time';

describe('ISO date helpers', () => {
  it('round-trips toISODate/parseISODate', () => {
    const date = new Date(2026, 0, 15, 10, 30);
    expect(toISODate(date)).toBe('2026-01-15');
    expect(parseISODate('2026-01-15').getFullYear()).toBe(2026);
    expect(parseISODate('2026-01-15').getMonth()).toBe(0);
    expect(parseISODate('2026-01-15').getDate()).toBe(15);
  });

  it('todayISO returns a valid ISO date', () => {
    expect(isValidISODate(todayISO())).toBe(true);
  });

  it('addDaysISO crosses month and year boundaries', () => {
    expect(addDaysISO('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysISO('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDaysISO('2026-02-15', 0)).toBe('2026-02-15');
  });

  it('weekDatesISO returns a Monday-start week', () => {
    // 2026-11-22 is a Sunday -> week starts Mon 2026-11-16
    const week = weekDatesISO('2026-11-22');
    expect(week).toHaveLength(7);
    expect(week[0]).toBe('2026-11-16');
    expect(week[6]).toBe('2026-11-22');
    expect(parseISODate(week[0]).getDay()).toBe(1);
  });

  it('weekDatesISO for a Wednesday returns surrounding week', () => {
    const week = weekDatesISO('2026-11-18');
    expect(week[0]).toBe('2026-11-16');
    expect(week[6]).toBe('2026-11-22');
  });

  it('formatDateLong/Short/WeekRange produce non-empty strings', () => {
    expect(formatDateLong('2026-11-22').length).toBeGreaterThan(0);
    expect(formatDateShort('2026-11-22').length).toBeGreaterThan(0);
    expect(formatWeekRangeISO('2026-11-22').length).toBeGreaterThan(0);
  });
});

describe('time conversion', () => {
  it('timeToMinutes parses HH:MM', () => {
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('09:30')).toBe(570);
    expect(timeToMinutes('23:59')).toBe(1439);
  });

  it('minutesToTime formats and pads', () => {
    expect(minutesToTime(0)).toBe('00:00');
    expect(minutesToTime(570)).toBe('09:30');
    expect(minutesToTime(1439)).toBe('23:59');
  });

  it('minutesToTime clamps out-of-range values', () => {
    expect(minutesToTime(-30)).toBe('00:00');
    expect(minutesToTime(24 * 60 + 5)).toBe('23:59');
    expect(minutesToTime(90.6)).toBe('01:31');
  });

  it('snapMinutes snaps to interval via Math.round', () => {
    expect(snapMinutes(0, 15)).toBe(0);
    expect(snapMinutes(7, 15)).toBe(0);
    expect(snapMinutes(8, 15)).toBe(15);
    expect(snapMinutes(22, 15)).toBe(15);
    expect(snapMinutes(23, 15)).toBe(30);
    expect(snapMinutes(100, 30)).toBe(90);
    expect(snapMinutes(-10, 15)).toBe(-15);
  });
});

describe('formatDuration', () => {
  it('formats minutes, hours, and combos', () => {
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(45)).toBe('45m');
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(90)).toBe('1h 30m');
    expect(formatDuration(125)).toBe('2h 5m');
  });

  it('handles null/NaN/negative', () => {
    expect(formatDuration(null)).toBe('0m');
    expect(formatDuration(undefined)).toBe('0m');
    expect(formatDuration(NaN)).toBe('0m');
    expect(formatDuration(-10)).toBe('0m');
  });
});

describe('formatTime12', () => {
  it('formats AM/PM', () => {
    expect(formatTime12('09:30')).toBe('9:30 AM');
    expect(formatTime12('13:05')).toBe('1:05 PM');
    expect(formatTime12('00:00')).toBe('12:00 AM');
    expect(formatTime12('12:00')).toBe('12:00 PM');
    expect(formatTime12('12:30')).toBe('12:30 PM');
  });

  it('returns placeholder for missing and passthrough for invalid', () => {
    expect(formatTime12(null)).toBe('—');
    expect(formatTime12(undefined)).toBe('—');
    expect(formatTime12('')).toBe('—');
    expect(formatTime12('abc')).toBe('abc');
  });
});

describe('elapsedMs', () => {
  const start = '2026-11-22T10:00:00.000Z';

  it('running timer = now - start', () => {
    const now = new Date(start).getTime() + 90_000;
    expect(elapsedMs(start, 0, null, now)).toBe(90_000);
  });

  it('paused timer freezes at pausedAt', () => {
    const pausedAt = '2026-11-22T10:01:00.000Z';
    const now = new Date(pausedAt).getTime() + 3_600_000;
    expect(elapsedMs(start, 0, pausedAt, now)).toBe(60_000);
  });

  it('subtracts accumulated paused time', () => {
    // raw elapsed = 10min; minus 5min accumulated pause = 5min
    const now = new Date(start).getTime() + 600_000;
    expect(elapsedMs(start, 300_000, null, now)).toBe(300_000);
  });

  it('returns 0 for invalid timestamps and never goes negative', () => {
    expect(elapsedMs('not-a-date', 0, null)).toBe(0);
    expect(elapsedMs(start, 0, 'not-a-date', Date.now())).toBe(0);
    // pausedAt before start would be negative -> clamped to 0
    expect(elapsedMs(start, 0, '2026-11-22T09:00:00.000Z', Date.now())).toBe(0);
  });
});

describe('formatElapsed', () => {
  it('formats HH:MM:SS', () => {
    expect(formatElapsed(0)).toBe('00:00:00');
    expect(formatElapsed(65_000)).toBe('00:01:05');
    expect(formatElapsed(3_723_000)).toBe('01:02:03');
  });
});

describe('validation helpers', () => {
  it('isValidISODate accepts YYYY-MM-DD and rejects malformed', () => {
    expect(isValidISODate('2026-11-22')).toBe(true);
    expect(isValidISODate('2026-1-5')).toBe(false);
    expect(isValidISODate('2026-13-01')).toBe(false);
    expect(isValidISODate('not-a-date')).toBe(false);
    expect(isValidISODate('2026-02-30')).toBe(false);
  });

  it('isValidTime enforces HH:MM 00:00-23:59', () => {
    expect(isValidTime('00:00')).toBe(true);
    expect(isValidTime('23:59')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('9:30')).toBe(false);
    expect(isValidTime('12:60')).toBe(false);
    expect(isValidTime('noon')).toBe(false);
  });
});

describe('uuid', () => {
  it('generates v4-shaped unique ids', () => {
    const a = uuid();
    const b = uuid();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });
});

describe('deriveLogTimes', () => {
  it('same-day timer produces start and end times', () => {
    const start = new Date(2026, 10, 22, 9, 0, 0); // local 09:00
    const result = deriveLogTimes(start.toISOString(), 30 * 60_000);
    expect(result.logDate).toBe('2026-11-22');
    expect(result.startTime).toBe(localTimeFromDate(start));
    expect(result.endTime).toBe(localTimeFromDate(new Date(start.getTime() + 30 * 60_000)));
  });

  it('cross-midnight timer keeps logDate at start and nulls endTime', () => {
    const start = new Date(2026, 10, 22, 23, 30, 0);
    const result = deriveLogTimes(start.toISOString(), 2 * 3_600_000);
    expect(result.logDate).toBe('2026-11-22');
    expect(result.endTime).toBeNull();
  });
});
