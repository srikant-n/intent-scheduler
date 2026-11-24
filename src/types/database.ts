// DB row shapes (snake_case columns) mapped to camelCase TS fields.
// Dates are 'YYYY-MM-DD', timestamps ISO-8601, all ids UUID v4 strings.

export type ThemeMode = 'light' | 'dark' | 'system';
export type AccentPreset = 'ember' | 'indigo' | 'emerald' | 'rose' | 'violet' | 'graphite';
export type TaskStatus = 'active' | 'archived';
export type ScheduleStatus = 'planned' | 'completed' | 'missed' | 'dismissed' | 'rolled';
/** Energy/mood tag on a time log, used by analytics reflections. */
export type TimeLogMood = 'restorative' | 'energizing' | 'distraction' | 'firefight';

export interface Category {
  id: string;
  name: string;
  colorHex: string;
  createdAt: string;
}

/** An intention — the "menu" item that can be scheduled. Recurring intentions
 * carry a weekly session target and optional preferred weekdays (ISO 1–7). */
export interface Intention {
  id: string;
  title: string;
  categoryId: string | null;
  isRecurring: boolean;
  defaultDurationMins: number | null;
  targetSessionsPerWeek: number | null;
  preferredWeekdays: number[];
  status: TaskStatus;
  notes: string | null;
  priority: string | null;
  createdAt: string;
}

/** A planned time block (the "intent"). `rolledFromBlockId` preserves lineage
 * when a block is rolled over to a later date. */
export interface ScheduleBlock {
  id: string;
  taskId: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  plannedDurationMins: number;
  notes: string | null;
  status: ScheduleStatus;
  rolledFromBlockId: string | null;
  createdAt: string;
}

/** An actual time log (the "reality"). All link fields are nullable so ad-hoc
 * activities can be logged without an intention or schedule block. */
export interface TimeLog {
  id: string;
  taskId: string | null;
  scheduleBlockId: string | null;
  customTitle: string | null;
  categoryId: string | null;
  logDate: string;
  startTime: string | null;
  endTime: string | null;
  durationMins: number;
  notes: string | null;
  mood: TimeLogMood | null;
  isAdHoc: boolean;
  createdAt: string;
}

export interface AppSetting {
  key: string;
  value: string;
  updatedAt: string;
}

/** Persisted active-timer state (app_settings) so a running timer survives reloads. */
export interface ActiveTimerState {
  id: string;
  taskId: string | null;
  scheduleBlockId: string | null;
  customTitle: string | null;
  categoryId: string | null;
  startedAt: string;
  accumulatedPausedMs: number;
  pausedAt: string | null;
  targetDurationMins: number | null;
  notes: string | null;
}

export interface DailySummary {
  plannedMins: number;
  actualMins: number;
  unplannedMins: number;
  blockCount: number;
  logCount: number;
}

/** Block with its parent task resolved — the shape timeline/planner components consume. */
export interface EnrichedScheduleBlock extends ScheduleBlock {
  task?: Intention;
}

/** Log with resolved task/category plus display fallbacks — see enrichLogs. */
export interface EnrichedTimeLog extends TimeLog {
  task?: Intention;
  category?: Category;
  displayTitle: string;
  displayCategory?: Category;
}
