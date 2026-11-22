import type { TimeLogMood } from '@/types/database';

export type DriftBias = 'underestimated' | 'overestimated' | 'spot-on' | 'insufficient';
export type Tendency = 'under-realized' | 'over-realized' | 'on-track' | 'insufficient';

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

export interface DriftSession {
  blockId: string;
  taskId: string;
  taskTitle: string;
  plannedMins: number;
  actualMins: number;
  varianceMins: number;
}

export interface TaskDrift {
  taskId: string;
  title: string;
  sessions: number;
  avgVarianceMins: number;
  avgAbsVarianceMins: number;
  bias: DriftBias;
}

export interface EstimationDrift {
  sessions: number;
  avgVarianceMins: number;
  avgAbsVarianceMins: number;
  grade: string;
  tasks: TaskDrift[];
  recentSessions: DriftSession[];
}

export interface RolloverEvent {
  blockId: string;
  taskTitle: string;
  scheduledDate: string;
  status: 'rolled' | 'dismissed' | 'missed';
  minutes: number;
}

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

export interface MoodBucket {
  mood: TimeLogMood;
  count: number;
  minutes: number;
}

export interface ReflectionEntry {
  logId: string;
  logDate: string;
  title: string;
  mood: TimeLogMood | null;
  notes: string;
  minutes: number;
}

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
