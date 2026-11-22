import type {
  AnalyticsSnapshot,
  CategoryVariance,
  DailyCategorySlice,
  DailyRhythmDay,
  DriftSession,
  EstimationDrift,
  MoodBucket,
  ReflectionEntry,
  RolloverEvent,
  RolloverStats,
  TaskDrift,
} from '@/types/analytics';
import type { Category, Intention, ScheduleBlock, TimeLog, TimeLogMood } from '@/types/database';
import { capacityForWeekday, type WeeklyCapacity } from '@/utils/capacity';
import { enrichLogs } from '@/utils/enrich';
import { isPendingRolloverBlock } from '@/utils/planner';
import { isoWeekdayISO, todayISO } from '@/utils/time';

const UNCATEGORIZED = { id: null, name: 'Uncategorized', colorHex: '#78716c' };

function plannedStatuses(block: ScheduleBlock): boolean {
  return block.status === 'planned' || block.status === 'completed' || block.status === 'missed';
}

function linkedActualMins(blockId: string, logs: TimeLog[]): number {
  return logs
    .filter((log) => log.scheduleBlockId === blockId)
    .reduce((sum, log) => sum + log.durationMins, 0);
}

function driftGrade(avgAbsPct: number | null): string {
  if (avgAbsPct == null) return '—';
  if (avgAbsPct <= 10) return 'A';
  if (avgAbsPct <= 20) return 'B';
  if (avgAbsPct <= 35) return 'C';
  return 'D';
}

function buildDrift(
  blocks: ScheduleBlock[],
  logs: TimeLog[],
  intentions: Intention[],
): EstimationDrift {
  const taskMap = new Map(intentions.map((task) => [task.id, task]));
  const sessions: DriftSession[] = [];
  for (const block of blocks) {
    if (!plannedStatuses(block)) continue;
    const actual = linkedActualMins(block.id, logs);
    if (actual <= 0) continue;
    sessions.push({
      blockId: block.id,
      taskId: block.taskId,
      taskTitle: taskMap.get(block.taskId)?.title ?? 'Unknown task',
      plannedMins: block.plannedDurationMins,
      actualMins: actual,
      varianceMins: actual - block.plannedDurationMins,
    });
  }

  const totalVariance = sessions.reduce((sum, s) => sum + s.varianceMins, 0);
  const totalAbs = sessions.reduce((sum, s) => sum + Math.abs(s.varianceMins), 0);
  const avgPlanned = sessions.length > 0
    ? sessions.reduce((sum, s) => sum + s.plannedMins, 0) / sessions.length
    : 0;
  const avgAbsPct = avgPlanned > 0 ? (totalAbs / sessions.length / avgPlanned) * 100 : null;

  const byTask = new Map<string, DriftSession[]>();
  for (const session of sessions) {
    byTask.set(session.taskId, [...(byTask.get(session.taskId) ?? []), session]);
  }
  const tasks: TaskDrift[] = [...byTask.entries()]
    .map(([taskId, list]) => {
      const avgVariance = list.reduce((sum, s) => sum + s.varianceMins, 0) / list.length;
      const avgAbs = list.reduce((sum, s) => sum + Math.abs(s.varianceMins), 0) / list.length;
      const avgPlannedForTask = list.reduce((sum, s) => sum + s.plannedMins, 0) / list.length;
      const pct = avgPlannedForTask > 0 ? avgVariance / avgPlannedForTask : 0;
      let bias: TaskDrift['bias'] = 'insufficient';
      if (list.length >= 2) {
        if (pct <= -0.15) bias = 'overestimated';
        else if (pct >= 0.15) bias = 'underestimated';
        else bias = 'spot-on';
      }
      return {
        taskId,
        title: taskMap.get(taskId)?.title ?? 'Unknown task',
        sessions: list.length,
        avgVarianceMins: Math.round(avgVariance),
        avgAbsVarianceMins: Math.round(avgAbs),
        bias,
      };
    })
    .sort((a, b) => b.avgAbsVarianceMins - a.avgAbsVarianceMins);

  return {
    sessions: sessions.length,
    avgVarianceMins: sessions.length > 0 ? Math.round(totalVariance / sessions.length) : 0,
    avgAbsVarianceMins: sessions.length > 0 ? Math.round(totalAbs / sessions.length) : 0,
    grade: driftGrade(avgAbsPct),
    tasks,
    recentSessions: [...sessions].sort((a, b) => b.blockId.localeCompare(a.blockId)).slice(0, 10),
  };
}

