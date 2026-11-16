import { applyAnswer } from '../levels';
import { cardWeight, pickRoundCards, shuffle } from '../picking';
import { scoreAnswer } from '../scoring';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 100 * DAY;

describe('scoreAnswer', () => {
  const base = { timeMs: 30_000, timeLimitMs: 30_000, streak: 0, repeat: false };

  it('серия не увеличивает награду', () => {
    expect(scoreAnswer({ ...base, result: 'correct', streak: 5 })).toBe(10);
    expect(scoreAnswer({ ...base, result: 'correct', streak: 50 })).toBe(10);
  });

  it('не даёт отрицательный бонус, если время превышено', () => {
    expect(scoreAnswer({ ...base, result: 'correct', timeMs: 45_000 })).toBe(10);
  });

  it('штраф за подсказку 3, за время 2', () => {
    expect(scoreAnswer({ ...base, result: 'hint' })).toBe(-3);
    expect(scoreAnswer({ ...base, result: 'timeout', repeat: true })).toBe(-2);
    expect(scoreAnswer({ ...base, result: 'wrong', streak: 3 })).toBe(0);
  });
});

describe('applyAnswer', () => {
  it('поднимает уровень на 1, но не выше 4', () => {
    expect(applyAnswer({ level: 0, correct_count: 0, wrong_count: 2 }, 'correct')).toEqual({
      level: 1,
      correct_count: 1,
      wrong_count: 2,
    });
    expect(applyAnswer({ level: 4, correct_count: 7, wrong_count: 0 }, 'correct').level).toBe(4);
  });

  it.each(['wrong', 'hint', 'timeout'] as const)('%s сбрасывает уровень на 0', (result) => {
    expect(applyAnswer({ level: 3, correct_count: 3, wrong_count: 0 }, result)).toEqual({
      level: 0,
      correct_count: 3,
      wrong_count: 1,
    });
  });
});

describe('подбор карточек', () => {
  it('вес падает с уровнем и растёт с давностью показа', () => {
    const weights = [0, 1, 2, 3, 4].map((level) => cardWeight({ level, last_shown_at: NOW }, NOW));
    expect(weights).toEqual([16, 8, 4, 2, 1]);
    expect(cardWeight({ level: 2, last_shown_at: null }, NOW)).toBe(8);
    expect(cardWeight({ level: 2, last_shown_at: NOW - 30 * DAY }, NOW)).toBe(8);
    expect(cardWeight({ level: 2, last_shown_at: NOW - 3.5 * DAY }, NOW)).toBe(6);
  });

  it('берёт не больше размера раунда и без повторов', () => {
    const cards = Array.from({ length: 30 }, (_, i) => ({ id: i, level: i % 5, last_shown_at: null }));
    const picked = pickRoundCards(cards, 10, NOW);
    expect(picked).toHaveLength(10);
    expect(new Set(picked.map((c) => c.id)).size).toBe(10);
    expect(pickRoundCards(cards.slice(0, 4), 10, NOW)).toHaveLength(4);
  });

  it('сложные карточки попадают в раунд заметно чаще выученных', () => {
    // Детерминированный генератор, чтобы тест не мигал.
    let seed = 42;
    const random = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const cards = [
      ...Array.from({ length: 10 }, (_, i) => ({ id: `hard-${i}`, level: 0, last_shown_at: NOW })),
      ...Array.from({ length: 10 }, (_, i) => ({ id: `known-${i}`, level: 4, last_shown_at: NOW })),
    ];
    let hard = 0;
    const rounds = 500;
    for (let i = 0; i < rounds; i++) {
      hard += pickRoundCards(cards, 5, NOW, random).filter((c) => c.id.startsWith('hard')).length;
    }
    // При равных шансах было бы 50%; с весами 16:1 — больше 85%.
    expect(hard / (rounds * 5)).toBeGreaterThan(0.85);
    // Но выученные всё же иногда встречаются.
    expect(hard).toBeLessThan(rounds * 5);
  });

  it('shuffle сохраняет состав и не трогает исходный массив', () => {
    const source = ['a', 'b', 'c', 'd', 'e'];
    expect(shuffle(source, () => 0)).toEqual(['b', 'c', 'd', 'e', 'a']);
    expect(source).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});

it('полная шкала оценок, бонус только 4–5 и половина при повторе', () => {
  const base = { result: 'correct' as const, timeMs: 0, timeLimitMs: 30000, streak: 100, repeat: false };
  const grades = [1, 2, 3, 4, 5] as const;
  expect(grades.map(grade => scoreAnswer({ ...base, grade, timeLimitMs: null }))).toEqual([0, 2, 5, 8, 10]);
  expect(grades.map(grade => scoreAnswer({ ...base, grade }))).toEqual([0, 2, 5, 13, 15]);
  expect(grades.map(grade => scoreAnswer({ ...base, grade, repeat: true }))).toEqual([0, 1, 2, 4, 5]);
});
