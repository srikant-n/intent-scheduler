import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db/client', () => ({
  selectRows: vi.fn(),
  executeSql: vi.fn(),
}));

import { executeSql, selectRows } from '@/db/client';
import {
  archiveIntention,
  createCategory,
  createIntention,
  createScheduleBlock,
  createTimeLog,
  deleteScheduleBlock,
  getActiveTimer,
  getAllSettings,
  getSetting,
  listCategories,
  listIntentions,
  listScheduleBlocks,
  listTimeLogs,
  restoreIntention,
  saveActiveTimer,
  setSetting,
  updateScheduleBlock,
  updateTimeLog,
} from './queries';
import type { ActiveTimerState } from '@/types/database';

const selectRowsMock = vi.mocked(selectRows);
const executeSqlMock = vi.mocked(executeSql);

const VALID_BLOCK_ROW = {
  id: 'block-1',
  task_id: 'task-1',
  scheduled_date: '2026-11-22',
  start_time: '09:00',
  end_time: '10:00',
  planned_duration_mins: 60,
  notes: null,
  status: 'planned',
  rolled_from_block_id: null,
  created_at: '2026-11-22T08:00:00Z',
};

const VALID_LOG_ROW = {
  id: 'log-1',
  task_id: null,
  schedule_block_id: null,
  custom_title: 'Coffee',
  category_id: 'cat-1',
  log_date: '2026-11-22',
  start_time: null,
  end_time: null,
  duration_mins: 30,
  notes: null,
  mood: null,
  is_ad_hoc: 1,
  created_at: '2026-11-22T12:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  executeSqlMock.mockResolvedValue({ rowsAffected: 1 });
  selectRowsMock.mockResolvedValue([]);
});

describe('settings', () => {
  it('getSetting returns value or null', async () => {
    selectRowsMock.mockResolvedValueOnce([{ key: 'theme_mode', value: 'dark', updated_at: 'x' }]);
    await expect(getSetting('theme_mode')).resolves.toBe('dark');
    await expect(getSetting('missing')).resolves.toBeNull();
  });

  it('setSetting upserts key/value/timestamp', async () => {
    await setSetting('theme_mode', 'dark');
    expect(executeSqlMock).toHaveBeenCalledTimes(1);
    const [sql, params] = executeSqlMock.mock.calls[0];
    expect(sql).toContain('ON CONFLICT(key) DO UPDATE');
    expect(params?.[0]).toBe('theme_mode');
    expect(params?.[1]).toBe('dark');
    expect(typeof params?.[2]).toBe('string');
  });

  it('getAllSettings maps rows', async () => {
    selectRowsMock.mockResolvedValueOnce([{ key: 'a', value: '1', updated_at: 't' }]);
    await expect(getAllSettings()).resolves.toEqual([{ key: 'a', value: '1', updatedAt: 't' }]);
  });
});

describe('categories', () => {
  it('listCategories maps snake_case to camelCase', async () => {
    selectRowsMock.mockResolvedValueOnce([{ id: 'c1', name: 'Health', color_hex: '#059669', created_at: 't' }]);
    const rows = await listCategories();
    expect(rows[0]).toEqual({ id: 'c1', name: 'Health', colorHex: '#059669', createdAt: 't' });
  });

  it('createCategory trims name and rejects empty', async () => {
    await expect(createCategory({ name: '   ', colorHex: '#fff' })).rejects.toThrow('Category name is required');
    expect(executeSqlMock).not.toHaveBeenCalled();

    const created = await createCategory({ name: '  Deep Work  ', colorHex: '#4f46e5' });
    expect(created.name).toBe('Deep Work');
    expect(executeSqlMock.mock.calls[0][1]?.[1]).toBe('Deep Work');
  });
});

describe('intentions', () => {
  const baseInput = { title: 'Study', categoryId: 'cat-1', isRecurring: false, defaultDurationMins: 45 };

  it('createIntention validates title and duration', async () => {
    await expect(createIntention({ ...baseInput, title: '  ' })).rejects.toThrow('Intention title is required');
    await expect(createIntention({ ...baseInput, defaultDurationMins: 0 })).rejects.toThrow('positive integer');
    await expect(createIntention({ ...baseInput, defaultDurationMins: 1.5 })).rejects.toThrow('positive integer');
    expect(executeSqlMock).not.toHaveBeenCalled();
  });

  it('createIntention serializes is_recurring as 0/1 and returns mapped object', async () => {
    const created = await createIntention({ ...baseInput, isRecurring: true, notes: 'n', priority: 'high' });
    const params = executeSqlMock.mock.calls[0][1];
    expect(params?.[3]).toBe(1); // is_recurring
    expect(created.isRecurring).toBe(true);
    expect(created.status).toBe('active');
    expect(typeof created.id).toBe('string');
  });

  it('listIntentions filters by status and maps rows', async () => {
    selectRowsMock.mockResolvedValueOnce([
      {
        id: 't1', title: 'X', category_id: 'c', is_recurring: 1, default_duration_mins: 30,
        status: 'active', notes: null, priority: null, created_at: 't',
      },
    ]);
    const rows = await listIntentions('active');
    expect(selectRowsMock.mock.calls[0][1]).toEqual(['active']);
    expect(rows[0].isRecurring).toBe(true);
    expect(rows[0].defaultDurationMins).toBe(30);
  });

  it('archiveIntention/restoreIntention update status', async () => {
    await archiveIntention('t1');
    expect(executeSqlMock.mock.calls[0][1]).toEqual(['t1']);
    expect(executeSqlMock.mock.calls[0][0]).toContain("'archived'");
    await restoreIntention('t1');
    expect(executeSqlMock.mock.calls[1][0]).toContain("'active'");
  });
});

