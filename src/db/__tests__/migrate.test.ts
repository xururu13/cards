import { migrate } from '../migrate';
import { MIGRATIONS } from '../schema';
import { openMemoryDb } from '../test-db';

const now = 1_700_000_000_000;

describe('migrate', () => {
  it('создаёт все таблицы и выставляет версию', async () => {
    const { raw, db } = openMemoryDb();
    const version = await migrate(db);

    expect(version).toBe(MIGRATIONS.length);
    const tables = raw
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => row.name);
    expect(tables).toEqual(['answers', 'cards', 'decks', 'rounds', 'settings']);
  });

  it('повторный запуск ничего не меняет', async () => {
    const { raw, db } = openMemoryDb();
    await migrate(db);
    raw.prepare('INSERT INTO decks (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
      'd1',
      'Биология',
      now,
      now,
    );

    await expect(migrate(db)).resolves.toBe(MIGRATIONS.length);
    expect(raw.prepare('SELECT COUNT(*) AS n FROM decks').get()).toEqual({ n: 1 });
  });

  it('откатывает упавшую миграцию и оставляет прежнюю версию', async () => {
    const { raw, db } = openMemoryDb();
    await migrate(db);
    const broken = [...MIGRATIONS, 'CREATE TABLE extra (id TEXT); CREATE TABLE decks (id TEXT);'];

    await expect(migrate(db, broken)).rejects.toThrow();
    expect(raw.prepare('PRAGMA user_version').get()).toEqual({ user_version: MIGRATIONS.length });
    expect(
      raw.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'extra'").get(),
    ).toEqual({ n: 0 });
  });

  it('отказывается открывать базу новее приложения', async () => {
    const { raw, db } = openMemoryDb();
    raw.exec(`PRAGMA user_version = ${MIGRATIONS.length + 1}`);
    await expect(migrate(db)).rejects.toThrow(/новее/);
  });

  it('схема не пускает уровень вне 0–4, неизвестный результат и чужую стопку', async () => {
    const { raw, db } = openMemoryDb();
    await migrate(db);
    raw.prepare('INSERT INTO decks (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
      'd1',
      'Биология',
      now,
      now,
    );
    const addCard = raw.prepare(
      'INSERT INTO cards (id, deck_id, front, back, level, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    addCard.run('c1', 'd1', 'Митоз', 'Деление клетки', 0, now, now);

    expect(() => addCard.run('c2', 'd1', 'a', 'b', 5, now, now)).toThrow();
    expect(() => addCard.run('c3', 'нет-такой', 'a', 'b', 0, now, now)).toThrow();

    raw.prepare('INSERT INTO rounds (id, deck_id, started_at, updated_at) VALUES (?, ?, ?, ?)').run(
      'r1',
      'd1',
      now,
      now,
    );
    const addAnswer = raw.prepare(
      'INSERT INTO answers (id, round_id, card_id, result, time_ms, points, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    addAnswer.run('a1', 'r1', 'c1', 'hint', 1200, -5, now);
    expect(() => addAnswer.run('a2', 'r1', 'c1', 'unknown', 0, 0, now)).toThrow();
  });
});
