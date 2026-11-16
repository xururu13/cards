import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Прокручиваемая форма с прижатыми к низу кнопками. */
export function FormScreen({ children, footer }: { children: React.ReactNode; footer: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ThemedView style={styles.flex}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        // Высота шапки навигации: без неё кнопки внизу остаются под клавиатурой.
        keyboardVerticalOffset={Platform.OS === 'android' ? insets.top + 56 : 96}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.three }]}>{footer}</View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

export function FieldLabel({ children }: { children: string }) {
  return (
    <ThemedText type="small" themeColor="textSecondary">
      {children}
    </ThemedText>
  );
}

export function FormError({ message }: { message: string | null }) {
  const theme = useTheme();
  if (!message) return null;
  return (
    <ThemedText type="small" style={{ color: theme.danger }}>
      {message}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.two },
  footer: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, gap: Spacing.two },
});
