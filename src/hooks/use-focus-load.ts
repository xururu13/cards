import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

type State<T> = { data: T | undefined; error: string | null };

/** Загружает данные каждый раз, когда экран получает фокус (в том числе при возврате назад). */
export function useFocusLoad<T>(load: () => Promise<T>): State<T> {
  const [state, setState] = useState<State<T>>({ data: undefined, error: null });
  useFocusEffect(
    useCallback(() => {
      let active = true;
      load()
        .then((data) => active && setState({ data, error: null }))
        .catch(
          (e: unknown) =>
            active && setState({ data: undefined, error: e instanceof Error ? e.message : String(e) }),
        );
      return () => {
        active = false;
      };
    }, [load]),
  );
  return state;
}
