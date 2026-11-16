import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

/** Заглушка экрана, который будет реализован на одном из следующих этапов. */
export function StubScreen({ stage, description }: { stage: number; description: string }) {
  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.center}>{description}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        Появится на этапе {stage}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
  center: { textAlign: 'center' },
});
