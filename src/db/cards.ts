import type { Db } from './db';
import { newId } from './ids';
import type { Card } from './types';

export interface CardInput {
  front: string;
  back: string;
}

export type CardStatus = 'new' | 'hard' | 'learning' | 'known';

export function cardStatus(card: Pick<Card, 'level' | 'correct_count' | 'wrong_count'>): CardStatus {
  if (card.correct_count + card.wrong_count === 0) return 'new';
  if (card.level >= 4) return 'known';
  if (card.level === 0) return 'hard';
  return 'learning';
}

function clean(input: CardInput): CardInput {
  const front = input.front.trim();
  const back = input.back.trim();
  if (!front) throw new Error('Заполни сторону со словом');
  if (!back) throw new Error('Заполни оборот карточки');
  return { front, back };
}

export function listCards(db: Db, deckId: string): Promise<Card[]> {
  return db.getAllAsync<Card>(
    `SELECT * FROM cards WHERE deck_id = ? AND deleted_at IS NULL ORDER BY created_at DESC, id`,
    [deckId],
  );
}

export function getCard(db: Db, id: string): Promise<Card | null> {
  return db.getFirstAsync<Card>(`SELECT * FROM cards WHERE id = ? AND deleted_at IS NULL`, [id]);
}

export async function createCard(
  db: Db,
  deckId: string,
  input: CardInput,
  now = Date.now(),
): Promise<string> {
  const { front, back } = clean(input);
  const id = newId();
  await db.runAsync(
    `INSERT INTO cards (id, deck_id, front, back, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, deckId, front, back, now, now],
  );
  return id;
}

/** Меняет текст карточки. Прогресс (уровень и счётчики) сохраняется. */
export async function updateCard(
  db: Db,
  id: string,
  input: CardInput,
  now = Date.now(),
): Promise<void> {
  const { front, back } = clean(input);
  await db.runAsync(
    `UPDATE cards SET front = ?, back = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
    [front, back, now, id],
  );
}

export async function deleteCard(db: Db, id: string, now = Date.now()): Promise<void> {
  await db.runAsync(
    `UPDATE cards SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
    [now, now, id],
  );
}
