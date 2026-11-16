import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Alert, BackHandler, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listDecks } from '@/db/decks';
import { Button } from '@/components/button';
import { FlipCard } from '@/components/flip-card';
import { FormError } from '@/components/form';
import { HeaderIcon } from '@/components/header-icon';
import { StatusScreen } from '@/components/status-screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { listAllCards, listCards } from '@/db/cards';
import { listMissedCardIds, saveRound } from '@/db/rounds';
import { getSettings } from '@/db/settings';
import type { Card } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';
import { useVoiceAnswer } from '@/hooks/use-voice-answer';
import type { Evaluation } from '@/ai/grade';
import { pickRoundCards, shuffle } from '@/round/picking';
import { formatDelta } from '@/round/format';
import { ALL_DECKS } from '@/round/mixed';
import { POINTS } from '@/round/scoring';
import { isFinished, sessionReducer, startSession } from '@/round/session';

const FLIP_MS = 450;
const SLIDE_MS = 260;

export default function RoundScreen() {
  const { deckId, fromRound } = useLocalSearchParams<{ deckId: string; fromRound?: string }>();
  const db = useSQLiteContext();
  const mixed = deckId === ALL_DECKS;
  const [round, setRound] = useState<{
    languages: Record<string, string>;
    cards: Card[];
    timeLimitMs: number | null;
    deckNames: Record<string, string> | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Карточки выбираются один раз при открытии: состав раунда не должен меняться на ходу.
  useEffect(() => {
    let active = true;
    (async () => {
      const languages = Object.fromEntries((await listDecks(db)).map(d => [d.id, d.back_lang]));
      const settings = await getSettings(db);
      const withDecks = mixed ? await listAllCards(db) : null;
      const all = withDecks ?? (await listCards(db, deckId));
      const timeLimitMs = settings.timerSeconds > 0 ? settings.timerSeconds * 1000 : null;
      // В смешанном раунде на карточке подписано, из какой она стопки.
      const deckNames = withDecks && Object.fromEntries(withDecks.map((card) => [card.deck_id, card.deck_name]));
      if (!fromRound) {
        return { languages, cards: pickRoundCards(all, settings.roundSize, Date.now()), timeLimitMs, deckNames };
      }
      const missed = new Set((await listMissedCardIds(db, fromRound)).map((row) => row.id));
      return { languages, cards: shuffle(all.filter((card) => missed.has(card.id))), timeLimitMs, deckNames };
    })()
      .then((loaded) => active && setRound(loaded))
      .catch((e: unknown) => active && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      active = false;
    };
  }, [db, deckId, fromRound, mixed]);

  if (error) return <StatusScreen error={error} />;
  if (!round) return <StatusScreen />;
  if (round.cards.length === 0) {
    return <StatusScreen error={mixed ? 'Пока нет карточек ни в одной стопке.' : 'В стопке нет карточек для раунда.'} />;
  }
  return (
    <RoundPlay
      deckId={mixed ? null : deckId}
      cards={round.cards}
      languages={round.languages}
      timeLimitMs={round.timeLimitMs}
      deckNames={round.deckNames}
    />
  );
}

type RoundPlayProps = {
  languages: Record<string, string>;
  /** null — смешанный раунд. */
  deckId: string | null;
  cards: Card[];
  timeLimitMs: number | null;
  /** Названия стопок для подписи на карточке; null — раунд по одной стопке. */
  deckNames: Record<string, string> | null;
};

function RoundPlay({ deckId, cards, timeLimitMs, deckNames, languages }: RoundPlayProps) {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();

  const [session, dispatch] = useReducer(sessionReducer, undefined, () =>
    startSession(cards, timeLimitMs),
  );
  const [startedAt] = useState(() => Date.now());
  // Карточка на экране отстаёт от сессии на время анимации смены.
  const [shownIndex, setShownIndex] = useState(0);
  const [remainingMs, setRemainingMs] = useState(timeLimitMs ?? 0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const questionStart = useRef(0);
  const saving = useRef(false);

  const flip = useSharedValue(0);
  const slide = useSharedValue(0);
  const timer = useSharedValue(1);

  const transitioning = shownIndex !== session.index;
  const asking = session.phase === 'question' && !transitioning;
  const speaking = session.phase === 'voice';
  const item = session.queue[shownIndex];
  const onEvaluation = useCallback((result: Evaluation) => {
    dispatch({ type: 'graded', index: shownIndex, ...result });
  }, [shownIndex]);
  const voice = useVoiceAnswer({
    enabled: speaking,
    question: item.card.front,
    reference: item.card.back,
    language: languages[item.card.deck_id] ?? 'ru-RU',
    onResult: onEvaluation,
  });

  // Таймер вопроса: полоса убывает плавно, число обновляется несколько раз в секунду.
  useEffect(() => {
    if (!asking) return;
    questionStart.current = Date.now() - session.revealTimeMs;
    if (!timeLimitMs) return;
    timer.value = Math.max(0, 1 - session.revealTimeMs / timeLimitMs);
    timer.value = withTiming(0, { duration: Math.max(0, timeLimitMs - session.revealTimeMs), easing: Easing.linear });
    const interval = setInterval(() => {
      const left = timeLimitMs - (Date.now() - questionStart.current);
      setRemainingMs(Math.max(0, left));
      if (left <= 0) dispatch({ type: 'reveal', by: 'timeout', timeMs: timeLimitMs });
    }, 200);
    return () => {
      clearInterval(interval);
      cancelAnimation(timer);
    };
  }, [asking, shownIndex, timer, timeLimitMs, session.revealTimeMs]);

  // Переворот при открытии оборота.
  useEffect(() => {
    if (session.phase === 'answer') {
      flip.value = withTiming(1, { duration: FLIP_MS, easing: Easing.inOut(Easing.cubic) });
    }
  }, [session.phase, session.index, flip]);

  const finish = useCallback(async () => {
    if (saving.current) return;
    saving.current = true;
    try {
      const roundId = await saveRound(db, deckId, startedAt, session.answers);
      router.replace({ pathname: '/round/result', params: { roundId } });
    } catch (e) {
      saving.current = false;
      setSaveError(e instanceof Error ? e.message : String(e));
    }
  }, [db, deckId, router, session.answers, startedAt]);

  // Смена карточки: текущая уезжает влево, следующая въезжает справа.
  useEffect(() => {
    if (!transitioning) return;
    slide.value = withTiming(-1, { duration: SLIDE_MS, easing: Easing.in(Easing.cubic) });
    const timeout = setTimeout(() => {
      if (isFinished(session)) {
        void finish();
        return;
      }
      flip.value = 0;
      setRemainingMs(timeLimitMs ?? 0);
      setShownIndex(session.index);
      slide.value = withSequence(
        withTiming(1, { duration: 0 }),
        withTiming(0, { duration: SLIDE_MS, easing: Easing.out(Easing.cubic) }),
      );
    }, SLIDE_MS + 20);
    return () => clearTimeout(timeout);
  }, [transitioning, session, finish, flip, slide, timeLimitMs]);

  const confirmExit = useCallback(() => {
    Alert.alert('Прервать раунд?', 'Ответы этого раунда не сохранятся.', [
      { text: 'Продолжить', style: 'cancel' },
      { text: 'Прервать', style: 'destructive', onPress: () => router.back() },
    ]);
    return true;
  }, [router]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', confirmExit);
    return () => subscription.remove();
  }, [confirmExit]);

  const reveal = (by: 'check' | 'hint') =>
    dispatch({ type: 'reveal', by, timeMs: Date.now() - questionStart.current });

  const slideStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.abs(slide.value),
    transform: [{ translateX: reducedMotion ? 0 : slide.value * width }],
  }));
  const timerStyle = useAnimatedStyle(() => ({ width: `${timer.value * 100}%` }));

  const total = session.queue.length;
  const lastAnswer = session.answers.at(-1);
  const seconds = Math.ceil(remainingMs / 1000);
  const timeLow = remainingMs <= 5000;

  let controls: React.ReactNode = null;
  if (saveError) {
    controls = (
      <>
        <ThemedText type="small" style={[styles.center, { color: theme.danger }]}>
          Не удалось сохранить раунд. {saveError}
        </ThemedText>
        <Button title="Повторить сохранение" variant="primary" onPress={() => void finish()} />
      </>
    );
  } else if (transitioning) {
    // Пока карточка сменяется, показываем, сколько очков принёс ответ.
    controls = lastAnswer && (
      <ThemedText
        type="smallBold"
        style={[
          styles.center,
          { color: lastAnswer.points > 0 ? theme.success : lastAnswer.points < 0 ? theme.danger : theme.textSecondary },
        ]}>
        {formatDelta(lastAnswer.points)} очк.
      </ThemedText>
    );
  } else if (session.phase === 'question' || speaking) {
    controls = (
      <View style={styles.rate}>
        <View style={styles.flex}>
          <Button
            title={speaking ? 'Оценить' : 'Ответить'}
            variant="primary"
            icon={voice.listening ? 'mic' : 'mic-outline'}
            pulse={speaking && !voice.submitting && !voice.preparing && (voice.listening || !!voice.text.trim())}
            disabled={speaking && (voice.submitting || voice.preparing)}
            accessibilityState={{ busy: speaking && voice.submitting }}
            accessibilityHint={speaking ? 'Завершает диктовку и отправляет ответ на оценку' : undefined}
            onPress={speaking ? voice.evaluate : () => {
              dispatch({ type: 'voice', timeMs: Date.now() - questionStart.current });
              voice.start();
            }}
          />
        </View>
        <View style={styles.flex}>
          <Button title="Проверить" variant="secondary" onPress={() => reveal('check')} />
        </View>
      </View>
    );
  } else if (session.reveal === 'voice' && session.evaluation) {
    controls = <>
      <ThemedText type="smallBold">Оценка: {session.evaluation.grade} из 5</ThemedText>
      <ThemedText type="small">{session.evaluation.feedback}</ThemedText>
      <Button title="Дальше" variant="primary" onPress={() => dispatch({ type: 'continue' })} />
    </>;
  } else if (session.reveal === 'check') {
    controls = (
      <View style={styles.rate}>
        <View style={styles.flex}>
          <Button
            title="Ошибся"
            variant="danger"
            icon="close"
            onPress={() => dispatch({ type: 'rate', correct: false })}
          />
        </View>
        <View style={styles.flex}>
          <Button
            title="Вспомнил"
            variant="success"
            icon="checkmark"
            onPress={() => dispatch({ type: 'rate', correct: true })}
          />
        </View>
      </View>
    );
  } else {
    controls = (
      <>
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          {session.reveal === 'timeout' ? 'Время вышло' : 'Открыто по подсказке'} ·{' '}
          {formatDelta(session.reveal === 'timeout' ? POINTS.timeout : POINTS.penalty)}
        </ThemedText>
        <Button title="Дальше" variant="primary" onPress={() => dispatch({ type: 'continue' })} />
      </>
    );
  }

  return (
    <ThemedView style={[styles.container, { paddingBottom: insets.bottom + Spacing.three }]}>
      <Stack.Screen
        options={{
          title: `${Math.min(shownIndex + 1, total)} из ${total}`,
          headerRight: () => (
            <View style={[styles.score, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold">{session.score} очк.</ThemedText>
            </View>
          ),
          headerBackVisible: false,
          gestureEnabled: false,
          headerLeft: () => (
            <View style={styles.headerLeft}>
              <HeaderIcon name="close" label="Прервать раунд" onPress={confirmExit} />
            </View>
          ),
        }}
      />
      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View
          style={[
            styles.fill,
            { backgroundColor: theme.accent, width: `${(session.index / total) * 100}%` },
          ]}
        />
      </View>
      {timeLimitMs !== null && (
      <View style={[styles.timerRow, !asking && !speaking && styles.hidden]}>
        <View style={[styles.track, styles.flex, { backgroundColor: theme.backgroundSelected }]}>
          <Animated.View
            style={[
              styles.fill,
              { backgroundColor: timeLow ? theme.danger : theme.warning },
              timerStyle,
            ]}
          />
        </View>
        <ThemedText
          type="smallBold"
          style={[styles.seconds, timeLow && { color: theme.danger }]}
          accessibilityLabel={`Осталось секунд: ${seconds}`}>
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
        </ThemedText>
      </View>
      )}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={insets.top + 56}>
      <Animated.View style={[styles.flex, slideStyle]}>
        <FlipCard
          front={item.card.front}
          frontContent={speaking ? (
            <>
              <TextField
                accessibilityLabel="Распознанный ответ"
                value={voice.text}
                onChangeText={voice.setText}
                multiline
                maxLength={2000}
                editable={voice.editable}
                placeholder="Твой ответ…"
              />
              <FormError message={voice.error} />
            </>
          ) : undefined}
          back={item.card.back}
          caption={item.repeat ? 'Повтор после ошибки. Вспомни, что на обороте' : 'Вспомни, что на обороте'}
          label={deckNames?.[item.card.deck_id]}
          flip={flip}
          reducedMotion={reducedMotion}
        />
      </Animated.View>
      </KeyboardAvoidingView>
      {controls && <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 240, flexGrow: 0 }} contentContainerStyle={styles.controls}>{controls}</ScrollView>}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.three, gap: Spacing.three },
  flex: { flex: 1 },
  headerLeft: { marginRight: Spacing.three },
  score: { borderRadius: 14, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  hidden: { opacity: 0 },
  seconds: { minWidth: 40, textAlign: 'right', fontVariant: ['tabular-nums'] },
  controls: { minHeight: 104, gap: Spacing.two, justifyContent: 'flex-end' },
  rate: { flexDirection: 'row', gap: Spacing.two },
  center: { textAlign: 'center' },
});
