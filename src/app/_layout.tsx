import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { useColorScheme } from 'react-native';

import { migrate } from '@/db/migrate';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SQLiteProvider databaseName="cards.db" onInit={async (db) => void (await migrate(db))}>
        <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
          <Stack.Screen name="index" options={{ title: 'Твои стопки' }} />
          <Stack.Screen name="settings" options={{ title: 'Настройки' }} />
          <Stack.Screen name="deck/new" options={{ title: 'Новая стопка', presentation: 'modal' }} />
          <Stack.Screen name="deck/[id]" options={{ title: 'Стопка' }} />
          <Stack.Screen name="card/new" options={{ title: 'Новая карточка', presentation: 'modal' }} />
          <Stack.Screen name="round/[deckId]" options={{ title: 'Раунд' }} />
          <Stack.Screen name="round/result" options={{ title: 'Раунд завершён' }} />
        </Stack>
      </SQLiteProvider>
    </ThemeProvider>
  );
}
