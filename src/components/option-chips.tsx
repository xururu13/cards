import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props<T> = {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

/** Выбор одного значения из нескольких. */
export function OptionChips<T extends string | number>({ options, value, onChange }: Props<T>) {
  const theme = useTheme();
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[
              styles.chip,
              { borderColor: selected ? theme.accent : theme.border },
              selected && { backgroundColor: theme.accent },
            ]}>
            <ThemedText type="small" style={selected && { color: theme.onAccent }}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: Spacing.three,
    minHeight: 36,
    justifyContent: 'center',
  },
});
