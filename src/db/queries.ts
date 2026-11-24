import {
  ActiveTimerState,
  AppSetting,
  Category,
  Intention,
  ScheduleBlock,
  ScheduleStatus,
  TaskStatus,
  TimeLog,
  TimeLogMood,
} from '@/types/database';
import { isValidISODate, isValidTime, uuid } from '@/utils/time';
import { buildVaultPayload, vaultPayloadIssues, type VaultPayload, type VaultRow } from '@/utils/vault';
import { invoke } from '@tauri-apps/api/core';
import pkg from '../../package.json';
import { executeSql, selectRows } from './client';

function nowIso(): string {
  return new Date().toISOString();
}

interface CategoryRow {
  id: string;
  name: string;
  color_hex: string;
  created_at: string;
}

interface TaskRow {
  id: string;
  title: string;
  category_id: string | null;
  is_recurring: number;
  default_duration_mins: number | null;
  target_sessions_per_week: number | null;
  preferred_weekdays: string | null;
  status: string;
  notes: string | null;
  priority: string | null;
  created_at: string;
}

const TASK_COLUMNS =
  'id, title, category_id, is_recurring, default_duration_mins, target_sessions_per_week, preferred_weekdays, status, notes, priority, created_at';

interface ScheduleBlockRow {
  id: string;
  task_id: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  planned_duration_mins: number;
  notes: string | null;
  status: string;
  rolled_from_block_id: string | null;
  created_at: string;
}

interface TimeLogRow {
  id: string;
  task_id: string | null;
  schedule_block_id: string | null;
  custom_title: string | null;
  category_id: string | null;
  log_date: string;
  start_time: string | null;
  end_time: string | null;
  duration_mins: number;
  notes: string | null;
  mood: string | null;
  is_ad_hoc: number;
  created_at: string;
}

interface SettingRow {
  key: string;
  value: string;
  updated_at: string;
}

function mapCategory(row: CategoryRow): Category {
  return { id: row.id, name: row.name, colorHex: row.color_hex, createdAt: row.created_at };
}

function parsePreferredWeekdays(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((day): day is number => Number.isInteger(day) && day >= 1 && day <= 7);
  } catch {
    return [];
  }
}

function mapTask(row: TaskRow): Intention {
  return {
    id: row.id,
    title: row.title,
    categoryId: row.category_id,
    isRecurring: row.is_recurring === 1,
    defaultDurationMins: row.default_duration_mins,
    targetSessionsPerWeek: row.target_sessions_per_week,
    preferredWeekdays: parsePreferredWeekdays(row.preferred_weekdays),
    status: row.status as TaskStatus,
    notes: row.notes,
    priority: row.priority,
    createdAt: row.created_at,
  };
}

function mapScheduleBlock(row: ScheduleBlockRow): ScheduleBlock {
  return {
    id: row.id,
    taskId: row.task_id,
    scheduledDate: row.scheduled_date,
    startTime: row.start_time,
    endTime: row.end_time,
    plannedDurationMins: row.planned_duration_mins,
    notes: row.notes,
    status: row.status as ScheduleStatus,
    rolledFromBlockId: row.rolled_from_block_id,
    createdAt: row.created_at,
  };
}

function mapTimeLog(row: TimeLogRow): TimeLog {
  return {
    id: row.id,
    taskId: row.task_id,
    scheduleBlockId: row.schedule_block_id,
    customTitle: row.custom_title,
    categoryId: row.category_id,
    logDate: row.log_date,
    startTime: row.start_time,
    endTime: row.end_time,
    durationMins: row.duration_mins,
    notes: row.notes,
    mood: row.mood as TimeLogMood | null,
    isAdHoc: row.is_ad_hoc === 1,
    createdAt: row.created_at,
  };
}

function assertDate(value: string) {
  if (!isValidISODate(value)) throw new Error(`Invalid date: ${value}`);
}

function assertTime(value: string) {
  if (!isValidTime(value)) throw new Error(`Invalid time: ${value}`);
}

