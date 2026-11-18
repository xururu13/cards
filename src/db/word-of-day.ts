import type { Db } from './db';
import { getMeta, setMeta } from './meta';

export interface WordOfDay {
  id: string;
  front: string;
  back: string;
  deck_name: string;
}

const ACTIVE_CARDS = `
  FROM cards c JOIN decks d ON d.id = c.deck_id
  WHERE c.deleted_at IS NULL AND d.deleted_at IS NULL`;
const WORD_QUERY = `SELECT c.id, c.front, c.back, d.name AS deck_name ${ACTIVE_CARDS}`;

export async function getWordOfDay(db: Db, now = Date.now()): Promise<WordOfDay | null> {
  const date = new Date(now);
  // Номер местного календарного дня, одинаковый для всех его часов.
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  const prefix = `${day}:`;
  const saved = await getMeta(db, 'wordOfDay');
  if (saved?.startsWith(prefix)) {
    const word = await db.getFirstAsync<WordOfDay>(`${WORD_QUERY} AND c.id = ?`, [saved.slice(prefix.length)]);
    if (word) return word;
  }
  const count = await db.getFirstAsync<{ total: number }>(`SELECT COUNT(*) AS total ${ACTIVE_CARDS}`, []);
  if (!count?.total) return null;
  const offset = ((day % count.total) + count.total) % count.total;
  const word = await db.getFirstAsync<WordOfDay>(`${WORD_QUERY} ORDER BY c.id LIMIT 1 OFFSET ?`, [offset]);
  if (word) await setMeta(db, 'wordOfDay', prefix + word.id);
  return word;
}
