import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

import { AI_CONFIG } from '@/ai/config';
import { gradeAnswer, type Evaluation } from '@/ai/grade';
import { useDictation } from '@/hooks/use-dictation';

export function useVoiceAnswer({ enabled, question, reference, language, onResult }: {
  enabled: boolean;
  question: string;
  reference: string;
  language: string;
  onResult: (result: Evaluation) => void;
}) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const speech = useDictation<'answer'>((_target, value) => setText(value.slice(0, 2000)));
  const { target, cancel } = speech;

  useEffect(() => {
    if (enabled) return cancel;
  }, [enabled, cancel]);

  // После stop распознаватель ещё может прислать финальный текст.
  useEffect(() => {
    if (!enabled || !submitting || target || !AI_CONFIG) return;
    let active = true;
    void gradeAnswer(AI_CONFIG, question, reference, text)
      .then((result) => {
        if (active) onResult(result);
      })
      .catch((e: unknown) => {
        if (active) {
          setError(!text.trim()
            ? 'Ответ не распознан. Нажми «Оценить», чтобы повторить диктовку.'
            : e instanceof Error ? e.message : String(e));
          setSubmitting(false);
        }
      });
    return () => { active = false; };
  }, [enabled, onResult, question, reference, submitting, target, text]);

  const start = () => {
    setText('');
    setError(null);
    setSubmitting(false);
    void speech.start('answer', language);
  };

  const evaluate = () => {
    if (submitting || (target && !speech.listening)) return;
    if (!target && !text.trim()) {
      start();
      return;
    }
    if (!AI_CONFIG) {
      setError('Проверка AI не настроена. Можно открыть ответ кнопкой «Проверить».');
      return;
    }
    Keyboard.dismiss();
    setError(null);
    setSubmitting(true);
    if (target) speech.stop();
  };

  return {
    text, setText, start, evaluate, submitting,
    error: error ?? speech.error,
    listening: speech.listening && !submitting,
    preparing: !!target && !speech.listening,
    editable: !target && !submitting,
  };
}
