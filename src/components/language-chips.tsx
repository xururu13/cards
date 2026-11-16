import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { LANGUAGES } from '@/constants/languages';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function LanguageChips({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {LANGUAGES.map((lang) => {
        const selected = lang.code === value;
        return (
          <Pressable
            key={lang.code}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(lang.code)}
            style={[
              styles.chip,
              { borderColor: selected ? theme.accent : theme.border },
              selected && { backgroundColor: theme.accent },
            ]}>
            <ThemedText type="small" style={selected && { color: theme.onAccent }}>
              {lang.label}
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
