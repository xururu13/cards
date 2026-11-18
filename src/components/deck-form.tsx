import { useState } from 'react';

import { Button } from '@/components/button';
import { CoachMark } from '@/components/coach-mark';
import { FieldLabel, FormError, FormScreen } from '@/components/form';
import { LanguageChips } from '@/components/language-chips';
import { TextField } from '@/components/text-field';
import type { DeckInput } from '@/db/decks';

type Props = {
  initial: DeckInput;
  submitTitle: string;
  onSubmit: (input: DeckInput) => Promise<void>;
  onDelete?: () => void;
  /** Показать кнопку «Наборы карточек». */
  onCatalog?: () => void;
  guided?: boolean;
};

export function DeckForm({ initial, submitTitle, onSubmit, onDelete, onCatalog, guided }: Props) {
  const [name, setName] = useState(initial.name);
  const [frontLang, setFrontLang] = useState(initial.frontLang);
  const [backLang, setBackLang] = useState(initial.backLang);
  const [error, setError] = useState<string | null>(null);
  const named = !!name.trim();

  const submit = async () => {
    if (!name.trim()) {
      setError('Введи название стопки');
      return;
    }
    try {
      await onSubmit({ name, frontLang, backLang });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <FormScreen
      footer={
        <>
          <CoachMark tip={guided && named && {
            title: 'Сохрани стопку',
            body: 'Нажми «Создать стопку». Языки диктовки можно поменять позже.',
          }}>
            <Button title={submitTitle} variant="primary" onPress={submit} />
          </CoachMark>
          {onCatalog && <Button title="Наборы карточек" icon="library-outline" onPress={onCatalog} />}
          {onDelete && <Button title="Удалить стопку" variant="danger" onPress={onDelete} />}
        </>
      }>
      <FieldLabel>Название</FieldLabel>
      <CoachMark below tip={guided && !named && {
        title: 'Дай стопке название',
        body: 'Нажми на поле и введи тему, например «Английский язык».',
      }}>
        <TextField
          accessibilityLabel="Название стопки"
          value={name}
          onChangeText={(text) => {
            setName(text);
            setError(null);
          }}
          placeholder="Английский язык"
          autoFocus={!initial.name && !guided}
          maxLength={60}
          returnKeyType="done"
        />
      </CoachMark>
      <FormError message={error} />
      <FieldLabel>Язык диктовки слов</FieldLabel>
      <LanguageChips value={frontLang} onChange={setFrontLang} />
      <FieldLabel>Язык диктовки перевода или объяснения</FieldLabel>
      <LanguageChips value={backLang} onChange={setBackLang} />
    </FormScreen>
  );
}
