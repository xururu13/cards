import type { AnswerResult } from '@/db/types';

export type Grade = 0 | 1 | 2 | 3 | 4 | 5;
export const GRADE_POINTS = { 0: 0, 1: 0, 2: 2, 3: 5, 4: 8, 5: 10 } as const;
export const isGrade = (value: unknown): value is Grade =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 5;
export const POINTS = { correct: 10, repeatCorrect: 5, speedBonusMax: 5, penalty: -3, timeout: -2 } as const;
export interface ScoreInput {
  result: AnswerResult;
  grade?: Grade;
  timeMs: number;
  timeLimitMs: number | null;
  streak: number;
  repeat: boolean;
}
/** Голос и самооценка используют одну шкалу; повтор без бонуса, половина вниз. */
export function scoreAnswer({ result, grade, timeMs, timeLimitMs, repeat }: ScoreInput): number {
  if (result === 'hint') return POINTS.penalty;
  if (result === 'timeout') return POINTS.timeout;
  const mark = grade ?? (result === 'correct' ? 5 : 0);
  const base = GRADE_POINTS[mark];
  if (repeat) return Math.floor(base / 2);
  const left = timeLimitMs ? Math.max(0, Math.min(1, 1 - timeMs / timeLimitMs)) : 0;
  return base + (mark >= 4 ? Math.round(POINTS.speedBonusMax * left) : 0);
}
