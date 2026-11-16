import type { Db } from './db';

export interface ScoreStats {
  /** Сумма очков за раунды, завершённые сегодня. */
  today: number;
  /** Лучшая сумма очков за один день. */
  bestDay: number;
  /** Лучший счёт одного раунда. */
  bestRound: number;
  /** Стопка лучшего раунда («Все стопки» для смешанного); null, если раундов нет или стопка удалена. */
  bestRoundDeck: string | null;
}

export function startOfDay(now: number): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** Очки и рекорды. Раунды удалённых стопок учитываются: очки уже заработаны. */
export async function getScoreStats(db: Db, now = Date.now()): Promise<ScoreStats> {
  const today = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(score), 0) AS total FROM rounds
      WHERE deleted_at IS NULL AND finished_at >= ?`,
    [startOfDay(now)],
  );
  const bestDay = await db.getFirstAsync<{ total: number }>(
    `SELECT SUM(score) AS total FROM rounds
      WHERE deleted_at IS NULL AND finished_at IS NOT NULL
      GROUP BY date(finished_at / 1000, 'unixepoch', 'localtime')
      ORDER BY total DESC LIMIT 1`,
    [],
  );
  const bestRound = await db.getFirstAsync<{ score: number; deck: string | null }>(
    `SELECT r.score, CASE WHEN r.deck_id IS NULL THEN 'Все стопки' ELSE d.name END AS deck
       FROM rounds r LEFT JOIN decks d ON d.id = r.deck_id AND d.deleted_at IS NULL
      WHERE r.deleted_at IS NULL AND r.finished_at IS NOT NULL
      ORDER BY r.score DESC, r.finished_at LIMIT 1`,
    [],
  );
  return {
    today: today?.total ?? 0,
    bestDay: bestDay?.total ?? 0,
    bestRound: bestRound?.score ?? 0,
    bestRoundDeck: bestRound?.deck ?? null,
  };
}

/** Лучший счёт среди раундов, завершённых раньше указанного. Нужен, чтобы отметить новый рекорд. */
export async function getBestRoundBefore(db: Db, finishedAt: number): Promise<number> {
  const row = await db.getFirstAsync<{ best: number | null }>(
    `SELECT MAX(score) AS best FROM rounds WHERE deleted_at IS NULL AND finished_at < ?`,
    [finishedAt],
  );
  return row?.best ?? 0;
}
