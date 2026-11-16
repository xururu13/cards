import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import { CardForm } from '@/components/card-form';
import { StatusScreen } from '@/components/status-screen';
import { deleteCard, getCard, updateCard } from '@/db/cards';
import { getDeck, type DeckSummary } from '@/db/decks';
import type { Card } from '@/db/types';
import { useDeckLanguages } from '@/hooks/use-deck-languages';
import { useFocusLoad } from '@/hooks/use-focus-load';

export default function EditCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const { data, error } = useFocusLoad(
    useCallback(async () => {
      const card = await getCard(db, id);
      return card ? { card, deck: await getDeck(db, card.deck_id) } : null;
    }, [db, id]),
  );

  if (error) return <StatusScreen error={error} />;
  if (data === undefined) return <StatusScreen />;
  if (!data?.deck) return <StatusScreen error="Карточка не найдена." />;
  return <EditCardForm card={data.card} deck={data.deck} />;
}

function EditCardForm({ card, deck }: { card: Card; deck: DeckSummary }) {
  const db = useSQLiteContext();
  const router = useRouter();
  const [languages, changeLanguage] = useDeckLanguages(db, deck);

  const confirmDelete = () =>
    Alert.alert(`Удалить карточку «${card.front}»?`, 'Вернуть её будет нельзя.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          await deleteCard(db, card.id);
          router.back();
        },
      },
    ]);

  return (
    <CardForm
      deckId={deck.id}
      deckName={deck.name}
      initial={{ front: card.front, back: card.back }}
      languages={languages}
      onLanguageChange={changeLanguage}
      onSave={async (input) => {
        await updateCard(db, card.id, input);
        router.back();
        return false;
      }}
      onDelete={confirmDelete}
    />
  );
}
