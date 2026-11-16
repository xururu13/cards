import type { Card } from '@/db/types';

import {
  currentCard,
  isFinished,
  pickRoundCards,
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

const play = (session: Session, ...actions: SessionAction[]) => actions.reduce(sessionReducer, session);

describe('sessionReducer', () => {
  it('«Проверить» открывает оборот и ждёт самооценку', () => {
    const s = play(startSession([card('a'), card('b')]), { type: 'reveal', by: 'check', timeMs: 4000 });
    expect(s).toMatchObject({ index: 0, phase: 'answer', reveal: 'check', answers: [] });
  });

  it('записывает самооценку и переходит к следующей карточке', () => {
    const s = play(
      startSession([card('a'), card('b')]),
      { type: 'reveal', by: 'check', timeMs: 4000 },
      { type: 'rate', correct: true },
      { type: 'reveal', by: 'check', timeMs: 9000 },
      { type: 'rate', correct: false },
    );
    expect(s.answers).toEqual([
      { cardId: 'a', result: 'correct', timeMs: 4000 },
      { cardId: 'b', result: 'wrong', timeMs: 9000 },
    ]);
    expect(isFinished(s)).toBe(true);
    expect(currentCard(s)).toBeUndefined();
  });

  it('после подсказки и истёкшего времени есть только «Дальше»', () => {
    const hinted = play(startSession([card('a'), card('b')]), { type: 'reveal', by: 'hint', timeMs: 2000 });
    // Самооценка после подсказки не принимается.
    expect(sessionReducer(hinted, { type: 'rate', correct: true })).toBe(hinted);

    const s = play(
      hinted,
      { type: 'continue' },
      { type: 'reveal', by: 'timeout', timeMs: 30000 },
      { type: 'continue' },
    );
    expect(s.answers).toEqual([
      { cardId: 'a', result: 'hint', timeMs: 2000 },
      { cardId: 'b', result: 'timeout', timeMs: 30000 },
    ]);
  });

  it('игнорирует действия не из своей фазы', () => {
    const start = startSession([card('a')]);
    expect(sessionReducer(start, { type: 'rate', correct: true })).toBe(start);
    expect(sessionReducer(start, { type: 'continue' })).toBe(start);

    const checked = sessionReducer(start, { type: 'reveal', by: 'check', timeMs: 1 });
    // Таймер сработал уже после «Проверить» — оборот остаётся открытым как «check».
    expect(sessionReducer(checked, { type: 'reveal', by: 'timeout', timeMs: 30000 })).toBe(checked);
    expect(sessionReducer(checked, { type: 'continue' })).toBe(checked);

    const done = sessionReducer(checked, { type: 'rate', correct: true });
    expect(sessionReducer(done, { type: 'reveal', by: 'check', timeMs: 1 })).toBe(done);
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

describe('pickRoundCards', () => {
  const ids = ['a', 'b', 'c', 'd', 'e'];

  it('берёт не больше размера раунда и без повторов', () => {
    const picked = pickRoundCards(ids, 3);
    expect(picked).toHaveLength(3);
    expect(new Set(picked).size).toBe(3);
    picked.forEach((id) => expect(ids).toContain(id));
  });

  it('отдаёт все карточки, если их меньше размера раунда', () => {
    expect([...pickRoundCards(ids, 10)].sort()).toEqual(ids);
  });

  it('перемешивает и не трогает исходный массив', () => {
    const source = [...ids];
    // random = 0 на каждом шаге меняет текущий элемент с первым.
    expect(pickRoundCards(source, 5, () => 0)).toEqual(['b', 'c', 'd', 'e', 'a']);
    expect(source).toEqual(ids);
  });
});
