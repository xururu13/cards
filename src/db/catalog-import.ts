import { allSections, cardKey, type CatalogSet } from '@/catalog/catalog';

import type { Db } from './db';
import { createDeck } from './decks';

export interface ImportResult {
  deckId: string;
  /** Сколько карточек добавлено. */
  added: number;
  /** Сколько уже было в стопке (в том числе удалённых вручную) — их не трогаем. */
  skipped: number;
}

export type ImportTarget = { deckId: string } | { newDeckName: string };

/**
 * Id карточки из набора зависит от стопки, набора и термина. Поэтому повторная загрузка
 * тех же параграфов в ту же стопку не создаёт дубли, а на другом устройстве после
 * синхронизации получаются те же id.
 */
export function catalogCardId(deckId: string, setId: string, front: string): string {
  return `${deckId}:${setId}:${cardKey(front)}`;
}

/** Добавляет карточки выбранных параграфов в стопку (или в новую стопку). */
export async function importCatalog(
  db: Db,
  set: CatalogSet,
  sectionNumbers: readonly number[],
  target: ImportTarget,
  now = Date.now(),
): Promise<ImportResult> {
  const chosen = new Set(sectionNumbers);
  const cards = allSections(set)
    .filter((section) => chosen.has(section.number))
    .flatMap((section) => section.cards);
  if (cards.length === 0) throw new Error('Выбери хотя бы один параграф');

  let result: ImportResult | undefined;
  await db.withTransactionAsync(async () => {
    const deckId =
      'deckId' in target
        ? target.deckId
        : await createDeck(db, { name: target.newDeckName, frontLang: set.frontLang, backLang: set.backLang }, now);
    let added = 0;
    for (const [index, card] of cards.entries()) {
      // Список карточек в стопке идёт от новых к старым — время убывает, чтобы
      // карточки встали в порядке учебника.
      const createdAt = now - index;
      const { changes } = await db.runAsync(
        `INSERT OR IGNORE INTO cards (id, deck_id, front, back, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [catalogCardId(deckId, set.id, card.front), deckId, card.front.trim(), card.back.trim(), createdAt, now],
      );
      added += changes;
    }
    result = { deckId, added, skipped: cards.length - added };
  });
  return result!;
}

/** Номера параграфов набора, все карточки которых уже есть в стопке. */
export async function loadedSections(db: Db, set: CatalogSet, deckId: string): Promise<number[]> {
  const rows = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM cards WHERE deck_id = ? AND id LIKE ?`,
    [deckId, `${deckId}:${set.id}:%`],
  );
  const ids = new Set(rows.map((row) => row.id));
  return allSections(set)
    .filter((section) => section.cards.every((card) => ids.has(catalogCardId(deckId, set.id, card.front))))
    .map((section) => section.number);
}
