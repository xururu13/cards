import { applyAnswer, type Progress } from '@/round/levels';
import { totals, type SessionAnswer } from '@/round/session';

import type { Db } from './db';
import { newId } from './ids';
import type { AnswerResult, Round } from './types';

export interface RoundAnswer {
  grade: number | null;
  card_id: string;
  front: string;
  back: string;
  result: AnswerResult;
  points: number;
}

export interface RoundResult {
  round: Round;
  answers: RoundAnswer[];
}

/**
 * Сохраняет завершённый раунд: итоги, ответы с очками и новый прогресс карточек.
 * Всё в одной транзакции — раунд не может сохраниться наполовину.
 * deckId = null — смешанный раунд по всем стопкам.
 */
export async function saveRound(
  db: Db,
  deckId: string | null,
  startedAt: number,
  answers: readonly SessionAnswer[],
  now = Date.now(),
): Promise<string> {
  const roundId = newId();
  const { correct, wrong, hints } = totals(answers);
  const score = answers.reduce((sum, answer) => sum + answer.points, 0);

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO rounds (id, deck_id, started_at, finished_at, correct, wrong, hints, score, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [roundId, deckId, startedAt, now, correct, wrong, hints, score, now],
    );
    for (const answer of answers) {
      await db.runAsync(
        `INSERT INTO answers (id, round_id, card_id, result, time_ms, points, created_at, grade)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId(), roundId, answer.cardId, answer.result, Math.round(answer.timeMs), answer.points, now, answer.grade ?? null],
      );
    }

    // Прогресс каждой карточки: её ответы применяются по порядку показа.
    const byCard = new Map<string, AnswerResult[]>();
    for (const answer of answers) {
      byCard.set(answer.cardId, [...(byCard.get(answer.cardId) ?? []), answer.result]);
    }
    for (const [cardId, results] of byCard) {
      const current = await db.getFirstAsync<Progress>(
        `SELECT level, correct_count, wrong_count FROM cards WHERE id = ?`,
        [cardId],
      );
      if (!current) continue;
      const next = results.reduce(applyAnswer, current);
      await db.runAsync(
        `UPDATE cards
            SET level = ?, correct_count = ?, wrong_count = ?, last_shown_at = ?, updated_at = ?
          WHERE id = ?`,
        [next.level, next.correct_count, next.wrong_count, now, now, cardId],
      );
    }
  });
  return roundId;
}

export async function getRoundResult(db: Db, roundId: string): Promise<RoundResult | null> {
  const round = await db.getFirstAsync<Round>(
    `SELECT * FROM rounds WHERE id = ? AND deleted_at IS NULL`,
    [roundId],
  );
  if (!round) return null;
  const answers = await db.getAllAsync<RoundAnswer>(
    `SELECT a.card_id, c.front, c.back, a.result, a.points, a.grade
       FROM answers a JOIN cards c ON c.id = a.card_id
      WHERE a.round_id = ?
      ORDER BY a.rowid`,
    [roundId],
  );
  return { round, answers };
}

/** Карточки, на которых в раунде ошиблись, взяли подсказку или не успели. Без удалённых. */
export function listMissedCardIds(db: Db, roundId: string): Promise<{ id: string }[]> {
  return db.getAllAsync<{ id: string }>(
    `SELECT DISTINCT c.id
       FROM answers a JOIN cards c ON c.id = a.card_id
      WHERE a.round_id = ? AND a.result != 'correct' AND c.deleted_at IS NULL`,
    [roundId],
  );
}
