import { ActivityIndicator, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Экран загрузки; с `error` — экран ошибки. */
export function StatusScreen({ error }: { error?: string }) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.container}>
      {error ? (
        <ThemedText style={[styles.text, { color: theme.danger }]}>{error}</ThemedText>
      ) : (
        <ActivityIndicator color={theme.accent} />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  text: { textAlign: 'center' },
});
