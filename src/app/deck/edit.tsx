import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import { DeckForm } from '@/components/deck-form';
import { StatusScreen } from '@/components/status-screen';
import { deleteDeck, getDeck, updateDeck } from '@/db/decks';
import { useFocusLoad } from '@/hooks/use-focus-load';

export default function EditDeckScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const { data: deck, error } = useFocusLoad(useCallback(() => getDeck(db, id), [db, id]));

  if (error) return <StatusScreen error={error} />;
  if (deck === undefined) return <StatusScreen />;
  if (deck === null) return <StatusScreen error="Стопка не найдена." />;

  const confirmDelete = () =>
    Alert.alert(
      `Удалить стопку «${deck.name}»?`,
      deck.card_count > 0
        ? `Вместе с ней удалятся карточки: ${deck.card_count}. Вернуть их будет нельзя.`
        : 'Вернуть её будет нельзя.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            await deleteDeck(db, deck.id);
            router.dismissTo('/');
          },
        },
      ],
    );

  return (
    <DeckForm
      initial={{ name: deck.name, frontLang: deck.front_lang, backLang: deck.back_lang }}
      submitTitle="Сохранить"
      onSubmit={async (input) => {
        await updateDeck(db, deck.id, input);
        router.back();
      }}
      onDelete={confirmDelete}
    />
  );
}
