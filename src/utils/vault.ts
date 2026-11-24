import type { EnrichedTimeLog } from '@/types/database';
import { isValidISODate, isValidTime } from '@/utils/time';

// Vault = the app's JSON backup format. Versioned so future schema changes can
// be detected on import. Field names use snake_case to mirror DB columns.
export const VAULT_SCHEMA_VERSION = 1;

export type VaultRow = Record<string, unknown>;

export interface VaultPayload {
  metadata: {
    schemaVersion: number;
    exportedAt: string;
    appVersion: string;
  };
  data: {
    settings: VaultRow[];
    categories: VaultRow[];
    tasks: VaultRow[];
    scheduleBlocks: VaultRow[];
    timeLogs: VaultRow[];
  };
}

export interface VaultDataCounts {
  settings: number;
  categories: number;
  tasks: number;
  scheduleBlocks: number;
  timeLogs: number;
}

const TABLE_KEYS = ['settings', 'categories', 'tasks', 'scheduleBlocks', 'timeLogs'] as const;

// Allowed enum values mirrored from the DB schema — validated on import so bad
// payloads fail before touching SQLite.
const TASK_STATUSES = new Set(['active', 'archived']);
const BLOCK_STATUSES = new Set(['planned', 'completed', 'missed', 'dismissed', 'rolled']);
const MOODS = new Set(['restorative', 'energizing', 'distraction', 'firefight']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === 'string';
}

function isInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isNullableInt(value: unknown): boolean {
  return value === null || isInt(value);
}

function rowLabel(table: string, index: number, row: VaultRow): string {
  const id = typeof row.id === 'string' && row.id ? row.id : `row ${index + 1}`;
  return `${table}[${id}]`;
}

function checkString(row: VaultRow, field: string, issues: string[], label: string, required = true) {
  const value = row[field];
  if (required ? !isNonEmptyString(value) : !isNullableString(value)) {
    issues.push(`${label}: "${field}" must be ${required ? 'a non-empty string' : 'a string or null'}`);
  }
}

function validateSettings(rows: VaultRow[], issues: string[]) {
  rows.forEach((row, index) => {
    const label = rowLabel('settings', index, row);
    checkString(row, 'key', issues, label);
    if (typeof row.value !== 'string') issues.push(`${label}: "value" must be a string`);
    checkString(row, 'updated_at', issues, label);
  });
}

function validateCategories(rows: VaultRow[], issues: string[]) {
  rows.forEach((row, index) => {
    const label = rowLabel('categories', index, row);
    checkString(row, 'id', issues, label);
    checkString(row, 'name', issues, label);
    checkString(row, 'color_hex', issues, label);
    checkString(row, 'created_at', issues, label);
  });
}

function validateTasks(rows: VaultRow[], categoryIds: Set<string>, issues: string[]) {
  rows.forEach((row, index) => {
    const label = rowLabel('tasks', index, row);
    checkString(row, 'id', issues, label);
    checkString(row, 'title', issues, label);
    checkString(row, 'status', issues, label);
    if (typeof row.status === 'string' && !TASK_STATUSES.has(row.status)) {
      issues.push(`${label}: "status" must be one of ${[...TASK_STATUSES].join(', ')}`);
    }
    if (row.is_recurring !== 0 && row.is_recurring !== 1) issues.push(`${label}: "is_recurring" must be 0 or 1`);
    if (!isNullableInt(row.default_duration_mins)) issues.push(`${label}: "default_duration_mins" must be an integer or null`);
    if (!isNullableInt(row.target_sessions_per_week)) issues.push(`${label}: "target_sessions_per_week" must be an integer or null`);
    if (typeof row.preferred_weekdays !== 'string') issues.push(`${label}: "preferred_weekdays" must be a string`);
    checkString(row, 'created_at', issues, label);
    checkString(row, 'notes', issues, label, false);
    checkString(row, 'priority', issues, label, false);
    const categoryId = row.category_id;
    if (categoryId !== null && categoryId !== undefined && (typeof categoryId !== 'string' || !categoryIds.has(categoryId))) {
      issues.push(`${label}: "category_id" references a missing category`);
    }
  });
}

