export const WEEKLY_CAPACITY_KEY = 'weekly_capacity_minutes';

export const DEFAULT_WEEKLY_CAPACITY: Record<number, number> = {
  1: 360,
  2: 360,
  3: 360,
  4: 360,
  5: 360,
  6: 240,
  7: 180,
};

export const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun',
};

export type WeeklyCapacity = Record<number, number>;

export function parseWeeklyCapacity(raw: string | null | undefined): WeeklyCapacity {
  const capacity: WeeklyCapacity = { ...DEFAULT_WEEKLY_CAPACITY };
  if (!raw) return capacity;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (let day = 1; day <= 7; day += 1) {
      const value = Number(parsed[String(day)]);
      if (Number.isFinite(value) && value >= 0) capacity[day] = Math.round(value);
    }
  } catch {
    // Fall back to defaults on malformed JSON.
  }
  return capacity;
}

export function serializeWeeklyCapacity(capacity: WeeklyCapacity): string {
  const ordered: Record<string, number> = {};
  for (let day = 1; day <= 7; day += 1) ordered[String(day)] = capacity[day] ?? 0;
  return JSON.stringify(ordered);
}

export function capacityForWeekday(capacity: WeeklyCapacity, isoWeekday: number): number {
  return capacity[isoWeekday] ?? 0;
}

export function weeklyCapacityTotal(capacity: WeeklyCapacity): number {
  return Object.values(capacity).reduce((sum, value) => sum + value, 0);
}
