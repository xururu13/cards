import type { AnswerResult } from '@/db/types';

export const MAX_LEVEL = 4;

export interface Progress {
  level: number;
  correct_count: number;
  wrong_count: number;
}

/** «Вспомнил» поднимает уровень на 1; ошибка, подсказка и истёкшее время сбрасывают на 0. */
export function applyAnswer(progress: Progress, result: AnswerResult): Progress {
  if (result === 'skipped') return progress;
  if (result === 'correct') {
    return {
      level: Math.min(progress.level + 1, MAX_LEVEL),
      correct_count: progress.correct_count + 1,
      wrong_count: progress.wrong_count,
    };
  }
  return { level: 0, correct_count: progress.correct_count, wrong_count: progress.wrong_count + 1 };
}
