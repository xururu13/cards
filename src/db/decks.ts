import type { SQLiteDatabase } from 'expo-sqlite';

import type { Deck } from './types';

export interface DeckSummary extends Deck {
  card_count: number;
  /** Карточки на уровне 0, которые уже показывались и были забыты. */
  hard_count: number;
}

export function listDecks(db: SQLiteDatabase): Promise<DeckSummary[]> {
  return db.getAllAsync<DeckSummary>(
    `SELECT d.*,
            COUNT(c.id) AS card_count,
            COALESCE(SUM(c.level = 0 AND c.wrong_count > 0), 0) AS hard_count
       FROM decks d
       LEFT JOIN cards c ON c.deck_id = d.id AND c.deleted_at IS NULL
      WHERE d.deleted_at IS NULL
      GROUP BY d.id
      ORDER BY d.created_at`,
  );
}
