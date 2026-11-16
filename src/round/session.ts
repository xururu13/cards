import type { AnswerResult, Card } from '@/db/types';

import { isGrade, scoreAnswer, type Grade } from './scoring';

/** Как открыли оборот: сам проверил, взял подсказку или вышло время. */
export type Reveal = 'check' | 'hint' | 'timeout' | 'voice';

export interface QueueItem {
  card: Card;
  /** Карточка вернулась в конец раунда после ошибки. */
  repeat: boolean;
}

export interface SessionAnswer {
  cardId: string;
  grade?: Grade;
  result: AnswerResult;
  /** Сколько думал до открытия оборота. */
  timeMs: number;
  /** На сколько изменился счёт раунда. Сумма по ответам равна счёту. */
  points: number;
  repeat: boolean;
}

export interface Session {
  queue: QueueItem[];
  index: number;
  phase: 'question' | 'voice' | 'answer';
  evaluation?: { grade: Grade; feedback: string };
  /** Задано в фазе «answer». */
  reveal: Reveal | null;
  revealTimeMs: number;
  answers: SessionAnswer[];
  score: number;
  /** Верных ответов подряд. */
  streak: number;
  /** null — таймер выключен. */
  timeLimitMs: number | null;
}

export type SessionAction =
  | { type: 'voice'; timeMs: number }
  | { type: 'cancelVoice' }
  | { type: 'graded'; index: number; grade: Grade; feedback: string }
  | { type: 'reveal'; by: Exclude<Reveal, 'voice'>; timeMs: number }
  /** Самооценка после «Проверить». */
  | { type: 'rate'; correct: boolean }
  /** «Дальше» после подсказки или истёкшего времени. */
  | { type: 'continue' };

export function startSession(cards: readonly Card[], timeLimitMs: number | null): Session {
  return {
    queue: cards.map((card) => ({ card, repeat: false })),
    index: 0,
    phase: 'question',
    reveal: null,
    evaluation: undefined,
    revealTimeMs: 0,
    answers: [],
    score: 0,
    streak: 0,
    timeLimitMs,
  };
}

export const isFinished = (session: Session): boolean => session.index >= session.queue.length;

export const currentItem = (session: Session): QueueItem | undefined =>
  session.queue[session.index];

function record(session: Session, result: AnswerResult): Session {
  const item = session.queue[session.index];
  const raw = scoreAnswer({
    result,
    grade: session.evaluation?.grade,
    timeMs: session.revealTimeMs,
    timeLimitMs: session.timeLimitMs,
    streak: session.streak,
    repeat: item.repeat,
  });
  // Счёт раунда не опускается ниже нуля.
  const score = Math.max(0, session.score + raw);
  const missed = result !== 'correct';
  return {
    ...session,
    // Ошибочная карточка возвращается в конец раунда, но только один раз.
    queue: missed && !item.repeat ? [...session.queue, { card: item.card, repeat: true }] : session.queue,
    index: session.index + 1,
    phase: 'question',
    reveal: null,
    evaluation: undefined,
    revealTimeMs: 0,
    answers: [
      ...session.answers,
      {
        cardId: item.card.id,
        ...(session.evaluation && { grade: session.evaluation.grade }),
        result,
        timeMs: session.revealTimeMs,
        points: score - session.score,
        repeat: item.repeat,
      },
    ],
    score,
    streak: missed ? 0 : session.streak + 1,
  };
}

/** Действия, не подходящие текущей фазе, игнорируются: это защищает от двойных нажатий. */
export function sessionReducer(session: Session, action: SessionAction): Session {
  if (isFinished(session)) return session;
  switch (action.type) {
    case 'voice':
      if (session.phase !== 'question') return session;
      return { ...session, phase: 'voice', revealTimeMs: Math.max(0, action.timeMs) };
    case 'cancelVoice':
      if (session.phase !== 'voice') return session;
      return { ...session, phase: 'question' };
    case 'graded':
      if (session.phase !== 'voice' || action.index !== session.index || !isGrade(action.grade)) return session;
      return { ...session, phase: 'answer', reveal: 'voice', evaluation: { grade: action.grade, feedback: action.feedback } };

    case 'reveal':
      if (session.phase === 'voice' && action.by === 'check') {
        return { ...session, phase: 'answer', reveal: 'check' };
      }
      if (session.phase !== 'question') return session;
      return { ...session, phase: 'answer', reveal: action.by, revealTimeMs: action.timeMs };
    case 'rate':
      if (session.phase !== 'answer' || session.reveal !== 'check') return session;
      return record(session, action.correct ? 'correct' : 'wrong');
    case 'continue':
      if (session.phase !== 'answer' || session.reveal === 'check' || !session.reveal) return session;
      if (session.reveal === 'voice') return record(session, session.evaluation!.grade >= 4 ? 'correct' : 'wrong');
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