function validateScheduleBlocks(rows: VaultRow[], taskIds: Set<string>, issues: string[]) {
  rows.forEach((row, index) => {
    const label = rowLabel('scheduleBlocks', index, row);
    checkString(row, 'id', issues, label);
    if (typeof row.task_id !== 'string' || !taskIds.has(row.task_id)) {
      issues.push(`${label}: "task_id" references a missing task`);
    }
    if (typeof row.scheduled_date !== 'string' || !isValidISODate(row.scheduled_date)) {
      issues.push(`${label}: "scheduled_date" must be YYYY-MM-DD`);
    }
    if (typeof row.start_time !== 'string' || !isValidTime(row.start_time)) {
      issues.push(`${label}: "start_time" must be HH:MM`);
    }
    if (typeof row.end_time !== 'string' || !isValidTime(row.end_time)) {
      issues.push(`${label}: "end_time" must be HH:MM`);
    }
    if (!isInt(row.planned_duration_mins) || (row.planned_duration_mins as number) <= 0) {
      issues.push(`${label}: "planned_duration_mins" must be a positive integer`);
    }
    if (typeof row.status === 'string' && !BLOCK_STATUSES.has(row.status)) {
      issues.push(`${label}: "status" must be one of ${[...BLOCK_STATUSES].join(', ')}`);
    }
    checkString(row, 'created_at', issues, label);
    checkString(row, 'notes', issues, label, false);
    if (row.rolled_from_block_id !== null && row.rolled_from_block_id !== undefined && typeof row.rolled_from_block_id !== 'string') {
      issues.push(`${label}: "rolled_from_block_id" must be a string or null`);
    }
  });
}

function validateTimeLogs(rows: VaultRow[], taskIds: Set<string>, blockIds: Set<string>, categoryIds: Set<string>, issues: string[]) {
  rows.forEach((row, index) => {
    const label = rowLabel('timeLogs', index, row);
    checkString(row, 'id', issues, label);
    if (row.task_id !== null && row.task_id !== undefined && (typeof row.task_id !== 'string' || !taskIds.has(row.task_id))) {
      issues.push(`${label}: "task_id" references a missing task`);
    }
    if (row.schedule_block_id !== null && row.schedule_block_id !== undefined && (typeof row.schedule_block_id !== 'string' || !blockIds.has(row.schedule_block_id))) {
      issues.push(`${label}: "schedule_block_id" references a missing schedule block`);
    }
    if (row.category_id !== null && row.category_id !== undefined && (typeof row.category_id !== 'string' || !categoryIds.has(row.category_id))) {
      issues.push(`${label}: "category_id" references a missing category`);
    }
    if (typeof row.log_date !== 'string' || !isValidISODate(row.log_date)) {
      issues.push(`${label}: "log_date" must be YYYY-MM-DD`);
    }
    if (row.start_time !== null && row.start_time !== undefined && (typeof row.start_time !== 'string' || !isValidTime(row.start_time))) {
      issues.push(`${label}: "start_time" must be HH:MM or null`);
    }
    if (row.end_time !== null && row.end_time !== undefined && (typeof row.end_time !== 'string' || !isValidTime(row.end_time))) {
      issues.push(`${label}: "end_time" must be HH:MM or null`);
    }
    if (!isInt(row.duration_mins) || (row.duration_mins as number) <= 0) {
      issues.push(`${label}: "duration_mins" must be a positive integer`);
    }
    if (row.is_ad_hoc !== 0 && row.is_ad_hoc !== 1) issues.push(`${label}: "is_ad_hoc" must be 0 or 1`);
    if (row.mood !== null && row.mood !== undefined && (typeof row.mood !== 'string' || !MOODS.has(row.mood))) {
      issues.push(`${label}: "mood" must be one of ${[...MOODS].join(', ')}`);
    }
    checkString(row, 'created_at', issues, label);
    checkString(row, 'custom_title', issues, label, false);
    checkString(row, 'notes', issues, label, false);
  });
}

/** Collect human-readable validation issues for the relational `data` section
 * (referential integrity, enums, formats). Empty array = valid. */
export function vaultRowIssues(data: VaultPayload['data']): string[] {
  const issues: string[] = [];
  const categoryIds = new Set(data.categories.map((row) => row.id).filter((id): id is string => typeof id === 'string'));
  const taskIds = new Set(data.tasks.map((row) => row.id).filter((id): id is string => typeof id === 'string'));
  const blockIds = new Set(data.scheduleBlocks.map((row) => row.id).filter((id): id is string => typeof id === 'string'));

  validateSettings(data.settings, issues);
  validateCategories(data.categories, issues);
  validateTasks(data.tasks, categoryIds, issues);
  validateScheduleBlocks(data.scheduleBlocks, taskIds, issues);
  validateTimeLogs(data.timeLogs, taskIds, blockIds, categoryIds, issues);
  return issues;
}

