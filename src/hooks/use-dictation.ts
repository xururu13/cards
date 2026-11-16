import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useCallback, useEffect, useRef, useState } from 'react';

const ERROR_TEXT: Record<string, string> = {
  'not-allowed': 'Нет доступа к микрофону. Разреши его в настройках телефона.',
  'no-speech': 'Ничего не слышно. Попробуй ещё раз.',
  'speech-timeout': 'Ничего не слышно. Попробуй ещё раз.',
  network: 'Нет связи с сервисом распознавания. Проверь интернет.',
  'language-not-supported': 'Этот язык не поддерживается распознаванием на телефоне.',
  'service-not-allowed': 'На телефоне нет сервиса распознавания речи.',
};

/**
 * Диктовка в одно из нескольких полей. `target` — поле, которое сейчас слушает.
 * `onText` получает распознанный текст по мере уточнения и в финальном виде.
 */
export function useDictation<Target extends string>(onText: (target: Target, text: string) => void) {
  const [target, setTarget] = useState<Target | null>(null);
  const [error, setError] = useState<string | null>(null);
  const targetRef = useRef<Target | null>(null);
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  });

  const finish = useCallback(() => {
    targetRef.current = null;
    setTarget(null);
  }, []);

  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results[0]?.transcript;
    if (targetRef.current && text) onTextRef.current(targetRef.current, text);
  });
  useSpeechRecognitionEvent('end', finish);
  useSpeechRecognitionEvent('error', (event) => {
    // «aborted» приходит, когда диктовку остановили мы сами.
    if (event.error !== 'aborted') {
      setError(ERROR_TEXT[event.error] ?? 'Не получилось распознать речь. Попробуй ещё раз.');
    }
    finish();
  });

  useEffect(() => () => ExpoSpeechRecognitionModule.abort(), []);

  const stop = useCallback(() => ExpoSpeechRecognitionModule.stop(), []);

  const start = useCallback(async (next: Target, lang: string) => {
    setError(null);
    if (targetRef.current) ExpoSpeechRecognitionModule.abort();
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setError(ERROR_TEXT['not-allowed']);
      return;
    }
    targetRef.current = next;
    setTarget(next);
    ExpoSpeechRecognitionModule.start({ lang, interimResults: true, continuous: false });
  }, []);

  return { target, error, start, stop };
}
