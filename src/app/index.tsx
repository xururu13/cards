import { Link, Stack, useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { listDecks, type DeckSummary } from '@/db/decks';
import { useTheme } from '@/hooks/use-theme';

export default function DecksScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [decks, setDecks] = useState<DeckSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      listDecks(db)
        .then((rows) => active && setDecks(rows))
        .catch((e: unknown) => active && setError(e instanceof Error ? e.message : String(e)));
      return () => {
        active = false;
      };
    }, [db]),
  );

  return (
    <ThemedView style={[styles.container, { paddingBottom: insets.bottom + Spacing.three }]}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/settings" asChild>
              <Pressable accessibilityRole="button" hitSlop={12}>
                <ThemedText style={{ color: theme.accent }}>Настройки</ThemedText>
              </Pressable>
            </Link>
          ),
        }}
      />
      {error ? (
        <View style={styles.empty}>
          <ThemedText style={[styles.center, { color: theme.danger }]}>
            Не удалось прочитать базу. {error}
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={decks ?? []}
          keyExtractor={(deck) => deck.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            decks ? (
              <View style={styles.empty}>
                <ThemedText type="subtitle" style={styles.center}>
                  Собери первую стопку
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.center}>
                  Стопка — это набор карточек по одному предмету: английский, биология, алгебра.
                </ThemedText>
              </View>
            ) : undefined
          }
          renderItem={({ item }) => (
            <Link href={{ pathname: '/deck/[id]', params: { id: item.id } }} asChild>
              <Pressable style={[styles.row, { borderColor: theme.border }]}>
                <ThemedText>{item.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Карточек: {item.card_count} · сложных: {item.hard_count}
                </ThemedText>
              </Pressable>
            </Link>
          )}
        />
      )}
      <Button title="Новая стопка" variant="primary" onPress={() => router.push('/deck/new')} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.three },
  list: { flexGrow: 1, gap: Spacing.two, paddingVertical: Spacing.three },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  center: { textAlign: 'center' },
  row: { borderWidth: 1, borderRadius: 12, padding: Spacing.three, gap: Spacing.one },
});
