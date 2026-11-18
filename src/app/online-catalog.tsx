import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { downloadOnlineSet, loadOnlineCatalog, type OnlineCatalogEntry } from '@/catalog/online';
import { Button } from '@/components/button';
import { HeaderIcon } from '@/components/header-icon';
import { StatusScreen } from '@/components/status-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { CatalogSetExistsError, saveImportedSet } from '@/db/catalog-sets';
import { useOnboarding } from '@/hooks/use-onboarding';
import { useTheme } from '@/hooks/use-theme';

type CatalogState = { entries?: OnlineCatalogEntry[]; error?: string };
type Replacement = { entry: OnlineCatalogEntry; source: string };

export default function OnlineCatalogScreen() {
  const { deckId, guide } = useLocalSearchParams<{ deckId?: string; guide?: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { state } = useOnboarding();
  const guided = guide === '1' && !deckId && state !== null && state !== 'done';
  const [catalog, setCatalog] = useState<CatalogState>({});
  const [busyId, setBusyId] = useState<string>();
  const [importError, setImportError] = useState<string>();
  const [replacement, setReplacement] = useState<Replacement>();
  const loading = useRef<AbortController | null>(null);
  const importing = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    loading.current?.abort();
    const controller = new AbortController();
    loading.current = controller;
    setCatalog({});
    setImportError(undefined);
    loadOnlineCatalog(controller)
      .then((entries) => {
        if (loading.current === controller) setCatalog({ entries });
      })
      .catch(() => {
        if (loading.current === controller) {
          setCatalog({ error: 'Не удалось загрузить каталог. Проверь подключение и попробуй снова.' });
        }
      });
  }, []);

  useFocusEffect(useCallback(() => {
    refresh();
    return () => {
      loading.current?.abort();
      loading.current = null;
      importing.current?.abort();
      importing.current = null;
      setBusyId(undefined);
      setReplacement(undefined);
    };
  }, [refresh]));

  const importSet = async (entry: OnlineCatalogEntry, confirmedSource?: string) => {
    if (importing.current) return;
    const controller = new AbortController();
    importing.current = controller;
    setBusyId(entry.id);
    setReplacement(undefined);
    setImportError(undefined);
    let source = confirmedSource;
    try {
      source ??= await downloadOnlineSet(entry, controller);
      if (importing.current !== controller) return;
      const { set } = await saveImportedSet(db, source, undefined, {
        expectedId: entry.id,
        replaceExisting: confirmedSource !== undefined,
      });
      if (importing.current === controller) {
        const destination = {
          pathname: '/catalog/[setId]' as const,
          params: { setId: set.id, deckId, guide: guided ? '1' : undefined },
        };
        if (guided) router.push(destination);
        else router.replace(destination);
      }
    } catch (error) {
      if (importing.current !== controller) return;
      if (error instanceof CatalogSetExistsError && source !== undefined) {
        setReplacement({ entry, source });
      } else {
        setImportError(error instanceof Error ? error.message : 'Не удалось загрузить набор.');
      }
    } finally {
      if (importing.current === controller) {
        importing.current = null;
        setBusyId(undefined);
      }
    }
  };

  const showImport = busyId !== undefined || replacement !== undefined || importError !== undefined;
  const canRefresh = catalog.entries !== undefined && busyId === undefined && replacement === undefined;
  return (
    <ThemedView style={[styles.screen, { paddingBottom: insets.bottom + Spacing.three }]}>
      <Stack.Screen options={{
        title: 'Онлайн-каталог',
        headerRight: canRefresh
          ? () => <HeaderIcon name="refresh-outline" label="Обновить каталог" onPress={refresh} />
          : undefined,
      }} />
      {catalog.error ? (
        <>
          <StatusScreen error={catalog.error} />
          <View style={styles.footer}>
            <Button title="Повторить" icon="refresh-outline" onPress={refresh} />
          </View>
        </>
      ) : catalog.entries ? (
        <>
          <FlatList
            data={catalog.entries}
            keyExtractor={(entry) => entry.id}
            contentContainerStyle={styles.list}
            ListHeaderComponent={guided && catalog.entries.length > 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Выбери набор. На следующем экране можно взять один параграф для первого раунда.
              </ThemedText>
            ) : undefined}
            ListEmptyComponent={<ThemedText type="subtitle">В каталоге пока нет наборов</ThemedText>}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Импортировать «${item.title}»`}
                disabled={busyId !== undefined || replacement !== undefined}
                onPress={() => importSet(item)}
                style={[styles.row, { borderColor: theme.border }]}>
                <ThemedText>{item.title}</ThemedText>
                {item.source && (
                  <ThemedText type="small" themeColor="textSecondary">{item.source}</ThemedText>
                )}
                <ThemedText type="small" themeColor="textSecondary">
                  Параграфов: {item.sectionCount} · карточек: {item.cardCount}
                </ThemedText>
              </Pressable>
            )}
          />
          {showImport && (
            <View style={styles.footer}>
              {busyId && <ThemedText accessibilityLiveRegion="polite">Загружаем набор…</ThemedText>}
              {importError && (
                <ThemedText accessibilityLiveRegion="polite" style={{ color: theme.danger }}>
                  {importError}
                </ThemedText>
              )}
              {replacement && (
                <>
                  <ThemedText accessibilityLiveRegion="polite">Заменить «{replacement.entry.title}»?</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Карточки, уже добавленные в стопки, сохранятся.
                  </ThemedText>
                  <Button
                    title="Заменить набор"
                    variant="primary"
                    onPress={() => importSet(replacement.entry, replacement.source)}
                  />
                  <Button title="Отмена" onPress={() => setReplacement(undefined)} />
                </>
              )}
            </View>
          )}
        </>
      ) : <StatusScreen />}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { padding: Spacing.three, gap: Spacing.two },
  row: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  footer: { paddingHorizontal: Spacing.three, gap: Spacing.two },
});