function buildInsights(input: {
  plannedMins: number;
  actualMins: number;
  unplannedMins: number;
  capacityUtilizationPct: number | null;
  categories: CategoryVariance[];
  drift: EstimationDrift;
  rollover: RolloverStats;
  moodCount: number;
}): string[] {
  const insights: string[] = [];
  const { plannedMins, actualMins, unplannedMins, capacityUtilizationPct, categories, drift, rollover } = input;

  if (plannedMins > 0 && actualMins > 0) {
    const ratio = actualMins / plannedMins;
    if (ratio < 0.7) insights.push('You tracked substantially less than you planned this week — the gap is intent drift, not failure.');
    else if (ratio > 1.3) insights.push('Reality exceeded intent this week — either ambitious planning or unplanned depth.');
    else insights.push('Planned and actual time are well aligned this week.');
  }

  if (capacityUtilizationPct != null && capacityUtilizationPct > 100) {
    insights.push(`Planned workload is ${capacityUtilizationPct}% of weekly capacity — consider trimming before rollover debt accumulates.`);
  } else if (capacityUtilizationPct != null && capacityUtilizationPct > 0 && capacityUtilizationPct < 40) {
    insights.push('The week is lightly loaded relative to capacity — room for one more recurring habit.');
  }

  const worst = categories.filter((c) => c.tendency === 'under-realized').sort((a, b) => (a.realizationPct ?? 0) - (b.realizationPct ?? 0))[0];
  if (worst && worst.plannedMins >= 60) {
    insights.push(`${worst.name} is consistently under-realized (${worst.realizationPct ?? 0}% of plan) — shrink the blocks or protect the time.`);
  }

  const chronic = drift.tasks.find((t) => t.bias === 'underestimated' || t.bias === 'overestimated');
  if (chronic && drift.sessions >= 3) {
    insights.push(
      chronic.bias === 'underestimated'
        ? `${chronic.title} repeatedly takes longer than planned (~${Math.abs(chronic.avgVarianceMins)}m over) — pad future estimates.`
        : `${chronic.title} repeatedly finishes early (~${Math.abs(chronic.avgVarianceMins)}m under) — tighten estimates to free capacity.`,
    );
  } else if (drift.sessions > 0) {
    insights.push(`Estimation drift grade ${drift.grade} across ${drift.sessions} logged sessions.`);
  }

  const rolloverTotal = rollover.rolledCount + rollover.dismissedCount + rollover.missedCount;
  if (rolloverTotal > 0) {
    insights.push(`${rolloverTotal} blocks needed rollover, dismissal, or were missed — review whether capacity or timing caused the pile-up.`);
  }

  if (unplannedMins > actualMins * 0.4 && actualMins > 0) {
    insights.push('A large share of tracked time was spontaneous — consider whether recurring intentions should absorb it.');
  }

  if (insights.length === 0) {
    insights.push('Not enough data yet — log a few days to unlock reflection insights.');
  }
  return insights.slice(0, 6);
}