describe('schedule blocks', () => {
  const baseBlock = {
    taskId: 'task-1',
    scheduledDate: '2026-11-22',
    startTime: '09:00',
    endTime: '10:00',
    plannedDurationMins: 60,
  };

  it('listScheduleBlocks validates date before querying', async () => {
    await expect(listScheduleBlocks('2026-13-01')).rejects.toThrow('Invalid date');
    expect(selectRowsMock).not.toHaveBeenCalled();
    await listScheduleBlocks('2026-11-22');
    expect(selectRowsMock).toHaveBeenCalledTimes(1);
  });

  it('createScheduleBlock validates date/time/duration', async () => {
    await expect(createScheduleBlock({ ...baseBlock, scheduledDate: 'bad' })).rejects.toThrow('Invalid date');
    await expect(createScheduleBlock({ ...baseBlock, startTime: '25:00' })).rejects.toThrow('Invalid time');
    await expect(createScheduleBlock({ ...baseBlock, endTime: '9:00' })).rejects.toThrow('Invalid time');
    await expect(createScheduleBlock({ ...baseBlock, plannedDurationMins: -5 })).rejects.toThrow('positive integer');
    expect(executeSqlMock).not.toHaveBeenCalled();
  });

  it('createScheduleBlock defaults status to planned and maps rolledFromBlockId', async () => {
    const block = await createScheduleBlock({ ...baseBlock, rolledFromBlockId: 'orig-1' });
    const params = executeSqlMock.mock.calls[0][1];
    expect(params?.[7]).toBe('planned');
    expect(params?.[8]).toBe('orig-1');
    expect(block.status).toBe('planned');
    expect(block.rolledFromBlockId).toBe('orig-1');
  });

  it('updateScheduleBlock merges partial input and revalidates', async () => {
    selectRowsMock.mockResolvedValueOnce([VALID_BLOCK_ROW]);
    await updateScheduleBlock('block-1', { startTime: '11:00' });
    const params = executeSqlMock.mock.calls[0][1];
    expect(params?.[0]).toBe('task-1'); // unchanged task_id
    expect(params?.[2]).toBe('11:00'); // updated start_time
    expect(params?.[3]).toBe('10:00'); // unchanged end_time
    expect(params?.[8]).toBe('block-1');
  });

  it('updateScheduleBlock throws for missing block and invalid merged values', async () => {
    selectRowsMock.mockResolvedValueOnce([]);
    await expect(updateScheduleBlock('nope', { startTime: '11:00' })).rejects.toThrow('Schedule block not found');

    selectRowsMock.mockResolvedValueOnce([VALID_BLOCK_ROW]);
    await expect(updateScheduleBlock('block-1', { startTime: 'bogus' })).rejects.toThrow('Invalid time');
    expect(executeSqlMock).not.toHaveBeenCalled();
  });

  it('deleteScheduleBlock deletes by id', async () => {
    await deleteScheduleBlock('b1');
    expect(executeSqlMock.mock.calls[0][1]).toEqual(['b1']);
  });
});

