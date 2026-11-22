import type {
  Category,
  EnrichedScheduleBlock,
  EnrichedTimeLog,
  Intention,
  ScheduleBlock,
  TimeLog,
} from '@/types/database';
import { timeToMinutes } from '@/utils/time';

export interface DailySummary {
  plannedMins: number;
  actualMins: number;
  unplannedMins: number;
  alignment: number;
  blockCount: number;
  logCount: number;
}

export function computeDailySummary(blocks: ScheduleBlock[], logs: TimeLog[]): DailySummary {
  const plannedMins = blocks
    .filter((block) => block.status !== 'dismissed' && block.status !== 'rolled')
    .reduce((sum, block) => sum + block.plannedDurationMins, 0);
  const actualMins = logs.reduce((sum, log) => sum + log.durationMins, 0);
  const unplannedMins = logs.filter((log) => !log.scheduleBlockId).reduce((sum, log) => sum + log.durationMins, 0);
  const alignment = plannedMins > 0 ? Math.round((actualMins / plannedMins) * 100) : actualMins > 0 ? 100 : 0;
  return { plannedMins, actualMins, unplannedMins, alignment, blockCount: blocks.length, logCount: logs.length };
}

export function isPendingRolloverBlock(block: ScheduleBlock, today: string, nowMinutes: number): boolean {
  if (block.status !== 'planned') return false;
  if (block.scheduledDate < today) return true;
  if (block.scheduledDate === today) return timeToMinutes(block.endTime) <= nowMinutes;
  return false;
}

export type IntentionFilter = 'all' | 'recurring' | 'one-off' | 'archived';
export type IntentionSort = 'category' | 'duration-desc' | 'duration-asc' | 'recent';

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

export function enrichBlocks(blocks: ScheduleBlock[], tasks: Intention[]): EnrichedScheduleBlock[] {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  return blocks.map((block) => ({ ...block, task: taskMap.get(block.taskId) }));
}

export function enrichLogs(logs: TimeLog[], tasks: Intention[], categories: Category[]): EnrichedTimeLog[] {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  return logs.map((log) => {
    const task = log.taskId ? taskMap.get(log.taskId) : undefined;
    const category = categoryMap.get(log.categoryId ?? task?.categoryId ?? '');
    return {
      ...log,
      task,
      category,
      displayCategory: category,
      displayTitle: log.customTitle || task?.title || category?.name || 'Activity',
    };
  });
}
