import type {
  Category,
  Intention,
  ScheduleBlock,
  TimeLog,
} from '@/types/database';
import { timeToMinutes } from '@/utils/time';
import { enrichBlocks, enrichLogs } from '@/utils/enrich';

/** Re-exported for convenience — most callers only need this module. */
export { enrichBlocks, enrichLogs };

export interface DailySummary {
  plannedMins: number;
  actualMins: number;
  unplannedMins: number;
  alignment: number;
  blockCount: number;
  logCount: number;
}

/** Headline day metrics: planned vs actual minutes, unplanned share, and
 * `alignment` (% of plan executed; 100 when nothing was planned but time was logged). */
export function computeDailySummary(blocks: ScheduleBlock[], logs: TimeLog[]): DailySummary {
  const plannedMins = blocks
    .filter((block) => block.status !== 'dismissed' && block.status !== 'rolled')
    .reduce((sum, block) => sum + block.plannedDurationMins, 0);
  const actualMins = logs.reduce((sum, log) => sum + log.durationMins, 0);
  const unplannedMins = logs.filter((log) => !log.scheduleBlockId).reduce((sum, log) => sum + log.durationMins, 0);
  const alignment = plannedMins > 0 ? Math.round((actualMins / plannedMins) * 100) : actualMins > 0 ? 100 : 0;
  return { plannedMins, actualMins, unplannedMins, alignment, blockCount: blocks.length, logCount: logs.length };
}

/** A block is eligible for rollover when it's still `planned`, has no linked
 * actual minutes, and its end time has passed (past date, or today past end_time). */
export function isPendingRolloverBlock(
  block: ScheduleBlock,
  today: string,
  nowMinutes: number,
  hasLinkedActualMins = false,
): boolean {
  if (block.status !== 'planned') return false;
  if (hasLinkedActualMins) return false;
  if (block.scheduledDate < today) return true;
  if (block.scheduledDate === today) return timeToMinutes(block.endTime) <= nowMinutes;
  return false;
}

export type IntentionFilter = 'all' | 'recurring' | 'one-off' | 'archived';
export type IntentionSort = 'category' | 'duration-desc' | 'duration-asc' | 'recent';

/** Filter + sort the intentions list. `category` sort falls back to 'zzz' so
 * uncategorized items land last alphabetically. */
export function filterSortIntentions(
  intentions: Intention[],
  options: { filter: IntentionFilter; search: string; sort: IntentionSort },
  categories: Category[],
): Intention[] {
  const { filter, search, sort } = options;
  const query = search.trim().toLowerCase();
  let items = intentions.filter((item) => {
    if (filter === 'recurring') return item.isRecurring;
    if (filter === 'one-off') return !item.isRecurring;
    return true;
  });
  if (query) items = items.filter((item) => `${item.title} ${item.notes ?? ''}`.toLowerCase().includes(query));
  const categoryName = (item: Intention) => categories.find((category) => category.id === item.categoryId)?.name ?? 'zzz';
  if (sort === 'duration-desc') items = [...items].sort((a, b) => (b.defaultDurationMins ?? 0) - (a.defaultDurationMins ?? 0));
  if (sort === 'duration-asc') items = [...items].sort((a, b) => (a.defaultDurationMins ?? 9999) - (b.defaultDurationMins ?? 9999));
  if (sort === 'recent') items = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (sort === 'category') items = [...items].sort((a, b) => categoryName(a).localeCompare(categoryName(b)) || a.title.localeCompare(b.title));
  return items;
}

/** Group intentions by category id, sorted by category name with "Uncategorized" last. */
export function groupIntentionsByCategory(
  filtered: Intention[],
  categories: Category[],
): [string, Intention[]][] {
  const map = new Map<string, Intention[]>();
  for (const item of filtered) {
    const key = item.categoryId ?? 'uncategorized';
    map.set(key, [...(map.get(key) ?? []), item]);
  }
  return [...map.entries()].sort(([a], [b]) => {
    const an = a === 'uncategorized' ? 'zzz' : categories.find((category) => category.id === a)?.name ?? 'zzz';
    const bn = b === 'uncategorized' ? 'zzz' : categories.find((category) => category.id === b)?.name ?? 'zzz';
    return an.localeCompare(bn);
  });
}


