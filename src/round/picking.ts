import type { Card } from '@/db/types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Чем ниже уровень, тем чаще карточка попадает в раунд: уровень 0 — в 16 раз чаще уровня 4. */
const LEVEL_WEIGHT = [16, 8, 4, 2, 1];

/** Вес карточки: уровень × давность показа (×1 сегодня … ×2 неделю назад и для новых). */
export function cardWeight(card: Pick<Card, 'level' | 'last_shown_at'>, now: number): number {
  const level = LEVEL_WEIGHT[card.level] ?? 1;
  const days = card.last_shown_at === null ? 7 : Math.max(0, (now - card.last_shown_at) / DAY_MS);
  return level * (1 + Math.min(days, 7) / 7);
}

/** Случайный порядок без повторов. */
export function shuffle<T>(items: readonly T[], random = Math.random): T[] {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

/**
 * Карточки для раунда: до `size` штук без повторов. Шанс попасть в раунд
 * пропорционален весу, поэтому сложные и давно не показанные идут чаще.
 */
export function pickRoundCards<T extends Pick<Card, 'level' | 'last_shown_at'>>(
  cards: readonly T[],
  size: number,
  now: number,
  random = Math.random,
): T[] {
  const pool = cards.map((card) => ({ card, weight: cardWeight(card, now) }));
  const picked: T[] = [];
  while (picked.length < size && pool.length > 0) {
    const total = pool.reduce((sum, item) => sum + item.weight, 0);
    let point = random() * total;
    let index = pool.findIndex((item) => (point -= item.weight) < 0);
    if (index < 0) index = pool.length - 1;
    picked.push(pool[index].card);
    pool.splice(index, 1);
  }
  return picked;
}
