import type { Db, SqlValue } from '@/db/db';
import type { Answer, Card, Deck, Round } from '@/db/types';

export const SNAPSHOT_FORMAT = 'kartochki-backup';
export const SNAPSHOT_VERSION = 1;

export interface SettingRow {
  key: string;
  value: string;
  updated_at: number;
}

/** Полная копия данных пользователя: и для файла резервной копии, и для Google Drive. */
export interface Snapshot {
  format: typeof SNAPSHOT_FORMAT;
  version: number;
  exportedAt: number;
  decks: Deck[];
  cards: Card[];
  rounds: Round[];
  answers: Answer[];
  settings: SettingRow[];
}

type FieldType = 'string' | 'number' | 'string?' | 'number?';

/** Поля каждой таблицы; порядок совпадает с колонками в базе. */
const TABLES = {
  decks: {
    id: 'string',
    name: 'string',
    front_lang: 'string',
    back_lang: 'string',
    created_at: 'number',
    updated_at: 'number',
    deleted_at: 'number?',
  },
  cards: {
    id: 'string',
    deck_id: 'string',
    front: 'string',
    back: 'string',
    level: 'number',
    correct_count: 'number',
    wrong_count: 'number',
    last_shown_at: 'number?',
    created_at: 'number',
    updated_at: 'number',
    deleted_at: 'number?',
  },
  rounds: {
    id: 'string',
    deck_id: 'string?',
    started_at: 'number',
    finished_at: 'number?',
    correct: 'number',
    wrong: 'number',
    hints: 'number',
    score: 'number',
    updated_at: 'number',
    deleted_at: 'number?',
  },
  answers: {
    id: 'string',
    round_id: 'string',
    card_id: 'string',
    result: 'string',
    time_ms: 'number',
    points: 'number',
    created_at: 'number',
  },
  settings: { key: 'string', value: 'string', updated_at: 'number' },
} as const satisfies Record<string, Record<string, FieldType>>;

type Table = keyof typeof TABLES;
/** Порядок важен: сначала строки, на которые ссылаются остальные. */
const ORDER: Table[] = ['decks', 'cards', 'rounds', 'answers', 'settings'];

export async function exportSnapshot(db: Db, now = Date.now()): Promise<Snapshot> {
  const rows = async <T>(table: Table) => {
    const columns = Object.keys(TABLES[table]).join(', ');
    return db.getAllAsync<T>(`SELECT ${columns} FROM ${table} ORDER BY rowid`, []);
  };
  return {
    format: SNAPSHOT_FORMAT,
    version: SNAPSHOT_VERSION,
    exportedAt: now,
    decks: await rows<Deck>('decks'),
    cards: await rows<Card>('cards'),
    rounds: await rows<Round>('rounds'),
    answers: await rows<Answer>('answers'),
    settings: await rows<SettingRow>('settings'),
  };
}

function matches(value: unknown, type: FieldType): boolean {
  if (value === null) return type.endsWith('?');
  return typeof value === type.replace('?', '') && (typeof value !== 'number' || Number.isFinite(value));
}

/** Проверяет, что разобранный JSON — снимок этого приложения. Бросает понятную ошибку. */
export function parseSnapshot(json: string): Snapshot {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('Файл повреждён: это не JSON.');
  }
  const object = data as Record<string, unknown> | null;
  if (!object || object.format !== SNAPSHOT_FORMAT) {
    throw new Error('Это не резервная копия «Карточек».');
  }
  if (typeof object.version !== 'number' || object.version > SNAPSHOT_VERSION) {
    throw new Error('Копия сделана более новой версией приложения. Обнови приложение.');
  }
  for (const table of ORDER) {
    const rows = object[table];
    if (!Array.isArray(rows)) throw new Error(`Файл повреждён: нет раздела ${table}.`);
    const fields = Object.entries(TABLES[table]) as [string, FieldType][];
    rows.forEach((row: Record<string, unknown> | null, index) => {
      const broken = !row || fields.find(([field, type]) => !matches(row[field], type));
      if (broken) {
        const field = Array.isArray(broken) ? `, поле ${broken[0]}` : '';
        throw new Error(`Файл повреждён: ${table}, запись ${index + 1}${field}.`);
      }
    });
  }
  return object as unknown as Snapshot;
}

export interface MergeStats {
  /** Сколько записей добавлено или обновлено из снимка. */
  changed: number;
}

/**
 * Вливает снимок в базу. Запись из снимка побеждает, только если её правили позже;
 * удаление — тоже правка, поэтому удалённое на одном устройстве удаляется и на другом.
 * Ответы не меняются после записи, их достаточно добавить. Всё в одной транзакции.
 */
export async function mergeSnapshot(db: Db, snapshot: Snapshot): Promise<MergeStats> {
  let changed = 0;
  await db.withTransactionAsync(async () => {
    for (const table of ORDER) {
      const columns = Object.keys(TABLES[table]);
      const key = table === 'settings' ? 'key' : 'id';
      const updates = columns
        .filter((column) => column !== key)
        .map((column) => `${column} = excluded.${column}`)
        .join(', ');
      const sql =
        table === 'answers'
          ? `INSERT OR IGNORE INTO answers (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`
          : `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})
             ON CONFLICT(${key}) DO UPDATE SET ${updates}
             WHERE excluded.updated_at > ${table}.updated_at`;
      for (const row of snapshot[table] as unknown as Record<string, SqlValue>[]) {
        const result = await db.runAsync(
          sql,
          columns.map((column) => row[column]),
        );
        changed += result.changes;
      }
    }
  });
  return { changed };
}
