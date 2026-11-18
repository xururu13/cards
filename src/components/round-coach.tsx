import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const ACTIONS = [
  ['Ответить', 'Запиши голосом и нажми «Завершить и отправить», чтобы получить оценку.'],
  ['Проверить', 'Открой оборот и отметь, вспомнил ли ответ.'],
  ['Пропустить', 'Перейди к следующей карточке за 0 очков.'],
] as const;

export function RoundCoach({ onDismiss }: { onDismiss: () => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.panel, { borderColor: theme.accent, backgroundColor: theme.backgroundElement }]}>
      <View style={styles.heading}>
        <ThemedText type="smallBold" themeColor="accent" accessibilityLiveRegion="polite">Кнопки раунда</ThemedText>
        <Pressable accessibilityRole="button" onPress={onDismiss} style={styles.dismiss}>
          <ThemedText type="smallBold" themeColor="accent">Понятно</ThemedText>
        </Pressable>
      </View>
      {ACTIONS.map(([label, description]) => (
        <ThemedText key={label} type="small">
          <ThemedText type="smallBold">{label}</ThemedText>{' · '}{description}
        </ThemedText>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 14, paddingHorizontal: Spacing.three, paddingBottom: Spacing.two, gap: Spacing.one },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two, flexWrap: 'wrap' },
  dismiss: { minHeight: 44, justifyContent: 'center' },
});
