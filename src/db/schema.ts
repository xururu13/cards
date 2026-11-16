/**
 * Миграции базы. Индекс в массиве + 1 = версия схемы (PRAGMA user_version).
 * Уже выпущенные миграции не редактируются — изменения добавляются новой записью.
 *
 * Общие правила схемы (нужны для синхронизации через Google Drive):
 * - id — UUID, чтобы записи с разных устройств не конфликтовали;
 * - updated_at — время последней правки, мс; при слиянии побеждает более поздняя;
 * - deleted_at — отметка удаления; строки не удаляются физически, иначе
 *   удаление не дойдёт до другого устройства.
 */
export const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE decks (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    front_lang TEXT NOT NULL DEFAULT 'ru-RU',
    back_lang TEXT NOT NULL DEFAULT 'ru-RU',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  );

  CREATE TABLE cards (
    id TEXT PRIMARY KEY NOT NULL,
    deck_id TEXT NOT NULL REFERENCES decks(id),
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 0 CHECK (level BETWEEN 0 AND 4),
    correct_count INTEGER NOT NULL DEFAULT 0,
    wrong_count INTEGER NOT NULL DEFAULT 0,
    last_shown_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  );
  CREATE INDEX cards_deck ON cards(deck_id);

  CREATE TABLE rounds (
    id TEXT PRIMARY KEY NOT NULL,
    deck_id TEXT NOT NULL REFERENCES decks(id),
    started_at INTEGER NOT NULL,
    finished_at INTEGER,
    correct INTEGER NOT NULL DEFAULT 0,
    wrong INTEGER NOT NULL DEFAULT 0,
    hints INTEGER NOT NULL DEFAULT 0,
    score INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  );
  CREATE INDEX rounds_finished ON rounds(finished_at);

  CREATE TABLE answers (
    id TEXT PRIMARY KEY NOT NULL,
    round_id TEXT NOT NULL REFERENCES rounds(id),
    card_id TEXT NOT NULL REFERENCES cards(id),
    result TEXT NOT NULL CHECK (result IN ('correct', 'wrong', 'hint', 'timeout')),
    time_ms INTEGER NOT NULL,
    points INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX answers_round ON answers(round_id);

  CREATE TABLE settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  `,
  `
  -- Служебные значения этого устройства. В снимки и синхронизацию не попадают.
  CREATE TABLE meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
  `
  -- Наборы карточек, загруженные из файла (исходный текст YAML). Только на этом устройстве:
  -- сами карточки после загрузки в стопку синхронизируются как обычно.
  CREATE TABLE catalog_sets (
    id TEXT PRIMARY KEY NOT NULL,
    source TEXT NOT NULL,
    imported_at INTEGER NOT NULL
  );
  `,
  `
  -- Смешанный раунд идёт по карточкам из всех стопок: у него нет стопки, deck_id = NULL.
  -- SQLite не умеет снимать NOT NULL с колонки, поэтому таблица пересоздаётся.
  CREATE TABLE rounds_new (
    id TEXT PRIMARY KEY NOT NULL,
    deck_id TEXT REFERENCES decks(id),
    started_at INTEGER NOT NULL,
    finished_at INTEGER,
    correct INTEGER NOT NULL DEFAULT 0,
    wrong INTEGER NOT NULL DEFAULT 0,
    hints INTEGER NOT NULL DEFAULT 0,
    score INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  );
  INSERT INTO rounds_new (id, deck_id, started_at, finished_at, correct, wrong, hints, score, updated_at, deleted_at)
    SELECT id, deck_id, started_at, finished_at, correct, wrong, hints, score, updated_at, deleted_at FROM rounds;
  DROP TABLE rounds;
  ALTER TABLE rounds_new RENAME TO rounds;
  CREATE INDEX rounds_finished ON rounds(finished_at);
  `,
  `ALTER TABLE answers ADD COLUMN grade INTEGER CHECK (grade BETWEEN 1 AND 5);`,
  `
  ALTER TABLE answers RENAME COLUMN grade TO old_grade;
  ALTER TABLE answers ADD COLUMN grade INTEGER CHECK (grade BETWEEN 0 AND 5);
  UPDATE answers SET grade = old_grade WHERE old_grade IS NOT NULL;
  ALTER TABLE answers DROP COLUMN old_grade;
  `,
];
