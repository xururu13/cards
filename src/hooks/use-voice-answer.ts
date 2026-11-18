import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';

import { AI_CONFIG } from '@/ai/config';
import { gradeAnswer, type Evaluation } from '@/ai/grade';
import { useDictation } from '@/hooks/use-dictation';

type Submission = { kind: 'manual' } | { kind: 'deadline'; text: string };

export function useVoiceAnswer({ enabled, question, reference, language, onResult }: {
  enabled: boolean;
  question: string;
  reference: string;
  language: string;
  onResult: (result: Evaluation) => void;
}) {
  const [text, setDisplayedText] = useState('');
  const latestText = useRef('');
  const setText = useCallback((value: string) => {
    latestText.current = value;
    setDisplayedText(value);
  }, []);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const submittingRef = useRef(false);
  const submitting = submission !== null;
  const [error, setError] = useState<string | null>(null);
  const [stopped, setStopped] = useState(false);
  const speech = useDictation<'answer'>((_target, value) => setText(value.slice(0, 2000)));
  const { target, cancel } = speech;

  useEffect(() => {
    if (enabled) return cancel;
  }, [enabled, cancel]);

  useEffect(() => {
    if (!enabled || !submission || target || !AI_CONFIG) return;
    // При ручной отправке ждём финальный результат stop, по таймеру отправляем снимок поля.
    const answer = submission.kind === 'deadline' ? submission.text : text;
    let active = true;
    void gradeAnswer(AI_CONFIG, question, reference, answer)
      .then((result) => {
        if (active) onResult(result);
      })
      .catch((e: unknown) => {
        if (active) {
          setError(!answer.trim() ? null : e instanceof Error ? e.message : String(e));
          submittingRef.current = false;
          setSubmission(null);
        }
      });
    return () => { active = false; };
  }, [enabled, onResult, question, reference, submission, target, text]);

  const start = () => {
    setText('');
    setError(null);
    setStopped(false);
    submittingRef.current = false;
    setSubmission(null);
    void speech.start('answer', language);
  };

  const submit = (next: Submission) => {
    if (!AI_CONFIG) {
      setError('Проверка AI не настроена.');
      return;
    }
    Keyboard.dismiss();
    setError(null);
    submittingRef.current = true;
    setSubmission(next);
  };

  const evaluate = () => {
    if (submittingRef.current || (target && !speech.listening)) return;
    if (!target && !latestText.current.trim()) {
      start();
      return;
    }
    submit({ kind: 'manual' });
    if (submittingRef.current && target) speech.stop();
  };

  const submitAtDeadline = () => {
    if (submittingRef.current) return true;
    const answer = latestText.current;
    speech.cancel();
    if (!answer.trim()) return false;
    submit({ kind: 'deadline', text: answer });
    return true;
  };

  const reset = () => {
    if (submittingRef.current) return;
    speech.cancel();
    start();
  };

  const discard = () => {
    speech.cancel();
    Keyboard.dismiss();
    submittingRef.current = false;
    setSubmission(null);
    setText('');
    setError(null);
    setStopped(false);
  };

  const stopRecording = () => {
    speech.cancel();
    setStopped(true);
  };

  return {
    text, setText, start, evaluate, reset, discard, stopRecording, stopped, submitAtDeadline, submitting,
    error: error ?? speech.error,
    listening: speech.listening && !submitting,
    preparing: !!target && !speech.listening,
    editable: !target && !submitting,
  };
}
