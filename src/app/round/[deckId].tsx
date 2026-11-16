import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Alert, BackHandler, StyleSheet, useWindowDimensions, View } from 'react-native';
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

import { Button } from '@/components/button';
import { FlipCard } from '@/components/flip-card';
import { HeaderIcon } from '@/components/header-icon';
import { StatusScreen } from '@/components/status-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ANSWER_TIME_MS, ROUND_SIZE } from '@/constants/round';
import { Spacing } from '@/constants/theme';
import { listCards } from '@/db/cards';
import { listMissedCardIds, saveRound } from '@/db/rounds';
import type { Card } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';
import { isFinished, pickRoundCards, sessionReducer, startSession } from '@/round/session';

const FLIP_MS = 450;
const SLIDE_MS = 260;

export default function RoundScreen() {
  const { deckId, fromRound } = useLocalSearchParams<{ deckId: string; fromRound?: string }>();
  const db = useSQLiteContext();
  const [cards, setCards] = useState<Card[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Карточки выбираются один раз при открытии: состав раунда не должен меняться на ходу.
  useEffect(() => {
    let active = true;
    (async () => {
      const all = await listCards(db, deckId);
      if (!fromRound) return pickRoundCards(all, ROUND_SIZE);
      const missed = new Set((await listMissedCardIds(db, fromRound)).map((row) => row.id));
      return pickRoundCards(
        all.filter((card) => missed.has(card.id)),
        missed.size,
      );
    })()
      .then((picked) => active && setCards(picked))
      .catch((e: unknown) => active && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      active = false;
    };
  }, [db, deckId, fromRound]);

  if (error) return <StatusScreen error={error} />;
  if (!cards) return <StatusScreen />;
  if (cards.length === 0) return <StatusScreen error="В стопке нет карточек для раунда." />;
  return <RoundPlay deckId={deckId} cards={cards} />;
}

function RoundPlay({ deckId, cards }: { deckId: string; cards: Card[] }) {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();

  const [session, dispatch] = useReducer(sessionReducer, cards, startSession);
  const [startedAt] = useState(() => Date.now());
  // Карточка на экране отстаёт от сессии на время анимации смены.
  const [shownIndex, setShownIndex] = useState(0);
  const [remainingMs, setRemainingMs] = useState(ANSWER_TIME_MS);
  const [saveError, setSaveError] = useState<string | null>(null);
  const questionStart = useRef(0);
  const saving = useRef(false);

  const flip = useSharedValue(0);
  const slide = useSharedValue(0);
  const timer = useSharedValue(1);

  const transitioning = shownIndex !== session.index;
  const asking = session.phase === 'question' && !transitioning;

  // Таймер вопроса: полоса убывает плавно, число обновляется несколько раз в секунду.
  useEffect(() => {
    if (!asking) return;
    questionStart.current = Date.now();
    timer.value = 1;
    timer.value = withTiming(0, { duration: ANSWER_TIME_MS, easing: Easing.linear });
    const interval = setInterval(() => {
      const left = ANSWER_TIME_MS - (Date.now() - questionStart.current);
      setRemainingMs(Math.max(0, left));
      if (left <= 0) dispatch({ type: 'reveal', by: 'timeout', timeMs: ANSWER_TIME_MS });
    }, 200);
    return () => {
      clearInterval(interval);
      cancelAnimation(timer);
    };
  }, [asking, shownIndex, timer]);

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
      setRemainingMs(ANSWER_TIME_MS);
      setShownIndex(session.index);
      slide.value = withSequence(
        withTiming(1, { duration: 0 }),
        withTiming(0, { duration: SLIDE_MS, easing: Easing.out(Easing.cubic) }),
      );
    }, SLIDE_MS + 20);
    return () => clearTimeout(timeout);
  }, [transitioning, session, finish, flip, slide]);

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

  const card = cards[shownIndex];
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
    controls = null;
  } else if (session.phase === 'question') {
    controls = (
      <>
        <Button title="Проверить" variant="primary" onPress={() => reveal('check')} />
        <Button title="Подсказка" icon="bulb-outline" onPress={() => reveal('hint')} />
      </>
    );
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
          {session.reveal === 'timeout' ? 'Время вышло' : 'Открыто по подсказке'}
        </ThemedText>
        <Button title="Дальше" variant="primary" onPress={() => dispatch({ type: 'continue' })} />
      </>
    );
  }

  return (
    <ThemedView style={[styles.container, { paddingBottom: insets.bottom + Spacing.three }]}>
      <Stack.Screen
        options={{
          title: `${Math.min(shownIndex + 1, cards.length)} из ${cards.length}`,
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
            { backgroundColor: theme.accent, width: `${(session.index / cards.length) * 100}%` },
          ]}
        />
      </View>
      <View style={[styles.timerRow, !asking && styles.hidden]}>
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
          0:{String(seconds).padStart(2, '0')}
        </ThemedText>
      </View>
      <Animated.View style={[styles.flex, slideStyle]}>
        <FlipCard front={card.front} back={card.back} flip={flip} reducedMotion={reducedMotion} />
      </Animated.View>
      <View style={styles.controls}>{controls}</View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.three, gap: Spacing.three },
  flex: { flex: 1 },
  headerLeft: { marginRight: Spacing.three },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  hidden: { opacity: 0 },
  seconds: { minWidth: 40, textAlign: 'right', fontVariant: ['tabular-nums'] },
  controls: { minHeight: 104, gap: Spacing.two, justifyContent: 'flex-end' },
  rate: { flexDirection: 'row', gap: Spacing.two },
  center: { textAlign: 'center' },
});
