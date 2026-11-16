import { Stack, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { HeaderIcon } from '@/components/header-icon';
import { StatusScreen } from '@/components/status-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { listDecks } from '@/db/decks';
import { getScoreStats } from '@/db/stats';
import { useFocusLoad } from '@/hooks/use-focus-load';
import { useTheme } from '@/hooks/use-theme';

export default function DecksScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data, error } = useFocusLoad(
    useCallback(async () => ({ decks: await listDecks(db), stats: await getScoreStats(db) }), [db]),
  );
  const decks = data?.decks;
  const stats = data?.stats;

  if (error) return <StatusScreen error={`Не удалось прочитать базу. ${error}`} />;

  return (
    <ThemedView style={[styles.container, { paddingBottom: insets.bottom + Spacing.three }]}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <HeaderIcon
              name="settings-outline"
              label="Настройки"
              onPress={() => router.push('/settings')}
            />
          ),
        }}
      />
      <FlatList
        data={decks ?? []}
        keyExtractor={(deck) => deck.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          stats && stats.bestRound > 0 ? (
            <View style={styles.stats}>
              <View style={[styles.stat, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="small" themeColor="textSecondary">
                  Сегодня
                </ThemedText>
                <ThemedText type="subtitle">{stats.today}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  рекорд дня {stats.bestDay}
                </ThemedText>
              </View>
              <View style={[styles.stat, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="small" themeColor="textSecondary">
                  Лучший раунд
                </ThemedText>
                <ThemedText type="subtitle">{stats.bestRound}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {stats.bestRoundDeck ?? 'очков'}
                </ThemedText>
              </View>
            </View>
          ) : undefined
        }
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
          <Pressable
            accessibilityRole="button"
            style={[styles.row, { borderColor: theme.border }]}
            onPress={() => router.push({ pathname: '/deck/[id]', params: { id: item.id } })}>
            <ThemedText>{item.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {item.card_count === 0
                ? 'Пока без карточек'
                : `Карточек: ${item.card_count} · сложных: ${item.hard_count}`}
            </ThemedText>
          </Pressable>
        )}
      />
      <Button title="Новая стопка" variant="primary" onPress={() => router.push('/deck/new')} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.three },
  list: { flexGrow: 1, gap: Spacing.two, paddingVertical: Spacing.three },
  stats: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.two },
  stat: { flex: 1, borderRadius: 12, padding: Spacing.three },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  center: { textAlign: 'center' },
  row: { borderWidth: 1, borderRadius: 12, padding: Spacing.three, gap: Spacing.one },
});
