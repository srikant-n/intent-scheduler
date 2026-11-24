import Database from '@tauri-apps/plugin-sql';

// Singleton SQLite connection via tauri-plugin-sql. The promise is cached so
// every query shares one connection (plugin-sql manages its own pool).
export const DB_URL = 'sqlite:tracker.db';

let dbPromise: Promise<Database> | null = null;

/** Lazily open (and cache) the tracker.db connection. */
export function getDb(): Promise<Database> {
  dbPromise ??= Database.load(DB_URL);
  return dbPromise;
}

/** Run a SELECT and return typed rows. Params use $1, $2, … placeholders. */
export async function selectRows<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = await getDb();
  const rows = await db.select(sql, params);
  return rows as T[];
}

/** Run an INSERT/UPDATE/DELETE and return affected-row metadata. */
export async function executeSql(sql: string, params: unknown[] = []): Promise<{ rowsAffected: number; lastInsertId?: number }> {
  const db = await getDb();
  return db.execute(sql, params);
}
