import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  icon?: React.ComponentProps<typeof Ionicons>['name'];
};

export function Button({ title, variant = 'secondary', icon, ...rest }: ButtonProps) {
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
        primary
          ? { backgroundColor: theme.accent, borderColor: theme.accent }
          : { borderColor: variant === 'secondary' ? theme.border : color },
        pressed && styles.pressed,
      ]}
      {...rest}>
      {icon && <Ionicons name={icon} size={20} color={color} />}
      <ThemedText style={{ color }}>{title}</ThemedText>
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
  pressed: { opacity: 0.7 },
});