function assertPositiveInt(value: number, label: string) {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer`);
}

export async function getSetting(key: string): Promise<string | null> {
  const rows = await selectRows<SettingRow>('SELECT key, value, updated_at FROM app_settings WHERE key = $1', [key]);
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await executeSql(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ($1, $2, $3)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value, nowIso()],
  );
}

export async function getAllSettings(): Promise<AppSetting[]> {
  const rows = await selectRows<SettingRow>('SELECT key, value, updated_at FROM app_settings ORDER BY key');
  return rows.map((row) => ({ key: row.key, value: row.value, updatedAt: row.updated_at }));
}

export async function listCategories(): Promise<Category[]> {
  const rows = await selectRows<CategoryRow>('SELECT id, name, color_hex, created_at FROM categories ORDER BY name COLLATE NOCASE');
  return rows.map(mapCategory);
}

export async function createCategory(input: { name: string; colorHex: string }): Promise<Category> {
  const name = input.name.trim();
  if (!name) throw new Error('Category name is required');
  const id = uuid();
  const createdAt = nowIso();
  await executeSql('INSERT INTO categories (id, name, color_hex, created_at) VALUES ($1, $2, $3, $4)', [
    id,
    name,
    input.colorHex,
    createdAt,
  ]);
  return { id, name, colorHex: input.colorHex, createdAt };
}

export async function updateCategory(id: string, input: { name: string; colorHex: string }): Promise<void> {
  const name = input.name.trim();
  if (!name) throw new Error('Category name is required');
  await executeSql('UPDATE categories SET name = $1, color_hex = $2 WHERE id = $3', [name, input.colorHex, id]);
}

export async function deleteCategory(id: string): Promise<void> {
  await executeSql('DELETE FROM categories WHERE id = $1', [id]);
}

export async function listIntentions(status: TaskStatus = 'active'): Promise<Intention[]> {
  const rows = await selectRows<TaskRow>(
    `SELECT ${TASK_COLUMNS} FROM tasks WHERE status = $1 ORDER BY created_at DESC`,
    [status],
  );
  return rows.map(mapTask);
}

export async function listAllIntentions(): Promise<Intention[]> {
  const rows = await selectRows<TaskRow>(`SELECT ${TASK_COLUMNS} FROM tasks ORDER BY created_at DESC`);
  return rows.map(mapTask);
}

export async function createIntention(input: {
  title: string;
  categoryId: string | null;
  isRecurring: boolean;
  defaultDurationMins: number | null;
  targetSessionsPerWeek?: number | null;
  preferredWeekdays?: number[];
  notes?: string | null;
  priority?: string | null;
}): Promise<Intention> {
  const title = input.title.trim();
  if (!title) throw new Error('Intention title is required');
  if (input.defaultDurationMins != null) assertPositiveInt(input.defaultDurationMins, 'Default duration');
  if (input.targetSessionsPerWeek != null) assertPositiveInt(input.targetSessionsPerWeek, 'Target sessions per week');
  const id = uuid();
  const createdAt = nowIso();
  const preferredWeekdays = input.isRecurring ? JSON.stringify(input.preferredWeekdays ?? []) : '[]';
  const targetSessions = input.isRecurring ? (input.targetSessionsPerWeek ?? null) : null;
  await executeSql(
    `INSERT INTO tasks (id, title, category_id, is_recurring, default_duration_mins, target_sessions_per_week, preferred_weekdays, status, notes, priority, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $9, $10)`,
    [id, title, input.categoryId, input.isRecurring ? 1 : 0, input.defaultDurationMins, targetSessions, preferredWeekdays, input.notes ?? null, input.priority ?? null, createdAt],
  );
  return {
    id,
    title,
    categoryId: input.categoryId,
    isRecurring: input.isRecurring,
    defaultDurationMins: input.defaultDurationMins,
    targetSessionsPerWeek: targetSessions,
    preferredWeekdays: input.isRecurring ? (input.preferredWeekdays ?? []) : [],
    status: 'active',
    notes: input.notes ?? null,
    priority: input.priority ?? null,
    createdAt,
  };
}

export async function updateIntention(
  id: string,
  input: {
    title: string;
    categoryId: string | null;
    isRecurring: boolean;
    defaultDurationMins: number | null;
    targetSessionsPerWeek?: number | null;
    preferredWeekdays?: number[];
    notes?: string | null;
    priority?: string | null;
    status?: TaskStatus;
  },
): Promise<void> {
  const title = input.title.trim();
  if (!title) throw new Error('Intention title is required');
  if (input.defaultDurationMins != null) assertPositiveInt(input.defaultDurationMins, 'Default duration');
  if (input.targetSessionsPerWeek != null) assertPositiveInt(input.targetSessionsPerWeek, 'Target sessions per week');
  const preferredWeekdays = input.isRecurring ? JSON.stringify(input.preferredWeekdays ?? []) : '[]';
  const targetSessions = input.isRecurring ? (input.targetSessionsPerWeek ?? null) : null;
  await executeSql(
    `UPDATE tasks
     SET title = $1, category_id = $2, is_recurring = $3, default_duration_mins = $4, target_sessions_per_week = $5, preferred_weekdays = $6, notes = $7, priority = $8, status = $9
     WHERE id = $10`,
    [title, input.categoryId, input.isRecurring ? 1 : 0, input.defaultDurationMins, targetSessions, preferredWeekdays, input.notes ?? null, input.priority ?? null, input.status ?? 'active', id],
  );
}

export async function archiveIntention(id: string): Promise<void> {
  await executeSql("UPDATE tasks SET status = 'archived' WHERE id = $1", [id]);
}

export async function restoreIntention(id: string): Promise<void> {
  await executeSql("UPDATE tasks SET status = 'active' WHERE id = $1", [id]);
}

export async function deleteIntention(id: string): Promise<void> {
  await executeSql('UPDATE time_logs SET schedule_block_id = NULL WHERE schedule_block_id IN (SELECT id FROM schedule_blocks WHERE task_id = $1)', [id]);
  await executeSql('UPDATE time_logs SET task_id = NULL WHERE task_id = $1', [id]);
  await executeSql('DELETE FROM schedule_blocks WHERE task_id = $1', [id]);
  await executeSql('DELETE FROM tasks WHERE id = $1', [id]);
}

export async function listScheduleBlocks(date: string): Promise<ScheduleBlock[]> {
  assertDate(date);
  const rows = await selectRows<ScheduleBlockRow>(
    'SELECT id, task_id, scheduled_date, start_time, end_time, planned_duration_mins, notes, status, rolled_from_block_id, created_at FROM schedule_blocks WHERE scheduled_date = $1 ORDER BY start_time',
    [date],
  );
  return rows.map(mapScheduleBlock);
}

export async function listScheduleBlocksRange(startDate: string, endDate: string): Promise<ScheduleBlock[]> {
  assertDate(startDate);
  assertDate(endDate);
  const rows = await selectRows<ScheduleBlockRow>(
    `SELECT id, task_id, scheduled_date, start_time, end_time, planned_duration_mins, notes, status, rolled_from_block_id, created_at
     FROM schedule_blocks WHERE scheduled_date >= $1 AND scheduled_date <= $2 ORDER BY scheduled_date, start_time`,
    [startDate, endDate],
  );
  return rows.map(mapScheduleBlock);
}

export async function createScheduleBlock(input: {
  taskId: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  plannedDurationMins: number;
  notes?: string | null;
  status?: ScheduleStatus;
  rolledFromBlockId?: string | null;
}): Promise<ScheduleBlock> {
  assertDate(input.scheduledDate);
  assertTime(input.startTime);
  assertTime(input.endTime);
  assertPositiveInt(input.plannedDurationMins, 'Planned duration');
  const id = uuid();
  const createdAt = nowIso();
  await executeSql(
    `INSERT INTO schedule_blocks (id, task_id, scheduled_date, start_time, end_time, planned_duration_mins, notes, status, rolled_from_block_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [id, input.taskId, input.scheduledDate, input.startTime, input.endTime, input.plannedDurationMins, input.notes ?? null, input.status ?? 'planned', input.rolledFromBlockId ?? null, createdAt],
  );
  return {
    id,
    taskId: input.taskId,
    scheduledDate: input.scheduledDate,
    startTime: input.startTime,
    endTime: input.endTime,
    plannedDurationMins: input.plannedDurationMins,
    notes: input.notes ?? null,
    status: input.status ?? 'planned',
    rolledFromBlockId: input.rolledFromBlockId ?? null,
    createdAt,
  };
}

