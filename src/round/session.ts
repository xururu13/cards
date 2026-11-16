import type { AnswerResult, Card } from '@/db/types';

/** Как открыли оборот: сам проверил, взял подсказку или вышло время. */
export type Reveal = 'check' | 'hint' | 'timeout';

export interface SessionAnswer {
  cardId: string;
  result: AnswerResult;
  /** Сколько думал до открытия оборота. */
  timeMs: number;
}

export interface Session {
  cards: Card[];
  index: number;
  phase: 'question' | 'answer';
  /** Задано в фазе «answer». */
  reveal: Reveal | null;
  revealTimeMs: number;
  answers: SessionAnswer[];
}

export type SessionAction =
  | { type: 'reveal'; by: Reveal; timeMs: number }
  /** Самооценка после «Проверить». */
  | { type: 'rate'; correct: boolean }
  /** «Дальше» после подсказки или истёкшего времени. */
  | { type: 'continue' };

export function startSession(cards: Card[]): Session {
  return { cards, index: 0, phase: 'question', reveal: null, revealTimeMs: 0, answers: [] };
}

export const isFinished = (session: Session): boolean => session.index >= session.cards.length;

export const currentCard = (session: Session): Card | undefined => session.cards[session.index];

function record(session: Session, result: AnswerResult): Session {
  const card = session.cards[session.index];
  return {
    ...session,
    index: session.index + 1,
    phase: 'question',
    reveal: null,
    revealTimeMs: 0,
    answers: [...session.answers, { cardId: card.id, result, timeMs: session.revealTimeMs }],
  };
}

/** Действия, не подходящие текущей фазе, игнорируются: это защищает от двойных нажатий. */
export function sessionReducer(session: Session, action: SessionAction): Session {
  if (isFinished(session)) return session;
  switch (action.type) {
    case 'reveal':
      if (session.phase !== 'question') return session;
      return { ...session, phase: 'answer', reveal: action.by, revealTimeMs: action.timeMs };
    case 'rate':
      if (session.phase !== 'answer' || session.reveal !== 'check') return session;
      return record(session, action.correct ? 'correct' : 'wrong');
    case 'continue':
      if (session.phase !== 'answer' || session.reveal === 'check' || !session.reveal) return session;
      return record(session, session.reveal);
  }
}

export interface Totals {
  correct: number;
  wrong: number;
  hints: number;
}

/** Истёкшее время считается вместе с подсказками: оборот открылся без попытки ответа. */
export function totals(answers: readonly Pick<SessionAnswer, 'result'>[]): Totals {
  const count = (...results: AnswerResult[]) =>
    answers.filter((a) => results.includes(a.result)).length;
  return { correct: count('correct'), wrong: count('wrong'), hints: count('hint', 'timeout') };
}

/**
 * Карточки для раунда: случайные `size` штук в случайном порядке.
 * На этапе 4 подбор станет взвешенным по уровню карточки.
 */
export function pickRoundCards<T>(cards: readonly T[], size: number, random = Math.random): T[] {
  const pool = [...cards];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, size);
}
