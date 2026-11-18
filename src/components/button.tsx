import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  pulse?: boolean;
  compact?: boolean;
  prominent?: boolean;
  recording?: boolean;
};

function PulseHighlight() {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (reducedMotion) return;
    opacity.value = withRepeat(withTiming(0.12, { duration: 650 }), -1, true);
    return () => cancelAnimation(opacity);
  }, [opacity, reducedMotion]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View pointerEvents="none" style={[styles.highlight, style]} />;
}

export function Button({ title, variant = 'secondary', icon, pulse, compact, prominent, recording, ...rest }: ButtonProps) {
  const theme = useTheme();
  const primary = variant === 'primary';
  const color = primary
    ? theme.onAccent
    : variant === 'danger'
      ? theme.danger
      : variant === 'success'
        ? theme.success
        : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        prominent && styles.prominent,
        primary
          ? { backgroundColor: theme.accent, borderColor: theme.accent }
          : { borderColor: variant === 'secondary' ? theme.border : color },
        pulse && styles.pulseBase,
        pressed && styles.pressed,
      ]}
      {...rest}>
      {pulse && <PulseHighlight />}
      {recording && (
        <View style={styles.recording}>
          <View style={styles.recordDot} />
          <ThemedText style={styles.recordingText}>Идёт запись</ThemedText>
        </View>
      )}
      {icon && <Ionicons name={icon} size={20} color={color} />}
      <ThemedText type={compact ? 'smallBold' : 'default'} style={[
        { color },
        compact && styles.compactText,
        prominent && styles.prominentText,
      ]}>{title}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  compact: { paddingHorizontal: Spacing.one },
  compactText: { textAlign: 'center', flexShrink: 1 },
  prominent: { flexDirection: 'column', minHeight: 80, paddingVertical: Spacing.two },
  prominentText: { fontSize: 20, lineHeight: 26, fontWeight: '700', textAlign: 'center' },
  recording: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: '#861F31',
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.half,
  },
  recordDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFB4B8' },
  recordingText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  pulseBase: { backgroundColor: '#183A9E', borderColor: '#183A9E' },
  highlight: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#2B63DC',
    borderColor: '#B6DFFF',
    borderRadius: 11,
    borderWidth: 3,
  },
  pressed: { opacity: 0.7 },
});
