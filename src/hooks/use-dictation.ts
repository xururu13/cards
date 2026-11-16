import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { AppState } from 'react-native';
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
  const request = useRef<symbol | null>(null);
  const targetRef = useRef<Target | null>(null);
  const [listening, setListening] = useState(false);
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  });

  const finish = useCallback(() => {
    targetRef.current = null;
    setTarget(null);
    setListening(false);
  }, []);

  useSpeechRecognitionEvent('start', () => {
    if (targetRef.current) setListening(true);
  });
  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results[0]?.transcript;
    if (targetRef.current && text) onTextRef.current(targetRef.current, text);
  });
  useSpeechRecognitionEvent('end', () => {
    if (targetRef.current) finish();
  });
  useSpeechRecognitionEvent('error', (event) => {
    if (!targetRef.current) return;
    // «aborted» приходит, когда диктовку остановили мы сами.
    if (event.error !== 'aborted') {
      setError(ERROR_TEXT[event.error] ?? 'Не получилось распознать речь. Попробуй ещё раз.');
    }
    finish();
  });

  const abort = useCallback(() => {
    request.current = null;
    const wasActive = targetRef.current !== null;
    targetRef.current = null;
    if (wasActive) ExpoSpeechRecognitionModule.abort();
  }, []);

  const cancel = useCallback(() => {
    abort();
    finish();
  }, [abort, finish]);

  useEffect(() => abort, [abort]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => { if (state !== 'active' && targetRef.current) ExpoSpeechRecognitionModule.stop(); });
    return () => sub.remove();
  }, []);

  const stop = useCallback(() => ExpoSpeechRecognitionModule.stop(), []);

  const start = useCallback(async (next: Target, lang: string) => {
    if (request.current || targetRef.current) return;
    const token = Symbol();
    request.current = token;
    try {
      setError(null);
      setTarget(next);
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (request.current !== token) return;
      if (!permission.granted) {
        finish();
        setError(ERROR_TEXT['not-allowed']);
        return;
      }
      targetRef.current = next;
      setTarget(next);
      ExpoSpeechRecognitionModule.start({ lang, interimResults: true, continuous: false });
    } catch {
      if (request.current === token) {
        setError('Не удалось включить микрофон. Попробуй ещё раз.');
        finish();
      }
    } finally {
      if (request.current === token) request.current = null;
    }
  }, [finish]);

  return { target, listening, error, start, stop, cancel };
}
