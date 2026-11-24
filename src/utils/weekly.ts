import type { Category, Intention, ScheduleBlock, TimeLog } from '@/types/database';
import { capacityForWeekday, type WeeklyCapacity } from '@/utils/capacity';
import { isoWeekdayISO } from '@/utils/time';

/** Per-day rollup for the weekly planner: planned vs actual vs unplanned minutes,
 * capacity utilization, and count of blocks awaiting rollover. */
export interface WeeklyDaySummary {
  date: string;
  isoWeekday: number;
  plannedMins: number;
  actualMins: number;
  unplannedMins: number;
  capacityMins: number;
  utilizationPct: number | null;
  blockCount: number;
  pendingRolloverCount: number;
}

/** Planned-vs-actual minutes aggregated per category across the week. */
export interface WeeklyCategoryBalance {
  categoryId: string | null;
  name: string;
  colorHex: string;
  plannedMins: number;
  actualMins: number;
}

/** Full weekly aggregate powering the WeekSummary panel and capacity/habit modals. */
export interface WeeklySummary {
  days: WeeklyDaySummary[];
  totalPlannedMins: number;
  totalActualMins: number;
  totalUnplannedMins: number;
  totalCapacityMins: number;
  utilizationPct: number | null;
  pacingFidelityPct: number | null;
  blockCount: number;
  pendingRolloverCount: number;
  categoryBalance: WeeklyCategoryBalance[];
  habitAdherence: { plannedSessions: number; fulfilledSessions: number; pct: number | null };
}

/** A block counts toward the week while it's planned, completed, or missed —
 * dismissed and rolled blocks are excluded (rolled blocks live on a later date). */
function plannedBlock(block: ScheduleBlock): boolean {
  return block.status === 'planned' || block.status === 'completed' || block.status === 'missed';
}

/** Aggregate a Mon–Sun week of blocks + logs into day summaries, totals,
 * per-category balance, and habit adherence for recurring intentions. */
export function buildWeeklySummary(input: {
  weekDates: string[];
  blocks: ScheduleBlock[];
  logs: TimeLog[];
  intentions: Intention[];
  categories: Category[];
  capacity: WeeklyCapacity;
  pendingBlockIds?: Set<string>;
}): WeeklySummary {
  const { weekDates, blocks, logs, intentions, categories, capacity, pendingBlockIds } = input;
  const taskMap = new Map(intentions.map((t) => [t.id, t]));
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const uncategorized = { name: 'Uncategorized', colorHex: '#78716c' };

  const days: WeeklyDaySummary[] = weekDates.map((date) => {
    const dayBlocks = blocks.filter((b) => b.scheduledDate === date);
    const dayLogs = logs.filter((l) => l.logDate === date);
    const plannedMins = dayBlocks.filter(plannedBlock).reduce((s, b) => s + b.plannedDurationMins, 0);
    const actualMins = dayLogs.reduce((s, l) => s + l.durationMins, 0);
    const unplannedMins = dayLogs.filter((l) => !l.scheduleBlockId || l.isAdHoc).reduce((s, l) => s + l.durationMins, 0);
    const capacityMins = capacityForWeekday(capacity, isoWeekdayISO(date));
    const pendingRolloverCount = dayBlocks.filter((b) => pendingBlockIds?.has(b.id)).length;
    return {
      date,
      isoWeekday: isoWeekdayISO(date),
      plannedMins,
      actualMins,
      unplannedMins,
      capacityMins,
      utilizationPct: capacityMins > 0 ? Math.round((plannedMins / capacityMins) * 100) : null,
      blockCount: dayBlocks.filter(plannedBlock).length,
      pendingRolloverCount,
    };
  });

  const totalPlannedMins = days.reduce((s, d) => s + d.plannedMins, 0);
  const totalActualMins = days.reduce((s, d) => s + d.actualMins, 0);
  const totalUnplannedMins = days.reduce((s, d) => s + d.unplannedMins, 0);
  const totalCapacityMins = days.reduce((s, d) => s + d.capacityMins, 0);

  const plannedByCat = new Map<string, number>();
  const actualByCat = new Map<string, number>();
  for (const block of blocks.filter(plannedBlock)) {
    const catId = taskMap.get(block.taskId)?.categoryId ?? null;
    const key = catId ?? 'none';
    plannedByCat.set(key, (plannedByCat.get(key) ?? 0) + block.plannedDurationMins);
  }
  for (const log of logs) {
    const task = log.taskId ? taskMap.get(log.taskId) : undefined;
    const catId = log.categoryId ?? task?.categoryId ?? null;
    const key = catId ?? 'none';
    actualByCat.set(key, (actualByCat.get(key) ?? 0) + log.durationMins);
  }
  const catKeys = new Set([...plannedByCat.keys(), ...actualByCat.keys()]);
  const categoryBalance: WeeklyCategoryBalance[] = [...catKeys]
    .map((key) => {
      const catId = key === 'none' ? null : key;
      const category = catId ? categoryMap.get(catId) : undefined;
      return {
        categoryId: catId,
        name: category?.name ?? uncategorized.name,
        colorHex: category?.colorHex ?? uncategorized.colorHex,
        plannedMins: plannedByCat.get(key) ?? 0,
        actualMins: actualByCat.get(key) ?? 0,
      };
    })
    .sort((a, b) => b.plannedMins + b.actualMins - (a.plannedMins + a.actualMins));

  // Habit adherence: recurring intentions' planned sessions vs completed sessions.
  const recurring = new Set(intentions.filter((t) => t.isRecurring).map((t) => t.id));
  const habitBlocks = blocks.filter((b) => recurring.has(b.taskId) && plannedBlock(b));
  const plannedSessions = habitBlocks.length;
  const fulfilledSessions = habitBlocks.filter((b) => b.status === 'completed').length;

  return {
    days,
    totalPlannedMins,
    totalActualMins,
    totalUnplannedMins,
    totalCapacityMins,
    utilizationPct: totalCapacityMins > 0 ? Math.round((totalPlannedMins / totalCapacityMins) * 100) : null,
    pacingFidelityPct: totalPlannedMins > 0 ? Math.round((totalActualMins / totalPlannedMins) * 100) : null,
    blockCount: blocks.filter(plannedBlock).length,
    pendingRolloverCount: days.reduce((s, d) => s + d.pendingRolloverCount, 0),
    categoryBalance,
    habitAdherence: {
      plannedSessions,
      fulfilledSessions,
      pct: plannedSessions > 0 ? Math.round((fulfilledSessions / plannedSessions) * 100) : null,
    },
  };
}
