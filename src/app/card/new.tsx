import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';

import { CardForm } from '@/components/card-form';
import { StatusScreen } from '@/components/status-screen';
import { createCard } from '@/db/cards';
import { getDeck, type DeckSummary } from '@/db/decks';
import { useDeckLanguages } from '@/hooks/use-deck-languages';
import { useFocusLoad } from '@/hooks/use-focus-load';

export default function NewCardScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const db = useSQLiteContext();
  const { data: deck, error } = useFocusLoad(useCallback(() => getDeck(db, deckId), [db, deckId]));

  if (error) return <StatusScreen error={error} />;
  if (deck === undefined) return <StatusScreen />;
  if (deck === null) return <StatusScreen error="Стопка не найдена." />;
  return <NewCardForm deck={deck} />;
}

function NewCardForm({ deck }: { deck: DeckSummary }) {
  const db = useSQLiteContext();
  const router = useRouter();
  const [languages, changeLanguage] = useDeckLanguages(db, deck);
  return (
    <CardForm
      deckName={deck.name}
      initial={{ front: '', back: '' }}
      languages={languages}
      onLanguageChange={changeLanguage}
      allowAddMore
      onSave={async (input, addMore) => {
        await createCard(db, deck.id, input);
        if (!addMore) router.back();
        return addMore;
      }}
    />
  );
}
