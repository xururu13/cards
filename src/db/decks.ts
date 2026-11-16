import type { Db } from './db';
import { newId } from './ids';
import type { Deck } from './types';

export interface DeckSummary extends Deck {
  card_count: number;
  /** Карточки на уровне 0, которые уже показывались и были забыты. */
  hard_count: number;
  /** Карточки на верхнем уровне. */
  known_count: number;
}

export interface DeckInput {
  name: string;
  frontLang: string;
  backLang: string;
}

const SUMMARY_SQL = `
  SELECT d.*,
         COUNT(c.id) AS card_count,
         COALESCE(SUM(c.level = 0 AND c.wrong_count > 0), 0) AS hard_count,
         COALESCE(SUM(c.level = 4), 0) AS known_count
    FROM decks d
    LEFT JOIN cards c ON c.deck_id = d.id AND c.deleted_at IS NULL
   WHERE d.deleted_at IS NULL`;

export function listDecks(db: Db): Promise<DeckSummary[]> {
  return db.getAllAsync<DeckSummary>(`${SUMMARY_SQL} GROUP BY d.id ORDER BY d.created_at`, []);
}

export function getDeck(db: Db, id: string): Promise<DeckSummary | null> {
  return db.getFirstAsync<DeckSummary>(`${SUMMARY_SQL} AND d.id = ? GROUP BY d.id`, [id]);
}

function cleanName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('У стопки должно быть название');
  return trimmed;
}

export async function createDeck(db: Db, input: DeckInput, now = Date.now()): Promise<string> {
  const id = newId();
  await db.runAsync(
    `INSERT INTO decks (id, name, front_lang, back_lang, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, cleanName(input.name), input.frontLang, input.backLang, now, now],
  );
  return id;
}

export async function updateDeck(
  db: Db,
  id: string,
  input: DeckInput,
  now = Date.now(),
): Promise<void> {
  await db.runAsync(
    `UPDATE decks SET name = ?, front_lang = ?, back_lang = ?, updated_at = ?
      WHERE id = ? AND deleted_at IS NULL`,
    [cleanName(input.name), input.frontLang, input.backLang, now, id],
  );
}

export async function setDeckLanguage(
  db: Db,
  id: string,
  side: 'front' | 'back',
  lang: string,
  now = Date.now(),
): Promise<void> {
  const column = side === 'front' ? 'front_lang' : 'back_lang';
  await db.runAsync(
    `UPDATE decks SET ${column} = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
    [lang, now, id],
  );
}

/** Помечает стопку и её карточки удалёнными. Строки остаются для синхронизации. */
export async function deleteDeck(db: Db, id: string, now = Date.now()): Promise<void> {
  await db.runAsync(
    `UPDATE cards SET deleted_at = ?, updated_at = ? WHERE deck_id = ? AND deleted_at IS NULL`,
    [now, now, id],
  );
  await db.runAsync(
    `UPDATE decks SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
    [now, now, id],
  );
}
