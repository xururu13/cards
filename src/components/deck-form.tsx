import { useState } from 'react';

import { Button } from '@/components/button';
import { FieldLabel, FormError, FormScreen } from '@/components/form';
import { LanguageChips } from '@/components/language-chips';
import { TextField } from '@/components/text-field';
import type { DeckInput } from '@/db/decks';

type Props = {
  initial: DeckInput;
  submitTitle: string;
  onSubmit: (input: DeckInput) => Promise<void>;
  onDelete?: () => void;
};

export function DeckForm({ initial, submitTitle, onSubmit, onDelete }: Props) {
  const [name, setName] = useState(initial.name);
  const [frontLang, setFrontLang] = useState(initial.frontLang);
  const [backLang, setBackLang] = useState(initial.backLang);
  const [error, setError] = useState<string | null>(null);

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
          <Button title={submitTitle} variant="primary" onPress={submit} />
          {onDelete && <Button title="Удалить стопку" variant="danger" onPress={onDelete} />}
        </>
      }>
      <FieldLabel>Название</FieldLabel>
      <TextField
        value={name}
        onChangeText={(text) => {
          setName(text);
          setError(null);
        }}
        placeholder="Английский язык"
        autoFocus={!initial.name}
        maxLength={60}
        returnKeyType="done"
      />
      <FormError message={error} />
      <FieldLabel>Язык диктовки слов</FieldLabel>
      <LanguageChips value={frontLang} onChange={setFrontLang} />
      <FieldLabel>Язык диктовки перевода или объяснения</FieldLabel>
      <LanguageChips value={backLang} onChange={setBackLang} />
    </FormScreen>
  );
}
