import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { useColorScheme } from 'react-native';

import { migrate } from '@/db/migrate';
import { OnboardingProvider } from '@/hooks/use-onboarding';
import { AutoSync } from '@/sync/auto-sync';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SQLiteProvider databaseName="cards.db" onInit={async (db) => void (await migrate(db))}>
        <AutoSync />
        <OnboardingProvider>
        <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
          <Stack.Screen name="index" options={{ title: 'Твои стопки' }} />
          <Stack.Screen name="settings" options={{ title: 'Настройки' }} />
          <Stack.Screen name="deck/new" options={{ title: 'Новая стопка', presentation: 'modal' }} />
          <Stack.Screen name="deck/edit" options={{ title: 'Стопка', presentation: 'modal' }} />
          <Stack.Screen name="deck/[id]" options={{ title: '' }} />
          <Stack.Screen name="card/new" options={{ title: 'Новая карточка', presentation: 'modal' }} />
          <Stack.Screen name="card/[id]" options={{ title: 'Карточка', presentation: 'modal' }} />
          <Stack.Screen name="catalog/index" options={{ title: 'Наборы карточек' }} />
          <Stack.Screen name="catalog/[setId]" options={{ title: '' }} />
          <Stack.Screen name="round/[deckId]" options={{ title: 'Раунд' }} />
          <Stack.Screen name="round/result" options={{ title: 'Раунд завершён' }} />
        </Stack>
        </OnboardingProvider>
      </SQLiteProvider>
    </ThemeProvider>
  );
}
