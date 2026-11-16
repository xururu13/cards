import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { DeckForm } from '@/components/deck-form';
import { DEFAULT_LANGUAGE } from '@/constants/languages';
import { createDeck } from '@/db/decks';

export default function NewDeckScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  return (
    <DeckForm
      initial={{ name: '', frontLang: DEFAULT_LANGUAGE, backLang: DEFAULT_LANGUAGE }}
      submitTitle="Создать стопку"
      onSubmit={async (input) => {
        const id = await createDeck(db, input);
        router.replace({ pathname: '/deck/[id]', params: { id } });
      }}
    />
  );
}
