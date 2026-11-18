import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { FieldLabel, FormError, FormScreen } from '@/components/form';
import { StatusScreen } from '@/components/status-screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { allSections, sectionLabel, suggestDeckName, type CatalogSection } from '@/catalog/catalog';
import { Spacing } from '@/constants/theme';
import { importCatalog, loadedSections } from '@/db/catalog-import';
import { loadCatalogSet } from '@/db/catalog-sets';
import { getDeck } from '@/db/decks';
import { useFocusLoad } from '@/hooks/use-focus-load';
import { useOnboarding } from '@/hooks/use-onboarding';
import { useTheme } from '@/hooks/use-theme';

function cardsWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'карточку';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'карточки';
  return 'карточек';
}

/** Выбор глав и параграфов набора и загрузка их в стопку. */
export default function CatalogSetScreen() {
  const { setId, deckId, guide } = useLocalSearchParams<{ setId: string; deckId?: string; guide?: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useTheme();
  const { state, trackDeck } = useOnboarding();
  const guided = guide === '1' && !deckId && state !== null && state !== 'done';

  const { data, error: loadError } = useFocusLoad(
    useCallback(async () => {
      const set = await loadCatalogSet(db, setId);
      if (!set || !deckId) return { set, deckName: null, loaded: [] as number[] };
      const deck = await getDeck(db, deckId);
      return { set, deckName: deck?.name ?? null, loaded: await loadedSections(db, set, deckId) };
    }, [db, setId, deckId]),
  );

  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loadError) return <StatusScreen error={loadError} />;
  if (!data) return <StatusScreen />;
  const { set } = data;
  if (!set) return <StatusScreen error="Набор не найден." />;
  if (deckId && !data.deckName) return <StatusScreen error="Стопка не найдена." />;

  const loaded = new Set(data.loaded);
  const keys = [...selected];
  const count = allSections(set)
    .filter((s) => selected.has(s.key))
    .reduce((sum, s) => sum + s.cards.length, 0);
  const deckName = name ?? suggestDeckName(set, keys);

  const toggle = (sections: CatalogSection[]) => {
    setError(null);
    setSelected((current) => {
      const next = new Set(current);
      const all = sections.every((s) => next.has(s.key));
      for (const s of sections) {
        if (all) next.delete(s.key);
        else next.add(s.key);
      }
      return next;
    });
  };

  const submit = async () => {
    if (count === 0) {
      setError('Отметь хотя бы один параграф');
      return;
    }
    if (!deckId && !deckName.trim()) {
      setError('Введи название стопки');
      return;
    }
    setBusy(true);
    try {
      const result = await importCatalog(
        db,
        set,
        keys,
        deckId ? { deckId } : { newDeckName: deckName },
      );
      if (result.added === 0) {
        Alert.alert('Ничего не добавлено', 'Все эти карточки уже есть в стопке.');
        return;
      }
      if (guided) await trackDeck(result.deckId);
      // Экраны выбора больше не нужны: «назад» со стопки должно вести на главный экран.
      router.dismissAll();
      router.push({ pathname: '/deck/[id]', params: { id: result.deckId } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const check = (on: boolean, partial = false) => (
    <Ionicons
      name={on ? 'checkbox' : partial ? 'remove-circle-outline' : 'square-outline'}
      size={24}
      color={on || partial ? theme.accent : theme.textSecondary}
    />
  );

  return (
    <FormScreen
      footer={
        <>
          <FormError message={error} />
          <Button
            title={count ? `Добавить ${count} ${cardsWord(count)}` : 'Отметь параграфы'}
            variant="primary"
            disabled={busy}
            onPress={submit}
          />
        </>
      }>
      <Stack.Screen options={{ title: set.title }} />
      {guided && (
        <ThemedText type="small" themeColor="textSecondary">
          Отметь параграф и добавь карточки, чтобы начать первый раунд.
        </ThemedText>
      )}
      <ThemedText type="small" themeColor="textSecondary">
        {set.source ?? ''}
      </ThemedText>
      {deckId ? (
        <ThemedText type="small" themeColor="textSecondary">
          Карточки добавятся в стопку «{data.deckName}». Те, что уже есть, не повторятся.
        </ThemedText>
      ) : (
        <>
          <FieldLabel>Название новой стопки</FieldLabel>
          <TextField
            value={deckName}
            onChangeText={(text) => {
              setName(text);
              setError(null);
            }}
            maxLength={60}
            returnKeyType="done"
          />
        </>
      )}
      {set.chapters.map((chapter) => {
        const chosen = chapter.sections.filter((s) => selected.has(s.key)).length;
        return (
          <View key={chapter.title} style={styles.chapter}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: chosen === chapter.sections.length }}
              style={styles.row}
              onPress={() => toggle(chapter.sections)}>
              {check(chosen === chapter.sections.length, chosen > 0)}
              <ThemedText type="smallBold" style={styles.flex}>
                {chapter.title}
              </ThemedText>
            </Pressable>
            {chapter.sections.map((section) => (
              <Pressable
                key={section.key}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected.has(section.key) }}
                style={[styles.row, styles.section, { borderColor: theme.border }]}
                onPress={() => toggle([section])}>
                {check(selected.has(section.key))}
                <View style={styles.flex}>
                  <ThemedText>{sectionLabel(section)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {section.cards.length} {cardsWord(section.cards.length).replace('карточку', 'карточка')}
                    {loaded.has(section.key) ? ' · уже в стопке' : ''}
                  </ThemedText>
                </View>
              </Pressable>
            ))}
          </View>
        );
      })}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chapter: { gap: Spacing.two, marginTop: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.one },
  section: { borderWidth: 1, borderRadius: 12, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
});
