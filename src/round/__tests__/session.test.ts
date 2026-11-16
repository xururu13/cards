import type { Card } from '@/db/types';

import {
  currentItem,
  isFinished,
  sessionReducer,
  startSession,
  totals,
  type Session,
  type SessionAction,
} from '../session';

const card = (id: string): Card => ({
  id,
  deck_id: 'd',
  front: `front-${id}`,
  back: `back-${id}`,
  level: 0,
  correct_count: 0,
  wrong_count: 0,
  last_shown_at: null,
  created_at: 0,
  updated_at: 0,
  deleted_at: null,
});

const LIMIT = 30_000;
const play = (session: Session, ...actions: SessionAction[]) => actions.reduce(sessionReducer, session);
const check = (timeMs: number): SessionAction => ({ type: 'reveal', by: 'check', timeMs });
const right: SessionAction = { type: 'rate', correct: true };
const wrong: SessionAction = { type: 'rate', correct: false };
const hint: SessionAction = { type: 'reveal', by: 'hint', timeMs: 1000 };
const next: SessionAction = { type: 'continue' };

describe('sessionReducer', () => {
  it('«Проверить» открывает оборот и ждёт самооценку', () => {
    const s = play(startSession([card('a'), card('b')], LIMIT), check(4000));
    expect(s).toMatchObject({ index: 0, phase: 'answer', reveal: 'check', answers: [], score: 0 });
  });

  it('начисляет очки с бонусами за скорость и серию', () => {
    const s = play(
      startSession([card('a'), card('b'), card('c')], LIMIT),
      check(0), // 10 + 5 за скорость
      right,
      check(15_000), // 10 + 3 за скорость (половина времени) + 2 за серию
      right,
      check(LIMIT), // 10 + 0 + 4 за серию
      right,
    );
    expect(s.answers.map((a) => a.points)).toEqual([15, 15, 14]);
    expect(s.score).toBe(44);
    expect(s.streak).toBe(3);
    expect(isFinished(s)).toBe(true);
  });

  it('ошибка даёт 0, сбрасывает серию и возвращает карточку в конец раунда', () => {
    const s = play(startSession([card('a'), card('b')], LIMIT), check(LIMIT), right, check(LIMIT), wrong);
    expect(s.score).toBe(10);
    expect(s.streak).toBe(0);
    expect(isFinished(s)).toBe(false);
    expect(currentItem(s)).toMatchObject({ card: { id: 'b' }, repeat: true });
  });

  it('повторный показ даёт 5 без бонусов и больше не возвращается', () => {
    const afterMiss = play(startSession([card('a')], LIMIT), check(0), wrong);
    const fixed = play(afterMiss, check(0), right);
    expect(fixed.answers[1]).toMatchObject({ cardId: 'a', result: 'correct', points: 5, repeat: true });
    expect(isFinished(fixed)).toBe(true);

    const missedAgain = play(afterMiss, check(0), wrong);
    expect(missedAgain.queue).toHaveLength(2);
    expect(isFinished(missedAgain)).toBe(true);
  });

  it('подсказка и истёкшее время снимают 5 очков, но счёт не уходит ниже нуля', () => {
    const s = play(
      startSession([card('a'), card('b'), card('c')], LIMIT),
      hint, // счёт 0 → 0
      next,
      check(LIMIT), // +10
      right,
      { type: 'reveal', by: 'timeout', timeMs: LIMIT }, // −5
      next,
    );
    expect(s.answers.map((a) => [a.result, a.points])).toEqual([
      ['hint', 0],
      ['correct', 10],
      ['timeout', -5],
    ]);
    expect(s.score).toBe(5);
    expect(s.answers.reduce((sum, a) => sum + a.points, 0)).toBe(s.score);
    // Обе пропущенные карточки вернулись в конец.
    expect(s.queue.slice(3).map((item) => item.card.id)).toEqual(['a', 'c']);
  });

  it('без таймера бонуса за скорость нет', () => {
    const s = play(startSession([card('a')], null), check(0), right);
    expect(s.score).toBe(10);
  });

  it('после подсказки самооценка не принимается', () => {
    const hinted = play(startSession([card('a')], LIMIT), hint);
    expect(sessionReducer(hinted, right)).toBe(hinted);
  });

  it('игнорирует действия не из своей фазы', () => {
    const start = startSession([card('a')], LIMIT);
    expect(sessionReducer(start, right)).toBe(start);
    expect(sessionReducer(start, next)).toBe(start);

    const checked = sessionReducer(start, check(1));
    // Таймер сработал уже после «Проверить» — оборот остаётся открытым как «check».
    expect(sessionReducer(checked, { type: 'reveal', by: 'timeout', timeMs: LIMIT })).toBe(checked);
    expect(sessionReducer(checked, next)).toBe(checked);

    const done = sessionReducer(checked, right);
    expect(sessionReducer(done, check(1))).toBe(done);
  });
});

describe('totals', () => {
  it('считает верные, ошибки и подсказки вместе с истёкшим временем', () => {
    expect(
      totals([
        { result: 'correct' },
        { result: 'correct' },
        { result: 'wrong' },
        { result: 'hint' },
        { result: 'timeout' },
      ]),
    ).toEqual({ correct: 2, wrong: 1, hints: 2 });
  });
});
