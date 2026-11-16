import type { Db, SqlValue } from './db';
import { migrate, type MigrationDb } from './migrate';

// Jest не умеет импортировать node:sqlite напрямую, поэтому модуль берётся у самого Node.
const { DatabaseSync } = process.getBuiltinModule('node:sqlite');

/** База в памяти на встроенном в Node SQLite: проверяет настоящий SQL без телефона. */
export function openMemoryDb() {
  const raw = new DatabaseSync(':memory:');
  const db: Db & MigrationDb = {
    async execAsync(source: string) {
      raw.exec(source);
    },
    async runAsync(source: string, params: SqlValue[] = []) {
      return { changes: Number(raw.prepare(source).run(...params).changes) };
    },
    async getAllAsync<T>(source: string, params: SqlValue[] = []) {
      return raw.prepare(source).all(...params) as T[];
    },
    async getFirstAsync<T>(source: string, params: SqlValue[] = []) {
      return (raw.prepare(source).get(...params) as T | undefined) ?? null;
    },
    async withTransactionAsync(task: () => Promise<void>) {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return { raw, db };
}

export async function openMigratedDb() {
  const opened = openMemoryDb();
  await migrate(opened.db);
  return opened;
}
