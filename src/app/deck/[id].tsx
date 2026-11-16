import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { deckToCatalogSet } from '@/catalog/catalog';
import { shareCatalogSet } from '@/catalog/share-file';
import { HeaderIcon } from '@/components/header-icon';
import { StatusScreen } from '@/components/status-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { cardStatus, listCards, type CardStatus } from '@/db/cards';
import { getDeck } from '@/db/decks';
import { useFocusLoad } from '@/hooks/use-focus-load';
import { useTheme } from '@/hooks/use-theme';

const STATUS_LABEL: Record<CardStatus, string> = {
  new: 'новая',
  hard: 'сложная',
  learning: 'учу',
  known: 'знаю',
};

export default function DeckScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data, error } = useFocusLoad(
    useCallback(
      async () => ({ deck: await getDeck(db, id), cards: await listCards(db, id) }),
      [db, id],
    ),
  );

  if (error) return <StatusScreen error={error} />;
  if (!data) return <StatusScreen />;
  const { deck, cards } = data;
  if (!deck) return <StatusScreen error="Стопка не найдена." />;

  const statusColor: Record<CardStatus, string> = {
    new: theme.textSecondary,
    hard: theme.danger,
    learning: theme.textSecondary,
    known: theme.success,
  };
  const progress = deck.card_count ? deck.known_count / deck.card_count : 0;
  const share = () =>
    shareCatalogSet(
      // В файле — в том же порядке, что на экране стопки.
      deckToCatalogSet(deck, cards.map(({ front, back }) => ({ front, back }))),
    ).catch((e: unknown) =>
      Alert.alert('Не получилось поделиться', e instanceof Error ? e.message : String(e)),
    );
  const addCard = () => router.push({ pathname: '/card/new', params: { deckId: deck.id } });

  return (
    <ThemedView style={[styles.container, { paddingBottom: insets.bottom + Spacing.three }]}>
      <Stack.Screen
        options={{
          title: deck.name,
          headerRight: () => (
            <View style={styles.headerIcons}>
              {cards.length > 0 && (
                <HeaderIcon name="share-outline" label="Поделиться стопкой" onPress={share} />
              )}
              <HeaderIcon
                name="create-outline"
                label="Изменить стопку"
                onPress={() => router.push({ pathname: '/deck/edit', params: { id: deck.id } })}
              />
            </View>
          ),
        }}
      />
      <FlatList
        data={cards}
        keyExtractor={(card) => card.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          cards.length > 0 ? (
            <View style={styles.header}>
              <ThemedText type="small" themeColor="textSecondary">
                Выучено {deck.known_count} из {deck.card_count}
              </ThemedText>
              <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
                <View
                  style={[styles.fill, { backgroundColor: theme.accent, width: `${progress * 100}%` }]}
                />
              </View>
              <Button
                title="Начать раунд"
                variant="primary"
                onPress={() =>
                  router.push({ pathname: '/round/[deckId]', params: { deckId: deck.id } })
                }
              />
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <ThemedText type="subtitle" style={styles.center}>
              Добавь первую карточку
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.center}>
              На одной стороне — слово или термин, на другой — перевод или объяснение.
            </ThemedText>
          </View>
        }
        renderItem={({ item }) => {
          const status = cardStatus(item);
          return (
            <Pressable
              accessibilityRole="button"
              style={[styles.row, { borderColor: theme.border }]}
              onPress={() => router.push({ pathname: '/card/[id]', params: { id: item.id } })}>
              <View style={styles.rowText}>
                <ThemedText numberOfLines={1}>{item.front}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {item.back}
                </ThemedText>
              </View>
              <ThemedText type="small" style={{ color: statusColor[status] }}>
                {STATUS_LABEL[status]}
              </ThemedText>
            </Pressable>
          );
        }}
      />
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button
            title="Добавить карточку"
            variant={cards.length ? 'secondary' : 'primary'}
            onPress={addCard}
          />
        </View>
        <Button
          title="Из учебника"
          icon="library-outline"
          onPress={() => router.push({ pathname: '/catalog', params: { deckId: deck.id } })}
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.three },
  list: { flexGrow: 1, gap: Spacing.two, paddingVertical: Spacing.three },
  header: { gap: Spacing.two, marginBottom: Spacing.two },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  center: { textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
  },
  rowText: { flex: 1, gap: Spacing.half },
  actions: { flexDirection: 'row', gap: Spacing.two },
  headerIcons: { flexDirection: 'row', gap: Spacing.four },
  action: { flex: 1 },
});
