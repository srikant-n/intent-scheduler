// Tests for the singleton Tauri SQL client wrapper: lazy connection caching
// and select/execute delegation.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-sql', () => ({
  default: { load: mocks.load },
}));

async function importClient() {
  vi.resetModules();
  return import('./client');
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('db client', () => {
  it('lazily loads tracker.db once and reuses the connection', async () => {
    const db = { select: vi.fn(), execute: vi.fn() };
    mocks.load.mockResolvedValue(db);
    const client = await importClient();

    await expect(client.getDb()).resolves.toBe(db);
    await expect(client.getDb()).resolves.toBe(db);

    expect(mocks.load).toHaveBeenCalledTimes(1);
    expect(mocks.load).toHaveBeenCalledWith('sqlite:tracker.db');
  });

  it('selectRows delegates to db.select and returns typed rows', async () => {
    const rows = [{ id: 'row-1', value: 42 }];
    const db = { select: vi.fn().mockResolvedValue(rows), execute: vi.fn() };
    mocks.load.mockResolvedValue(db);
    const client = await importClient();

    const result = await client.selectRows<{ id: string; value: number }>('SELECT * FROM things WHERE id = $1', ['row-1']);

    expect(db.select).toHaveBeenCalledWith('SELECT * FROM things WHERE id = $1', ['row-1']);
    expect(result).toEqual(rows);
  });

  it('executeSql delegates to db.execute and returns its metadata', async () => {
    const metadata = { rowsAffected: 3, lastInsertId: 9 };
    const db = { select: vi.fn(), execute: vi.fn().mockResolvedValue(metadata) };
    mocks.load.mockResolvedValue(db);
    const client = await importClient();

    await expect(client.executeSql('UPDATE things SET value = $1', [7])).resolves.toEqual(metadata);
    expect(db.execute).toHaveBeenCalledWith('UPDATE things SET value = $1', [7]);
  });
});
