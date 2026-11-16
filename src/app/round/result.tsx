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
import { getRoundResult } from '@/db/rounds';
import type { AnswerResult } from '@/db/types';
import { useFocusLoad } from '@/hooks/use-focus-load';
import { useTheme } from '@/hooks/use-theme';

const MISS_LABEL: Record<Exclude<AnswerResult, 'correct'>, string> = {
  wrong: 'ошибка',
  hint: 'подсказка',
  timeout: 'время вышло',
};

export default function RoundResultScreen() {
  const { roundId } = useLocalSearchParams<{ roundId: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data, error } = useFocusLoad(useCallback(() => getRoundResult(db, roundId), [db, roundId]));

  if (error) return <StatusScreen error={error} />;
  if (data === undefined) return <StatusScreen />;
  if (data === null) return <StatusScreen error="Раунд не найден." />;

  const { round, answers } = data;
  const missed = answers.filter((answer) => answer.result !== 'correct');
  const stats = [
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
            <View style={styles.stats}>
              {stats.map((stat) => (
                <View
                  key={stat.label}
                  style={[styles.stat, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {stat.label}
                  </ThemedText>
                  <ThemedText type="subtitle" style={{ color: stat.color }}>
                    {stat.value}
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
              params: { deckId: round.deck_id, fromRound: round.id },
            })
          }
        />
      )}
      <Button
        title="К стопке"
        variant={missed.length > 0 ? 'secondary' : 'primary'}
        onPress={() => router.dismissTo({ pathname: '/deck/[id]', params: { id: round.deck_id } })}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.three, gap: Spacing.two },
  list: { flexGrow: 1, gap: Spacing.two, paddingVertical: Spacing.three },
  header: { gap: Spacing.three, marginBottom: Spacing.one },
  stats: { flexDirection: 'row', gap: Spacing.two },
  stat: { flex: 1, borderRadius: 12, padding: Spacing.three, gap: Spacing.one },
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
