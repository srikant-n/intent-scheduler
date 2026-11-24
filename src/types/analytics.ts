import type { TimeLogMood } from '@/types/database';

/** Derived analytics types produced by `buildAnalyticsSnapshot` — none of these
 * are persisted; they're computed on demand for the Time Analytics page. */

export type DriftBias = 'underestimated' | 'overestimated' | 'spot-on' | 'insufficient';
export type Tendency = 'under-realized' | 'over-realized' | 'on-track' | 'insufficient';

/** Planned vs actual minutes for one category, with a tendency label
 * (under-realized <70%, over-realized >130%, else on-track). */
export interface CategoryVariance {
  categoryId: string | null;
  name: string;
  colorHex: string;
  plannedMins: number;
  actualMins: number;
  varianceMins: number;
  variancePct: number | null;
  realizationPct: number | null;
  tendency: Tendency;
}

export interface DailyRhythmDay {
  date: string;
  isoWeekday: number;
  plannedMins: number;
  actualMins: number;
}

export interface DailyCategorySlice {
  date: string;
  categoryId: string | null;
  name: string;
  colorHex: string;
  minutes: number;
}

/** One planned-vs-actual comparison for a single schedule block that has logs. */
export interface DriftSession {
  blockId: string;
  taskId: string;
  taskTitle: string;
  plannedMins: number;
  actualMins: number;
  varianceMins: number;
}

/** Per-task estimation bias across all sessions up to the analyzed week. */
export interface TaskDrift {
  taskId: string;
  title: string;
  sessions: number;
  avgVarianceMins: number;
  avgAbsVarianceMins: number;
  bias: DriftBias;
}

/** Aggregate estimation-drift report: session stats, letter grade, per-task bias, recent sessions. */
export interface EstimationDrift {
  sessions: number;
  avgVarianceMins: number;
  avgAbsVarianceMins: number;
  grade: string;
  tasks: TaskDrift[];
  recentSessions: DriftSession[];
}

/** A block that was rolled to a later date, dismissed, or missed. */
export interface RolloverEvent {
  blockId: string;
  taskTitle: string;
  scheduledDate: string;
  status: 'rolled' | 'dismissed' | 'missed';
  minutes: number;
}

/** Rollover outcomes for the week: resolved events plus still-pending blocks. */
export interface RolloverStats {
  rolledCount: number;
  dismissedCount: number;
  missedCount: number;
  pendingCount: number;
  rolledMins: number;
  dismissedMins: number;
  missedMins: number;
  pendingMins: number;
  events: RolloverEvent[];
}

/** Log count + minutes grouped by mood tag. */
export interface MoodBucket {
  mood: TimeLogMood;
  count: number;
  minutes: number;
}

/** A log entry surfaced in the reflections feed (has notes or a mood tag). */
export interface ReflectionEntry {
  logId: string;
  logDate: string;
  title: string;
  mood: TimeLogMood | null;
  notes: string;
  minutes: number;
}

/** Everything the Time Analytics page renders for one week — see buildAnalyticsSnapshot. */
export interface AnalyticsSnapshot {
  weekStart: string;
  weekEnd: string;
  plannedMins: number;
  actualMins: number;
  unplannedMins: number;
  adHocMins: number;
  blockCount: number;
  logCount: number;
  capacityMins: number;
  capacityUtilizationPct: number | null;
  pacingFidelityPct: number | null;
  categories: CategoryVariance[];
  dailyRhythm: DailyRhythmDay[];
  categoryStack: DailyCategorySlice[];
  drift: EstimationDrift;
  rollover: RolloverStats;
  moods: MoodBucket[];
  reflections: ReflectionEntry[];
  insights: string[];
}
