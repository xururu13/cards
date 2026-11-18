import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';

import { DeckForm } from '@/components/deck-form';
import { StatusScreen } from '@/components/status-screen';
import { createDeck } from '@/db/decks';
import { getSettings } from '@/db/settings';
import { useFocusLoad } from '@/hooks/use-focus-load';
import { useOnboarding } from '@/hooks/use-onboarding';

export default function NewDeckScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { guide } = useLocalSearchParams<{ guide?: string }>();
  const onboarding = useOnboarding();
  const { data: settings, error } = useFocusLoad(useCallback(() => getSettings(db), [db]));

  if (error) return <StatusScreen error={error} />;
  if (!settings) return <StatusScreen />;

  const lang = settings.defaultLanguage;
  const guided = guide === '1' && onboarding.state !== null && onboarding.state !== 'done';
  return (
    <DeckForm
      initial={{ name: '', frontLang: lang, backLang: lang }}
      submitTitle="Создать стопку"
      guided={guided}
      onCatalog={() => router.replace('/catalog')}
      onSubmit={async (input) => {
        const id = await createDeck(db, input);
        if (guided) await onboarding.trackDeck(id);
        router.replace({ pathname: '/deck/[id]', params: { id } });
      }}
    />
  );
}
