import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { ScoreStats } from '@/db/stats';
import type { WordOfDay } from '@/db/word-of-day';
import { useTheme } from '@/hooks/use-theme';
import { COUNTRY_FLAG } from '@/round/flag';

export function DailyDashboard({ stats, word, day }: { stats: ScoreStats; word: WordOfDay | null; day: number }) {
  const theme = useTheme();
  const hasAttempts = stats.todayAttempts > 0;
  const success = hasAttempts ? `${Math.round(100 * stats.todayCorrect / stats.todayAttempts)}%` : '—';
  const metrics = [
    { label: 'Раунды', value: String(stats.todayRounds) },
    { label: 'Баллы', value: String(stats.today) },
    { label: 'Успех', value: success },
  ];

  return (
    <View style={styles.dashboard}>
      <View style={styles.heading}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>Сегодня</ThemedText>
        {hasAttempts && (
          <ThemedText type="small" themeColor="textSecondary">
            Верно {stats.todayCorrect} из {stats.todayAttempts}
          </ThemedText>
        )}
      </View>
      <View style={styles.metrics}>
        {metrics.map(({ label, value }) => (
          <View key={label} style={[styles.metric, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
            <ThemedText type="subtitle" style={styles.metricValue} adjustsFontSizeToFit numberOfLines={1}>
              {value}
            </ThemedText>
          </View>
        ))}
      </View>
      {stats.bestRound > 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          Рекорд дня {stats.bestDay} · Лучший раунд {stats.bestRound}
          {stats.bestRoundDeck && ` · ${stats.bestRoundDeck}`}
        </ThemedText>
      )}
      {word && <DailyWord key={`${day}:${word.id}`} word={word} />}
    </View>
  );
}

function DailyWord({ word }: { word: WordOfDay }) {
  const theme = useTheme();
  const [revealed, setRevealed] = useState(false);
  const flag = COUNTRY_FLAG.exec(word.front);
  const term = flag ? word.back : word.front;
  const answer = flag?.[1] ?? word.back;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: revealed }}
      onPress={() => setRevealed((value) => !value)}
      style={({ pressed }) => [
        styles.word, { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        pressed && styles.pressed,
      ]}>
      <View style={styles.heading}>
        <ThemedText type="smallBold" themeColor="accent">Слово дня</ThemedText>
        <Ionicons name={revealed ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textSecondary} />
      </View>
      <ThemedText type="subtitle" style={styles.wordTerm}>{term}</ThemedText>
      {revealed && <ThemedText style={flag ? styles.wordFlag : undefined}>{answer}</ThemedText>}
      <ThemedText type="small" themeColor="textSecondary">
        {word.deck_name} · {revealed ? 'Скрыть ответ' : 'Показать ответ'}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dashboard: { gap: Spacing.two, marginBottom: Spacing.three },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two, flexWrap: 'wrap' },
  sectionTitle: { fontSize: 23, lineHeight: 30 },
  metrics: { flexDirection: 'row', gap: Spacing.two },
  metric: { flex: 1, borderRadius: 12, paddingHorizontal: Spacing.two, paddingVertical: Spacing.two, alignItems: 'center' },
  metricValue: { fontSize: 26, lineHeight: 34, fontVariant: ['tabular-nums'] },
  word: { borderWidth: 1, borderRadius: 14, padding: Spacing.three, gap: Spacing.one },
  wordTerm: { fontSize: 22, lineHeight: 29 },
  wordFlag: { fontSize: 44, lineHeight: 54 },
  pressed: { opacity: 0.85 },
});
