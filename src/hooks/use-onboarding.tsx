import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { loadOnboarding, saveOnboarding, type OnboardingState } from '@/db/onboarding';

type Onboarding = {
  state: OnboardingState | null;
  deckId: string | null;
  trackDeck: (deckId: string) => Promise<void>;
  finish: () => void;
};

const OnboardingContext = createContext<Onboarding>({
  state: null,
  deckId: null,
  trackDeck: async () => {},
  finish: () => {},
});

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [state, setState] = useState<OnboardingState | null>(null);
  const current = useRef<OnboardingState | null>(null);
  useEffect(() => {
    let active = true;
    loadOnboarding(db)
      .then((loaded) => {
        if (active) {
          current.current = loaded;
          setState(loaded);
        }
      })
      .catch(() => {
        if (active) {
          current.current = 'done';
          setState('done');
        }
      });
    return () => { active = false; };
  }, [db]);
  const update = useCallback(async (next: OnboardingState) => {
    if (current.current === 'done' || current.current === next) return;
    current.current = next;
    setState(next);
    await saveOnboarding(db, next).catch(() => {});
  }, [db]);
  const trackDeck = useCallback((deckId: string) => update(`deck:${deckId}`), [update]);
  const finish = useCallback(() => { void update('done'); }, [update]);

  return (
    <OnboardingContext.Provider value={{ state, deckId: state?.startsWith('deck:') ? state.slice(5) : null, trackDeck, finish }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  return useContext(OnboardingContext);
}
