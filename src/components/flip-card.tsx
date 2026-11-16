import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  front: string;
  back: string;
  /** Подпись под словом на лицевой стороне. */
  caption: string;
  /** Метка в углу обеих сторон, например стопка карточки в смешанном раунде. */
  label?: string;
  /** 0 — видна сторона со словом, 1 — оборот. */
  flip: SharedValue<number>;
  /** При «уменьшении движения» стороны проявляются без переворота. */
  reducedMotion: boolean;
};

export function FlipCard({ front, back, caption, label, flip, reducedMotion }: Props) {
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
  const badge = label ? (
    <ThemedText type="small" style={[styles.label, { color: theme.accent }]} numberOfLines={1}>
      {label}
    </ThemedText>
  ) : null;

  return (
    <View style={styles.container}>
      <Animated.View style={[face, frontStyle]}>
        {badge}
        <ThemedText type="subtitle" style={styles.center} adjustsFontSizeToFit numberOfLines={4}>
          {front}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          {caption}
        </ThemedText>
      </Animated.View>
      <Animated.View style={[face, backStyle]}>
        {badge}
        <ThemedText type="small" themeColor="textSecondary" style={styles.center} numberOfLines={2}>
          {front}
        </ThemedText>
        <ScrollView style={styles.backScroll} contentContainerStyle={styles.backContent}>
          <ThemedText style={[styles.center, styles.backText]}>{back}</ThemedText>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  face: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 1,
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    backfaceVisibility: 'hidden',
  },
  center: { textAlign: 'center' },
  label: { position: 'absolute', top: Spacing.three, left: Spacing.four, right: Spacing.four, textAlign: 'center' },
  backScroll: { flexGrow: 0, alignSelf: 'stretch' },
  backContent: { flexGrow: 1, justifyContent: 'center' },
  backText: { fontSize: 22, lineHeight: 30 },
});
