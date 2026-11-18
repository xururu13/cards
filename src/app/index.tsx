import { Stack, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { DailyDashboard } from '@/components/daily-dashboard';
import { HeaderIcon } from '@/components/header-icon';
import { StatusScreen } from '@/components/status-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { listDecks } from '@/db/decks';
import { getScoreStats, nextDayStart, startOfDay } from '@/db/stats';
import { getWordOfDay } from '@/db/word-of-day';
import { ALL_DECKS } from '@/round/mixed';
import { useFocusLoad } from '@/hooks/use-focus-load';
import { useTheme } from '@/hooks/use-theme';

export default function DecksScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [day, setDay] = useState(() => startOfDay(Date.now()));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refreshDay = () => {
      clearTimeout(timer);
      const now = Date.now();
      setDay(startOfDay(now));
      timer = setTimeout(refreshDay, nextDayStart(now) - now);
    };
    refreshDay();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshDay();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);
  const { data, error } = useFocusLoad(
    useCallback(async () => {
      const [decks, stats, word] = await Promise.all([listDecks(db), getScoreStats(db, day), getWordOfDay(db, day)]);
      return { decks, stats, word, day };
    }, [db, day]),
  );
  const decks = data?.decks;
  // Смешанный раунд имеет смысл, когда карточки есть хотя бы в двух стопках.
  const canMix = (decks ?? []).filter((deck) => deck.card_count > 0).length >= 2;

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
        ListHeaderComponent={data && <DailyDashboard stats={data.stats} word={data.word} day={data.day} />}
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
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button title="Новая стопка" variant="primary" onPress={() => router.push('/deck/new')} />
        </View>
        {canMix && (
          <View style={styles.action}>
            <Button
              title="Смешанный раунд"
              icon="shuffle"
              onPress={() => Alert.alert('Смешанный раунд', 'Какой стороной показывать карточки?', [
                { text: 'Отмена', style: 'cancel' },
                {
                  text: 'Обычный',
                  onPress: () => router.push({ pathname: '/round/[deckId]', params: { deckId: ALL_DECKS } }),
                },
                {
                  text: 'Наоборот',
                  onPress: () => router.push({
                    pathname: '/round/[deckId]',
                    params: { deckId: ALL_DECKS, direction: 'reverse' },
                  }),
                },
              ], { cancelable: true })}
            />
          </View>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.three },
  list: { flexGrow: 1, gap: Spacing.two, paddingVertical: Spacing.three },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  center: { textAlign: 'center' },
  row: { borderWidth: 1, borderRadius: 12, padding: Spacing.three, gap: Spacing.one },
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: { flex: 1 },
});
