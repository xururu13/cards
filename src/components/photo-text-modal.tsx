import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AI_CONFIG } from '@/ai/config';
import { takePhoto, type Photo, type PhotoSource } from '@/ai/photo';
import { recognizeText } from '@/ai/recognize';
import { Button } from '@/components/button';
import { FormError } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  /** Откуда взять фото; null — окно закрыто. */
  source: PhotoSource | null;
  /** Язык стороны карточки — подсказка модели. */
  language: string;
  onInsert: (text: string) => void;
  onClose: () => void;
};

type State =
  | { step: 'working'; photo: Photo | null }
  | { step: 'choose'; photo: Photo; lines: string[] }
  | { step: 'error'; photo: Photo | null; message: string };

/** Фото → распознавание → выбор нужных строк → вставка в поле карточки. */
export function PhotoTextModal({ source, language, onInsert, onClose }: Props) {
  if (!source) return null;
  return <PhotoTextFlow source={source} language={language} onInsert={onInsert} onClose={onClose} />;
}

function PhotoTextFlow({ source, language, onInsert, onClose }: Props & { source: PhotoSource }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<State>({ step: 'working', photo: null });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const started = useRef(false);

  const recognize = async (photo: Photo) => {
    setState({ step: 'working', photo });
    try {
      if (!AI_CONFIG) throw new Error('Распознавание не настроено: нет адреса и модели в .env.local.');
      const lines = await recognizeText(AI_CONFIG, photo.base64, language);
      if (lines.length === 0) {
        setState({ step: 'error', photo, message: 'На фото не нашлось текста. Сними поближе и ровнее.' });
        return;
      }
      setSelected(new Set(lines.length === 1 ? [0] : []));
      setState({ step: 'choose', photo, lines });
    } catch (e) {
      setState({ step: 'error', photo, message: e instanceof Error ? e.message : String(e) });
    }
  };

  // Камера или галерея открываются сразу при появлении окна, один раз.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    takePhoto(source)
      .then((photo) => (photo ? recognize(photo) : onClose()))
      .catch((e: unknown) =>
        setState({ step: 'error', photo: null, message: e instanceof Error ? e.message : String(e) }),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (index: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const insert = () => {
    if (state.step !== 'choose' || selected.size === 0) return;
    const text = state.lines.filter((_, i) => selected.has(i)).join(' ');
    onInsert(text);
    onClose();
  };

  // Пока открыта камера, окно не показываем, чтобы не мелькало.
  const visible = state.step !== 'working' || state.photo !== null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ThemedView
        style={[styles.container, { paddingTop: insets.top + Spacing.two, paddingBottom: insets.bottom + Spacing.three }]}>
        <View style={styles.header}>
          <ThemedText type="smallBold" style={styles.flex}>
            {state.step === 'choose' ? 'Выбери нужный текст' : 'Текст с фото'}
          </ThemedText>
          <Pressable accessibilityRole="button" accessibilityLabel="Закрыть" hitSlop={12} onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.text} />
          </Pressable>
        </View>
        {state.photo && (
          <Image source={{ uri: state.photo.uri }} style={styles.preview} contentFit="contain" />
        )}
        <ScrollView style={styles.flex} contentContainerStyle={styles.lines}>
          {state.step === 'working' && (
            <View style={styles.center}>
              <ActivityIndicator color={theme.accent} />
              <ThemedText type="small" themeColor="textSecondary">
                Распознаю текст…
              </ThemedText>
            </View>
          )}
          {state.step === 'error' && <FormError message={state.message} />}
          {state.step === 'choose' &&
            state.lines.map((line, index) => {
              const on = selected.has(index);
              return (
                <Pressable
                  key={index}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  onPress={() => toggle(index)}
                  style={[
                    styles.line,
                    { borderColor: on ? theme.accent : theme.border },
                    on && { backgroundColor: theme.backgroundSelected },
                  ]}>
                  <Ionicons
                    name={on ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={on ? theme.accent : theme.textSecondary}
                  />
                  <ThemedText style={styles.flex}>{line}</ThemedText>
                </Pressable>
              );
            })}
        </ScrollView>
        {state.step === 'choose' && (
          <Button
            title={selected.size ? `Вставить (${selected.size})` : 'Отметь строки'}
            variant="primary"
            onPress={insert}
          />
        )}
        {state.step === 'error' && state.photo && (
          <Button title="Распознать ещё раз" variant="primary" onPress={() => recognize(state.photo!)} />
        )}
        {state.step !== 'working' && <Button title="Отмена" onPress={onClose} />}
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.three, gap: Spacing.two },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  preview: { height: 180, borderRadius: 12 },
  lines: { gap: Spacing.two, paddingVertical: Spacing.two },
  center: { alignItems: 'center', gap: Spacing.two, paddingTop: Spacing.four },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
  },
});
