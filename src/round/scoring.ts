import type { AnswerResult } from '@/db/types';

export const POINTS = {
  correct: 10,
  /** Верный ответ на карточку, которая вернулась в раунд после ошибки. */
  repeatCorrect: 5,
  speedBonusMax: 5,
  streakBonusStep: 2,
  streakBonusMax: 10,
  /** Подсказка или истёкшее время. */
  penalty: -5,
} as const;

export interface ScoreInput {
  result: AnswerResult;
  /** Сколько думал до открытия оборота. */
  timeMs: number;
  /** null — таймер выключен, бонуса за скорость нет. */
  timeLimitMs: number | null;
  /** Сколько верных ответов подряд было до этого. */
  streak: number;
  /** Карточка показывается повторно после ошибки в этом же раунде. */
  repeat: boolean;
}

/** Очки за один ответ, без учёта того, что счёт раунда не опускается ниже нуля. */
export function scoreAnswer({ result, timeMs, timeLimitMs, streak, repeat }: ScoreInput): number {
  if (result === 'wrong') return 0;
  if (result === 'hint' || result === 'timeout') return POINTS.penalty;
  if (repeat) return POINTS.repeatCorrect;

  const left = timeLimitMs ? Math.max(0, Math.min(1, 1 - timeMs / timeLimitMs)) : 0;
  const speedBonus = Math.round(POINTS.speedBonusMax * left);
  const streakBonus = Math.min(streak * POINTS.streakBonusStep, POINTS.streakBonusMax);
  return POINTS.correct + speedBonus + streakBonus;
}
