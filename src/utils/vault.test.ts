// Unit tests for the vault pipeline: JSON parse/validate, payload building,
// record counts, byte formatting, and CSV row serialization.
import { describe, expect, it } from 'vitest';
import {
  VAULT_SCHEMA_VERSION,
  buildVaultPayload,
  formatBytes,
  parseVaultJson,
  vaultCounts,
  vaultLogToCsvRow,
  vaultPayloadIssues,
  vaultRowIssues,
} from './vault';
import type { EnrichedTimeLog } from '@/types/database';

const VALID_DATA = {
  settings: [{ key: 'theme_mode', value: 'dark', updated_at: '2026-01-01T00:00:00Z' }],
  categories: [{ id: 'cat-1', name: 'Health', color_hex: '#059669', created_at: '2026-01-01T00:00:00Z' }],
  tasks: [
    {
      id: 'task-1',
      title: 'Run',
      category_id: 'cat-1',
      is_recurring: 1,
      default_duration_mins: 30,
      target_sessions_per_week: 3,
      preferred_weekdays: '[1,3,5]',
      status: 'active',
      notes: null,
      priority: null,
      created_at: '2026-01-01T00:00:00Z',
    },
  ],
  scheduleBlocks: [
    {
      id: 'block-1',
      task_id: 'task-1',
      scheduled_date: '2026-11-22',
      start_time: '09:00',
      end_time: '09:30',
      planned_duration_mins: 30,
      notes: null,
      status: 'planned',
      rolled_from_block_id: null,
      created_at: '2026-11-21T00:00:00Z',
    },
  ],
  timeLogs: [
    {
      id: 'log-1',
      task_id: 'task-1',
      schedule_block_id: 'block-1',
      custom_title: null,
      category_id: 'cat-1',
      log_date: '2026-11-22',
      start_time: '09:05',
      end_time: '09:35',
      duration_mins: 30,
      notes: null,
      mood: 'energizing',
      is_ad_hoc: 0,
      created_at: '2026-11-22T09:35:00Z',
    },
  ],
};

function validPayload() {
  // Deep-clone: tests mutate rows, and VALID_DATA's nested arrays are shared.
  const data = JSON.parse(JSON.stringify(VALID_DATA)) as typeof VALID_DATA;
  return buildVaultPayload({ ...data, exportedAt: '2026-11-22T00:00:00Z', appVersion: '0.1.0' });
}

describe('parseVaultJson', () => {
  it('accepts a valid payload', () => {
    const { payload, issues } = parseVaultJson(JSON.stringify(validPayload()));
    expect(issues).toEqual([]);
    expect(payload.data.timeLogs).toHaveLength(1);
  });

  it('rejects invalid JSON', () => {
    const { issues } = parseVaultJson('{not json');
    expect(issues[0]).toMatch(/Invalid JSON/);
  });

  it('rejects missing data tables', () => {
    const { issues } = parseVaultJson(JSON.stringify({ metadata: {}, data: { tasks: [] } }));
    expect(issues.join('\n')).toMatch(/data\.categories|data\.settings/);
  });

  it('rejects bad foreign keys', () => {
    const payload = validPayload();
    payload.data.timeLogs[0].task_id = 'missing-task';
    const issues = vaultPayloadIssues(payload);
    expect(issues.join('\n')).toMatch(/references a missing task/);
  });

  it('rejects invalid dates and durations', () => {
    const payload = validPayload();
    payload.data.timeLogs[0].log_date = '22/11/2026';
    payload.data.timeLogs[0].duration_mins = -5;
    const issues = vaultPayloadIssues(payload);
    expect(issues.join('\n')).toMatch(/log_date/);
    expect(issues.join('\n')).toMatch(/duration_mins/);
  });

  it('rejects unsupported schema versions', () => {
    const payload = validPayload();
    payload.metadata.schemaVersion = 99;
    expect(vaultPayloadIssues(payload).join('\n')).toMatch(/schemaVersion/);
  });

  it('rejects non-object payloads and missing sections', () => {
    expect(vaultPayloadIssues(null).join('\n')).toMatch(/not a JSON object/);
    expect(vaultPayloadIssues('string').join('\n')).toMatch(/not a JSON object/);
    expect(vaultPayloadIssues({}).join('\n')).toMatch(/metadata/);
    expect(vaultPayloadIssues({ metadata: {}, data: 'nope' }).join('\n')).toMatch(/data/);
  });

  it('rejects non-array tables and non-object rows', () => {
    const payload = validPayload();
    (payload.data as Record<string, unknown>).categories = 'not-an-array';
    expect(vaultPayloadIssues(payload).join('\n')).toMatch(/data\.categories.*array/);

    const payload2 = validPayload();
    payload2.data.tasks = [42 as never];
    expect(vaultPayloadIssues(payload2).join('\n')).toMatch(/data\.tasks\[0\] is not an object/);
  });

  it('rejects bad enum values', () => {
    const payload = validPayload();
    payload.data.tasks[0].status = 'deleted';
    payload.data.scheduleBlocks[0].status = 'bogus';
    payload.data.timeLogs[0].mood = 'happy';
    payload.data.timeLogs[0].is_ad_hoc = 2;
    payload.data.tasks[0].is_recurring = 5;
    const issues = vaultPayloadIssues(payload).join('\n');
    expect(issues).toMatch(/status.*active, archived/);
    expect(issues).toMatch(/status.*planned, completed/);
    expect(issues).toMatch(/mood/);
    expect(issues).toMatch(/is_ad_hoc/);
    expect(issues).toMatch(/is_recurring/);
  });

  it('rejects dangling block/category references on logs and tasks', () => {
    const payload = validPayload();
    payload.data.timeLogs[0].schedule_block_id = 'missing-block';
    payload.data.timeLogs[0].category_id = 'missing-cat';
    payload.data.tasks[0].category_id = 'missing-cat';
    const issues = vaultPayloadIssues(payload).join('\n');
    expect(issues).toMatch(/schedule_block_id.*missing schedule block/);
    expect(issues).toMatch(/category_id.*missing category/);
  });

  it('rejects malformed times and non-positive durations', () => {
    const payload = validPayload();
    payload.data.scheduleBlocks[0].start_time = '9am';
    payload.data.scheduleBlocks[0].end_time = '25:00';
    payload.data.scheduleBlocks[0].planned_duration_mins = 0;
    payload.data.timeLogs[0].start_time = 'noon';
    const issues = vaultPayloadIssues(payload).join('\n');
    expect(issues).toMatch(/start_time/);
    expect(issues).toMatch(/end_time/);
    expect(issues).toMatch(/planned_duration_mins/);
    expect(issues).toMatch(/duration_mins/);
  });
});

