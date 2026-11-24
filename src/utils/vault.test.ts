// Unit tests for the vault pipeline: JSON parse/validate, payload building,
// record counts, byte formatting, and CSV row serialization.
import { describe, expect, it } from 'vitest';
import {
  buildVaultPayload,
  formatBytes,
  parseVaultJson,
  vaultCounts,
  vaultLogToCsvRow,
  vaultPayloadIssues,
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
  return buildVaultPayload({ ...VALID_DATA, exportedAt: '2026-11-22T00:00:00Z', appVersion: '0.1.0' });
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
  });
});

describe('formatBytes', () => {
  it('formats sizes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(3.5 * 1024 * 1024)).toBe('3.5 MB');
  });
});
