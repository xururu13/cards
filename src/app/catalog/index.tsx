import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { HeaderIcon } from '@/components/header-icon';
import { StatusScreen } from '@/components/status-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { allSections, countCards } from '@/catalog/catalog';
import { pickCatalogFile } from '@/catalog/pick-file';
import { shareCatalogSet } from '@/catalog/share-file';
import { Spacing } from '@/constants/theme';
import { deleteImportedSet, loadCatalog, saveImportedSet, type CatalogEntry } from '@/db/catalog-sets';
import { useFocusLoad } from '@/hooks/use-focus-load';
import { useTheme } from '@/hooks/use-theme';

/** Список наборов, загруженных из файлов. `deckId` — добавить в существующую стопку. */
export default function CatalogScreen() {
  const { deckId } = useLocalSearchParams<{ deckId?: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const { data: entries, error } = useFocusLoad(
    useCallback(() => {
      void version; // новая версия — перечитать список после загрузки или удаления набора
      return loadCatalog(db);
    }, [db, version]),
  );

  const open = (setId: string) =>
    router.push({ pathname: '/catalog/[setId]', params: deckId ? { setId, deckId } : { setId } });

  const importFile = async () => {
    setBusy(true);
    try {
      const source = await pickCatalogFile();
      if (source === null) return;
      const { set, replaced } = await saveImportedSet(db, source);
      setVersion((v) => v + 1);
      Alert.alert(
        replaced ? 'Набор обновлён' : 'Набор загружен',
        `«${set.title}»: параграфов ${allSections(set).length}, карточек ${countCards(set)}.`,
        [
          { text: 'Позже', style: 'cancel' },
          { text: 'Выбрать параграфы', onPress: () => open(set.id) },
        ],
      );
    } catch (e) {
      Alert.alert('Не получилось загрузить файл', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const share = (entry: CatalogEntry) =>
    shareCatalogSet(entry.set).catch((e: unknown) =>
      Alert.alert('Не получилось поделиться', e instanceof Error ? e.message : String(e)),
    );

  const remove = (entry: CatalogEntry) =>
    Alert.alert(
      'Убрать набор из списка?',
      `«${entry.set.title}» пропадёт из списка. Стопки и карточки из него останутся.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Убрать',
          style: 'destructive',
          onPress: async () => {
            await deleteImportedSet(db, entry.set.id);
            setVersion((v) => v + 1);
          },
        },
      ],
    );

  if (error) return <StatusScreen error={error} />;
  if (!entries) return <StatusScreen />;

  return (
    <ThemedView style={[styles.flex, { paddingBottom: insets.bottom + Spacing.three }]}>
      <ScrollView contentContainerStyle={styles.list}>
        {entries.map((entry) => (
          <Pressable
            key={entry.set.id}
            accessibilityRole="button"
            style={[styles.row, { borderColor: theme.border }]}
            onPress={() => open(entry.set.id)}>
            <View style={styles.rowText}>
              <ThemedText>{entry.set.title}</ThemedText>
              {entry.set.source && (
                <ThemedText type="small" themeColor="textSecondary">
                  {entry.set.source}
                </ThemedText>
              )}
              <ThemedText type="small" themeColor="textSecondary">
                Параграфов: {allSections(entry.set).length} · карточек: {countCards(entry.set)}
              </ThemedText>
            </View>
            <HeaderIcon name="share-outline" label="Поделиться набором" onPress={() => share(entry)} />
            <HeaderIcon name="trash-outline" label="Убрать набор" onPress={() => remove(entry)} />
          </Pressable>
        ))}
        {entries.length === 0 && (
          <ThemedText type="subtitle" style={styles.center}>
            Наборов пока нет
          </ThemedText>
        )}
        <ThemedText type="small" themeColor="textSecondary" style={entries.length === 0 && styles.center}>
          Набор — это файл YAML с главами, параграфами и парами «термин: определение». Его можно
          получить в мессенджере, скачать или взять с Google Диска. Файл с тем же id заменит
          прежнюю версию.
        </ThemedText>
      </ScrollView>
      <View style={styles.footer}>
        <Button title="Загрузить из файла" icon="document-outline" disabled={busy} onPress={importFile} />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: Spacing.three, gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
  },
  rowText: { flex: 1, gap: Spacing.one },
  footer: { paddingHorizontal: Spacing.three },
  center: { textAlign: 'center' },
});