describe('vaultRowIssues', () => {
  it('returns no issues for a valid payload data section', () => {
    const { payload } = parseVaultJson(JSON.stringify(validPayload()));
    expect(vaultRowIssues(payload.data)).toEqual([]);
  });
});

describe('vaultCounts', () => {
  it('counts rows per table', () => {
    expect(vaultCounts(VALID_DATA)).toEqual({ settings: 1, categories: 1, tasks: 1, scheduleBlocks: 1, timeLogs: 1 });
  });
});

describe('vaultLogToCsvRow', () => {
  it('flattens enriched log fields', () => {
    const log = {
      id: 'log-1',
      taskId: 'task-1',
      scheduleBlockId: 'block-1',
      customTitle: null,
      categoryId: 'cat-1',
      logDate: '2026-11-22',
      startTime: '09:05',
      endTime: '09:35',
      durationMins: 30,
      notes: 'note',
      mood: 'energizing',
      isAdHoc: false,
      createdAt: '2026-11-22T09:35:00Z',
      displayTitle: 'Morning Run',
      displayCategory: { id: 'cat-1', name: 'Health', colorHex: '#059669', createdAt: 'x' },
    } as EnrichedTimeLog;
    const row = vaultLogToCsvRow(log);
    expect(row.title).toBe('Morning Run');
    expect(row.category).toBe('Health');
    expect(row.duration_mins).toBe(30);
    expect(row.is_ad_hoc).toBe(0);
    expect(row.id).toBe('log-1');
    expect(row.log_date).toBe('2026-11-22');
    expect(row.start_time).toBe('09:05');
    expect(row.end_time).toBe('09:35');
    expect(row.mood).toBe('energizing');
    expect(row.notes).toBe('note');
    expect(row.task_id).toBe('task-1');
    expect(row.schedule_block_id).toBe('block-1');
    expect(row.created_at).toBe('2026-11-22T09:35:00Z');
  });

  it('emits nulls for missing optional fields', () => {
    const log = {
      id: 'log-2',
      taskId: null,
      scheduleBlockId: null,
      customTitle: 'Ad hoc',
      categoryId: null,
      logDate: '2026-11-22',
      startTime: null,
      endTime: null,
      durationMins: 15,
      notes: null,
      mood: null,
      isAdHoc: true,
      createdAt: 't',
      displayTitle: 'Ad hoc',
      displayCategory: undefined,
    } as EnrichedTimeLog;
    const row = vaultLogToCsvRow(log);
    expect(row.category).toBeNull();
    expect(row.is_ad_hoc).toBe(1);
    expect(row.task_id).toBeNull();
  });
});

describe('buildVaultPayload', () => {
  it('wraps data with schema version and explicit metadata', () => {
    const payload = validPayload();
    expect(payload.metadata.schemaVersion).toBe(VAULT_SCHEMA_VERSION);
    expect(payload.metadata.exportedAt).toBe('2026-11-22T00:00:00Z');
    expect(payload.metadata.appVersion).toBe('0.1.0');
    expect(payload.data.timeLogs).toHaveLength(1);
  });

  it('defaults exportedAt and appVersion when omitted', () => {
    const payload = buildVaultPayload({ ...VALID_DATA });
    expect(payload.metadata.schemaVersion).toBe(VAULT_SCHEMA_VERSION);
    expect(payload.metadata.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(payload.metadata.appVersion).toBe('0.1.0');
  });
});

describe('formatBytes', () => {
  it('formats sizes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(3.5 * 1024 * 1024)).toBe('3.5 MB');
  });

  it('handles zero, invalid, and large values', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(-5)).toBe('0 B');
    expect(formatBytes(NaN)).toBe('0 B');
    expect(formatBytes(Infinity)).toBe('0 B');
    expect(formatBytes(1024 * 1024 * 1024 * 2)).toBe('2.0 GB');
    // values >= 100 in a unit round instead of showing decimals
    expect(formatBytes(150 * 1024)).toBe('150 KB');
  });
});