describe('time logs', () => {
  const baseLog = { logDate: '2026-11-22', durationMins: 30 };

  it('createTimeLog validates date/times/duration', async () => {
    await expect(createTimeLog({ ...baseLog, logDate: '22/11/2026' })).rejects.toThrow('Invalid date');
    await expect(createTimeLog({ ...baseLog, startTime: '9:00' })).rejects.toThrow('Invalid time');
    await expect(createTimeLog({ ...baseLog, durationMins: 0 })).rejects.toThrow('positive integer');
    expect(executeSqlMock).not.toHaveBeenCalled();
  });

  it('createTimeLog auto-marks ad-hoc when no task or block linked', async () => {
    await createTimeLog({ ...baseLog, customTitle: 'Coffee' });
    expect(executeSqlMock.mock.calls[0][1]?.[11]).toBe(1); // is_ad_hoc

    executeSqlMock.mockClear();
    await createTimeLog({ ...baseLog, taskId: 't1' });
    expect(executeSqlMock.mock.calls[0][1]?.[11]).toBe(0);
  });

  it('createTimeLog respects explicit isAdHoc flag', async () => {
    await createTimeLog({ ...baseLog, taskId: 't1', isAdHoc: true });
    expect(executeSqlMock.mock.calls[0][1]?.[11]).toBe(1);
  });

  it('listTimeLogs maps rows including mood/isAdHoc', async () => {
    selectRowsMock.mockResolvedValueOnce([{ ...VALID_LOG_ROW, mood: 'energizing' }]);
    const logs = await listTimeLogs('2026-11-22');
    expect(logs[0].isAdHoc).toBe(true);
    expect(logs[0].mood).toBe('energizing');
    expect(logs[0].customTitle).toBe('Coffee');
  });

  it('updateTimeLog merges partial input and validates merged duration', async () => {
    selectRowsMock.mockResolvedValueOnce([VALID_LOG_ROW]);
    await updateTimeLog('log-1', { notes: 'updated' });
    const params = executeSqlMock.mock.calls[0][1];
    expect(params?.[7]).toBe(30); // duration unchanged
    expect(params?.[8]).toBe('updated'); // notes
    expect(params?.[10]).toBe(1); // is_ad_hoc preserved as 1
    expect(params?.[11]).toBe('log-1');

    selectRowsMock.mockResolvedValueOnce([VALID_LOG_ROW]);
    await expect(updateTimeLog('log-1', { durationMins: 0 })).rejects.toThrow('positive integer');
  });

  it('updateTimeLog throws for missing log', async () => {
    selectRowsMock.mockResolvedValueOnce([]);
    await expect(updateTimeLog('nope', {})).rejects.toThrow('Time log not found');
  });
});

describe('active timer persistence', () => {
  const timer: ActiveTimerState = {
    id: 'timer-1',
    taskId: 't1',
    scheduleBlockId: null,
    customTitle: 'Study',
    categoryId: 'c1',
    startedAt: '2026-11-22T09:00:00.000Z',
    accumulatedPausedMs: 5000,
    pausedAt: null,
    targetDurationMins: 45,
    notes: null,
  };

  it('saveActiveTimer serializes state and clears with null', async () => {
    await saveActiveTimer(timer);
    expect(executeSqlMock.mock.calls[0][1]?.[1]).toBe(JSON.stringify(timer));

    await saveActiveTimer(null);
    expect(executeSqlMock.mock.calls[1][1]?.[1]).toBe('null');
  });

  it('getActiveTimer parses stored JSON', async () => {
    selectRowsMock.mockResolvedValueOnce([{ key: 'active_timer', value: JSON.stringify(timer), updated_at: 't' }]);
    await expect(getActiveTimer()).resolves.toEqual(timer);
  });

  it('getActiveTimer returns null for missing or malformed values', async () => {
    selectRowsMock.mockResolvedValueOnce([]);
    await expect(getActiveTimer()).resolves.toBeNull();

    selectRowsMock.mockResolvedValueOnce([{ key: 'active_timer', value: 'not-json', updated_at: 't' }]);
    await expect(getActiveTimer()).resolves.toBeNull();

    selectRowsMock.mockResolvedValueOnce([{ key: 'active_timer', value: '{"foo":1}', updated_at: 't' }]);
    await expect(getActiveTimer()).resolves.toBeNull(); // missing id
  });
});

describe('bootstrapDatabase', () => {
  async function freshQueries() {
    vi.resetModules();
    return import('./queries');
  }

  it('seeds default categories and settings on first run', async () => {
    const mod = await freshQueries();
    await mod.bootstrapDatabase();
    const categoryInserts = executeSqlMock.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO categories'));
    const settingUpserts = executeSqlMock.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO app_settings'));
    expect(categoryInserts).toHaveLength(5);
    // 5 default settings + categories_seeded flag
    expect(settingUpserts.length).toBeGreaterThanOrEqual(6);
  });

  it('is idempotent within a module instance', async () => {
    const mod = await freshQueries();
    await mod.bootstrapDatabase();
    const callsAfterFirst = executeSqlMock.mock.calls.length;
    await mod.bootstrapDatabase();
    expect(executeSqlMock.mock.calls.length).toBe(callsAfterFirst);
  });

  it('skips category seeding when categories_seeded is set', async () => {
    const mod = await freshQueries();
    selectRowsMock.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (String(sql).includes('app_settings') && params?.[0] === 'categories_seeded') {
        return [{ key: 'categories_seeded', value: '1', updated_at: 't' }];
      }
      return [];
    });
    await mod.bootstrapDatabase();
    const categoryInserts = executeSqlMock.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO categories'));
    expect(categoryInserts).toHaveLength(0);
  });
});