export async function updateScheduleBlock(
  id: string,
  input: Partial<{
    taskId: string;
    scheduledDate: string;
    startTime: string;
    endTime: string;
    plannedDurationMins: number;
    notes: string | null;
    status: ScheduleStatus;
    rolledFromBlockId: string | null;
  }>,
): Promise<void> {
  const current = await selectRows<ScheduleBlockRow>(
    'SELECT id, task_id, scheduled_date, start_time, end_time, planned_duration_mins, notes, status, rolled_from_block_id, created_at FROM schedule_blocks WHERE id = $1',
    [id],
  );
  if (!current[0]) throw new Error('Schedule block not found');
  const row = current[0];
  const next = {
    taskId: input.taskId ?? row.task_id,
    scheduledDate: input.scheduledDate ?? row.scheduled_date,
    startTime: input.startTime ?? row.start_time,
    endTime: input.endTime ?? row.end_time,
    plannedDurationMins: input.plannedDurationMins ?? row.planned_duration_mins,
    notes: input.notes === undefined ? row.notes : input.notes,
    status: input.status ?? (row.status as ScheduleStatus),
    rolledFromBlockId: input.rolledFromBlockId === undefined ? row.rolled_from_block_id : input.rolledFromBlockId,
  };
  assertDate(next.scheduledDate);
  assertTime(next.startTime);
  assertTime(next.endTime);
  assertPositiveInt(next.plannedDurationMins, 'Planned duration');
  await executeSql(
    `UPDATE schedule_blocks
     SET task_id = $1, scheduled_date = $2, start_time = $3, end_time = $4, planned_duration_mins = $5, notes = $6, status = $7, rolled_from_block_id = $8
     WHERE id = $9`,
    [next.taskId, next.scheduledDate, next.startTime, next.endTime, next.plannedDurationMins, next.notes, next.status, next.rolledFromBlockId, id],
  );
}

