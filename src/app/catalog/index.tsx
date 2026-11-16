import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { allSections, CATALOG } from '@/catalog/catalog';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Список готовых наборов. `deckId` — добавить в существующую стопку. */
export default function CatalogScreen() {
  const { deckId } = useLocalSearchParams<{ deckId?: string }>();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={styles.flex}>
      <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + Spacing.three }]}>
        {CATALOG.map((set) => {
          const sections = allSections(set);
          const cards = sections.reduce((sum, s) => sum + s.cards.length, 0);
          return (
            <Pressable
              key={set.id}
              accessibilityRole="button"
              style={[styles.row, { borderColor: theme.border }]}
              onPress={() =>
                router.push({
                  pathname: '/catalog/[setId]',
                  params: deckId ? { setId: set.id, deckId } : { setId: set.id },
                })
              }>
              <ThemedText>{set.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {set.source}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Параграфов: {sections.length} · карточек: {cards}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: Spacing.three, gap: Spacing.two },
  row: { borderWidth: 1, borderRadius: 12, padding: Spacing.three, gap: Spacing.one },
});
