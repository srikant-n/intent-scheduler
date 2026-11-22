export type ThemeMode = 'light' | 'dark' | 'system';
export type AccentPreset = 'ember' | 'indigo' | 'emerald' | 'rose' | 'violet';
export type TaskStatus = 'active' | 'archived';
export type ScheduleStatus = 'planned' | 'completed' | 'missed' | 'dismissed' | 'rolled';
export type TimeLogMood = 'restorative' | 'energizing' | 'distraction' | 'firefight';

export interface Category {
  id: string;
  name: string;
  colorHex: string;
  createdAt: string;
}

export interface Intention {
  id: string;
  title: string;
  categoryId: string | null;
  isRecurring: boolean;
  defaultDurationMins: number | null;
  status: TaskStatus;
  notes: string | null;
  priority: string | null;
  createdAt: string;
}

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

export interface EnrichedScheduleBlock extends ScheduleBlock {
  task?: Intention;
}

export interface EnrichedTimeLog extends TimeLog {
  task?: Intention;
  category?: Category;
  displayTitle: string;
  displayCategory?: Category;
}
