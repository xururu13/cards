import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { StatusScreen } from '@/components/status-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getRoundResult, type RoundAnswer } from '@/db/rounds';
import { getBestRoundBefore, getScoreStats } from '@/db/stats';
import { ALL_DECKS } from '@/round/mixed';
import type { AnswerResult } from '@/db/types';
import { useFocusLoad } from '@/hooks/use-focus-load';
import { useTheme } from '@/hooks/use-theme';

const MISS_LABEL: Record<Exclude<AnswerResult, 'correct'>, string> = {
  wrong: 'ошибка',
  hint: 'подсказка',
  timeout: 'время вышло',
};

/** По одной строке на карточку: причина — первый неверный ответ на неё в раунде. */
function missedCards(answers: RoundAnswer[]): RoundAnswer[] {
  const seen = new Set<string>();
  return answers.filter((answer) => {
    if (answer.result === 'correct' || seen.has(answer.card_id)) return false;
    seen.add(answer.card_id);
    return true;
  });
}

export default function RoundResultScreen() {
  const { roundId } = useLocalSearchParams<{ roundId: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data, error } = useFocusLoad(
    useCallback(async () => {
      const result = await getRoundResult(db, roundId);
      if (!result) return null;
      const finishedAt = result.round.finished_at ?? Date.now();
      return {
        ...result,
        stats: await getScoreStats(db),
        previousBest: await getBestRoundBefore(db, finishedAt),
      };
    }, [db, roundId]),
  );

  if (error) return <StatusScreen error={error} />;
  if (data === undefined) return <StatusScreen />;
  if (data === null) return <StatusScreen error="Раунд не найден." />;

  const { round, answers, stats, previousBest } = data;
  const missed = missedCards(answers);
  const graded = answers.filter(a => a.grade !== null);
  const isRecord = round.score > 0 && round.score > previousBest;
  const counters = [
    { label: 'Верно', value: round.correct, color: theme.success },
    { label: 'Ошибки', value: round.wrong, color: theme.danger },
    { label: 'Подсказки', value: round.hints, color: theme.text },
  ];

  return (
    <ThemedView style={[styles.container, { paddingBottom: insets.bottom + Spacing.three }]}>
      <Stack.Screen options={{ headerBackVisible: false }} />
      <FlatList
        data={missed}
        keyExtractor={(answer) => answer.card_id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={[styles.score, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="small" themeColor="textSecondary">
                Очки за раунд
              </ThemedText>
              <ThemedText type="title">{round.score}</ThemedText>
              {isRecord && (
                <View style={[styles.badge, { backgroundColor: theme.warning }]}>
                  <ThemedText type="smallBold" style={styles.badgeText}>
                    Новый рекорд раунда
                  </ThemedText>
                </View>
              )}
              <ThemedText type="small" themeColor="textSecondary">
                За сегодня {stats.today} · рекорд дня {stats.bestDay}
              </ThemedText>
            </View>
            {graded.length > 0 && <View style={{ gap: 8 }}>
              <ThemedText type="smallBold">Оценки ответов</ThemedText>
              {graded.map((a, i) => <ThemedText type="small" key={`${a.card_id}-${i}`}>{a.front}: {a.grade}/5 · {a.points} очк.</ThemedText>)}
            </View>}
            <View style={styles.counters}>
              {counters.map((counter) => (
                <View
                  key={counter.label}
                  style={[styles.counter, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {counter.label}
                  </ThemedText>
                  <ThemedText type="subtitle" style={{ color: counter.color }}>
                    {counter.value}
                  </ThemedText>
                </View>
              ))}
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {missed.length > 0 ? 'Стоит повторить' : 'Все карточки вспомнил сам. Так держать.'}
            </ThemedText>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.row, { borderColor: theme.border }]}>
            <View style={styles.rowText}>
              <ThemedText numberOfLines={1}>{item.front}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                {item.back}
              </ThemedText>
            </View>
            {item.result !== 'correct' && (
              <ThemedText type="small" style={{ color: theme.danger }}>
                {MISS_LABEL[item.result]}
              </ThemedText>
            )}
          </View>
        )}
      />
      {missed.length > 0 && (
        <Button
          title="Повторить ошибки"
          variant="primary"
          onPress={() =>
            router.replace({
              pathname: '/round/[deckId]',
              params: { deckId: round.deck_id ?? ALL_DECKS, fromRound: round.id },
            })
          }
        />
      )}
      <Button
        title={round.deck_id ? 'К стопке' : 'К стопкам'}
        variant={missed.length > 0 ? 'secondary' : 'primary'}
        onPress={() =>
          round.deck_id
            ? router.dismissTo({ pathname: '/deck/[id]', params: { id: round.deck_id } })
            : router.dismissAll()
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.three, gap: Spacing.two },
  list: { flexGrow: 1, gap: Spacing.two, paddingVertical: Spacing.three },
  header: { gap: Spacing.three, marginBottom: Spacing.one },
  score: { borderRadius: 16, padding: Spacing.three, gap: Spacing.one, alignItems: 'center' },
  badge: { borderRadius: 12, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  badgeText: { color: '#3D2800' },
  counters: { flexDirection: 'row', gap: Spacing.two },
  counter: { flex: 1, borderRadius: 12, padding: Spacing.three, gap: Spacing.one },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
  },
  rowText: { flex: 1, gap: Spacing.half },
});
