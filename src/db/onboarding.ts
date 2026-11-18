import type { Db } from './db';
import { getMeta, setMeta } from './meta';

export type OnboardingState = 'welcome' | 'done' | `deck:${string}`;

export async function loadOnboarding(db: Db): Promise<OnboardingState> {
  const saved = await getMeta(db, 'onboarding');
  if (saved === 'done' || saved === 'welcome') return saved;
  if (saved?.startsWith('deck:')) {
    const deck = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM decks WHERE id = ? AND deleted_at IS NULL', [saved.slice(5)],
    );
    return deck ? `deck:${deck.id}` : 'welcome';
  }

  // Старые установки со стопками уже знакомы с основным сценарием.
  const previous = await db.getFirstAsync('SELECT id FROM decks LIMIT 1', []);
  const initial = previous ? 'done' : 'welcome';
  await saveOnboarding(db, initial);
  return initial;
}

export function saveOnboarding(db: Db, state: OnboardingState): Promise<void> {
  return setMeta(db, 'onboarding', state);
}