export function buildAnalyticsSnapshot(input: {
  weekDates: string[];
  allBlocks: ScheduleBlock[];
  allLogs: TimeLog[];
  intentions: Intention[];
  categories: Category[];
  capacity: WeeklyCapacity;
  now?: Date;
}): AnalyticsSnapshot {
  const { weekDates, allBlocks, allLogs, intentions, categories, capacity } = input;
  const now = input.now ?? new Date();
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];
  const inWeek = (date: string) => date >= weekStart && date <= weekEnd;
  const throughWeekEnd = (date: string) => date <= weekEnd;

  const weekBlocks = allBlocks.filter((block) => inWeek(block.scheduledDate));
  const historyBlocks = allBlocks.filter((block) => throughWeekEnd(block.scheduledDate));
  const weekLogs = allLogs.filter((log) => inWeek(log.logDate));
  const historyLogs = allLogs.filter((log) => throughWeekEnd(log.logDate));
  const enrichedWeekLogs = enrichLogs(weekLogs, intentions, categories);

  const capacityMins = weekDates.reduce((sum, date) => {
    return sum + capacityForWeekday(capacity, isoWeekdayISO(date));
  }, 0);

  const plannedMins = weekBlocks.filter(plannedStatuses).reduce((sum, b) => sum + b.plannedDurationMins, 0);
  const actualMins = weekLogs.reduce((sum, log) => sum + log.durationMins, 0);
  const unplannedMins = weekLogs.filter((log) => !log.scheduleBlockId || log.isAdHoc).reduce((sum, log) => sum + log.durationMins, 0);
  const adHocMins = weekLogs.filter((log) => log.isAdHoc).reduce((sum, log) => sum + log.durationMins, 0);

  // Category variance: planned via block task category; actual via log resolution order.
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const catKey = (id: string | null) => id ?? 'none';
  const plannedByCat = new Map<string, { planned: number; id: string | null }>();
  const taskMap = new Map(intentions.map((t) => [t.id, t]));
  for (const block of weekBlocks.filter(plannedStatuses)) {
    const catId = taskMap.get(block.taskId)?.categoryId ?? null;
    const key = catKey(catId);
    const entry = plannedByCat.get(key) ?? { planned: 0, id: catId };
    entry.planned += block.plannedDurationMins;
    plannedByCat.set(key, entry);
  }
  const actualByCat = new Map<string, number>();
  for (const log of enrichedWeekLogs) {
    const resolved = log.categoryId ?? log.task?.categoryId ?? null;
    const key = catKey(resolved);
    actualByCat.set(key, (actualByCat.get(key) ?? 0) + log.durationMins);
  }
  const allCatKeys = new Set([...plannedByCat.keys(), ...actualByCat.keys()]);
  const categoryVariance: CategoryVariance[] = [...allCatKeys]
    .map((key) => {
      const planned = plannedByCat.get(key)?.planned ?? 0;
      const actual = actualByCat.get(key) ?? 0;
      const catId = plannedByCat.get(key)?.id ?? (key === 'none' ? null : key);
      const category = catId ? categoryMap.get(catId) : undefined;
      const variance = actual - planned;
      const realizationPct = planned > 0 ? Math.round((actual / planned) * 100) : null;
      let tendency: CategoryVariance['tendency'] = 'insufficient';
      if (planned > 0) {
        const ratio = actual / planned;
        tendency = ratio < 0.7 ? 'under-realized' : ratio > 1.3 ? 'over-realized' : 'on-track';
      } else if (actual > 0) {
        tendency = 'over-realized';
      }
      return {
        categoryId: catId,
        name: category?.name ?? UNCATEGORIZED.name,
        colorHex: category?.colorHex ?? UNCATEGORIZED.colorHex,
        plannedMins: planned,
        actualMins: actual,
        varianceMins: variance,
        variancePct: planned > 0 ? Math.round((variance / planned) * 100) : null,
        realizationPct,
        tendency,
      };
    })
    .sort((a, b) => b.actualMins - a.actualMins);

  const dailyRhythm: DailyRhythmDay[] = weekDates.map((date) => ({
    date,
    isoWeekday: isoWeekdayISO(date),
    plannedMins: weekBlocks.filter((b) => b.scheduledDate === date && plannedStatuses(b)).reduce((s, b) => s + b.plannedDurationMins, 0),
    actualMins: weekLogs.filter((l) => l.logDate === date).reduce((s, l) => s + l.durationMins, 0),
  }));

  const categoryStack: DailyCategorySlice[] = weekDates.flatMap((date) => {
    const dayLogs = enrichedWeekLogs.filter((log) => log.logDate === date);
    const byCat = new Map<string, { id: string | null; minutes: number }>();
    for (const log of dayLogs) {
      const resolved = log.categoryId ?? log.task?.categoryId ?? null;
      const key = catKey(resolved);
      const entry = byCat.get(key) ?? { id: resolved, minutes: 0 };
      entry.minutes += log.durationMins;
      byCat.set(key, entry);
    }
    return [...byCat.entries()].map(([, entry]) => {
      const category = entry.id ? categoryMap.get(entry.id) : undefined;
      return {
        date,
        categoryId: entry.id,
        name: category?.name ?? UNCATEGORIZED.name,
        colorHex: category?.colorHex ?? UNCATEGORIZED.colorHex,
        minutes: entry.minutes,
      };
    });
  });

  // Rollover stats over the displayed week.
  const today = todayISO();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const actualByBlock = new Map<string, number>();
  for (const log of allLogs) {
    if (!log.scheduleBlockId) continue;
    actualByBlock.set(log.scheduleBlockId, (actualByBlock.get(log.scheduleBlockId) ?? 0) + log.durationMins);
  }
  const taskTitle = (block: ScheduleBlock) => taskMap.get(block.taskId)?.title ?? 'Planned block';
  const events: RolloverEvent[] = [];
  let pendingCount = 0;
  let pendingMins = 0;
  for (const block of weekBlocks) {
    if (block.status === 'rolled' || block.status === 'dismissed' || block.status === 'missed') {
      events.push({ blockId: block.id, taskTitle: taskTitle(block), scheduledDate: block.scheduledDate, status: block.status, minutes: block.plannedDurationMins });
    } else if (isPendingRolloverBlock(block, today, nowMinutes, (actualByBlock.get(block.id) ?? 0) > 0)) {
      pendingCount += 1;
      pendingMins += block.plannedDurationMins;
    }
  }
  const rollover: RolloverStats = {
    rolledCount: events.filter((e) => e.status === 'rolled').length,
    dismissedCount: events.filter((e) => e.status === 'dismissed').length,
    missedCount: events.filter((e) => e.status === 'missed').length,
    pendingCount,
    rolledMins: events.filter((e) => e.status === 'rolled').reduce((s, e) => s + e.minutes, 0),
    dismissedMins: events.filter((e) => e.status === 'dismissed').reduce((s, e) => s + e.minutes, 0),
    missedMins: events.filter((e) => e.status === 'missed').reduce((s, e) => s + e.minutes, 0),
    pendingMins,
    events: events.sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate)).slice(0, 20),
  };

  const moodMap = new Map<TimeLogMood, { count: number; minutes: number }>();
  for (const log of weekLogs) {
    if (!log.mood) continue;
    const entry = moodMap.get(log.mood) ?? { count: 0, minutes: 0 };
    entry.count += 1;
    entry.minutes += log.durationMins;
    moodMap.set(log.mood, entry);
  }
  const moods: MoodBucket[] = [...moodMap.entries()].map(([mood, v]) => ({ mood, ...v }));

  const reflections: ReflectionEntry[] = enrichedWeekLogs
    .filter((log) => log.notes || log.mood)
    .sort((a, b) => b.logDate.localeCompare(a.logDate) || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    .slice(0, 8)
    .map((log) => ({
      logId: log.id,
      logDate: log.logDate,
      title: log.displayTitle,
      mood: log.mood,
      notes: log.notes ?? '',
      minutes: log.durationMins,
    }));

  const drift = buildDrift(historyBlocks, historyLogs, intentions);
  const capacityUtilizationPct = capacityMins > 0 ? Math.round((plannedMins / capacityMins) * 100) : null;
  const pacingFidelityPct = plannedMins > 0 ? Math.round((actualMins / plannedMins) * 100) : null;

  const snapshotBase = {
    weekStart,
    weekEnd,
    plannedMins,
    actualMins,
    unplannedMins,
    adHocMins,
    blockCount: weekBlocks.filter(plannedStatuses).length,
    logCount: weekLogs.length,
    capacityMins,
    capacityUtilizationPct,
    pacingFidelityPct,
    categories: categoryVariance,
    dailyRhythm,
    categoryStack,
    drift,
    rollover,
    moods,
    reflections,
  };

  return {
    ...snapshotBase,
    insights: buildInsights({
      plannedMins,
      actualMins,
      unplannedMins,
      capacityUtilizationPct,
      categories: categoryVariance,
      drift,
      rollover,
      moodCount: moods.length,
    }),
  };
}

