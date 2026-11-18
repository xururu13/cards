import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Флаг страны — пара региональных индикаторов. Вторая строка может уточнять регион.
const COUNTRY_FLAG = /^([\u{1F1E6}-\u{1F1FF}]{2})(?:\n(.+))?$/u;

type Props = {
  front: string;
  frontContent?: React.ReactNode;
  back: string;
  backContent?: React.ReactNode;
  showBack: boolean;
  /** Подпись под словом на лицевой стороне. */
  caption: string;
  /** Метка в углу обеих сторон, например стопка карточки в смешанном раунде. */
  label?: string;
  /** 0 — видна сторона со словом, 1 — оборот. */
  flip: SharedValue<number>;
  /** При «уменьшении движения» стороны проявляются без переворота. */
  reducedMotion: boolean;
};

export function FlipCard({ front, frontContent, back, backContent, showBack, caption, label, flip, reducedMotion }: Props) {
  const theme = useTheme();

  const frontStyle = useAnimatedStyle(() =>
    reducedMotion
      ? { opacity: 1 - flip.value }
      : {
          transform: [
            { perspective: 1200 },
            { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` },
          ],
        },
  );
  const backStyle = useAnimatedStyle(() =>
    reducedMotion
      ? { opacity: flip.value }
      : {
          transform: [
            { perspective: 1200 },
            { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` },
          ],
        },
  );

  const face = [styles.face, { borderColor: theme.border, backgroundColor: theme.backgroundElement }];
  const scroll = [styles.scroll, label && styles.belowLabel];
  const flag = COUNTRY_FLAG.exec(front);
  const flagContent = flag ? (
    <>
      <ThemedText
        accessibilityLabel="Флаг страны"
        style={[styles.center, styles.flag]}
        numberOfLines={1}
        adjustsFontSizeToFit>
        {flag[1]}
      </ThemedText>
      {flag[2] && (
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.center}>
          {flag[2]}
        </ThemedText>
      )}
    </>
  ) : null;
  const badge = label ? (
    <ThemedText type="small" style={[styles.label, { color: theme.accent }]} numberOfLines={1}>
      {label}
    </ThemedText>
  ) : null;
  return (
    <View style={styles.container}>
      <Animated.View
        style={[face, frontStyle]}
        pointerEvents={showBack ? 'none' : 'auto'}
        accessibilityElementsHidden={showBack}
        importantForAccessibility={showBack ? 'no-hide-descendants' : 'auto'}>
        {badge}
        <ScrollView style={scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {flagContent ?? <ThemedText type="subtitle" style={styles.center} adjustsFontSizeToFit numberOfLines={4}>
            {front}
          </ThemedText>}
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            {flag ? 'Назови страну' : caption}
          </ThemedText>
          {frontContent}
        </ScrollView>
      </Animated.View>
      <Animated.View
        style={[face, backStyle]}
        pointerEvents={showBack ? 'auto' : 'none'}
        accessibilityElementsHidden={!showBack}
        importantForAccessibility={showBack ? 'auto' : 'no-hide-descendants'}>
        {badge}
        <ScrollView style={scroll} contentContainerStyle={styles.content}>
          {flagContent ?? <ThemedText type="subtitle" themeColor="textSecondary" style={[styles.center, styles.backQuestion]}>
            {front}
          </ThemedText>}
          <ThemedText style={[styles.center, styles.backText]}>{back}</ThemedText>
          {backContent}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { alignSelf: 'stretch', flex: 1 },
  belowLabel: { marginTop: Spacing.four },
  content: { flexGrow: 1, justifyContent: 'center', gap: Spacing.three, paddingBottom: Spacing.six },
  face: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 1,
    borderRadius: 20,
    padding: Spacing.four,
    alignItems: 'center',
    backfaceVisibility: 'hidden',
  },
  center: { textAlign: 'center' },
  flag: { fontSize: 104, lineHeight: 126, fontWeight: 'normal' },
  label: { position: 'absolute', top: Spacing.three, left: Spacing.four, right: Spacing.four, textAlign: 'center' },
  backQuestion: { fontSize: 26, lineHeight: 34 },
  backText: { fontSize: 24, lineHeight: 32 },
});
