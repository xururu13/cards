import type { SQLiteDatabase } from 'expo-sqlite';
import { useState } from 'react';

import { setDeckLanguage, type DeckSummary } from '@/db/decks';

type Side = 'front' | 'back';

/** Языки диктовки стопки: меняются на форме карточки и сразу запоминаются в стопке. */
export function useDeckLanguages(db: SQLiteDatabase, deck: DeckSummary) {
  const [languages, setLanguages] = useState<Record<Side, string>>({
    front: deck.front_lang,
    back: deck.back_lang,
  });
  const change = (side: Side, lang: string) => {
    setLanguages((current) => ({ ...current, [side]: lang }));
    void setDeckLanguage(db, deck.id, side, lang);
  };
  return [languages, change] as const;
}
