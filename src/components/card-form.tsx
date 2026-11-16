import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { FieldLabel, FormError, FormScreen } from '@/components/form';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { languageShort, nextLanguage } from '@/constants/languages';
import { Spacing } from '@/constants/theme';
import type { CardInput } from '@/db/cards';
import { useDictation } from '@/hooks/use-dictation';
import { useTheme } from '@/hooks/use-theme';

type Side = 'front' | 'back';

type Props = {
  deckName: string;
  initial: CardInput;
  languages: Record<Side, string>;
  onLanguageChange: (side: Side, lang: string) => void;
  /** Возвращает true, если форму нужно очистить для следующей карточки. */
  onSave: (input: CardInput, addMore: boolean) => Promise<boolean>;
  allowAddMore?: boolean;
  onDelete?: () => void;
};

export function CardForm({
  deckName,
  initial,
  languages,
  onLanguageChange,
  onSave,
  allowAddMore,
  onDelete,
}: Props) {
  const theme = useTheme();
  const [text, setText] = useState<Record<Side, string>>(initial);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  // Текст поля на момент начала диктовки: распознанное дописывается после него.
  const dictationBase = useRef('');

  const dictation = useDictation<Side>((side, spoken) => {
    const base = dictationBase.current;
    setText((current) => ({ ...current, [side]: base ? `${base} ${spoken}` : spoken }));
  });

  const change = (side: Side, value: string) => {
    setText((current) => ({ ...current, [side]: value }));
    setError(null);
  };

  const toggleMic = (side: Side) => {
    if (dictation.target === side) {
      dictation.stop();
      return;
    }
    dictationBase.current = text[side].trim();
    setError(null);
    void dictation.start(side, languages[side]);
  };

  const save = async (addMore: boolean) => {
    if (!text.front.trim()) return setError('Заполни сторону со словом');
    if (!text.back.trim()) return setError('Заполни оборот карточки');
    if (dictation.target) dictation.stop();
    try {
      if (await onSave(text, addMore)) {
        setText({ front: '', back: '' });
        setSavedCount((n) => n + 1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const micControls = (side: Side) => {
    const listening = dictation.target === side;
    return (
      <View style={styles.accessory}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Язык диктовки: ${languageShort(languages[side])}. Сменить`}
          hitSlop={8}
          onPress={() => onLanguageChange(side, nextLanguage(languages[side]))}
          style={[styles.lang, { borderColor: theme.border }]}>
          <ThemedText type="small" themeColor="textSecondary">
            {languageShort(languages[side])}
          </ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={listening ? 'Остановить диктовку' : 'Продиктовать'}
          hitSlop={8}
          onPress={() => toggleMic(side)}
          style={[styles.mic, listening && { backgroundColor: theme.accent }]}>
          <Ionicons
            name={listening ? 'stop' : 'mic-outline'}
            size={22}
            color={listening ? theme.onAccent : theme.accent}
          />
        </Pressable>
      </View>
    );
  };

  return (
    <FormScreen
      footer={
        <>
          <Button title="Сохранить" variant="primary" onPress={() => save(false)} />
          {allowAddMore && <Button title="Сохранить и добавить ещё" onPress={() => save(true)} />}
          {onDelete && <Button title="Удалить карточку" variant="danger" onPress={onDelete} />}
        </>
      }>
      <ThemedText type="small" themeColor="textSecondary">
        Стопка: {deckName}
      </ThemedText>
      <FieldLabel>Слово или термин</FieldLabel>
      <TextField
        value={text.front}
        onChangeText={(value) => change('front', value)}
        placeholder="Butterfly"
        autoFocus={!initial.front}
        highlighted={dictation.target === 'front'}
        accessory={micControls('front')}
        maxLength={200}
      />
      <FieldLabel>Перевод или объяснение</FieldLabel>
      <TextField
        value={text.back}
        onChangeText={(value) => change('back', value)}
        placeholder="Бабочка"
        multiline
        highlighted={dictation.target === 'back'}
        accessory={micControls('back')}
        maxLength={1000}
      />
      {dictation.target && (
        <ThemedText type="small" style={{ color: theme.accent }}>
          Слушаю… Говори, потом нажми «стоп» или просто замолчи.
        </ThemedText>
      )}
      <FormError message={error ?? dictation.error} />
      {savedCount > 0 && !error && (
        <ThemedText type="small" style={{ color: theme.success }}>
          Сохранено карточек: {savedCount}
        </ThemedText>
      )}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  accessory: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  lang: {
    borderWidth: 1,
    borderRadius: 8,
    minWidth: 36,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.one,
  },
  mic: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
