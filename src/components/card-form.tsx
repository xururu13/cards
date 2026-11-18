import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import type { PhotoSource } from '@/ai/photo';

import { Button } from '@/components/button';
import { CoachMark } from '@/components/coach-mark';
import { FieldLabel, FormError, FormScreen } from '@/components/form';
import { GenerateModal } from '@/components/generate-modal';
import { PhotoTextModal } from '@/components/photo-text-modal';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { languageShort, nextLanguage } from '@/constants/languages';
import { Spacing } from '@/constants/theme';
import type { CardInput } from '@/db/cards';
import { useDictation } from '@/hooks/use-dictation';
import { useTheme } from '@/hooks/use-theme';

type Side = 'front' | 'back';

type Props = {
  deckId: string;
  deckName: string;
  initial: CardInput;
  languages: Record<Side, string>;
  onLanguageChange: (side: Side, lang: string) => void;
  /** Возвращает true, если форму нужно очистить для следующей карточки. */
  onSave: (input: CardInput, addMore: boolean) => Promise<boolean>;
  allowAddMore?: boolean;
  onDelete?: () => void;
  guided?: boolean;
};

export function CardForm({
  deckId,
  deckName,
  initial,
  languages,
  onLanguageChange,
  onSave,
  allowAddMore,
  onDelete,
  guided,
}: Props) {
  const theme = useTheme();
  const [text, setText] = useState<Record<Side, string>>(initial);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [photo, setPhoto] = useState<{ side: Side; source: PhotoSource } | null>(null);
  const hasFront = !!text.front.trim();
  const hasBack = !!text.back.trim();
  const guideBack = guided && hasFront && !hasBack;
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

  const askPhoto = (side: Side) => {
    if (dictation.target) dictation.stop();
    Alert.alert('Текст с фото', 'Сфотографируй слово или абзац — можно будет обрезать лишнее.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Из галереи', onPress: () => setPhoto({ side, source: 'library' }) },
      { text: 'Камера', onPress: () => setPhoto({ side, source: 'camera' }) },
    ]);
  };

  /** Распознанный текст дописывается к тому, что уже введено в поле. */
  const insertPhotoText = (side: Side, recognized: string) => {
    setText((current) => {
      const base = current[side].trim();
      return { ...current, [side]: base ? `${base} ${recognized}` : recognized };
    });
    setError(null);
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
        {side === 'back' && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Оборот с помощью AI"
            hitSlop={8}
            onPress={() => {
              if (dictation.target) dictation.stop();
              setGenerating(true);
            }}
            style={[
              styles.mic,
              guideBack && styles.guidedAi,
              guideBack && { borderColor: theme.accent },
            ]}>
            <Ionicons name="sparkles-outline" size={22} color={theme.accent} />
            {guideBack && <ThemedText type="smallBold" themeColor="accent">AI</ThemedText>}
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Текст с фото"
          hitSlop={8}
          onPress={() => askPhoto(side)}
          style={styles.mic}>
          <Ionicons name="camera-outline" size={22} color={theme.accent} />
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
          <CoachMark tip={guided && hasFront && hasBack && {
            title: 'Сохрани карточку',
            body: 'Нажми «Сохранить», чтобы вернуться к стопке и начать раунд.',
          }}>
            <Button title="Сохранить" variant="primary" onPress={() => save(false)} />
          </CoachMark>
          {allowAddMore && <Button title="Сохранить и добавить ещё" onPress={() => save(true)} />}
          {onDelete && <Button title="Удалить карточку" variant="danger" onPress={onDelete} />}
        </>
      }>
      <ThemedText type="small" themeColor="textSecondary">
        Стопка: {deckName}
      </ThemedText>
      <FieldLabel>Слово или термин</FieldLabel>
      <CoachMark below tip={guided && !hasFront && {
        title: 'Запиши вопрос',
        body: 'Введи слово, термин или вопрос. Эту сторону увидишь в раунде первой.',
      }}>
        <TextField
          accessibilityLabel="Слово или термин"
          value={text.front}
          onChangeText={(value) => change('front', value)}
          placeholder="Butterfly"
          autoFocus={!initial.front && !guided}
          highlighted={dictation.target === 'front'}
          accessory={micControls('front')}
          maxLength={200}
        />
      </CoachMark>
      <FieldLabel>{guideBack ? 'Введи ответ сам или нажми ✨ AI' : 'Перевод или объяснение'}</FieldLabel>
      <CoachMark below tip={guideBack && {
        title: 'Запиши ответ',
        body: 'Введи перевод или объяснение. Кнопка ✨ AI предложит текст для оборота. Проверь его перед сохранением.',
      }}>
        <TextField
          accessibilityLabel="Перевод или объяснение"
          value={text.back}
          onChangeText={(value) => change('back', value)}
          placeholder={guideBack ? 'Перевод или объяснение' : 'Бабочка'}
          multiline
          highlighted={dictation.target === 'back'}
          accessory={micControls('back')}
          maxLength={1000}
        />
      </CoachMark>
      {dictation.target && (
        <ThemedText type="small" style={{ color: theme.accent }}>
          Слушаю… Говори, потом нажми «стоп» или просто замолчи.
        </ThemedText>
      )}
      <FormError message={error ?? dictation.error} />
      <GenerateModal
        visible={generating}
        deckId={deckId}
        deckName={deckName}
        front={text.front}
        backLanguage={languages.back}
        currentBack={text.back}
        onApply={(generated) => change('back', generated)}
        onClose={() => setGenerating(false)}
      />
      <PhotoTextModal
        source={photo?.source ?? null}
        language={photo ? languages[photo.side] : languages.front}
        onInsert={(recognized) => photo && insertPhotoText(photo.side, recognized)}
        onClose={() => setPhoto(null)}
      />
      {savedCount > 0 && !error && (
        <ThemedText type="small" style={{ color: theme.success }}>
          Сохранено карточек: {savedCount}
        </ThemedText>
      )}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  accessory: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  guidedAi: { width: 'auto', flexDirection: 'row', gap: Spacing.one, paddingHorizontal: Spacing.two, borderWidth: 1, borderRadius: 10 },
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
