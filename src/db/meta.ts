import type { Db } from './db';

export type MetaKey = 'lastSyncAt';

export async function getMeta(db: Db, key: MetaKey): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(`SELECT value FROM meta WHERE key = ?`, [key]);
  return row?.value ?? null;
}

export async function setMeta(db: Db, key: MetaKey, value: string): Promise<void> {
  await db.runAsync(
    `INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}
