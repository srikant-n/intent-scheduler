import Database from '@tauri-apps/plugin-sql';

export const DB_URL = 'sqlite:tracker.db';

let dbPromise: Promise<Database> | null = null;

export function getDb(): Promise<Database> {
  dbPromise ??= Database.load(DB_URL);
  return dbPromise;
}

export async function selectRows<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = await getDb();
  const rows = await db.select(sql, params);
  return rows as T[];
}

export async function executeSql(sql: string, params: unknown[] = []): Promise<{ rowsAffected: number; lastInsertId?: number }> {
  const db = await getDb();
  return db.execute(sql, params);
}
