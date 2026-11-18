import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useOnboarding } from '@/hooks/use-onboarding';
import { useTheme } from '@/hooks/use-theme';

export function CoachMark({ children, tip, below = false }: {
  children: ReactNode;
  tip?: { title: string; body: string } | false | null;
  below?: boolean;
}) {
  const { finish } = useOnboarding();
  const theme = useTheme();
  const bubble = tip ? (
    <View style={[styles.bubble, { borderColor: theme.accent, backgroundColor: theme.backgroundElement }]}>
      <View style={[
        styles.pointer, below ? styles.pointerUp : styles.pointerDown,
        { borderColor: theme.accent, backgroundColor: theme.backgroundElement },
      ]} />
      <ThemedText type="smallBold" themeColor="accent" accessibilityLiveRegion="polite">{tip.title}</ThemedText>
      <ThemedText type="small">{tip.body}</ThemedText>
      <Pressable accessibilityRole="button" onPress={finish} style={styles.skip}>
        <ThemedText type="smallBold" themeColor="textSecondary">Пропустить обучение</ThemedText>
      </Pressable>
    </View>
  ) : null;
  return (
    <View style={tip && styles.group}>
      {!below && bubble}
      <View>
        {children}
        {tip && <View pointerEvents="none" style={[styles.outline, { borderColor: theme.accent }]} />}
      </View>
      {below && bubble}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.three },
  bubble: { borderWidth: 1, borderRadius: 14, padding: Spacing.two + Spacing.one, gap: Spacing.one },
  pointer: {
    position: 'absolute', left: Spacing.four, width: 12, height: 12,
    transform: [{ rotate: '45deg' }],
  },
  pointerUp: { top: -7, borderTopWidth: 1, borderLeftWidth: 1 },
  pointerDown: { bottom: -7, borderBottomWidth: 1, borderRightWidth: 1 },
  outline: {
    position: 'absolute', top: -4, bottom: -4, left: -4, right: -4,
    borderWidth: 2, borderRadius: 16,
  },
  skip: { minHeight: 36, alignSelf: 'flex-start', justifyContent: 'center', marginBottom: -Spacing.one },
});