/** Validate a full parsed vault file: metadata (schemaVersion etc.) plus every
 * table's shape and rows. Returns all issues found, not just the first. */
export function vaultPayloadIssues(payload: unknown): string[] {
  const issues: string[] = [];
  if (!isRecord(payload)) return ['File is not a JSON object'];

  const metadata = payload.metadata;
  if (!isRecord(metadata)) {
    issues.push('Missing "metadata" object');
  } else {
    if (metadata.schemaVersion !== VAULT_SCHEMA_VERSION) {
      issues.push(`Unsupported schemaVersion ${String(metadata.schemaVersion)} (expected ${VAULT_SCHEMA_VERSION})`);
    }
    if (!isNonEmptyString(metadata.exportedAt)) issues.push('"metadata.exportedAt" must be a string');
    if (!isNonEmptyString(metadata.appVersion)) issues.push('"metadata.appVersion" must be a string');
  }

  const data = payload.data;
  if (!isRecord(data)) {
    issues.push('Missing "data" object');
    return issues;
  }
  for (const key of TABLE_KEYS) {
    if (!Array.isArray(data[key])) {
      issues.push(`"data.${key}" must be an array`);
      return issues;
    }
    const rows = data[key] as unknown[];
    rows.forEach((row, index) => {
      if (!isRecord(row)) issues.push(`data.${key}[${index}] is not an object`);
    });
    if (issues.length > 0) return issues;
  }

  return [...issues, ...vaultRowIssues(data as unknown as VaultPayload['data'])];
}

/** Parse + validate raw JSON text into a VaultPayload. `issues` is non-empty when invalid. */
export function parseVaultJson(text: string): { payload: VaultPayload; issues: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { payload: null as unknown as VaultPayload, issues: [`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`] };
  }
  const issues = vaultPayloadIssues(parsed);
  return { payload: parsed as VaultPayload, issues };
}

/** Row counts per table, used by the export preview and vault health card. */
export function vaultCounts(data: VaultPayload['data']): VaultDataCounts {
  return {
    settings: data.settings.length,
    categories: data.categories.length,
    tasks: data.tasks.length,
    scheduleBlocks: data.scheduleBlocks.length,
    timeLogs: data.timeLogs.length,
  };
}

/** Assemble the export payload: metadata envelope + the five data sections. */
export function buildVaultPayload(input: {
  settings: VaultRow[];
  categories: VaultRow[];
  tasks: VaultRow[];
  scheduleBlocks: VaultRow[];
  timeLogs: VaultRow[];
  exportedAt?: string;
  appVersion?: string;
}): VaultPayload {
  return {
    metadata: {
      schemaVersion: VAULT_SCHEMA_VERSION,
      exportedAt: input.exportedAt ?? new Date().toISOString(),
      appVersion: input.appVersion ?? '0.1.0',
    },
    data: {
      settings: input.settings,
      categories: input.categories,
      tasks: input.tasks,
      scheduleBlocks: input.scheduleBlocks,
      timeLogs: input.timeLogs,
    },
  };
}

/** Flatten an enriched log into the CSV column set used by the time-logs export. */
export function vaultLogToCsvRow(log: EnrichedTimeLog): Record<string, string | number | null> {
  return {
    id: log.id,
    log_date: log.logDate,
    start_time: log.startTime,
    end_time: log.endTime,
    title: log.displayTitle,
    category: log.displayCategory?.name ?? null,
    duration_mins: log.durationMins,
    mood: log.mood,
    is_ad_hoc: log.isAdHoc ? 1 : 0,
    notes: log.notes,
    task_id: log.taskId,
    schedule_block_id: log.scheduleBlockId,
    created_at: log.createdAt,
  };
}

/** Human-readable byte size (B/KB/MB/GB) for export estimates. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = units[0];
  for (let i = 1; i < units.length && value >= 1024; i++) {
    value /= 1024;
    unit = units[i];
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${unit}`;
}