export async function deleteScheduleBlock(id: string): Promise<void> {
  await executeSql('DELETE FROM schedule_blocks WHERE id = $1', [id]);
}

export async function runBatchActions<T>(
  items: T[],
  action: (item: T) => Promise<void>,
): Promise<{ succeeded: T[]; failed: { item: T; error: string }[] }> {
  const succeeded: T[] = [];
  const failed: { item: T; error: string }[] = [];
  for (const item of items) {
    try {
      await action(item);
      succeeded.push(item);
    } catch (error) {
      failed.push({ item, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { succeeded, failed };
}

export async function listTimeLogs(date: string): Promise<TimeLog[]> {
  assertDate(date);
  const rows = await selectRows<TimeLogRow>(
    'SELECT id, task_id, schedule_block_id, custom_title, category_id, log_date, start_time, end_time, duration_mins, notes, mood, is_ad_hoc, created_at FROM time_logs WHERE log_date = $1 ORDER BY COALESCE(start_time, created_at), created_at',
    [date],
  );
  return rows.map(mapTimeLog);
}

export async function listTimeLogsRange(startDate: string, endDate: string): Promise<TimeLog[]> {
  assertDate(startDate);
  assertDate(endDate);
  const rows = await selectRows<TimeLogRow>(
    `SELECT id, task_id, schedule_block_id, custom_title, category_id, log_date, start_time, end_time, duration_mins, notes, mood, is_ad_hoc, created_at
     FROM time_logs WHERE log_date >= $1 AND log_date <= $2 ORDER BY log_date, COALESCE(start_time, created_at), created_at`,
    [startDate, endDate],
  );
  return rows.map(mapTimeLog);
}

export async function createTimeLog(input: {
  taskId?: string | null;
  scheduleBlockId?: string | null;
  customTitle?: string | null;
  categoryId?: string | null;
  logDate: string;
  startTime?: string | null;
  endTime?: string | null;
  durationMins: number;
  notes?: string | null;
  mood?: TimeLogMood | null;
  isAdHoc?: boolean;
}): Promise<TimeLog> {
  assertDate(input.logDate);
  if (input.startTime) assertTime(input.startTime);
  if (input.endTime) assertTime(input.endTime);
  assertPositiveInt(input.durationMins, 'Duration');
  const id = uuid();
  const createdAt = nowIso();
  const isAdHoc = input.isAdHoc ?? (!input.taskId && !input.scheduleBlockId);
  await executeSql(
    `INSERT INTO time_logs (id, task_id, schedule_block_id, custom_title, category_id, log_date, start_time, end_time, duration_mins, notes, mood, is_ad_hoc, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      id,
      input.taskId ?? null,
      input.scheduleBlockId ?? null,
      input.customTitle ?? null,
      input.categoryId ?? null,
      input.logDate,
      input.startTime ?? null,
      input.endTime ?? null,
      input.durationMins,
      input.notes ?? null,
      input.mood ?? null,
      isAdHoc ? 1 : 0,
      createdAt,
    ],
  );
  return {
    id,
    taskId: input.taskId ?? null,
    scheduleBlockId: input.scheduleBlockId ?? null,
    customTitle: input.customTitle ?? null,
    categoryId: input.categoryId ?? null,
    logDate: input.logDate,
    startTime: input.startTime ?? null,
    endTime: input.endTime ?? null,
    durationMins: input.durationMins,
    notes: input.notes ?? null,
    mood: input.mood ?? null,
    isAdHoc,
    createdAt,
  };
}

export async function updateTimeLog(
  id: string,
  input: Partial<{
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
  }>,
): Promise<void> {
  const rows = await selectRows<TimeLogRow>(
    'SELECT id, task_id, schedule_block_id, custom_title, category_id, log_date, start_time, end_time, duration_mins, notes, mood, is_ad_hoc, created_at FROM time_logs WHERE id = $1',
    [id],
  );
  if (!rows[0]) throw new Error('Time log not found');
  const row = rows[0];
  const next = {
    taskId: input.taskId === undefined ? row.task_id : input.taskId,
    scheduleBlockId: input.scheduleBlockId === undefined ? row.schedule_block_id : input.scheduleBlockId,
    customTitle: input.customTitle === undefined ? row.custom_title : input.customTitle,
    categoryId: input.categoryId === undefined ? row.category_id : input.categoryId,
    logDate: input.logDate ?? row.log_date,
    startTime: input.startTime === undefined ? row.start_time : input.startTime,
    endTime: input.endTime === undefined ? row.end_time : input.endTime,
    durationMins: input.durationMins ?? row.duration_mins,
    notes: input.notes === undefined ? row.notes : input.notes,
    mood: input.mood === undefined ? (row.mood as TimeLogMood | null) : input.mood,
    isAdHoc: input.isAdHoc === undefined ? row.is_ad_hoc === 1 : input.isAdHoc,
  };
  assertDate(next.logDate);
  if (next.startTime) assertTime(next.startTime);
  if (next.endTime) assertTime(next.endTime);
  assertPositiveInt(next.durationMins, 'Duration');
  await executeSql(
    `UPDATE time_logs
     SET task_id = $1, schedule_block_id = $2, custom_title = $3, category_id = $4, log_date = $5, start_time = $6, end_time = $7, duration_mins = $8, notes = $9, mood = $10, is_ad_hoc = $11
     WHERE id = $12`,
    [next.taskId, next.scheduleBlockId, next.customTitle, next.categoryId, next.logDate, next.startTime, next.endTime, next.durationMins, next.notes, next.mood, next.isAdHoc ? 1 : 0, id],
  );
}

export async function deleteTimeLog(id: string): Promise<void> {
  await executeSql('DELETE FROM time_logs WHERE id = $1', [id]);
}

export async function getActiveTimer(): Promise<ActiveTimerState | null> {
  const raw = await getSetting('active_timer');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ActiveTimerState;
    return parsed?.id ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveActiveTimer(timer: ActiveTimerState | null): Promise<void> {
  await setSetting('active_timer', timer ? JSON.stringify(timer) : 'null');
}

const DEFAULT_CATEGORIES = [
  { name: 'Health & Movement', colorHex: '#059669' },
  { name: 'Deep Learning', colorHex: '#4f46e5' },
  { name: 'Indie Projects', colorHex: '#ea580c' },
  { name: 'Daily Errands', colorHex: '#d97706' },
  { name: 'Rest & Play', colorHex: '#8b5cf6' },
];

export interface VaultCounts {
  blocks: number;
  logs: number;
  tasks: number;
  categories: number;
  settings: number;
}

export async function getVaultCounts(): Promise<VaultCounts> {
  const count = async (table: string) => {
    const rows = await selectRows<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table}`);
    return rows[0]?.count ?? 0;
  };
  const [blocks, logs, tasks, categories, settings] = await Promise.all([
    count('schedule_blocks'),
    count('time_logs'),
    count('tasks'),
    count('categories'),
    count('app_settings'),
  ]);
  return { blocks, logs, tasks, categories, settings };
}

const ALLOWED_PRAGMAS = new Set([
  'journal_mode',
  'synchronous',
  'cache_size',
  'foreign_keys',
  'auto_vacuum',
  'page_size',
  'encoding',
]);

export async function getPragmaValue(name: string): Promise<string> {
  if (!ALLOWED_PRAGMAS.has(name)) throw new Error(`PRAGMA ${name} is not allowed`);
  const rows = await selectRows<Record<string, unknown>>(`PRAGMA ${name}`);
  const row = rows[0];
  if (!row) return '';
  const value = Object.values(row)[0];
  return value == null ? '' : String(value);
}

export async function runIntegrityCheck(): Promise<string> {
  const rows = await selectRows<Record<string, unknown>>('PRAGMA integrity_check');
  const messages = rows.map((row) => String(Object.values(row)[0] ?? '')).filter(Boolean);
  return messages.length === 0 ? 'ok' : messages.join('; ');
}

export async function vacuumDatabase(): Promise<void> {
  await executeSql('VACUUM');
}

export async function exportVaultPayload(): Promise<VaultPayload> {
  const [settings, categories, tasks, scheduleBlocks, timeLogs] = await Promise.all([
    selectRows<VaultRow>('SELECT key, value, updated_at FROM app_settings ORDER BY key'),
    selectRows<VaultRow>('SELECT id, name, color_hex, created_at FROM categories ORDER BY name'),
    selectRows<VaultRow>(`SELECT ${TASK_COLUMNS} FROM tasks ORDER BY created_at`),
    selectRows<VaultRow>(
      'SELECT id, task_id, scheduled_date, start_time, end_time, planned_duration_mins, notes, status, rolled_from_block_id, created_at FROM schedule_blocks ORDER BY scheduled_date, start_time',
    ),
    selectRows<VaultRow>(
      'SELECT id, task_id, schedule_block_id, custom_title, category_id, log_date, start_time, end_time, duration_mins, notes, mood, is_ad_hoc, created_at FROM time_logs ORDER BY log_date, created_at',
    ),
  ]);
  return buildVaultPayload({
    settings,
    categories,
    tasks,
    scheduleBlocks,
    timeLogs,
    appVersion: pkg.version,
  });
}

export type VaultImportMode = 'merge' | 'replace';

export interface VaultImportStats {
  tables: { table: string; attempted: number; written: number }[];
}

export async function importVaultPayload(payload: VaultPayload, mode: VaultImportMode): Promise<VaultImportStats> {
  const issues = vaultPayloadIssues(payload);
  if (issues.length > 0) {
    throw new Error(`Vault payload failed validation:\n${issues.slice(0, 10).join('\n')}${issues.length > 10 ? `\n…and ${issues.length - 10} more` : ''}`);
  }
  // The actual write runs in a single Rust transaction (plugin-sql's pool
  // cannot span BEGIN/COMMIT across separate execute calls).
  const raw = await invoke<{ tables: [string, { attempted: number; written: number }][] }>('import_vault', {
    data: payload.data,
    mode,
  });
  return {
    tables: raw.tables.map(([table, stats]) => ({ table, ...stats })),
  };
}

export async function recordVaultEvent(kind: 'export' | 'import'): Promise<void> {
  await setSetting(`vault_last_${kind}_at`, nowIso());
}

export async function clearVaultData(): Promise<void> {
  // The actual delete runs in a single Rust transaction so partial wipes
  // are impossible (plugin-sql's pool cannot span BEGIN/COMMIT across calls).
  await invoke('clear_vault');
  resetBootstrapDatabase();
}

export function resetBootstrapDatabase(): void {
  bootstrapPromise = null;
}

const DEFAULT_SETTINGS: Record<string, string> = {
  theme_mode: 'system',
  accent_color: 'ember',
  snap_interval_minutes: '15',
  day_start_hour: '6',
  day_end_hour: '22',
  weekly_capacity_minutes: JSON.stringify({ 1: 360, 2: 360, 3: 360, 4: 360, 5: 360, 6: 240, 7: 180 }),
};

let bootstrapPromise: Promise<void> | null = null;

export function bootstrapDatabase(): Promise<void> {
  bootstrapPromise ??= bootstrapDatabaseInternal().catch((error) => {
    bootstrapPromise = null;
    throw error;
  });
  return bootstrapPromise;
}

async function bootstrapDatabaseInternal(): Promise<void> {
  const categoriesSeeded = await getSetting('categories_seeded');
  if (categoriesSeeded == null) {
    for (const category of DEFAULT_CATEGORIES) {
      const existing = await selectRows<{ id: string }>('SELECT id FROM categories WHERE name = $1', [category.name]);
      if (!existing[0]) await createCategory(category);
    }
    await setSetting('categories_seeded', '1');
  }

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    const existing = await getSetting(key);
    if (existing == null) await setSetting(key, value);
  }
}
