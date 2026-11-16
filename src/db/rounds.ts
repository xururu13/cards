import type { SessionAnswer } from '@/round/session';
import { totals } from '@/round/session';

import type { Db } from './db';
import { newId } from './ids';
import type { AnswerResult, Round } from './types';

export interface RoundAnswer {
  card_id: string;
  front: string;
  back: string;
  result: AnswerResult;
}

export interface RoundResult {
  round: Round;
  answers: RoundAnswer[];
}

/** Сохраняет завершённый раунд вместе с ответами. Очки начисляются на этапе 4. */
export async function saveRound(
  db: Db,
  deckId: string,
  startedAt: number,
  answers: readonly SessionAnswer[],
  now = Date.now(),
): Promise<string> {
  const roundId = newId();
  const { correct, wrong, hints } = totals(answers);
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO rounds (id, deck_id, started_at, finished_at, correct, wrong, hints, score, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [roundId, deckId, startedAt, now, correct, wrong, hints, now],
    );
    for (const answer of answers) {
      await db.runAsync(
        `INSERT INTO answers (id, round_id, card_id, result, time_ms, points, created_at)
         VALUES (?, ?, ?, ?, ?, 0, ?)`,
        [newId(), roundId, answer.cardId, answer.result, Math.round(answer.timeMs), now],
      );
    }
    await db.runAsync(
      `UPDATE cards SET last_shown_at = ?, updated_at = ?
        WHERE id IN (SELECT card_id FROM answers WHERE round_id = ?)`,
      [now, now, roundId],
    );
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
    `SELECT a.card_id, c.front, c.back, a.result
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
