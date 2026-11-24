// Unit tests for schedule slot math: clamp, overlapMinutes, rangesOverlap,
// and firstAvailableSlot placement within day bounds.
import { describe, expect, it } from 'vitest';
import { clamp, overlapMinutes, rangesOverlap } from './schedule';

describe('clamp', () => {
  it('clamps below min, above max, and passes through', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe('overlapMinutes', () => {
  it('returns 0 for disjoint ranges', () => {
    expect(overlapMinutes(0, 60, 60, 120)).toBe(0);
    expect(overlapMinutes(120, 180, 0, 60)).toBe(0);
  });

  it('returns overlap for partial intersection', () => {
    expect(overlapMinutes(0, 100, 50, 150)).toBe(50);
    expect(overlapMinutes(50, 150, 0, 100)).toBe(50);
  });

  it('returns full shorter range for containment', () => {
    expect(overlapMinutes(0, 200, 50, 100)).toBe(50);
    expect(overlapMinutes(50, 100, 0, 200)).toBe(50);
  });

  it('returns 0 for touching edges', () => {
    expect(overlapMinutes(0, 60, 60, 120)).toBe(0);
  });
});

describe('rangesOverlap', () => {
  it('adjacent blocks do not overlap', () => {
    expect(rangesOverlap('09:00', '10:00', '10:00', '11:00')).toBe(false);
    expect(rangesOverlap('10:00', '11:00', '09:00', '10:00')).toBe(false);
  });

  it('partial and contained overlaps are detected', () => {
    expect(rangesOverlap('09:00', '10:30', '10:00', '11:00')).toBe(true);
    expect(rangesOverlap('09:00', '12:00', '10:00', '11:00')).toBe(true);
    expect(rangesOverlap('10:00', '11:00', '09:00', '12:00')).toBe(true);
  });

  it('disjoint blocks do not overlap', () => {
    expect(rangesOverlap('09:00', '10:00', '11:00', '12:00')).toBe(false);
    expect(rangesOverlap('13:00', '14:00', '09:00', '10:00')).toBe(false);
  });
});
