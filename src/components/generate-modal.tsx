import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AI_CONFIG } from '@/ai/config';
import { generateBack, PRESETS } from '@/ai/generate';
import { Button } from '@/components/button';
import { FieldLabel, FormError } from '@/components/form';
import { OptionChips } from '@/components/option-chips';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getMeta, setMeta } from '@/db/meta';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  visible: boolean;
  deckId: string;
  deckName: string;
  front: string;
  backLanguage: string;
  /** Текущий текст оборота: если он есть, можно заменить или дописать. */
  currentBack: string;
  onApply: (text: string) => void;
  onClose: () => void;
};

/** Генерация оборота карточки по подсказке: готовой или своими словами. */
export function GenerateModal(props: Props) {
  if (!props.visible) return null;
  return <GenerateFlow {...props} />;
}

function GenerateFlow({ deckId, deckName, front, backLanguage, currentBack, onApply, onClose }: Props) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [instruction, setInstruction] = useState<string>(PRESETS[0].instruction);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const promptKey = `aiPrompt:${deckId}` as const;

  // Подсказка запоминается для стопки: в английском обычно нужен перевод, в биологии — определение.
  useEffect(() => {
    let active = true;
    getMeta(db, promptKey)
      .then((saved) => active && saved && setInstruction(saved))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [db, promptKey]);

  const preset = PRESETS.find((p) => p.instruction === instruction.trim())?.instruction ?? '';

  const generate = async (variation: boolean) => {
    if (busy) return;
    if (!front.trim()) {
      setError('Сначала заполни сторону со словом.');
      return;
    }
    if (!AI_CONFIG) {
      setError('Генерация не настроена: нет адреса и модели в .env.local.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const text = await generateBack(AI_CONFIG, {
        front,
        deckName,
        backLanguage,
        instruction,
        variation,
      });
      setResult(text);
      void setMeta(db, promptKey, instruction.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const apply = (mode: 'replace' | 'append') => {
    if (!result) return;
    const base = currentBack.trim();
    onApply(mode === 'append' && base ? `${base}\n${result}` : result);
    onClose();
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <ThemedView
        style={[
          styles.container,
          { paddingTop: insets.top + Spacing.two, paddingBottom: insets.bottom + Spacing.three },
        ]}>
        <View style={styles.header}>
          <ThemedText type="smallBold" style={styles.flex}>
            Оборот с помощью AI
          </ThemedText>
          <Pressable accessibilityRole="button" accessibilityLabel="Закрыть" hitSlop={12} onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.text} />
          </Pressable>
        </View>
        <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ThemedText type="small" themeColor="textSecondary">
            Стопка: {deckName}
          </ThemedText>
          <ThemedText type="subtitle" numberOfLines={3}>
            {front.trim() || '…'}
          </ThemedText>
          <FieldLabel>Что написать на обороте</FieldLabel>
          <OptionChips
            options={PRESETS.map((p) => ({ value: p.instruction, label: p.label }))}
            value={preset}
            onChange={(value) => {
              setInstruction(value);
              setError(null);
            }}
          />
          <TextField
            value={instruction}
            onChangeText={(value) => {
              setInstruction(value);
              setError(null);
            }}
            placeholder="Например: определение простыми словами для 6 класса"
            multiline
            maxLength={300}
          />
          {busy && (
            <View style={styles.busy}>
              <ActivityIndicator color={theme.accent} />
              <ThemedText type="small" themeColor="textSecondary">
                Думаю…
              </ThemedText>
            </View>
          )}
          <FormError message={error} />
          {result && !busy && (
            <View style={[styles.result, { borderColor: theme.accent, backgroundColor: theme.backgroundElement }]}>
              <ThemedText>{result}</ThemedText>
            </View>
          )}
        </ScrollView>
        {result ? (
          <>
            {currentBack.trim() ? (
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Button title="Дописать" onPress={() => apply('append')} />
                </View>
                <View style={styles.flex}>
                  <Button title="Заменить" variant="primary" onPress={() => apply('replace')} />
                </View>
              </View>
            ) : (
              <Button title="Вставить" variant="primary" onPress={() => apply('replace')} />
            )}
            <Button title="Другой вариант" icon="refresh" onPress={() => generate(true)} />
          </>
        ) : (
          <Button title="Сгенерировать" variant="primary" icon="sparkles-outline" onPress={() => generate(false)} />
        )}
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.three, gap: Spacing.two },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  content: { gap: Spacing.two, paddingVertical: Spacing.two },
  busy: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  result: { borderWidth: 1, borderRadius: 12, padding: Spacing.three },
  row: { flexDirection: 'row', gap: Spacing.two },
});
