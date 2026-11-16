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
  // На время миграций проверка ссылок выключена: иначе нельзя пересоздать таблицу,
  // на которую ссылаются другие. После миграций ссылки проверяются целиком.
  await db.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    return await runMigrations(db, migrations);
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
}

async function runMigrations(db: MigrationDb, migrations: readonly string[]): Promise<number> {
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
  const broken = await db.getFirstAsync<{ table: string }>('PRAGMA foreign_key_check');
  if (broken) throw new Error(`После обновления базы нарушены ссылки в таблице ${broken.table}`);
  return version;
}
