import { MIGRATIONS } from './schema';

/** Минимум от базы, нужный миграциям. Ему соответствует SQLiteDatabase из expo-sqlite. */
export interface MigrationDb {
  execAsync(source: string): Promise<void>;
  getFirstAsync<T>(source: string): Promise<T | null>;
}

/**
 * Доводит схему до последней версии. Каждая миграция идёт в своей транзакции
 * вместе с обновлением версии: если шаг упал, база остаётся на предыдущей версии.
 */
export async function migrate(
  db: MigrationDb,
  migrations: readonly string[] = MIGRATIONS,
): Promise<number> {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  if (version > migrations.length) {
    throw new Error(
      `База новее приложения: версия схемы ${version}, приложение знает ${migrations.length}`,
    );
  }

  while (version < migrations.length) {
    const next = version + 1;
    try {
      await db.execAsync(`BEGIN;\n${migrations[version]}\nPRAGMA user_version = ${next};\nCOMMIT;`);
    } catch (error) {
      await db.execAsync('ROLLBACK;').catch(() => {});
      throw error;
    }
    version = next;
  }
  return version;
}