export function weeklyCsvRows(input: {
  weekDates: string[];
  blocks: ScheduleBlock[];
  logs: TimeLog[];
  intentions: Intention[];
}): Record<string, string | number | null>[] {
  const { weekDates, blocks, logs, intentions } = input;
  const taskMap = new Map(intentions.map((t) => [t.id, t]));
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];
  const weekBlocks = blocks
    .filter((b) => b.scheduledDate >= weekStart && b.scheduledDate <= weekEnd)
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.startTime.localeCompare(b.startTime));

  return weekBlocks.map((block) => {
    const task = taskMap.get(block.taskId);
    const linked = logs.filter((log) => log.scheduleBlockId === block.id);
    const actual = linked.reduce((sum, log) => sum + log.durationMins, 0);
    return {
      week_start: weekStart,
      week_end: weekEnd,
      date: block.scheduledDate,
      weekday: isoWeekdayISO(block.scheduledDate),
      start_time: block.startTime,
      end_time: block.endTime,
      planned_minutes: block.plannedDurationMins,
      status: block.status,
      task_title: task?.title ?? 'Unknown task',
      task_id: block.taskId,
      category_id: task?.categoryId ?? null,
      is_recurring: task?.isRecurring ? 1 : 0,
      target_sessions_per_week: task?.targetSessionsPerWeek ?? null,
      actual_minutes: actual,
      variance_minutes: actual > 0 ? actual - block.plannedDurationMins : null,
      rolled_from_block_id: block.rolledFromBlockId,
      notes: block.notes,
    };
  });
}
