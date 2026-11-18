import type { AnswerResult } from '@/db/types';
import type { SessionAnswer } from '@/round/session';

import { createCard, deleteCard, getCard, listAllCards } from '../cards';
import { createDeck, deleteDeck } from '../decks';
import { getRoundResult, listMissedCardIds, saveRound } from '../rounds';
import { DEFAULT_SETTINGS, getSettings, setSetting } from '../settings';
import { getBestRoundBefore, getScoreStats } from '../stats';
import { openMigratedDb } from '../test-db';

jest.mock('../ids', () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
});

const answer = (cardId: string, result: AnswerResult, points = 0, repeat = false): SessionAnswer => ({
  cardId,
  result,
  timeMs: 1000,
  points,
  repeat,
});

async function setup() {
  const opened = await openMigratedDb();
  const deckId = await createDeck(opened.db, { name: 'English', frontLang: 'en-US', backLang: 'ru-RU' });
  const cat = await createCard(opened.db, deckId, { front: 'cat', back: 'кот' }, 10);
  const dog = await createCard(opened.db, deckId, { front: 'dog', back: 'собака' }, 20);
  const fox = await createCard(opened.db, deckId, { front: 'fox', back: 'лиса' }, 30);
  return { ...opened, deckId, cat, dog, fox };
}

describe('раунды', () => {
  it('сохраняет итоги, счёт и ответы в порядке показа', async () => {
    const { db, deckId, cat, dog, fox } = await setup();
    const roundId = await saveRound(
      db,
      deckId,
      1000,
      [
        { ...answer(dog, 'correct', 15), timeMs: 3200.4 },
        answer(cat, 'hint', -5),
        answer(fox, 'timeout', -5),
        answer(cat, 'correct', 5, true),
      ],
      5000,
    );

    const result = await getRoundResult(db, roundId);
    expect(result?.round).toMatchObject({
      deck_id: deckId,
      started_at: 1000,
      finished_at: 5000,
      correct: 2,
      wrong: 0,
      hints: 2,
      score: 10,
    });
    expect(result?.answers).toEqual([
      { grade: null, card_id: dog, front: 'dog', back: 'собака', result: 'correct', points: 15 },
      { grade: null, card_id: cat, front: 'cat', back: 'кот', result: 'hint', points: -5 },
      { grade: null, card_id: fox, front: 'fox', back: 'лиса', result: 'timeout', points: -5 },
      { grade: null, card_id: cat, front: 'cat', back: 'кот', result: 'correct', points: 5 },
    ]);
  });

  it('обновляет уровень и счётчики карточек по ответам раунда', async () => {
    const { raw, db, deckId, cat, dog, fox } = await setup();
    raw.prepare('UPDATE cards SET level = 3, correct_count = 3 WHERE id = ?').run(dog);
    raw.prepare('UPDATE cards SET level = 2, correct_count = 2 WHERE id = ?').run(fox);

    await saveRound(
      db,
      deckId,
      1000,
      [
        answer(dog, 'correct', 10), // 3 → 4
        answer(fox, 'wrong'), // 2 → 0
        answer(fox, 'correct', 5, true), // повтор: 0 → 1
      ],
      5000,
    );

    expect(await getCard(db, dog)).toMatchObject({
      level: 4,
      correct_count: 4,
      wrong_count: 0,
      last_shown_at: 5000,
      updated_at: 5000,
    });
    expect(await getCard(db, fox)).toMatchObject({ level: 1, correct_count: 3, wrong_count: 1 });
    // Карточка не из раунда не тронута.
    expect(await getCard(db, cat)).toMatchObject({ level: 0, last_shown_at: null, updated_at: 10 });
  });

  it('не оставляет половину раунда, если ответ не сохранился', async () => {
    const { raw, db, deckId, cat } = await setup();
    await expect(
      saveRound(db, deckId, 1000, [answer(cat, 'correct', 10), answer('нет-такой-карточки', 'wrong')]),
    ).rejects.toThrow();

    expect(raw.prepare('SELECT COUNT(*) AS n FROM rounds').get()).toEqual({ n: 0 });
    expect(raw.prepare('SELECT COUNT(*) AS n FROM answers').get()).toEqual({ n: 0 });
    expect(await getCard(db, cat)).toMatchObject({ level: 0, correct_count: 0 });
  });

  it('для повтора отдаёт все неверные карточки, кроме удалённых', async () => {
    const { db, deckId, cat, dog, fox } = await setup();
    const roundId = await saveRound(db, deckId, 1000, [
      answer(cat, 'correct', 10),
      answer(dog, 'wrong'),
      answer(dog, 'wrong', 0, true),
      answer(fox, 'hint'),
    ]);
    await deleteCard(db, fox);

    expect(await listMissedCardIds(db, roundId)).toEqual([{ id: dog }]);
  });

  it('хранит пропуск отдельно от ошибок и сохраняет уровень карточки', async () => {
    const { raw, db, deckId, cat, dog } = await setup();
    raw.prepare('UPDATE cards SET level = 3, correct_count = 4, wrong_count = 1 WHERE id = ?').run(cat);
    const roundId = await saveRound(db, deckId, 1000, [answer(cat, 'skipped'), answer(dog, 'wrong')], 5000);

    const result = await getRoundResult(db, roundId);
    expect(result?.round).toMatchObject({ correct: 0, wrong: 1, hints: 0, score: 0 });
    expect(result?.answers[0]).toMatchObject({ card_id: cat, result: 'skipped', points: 0, grade: null });
    expect(await getCard(db, cat)).toMatchObject({ level: 3, correct_count: 4, wrong_count: 1 });
    expect(await listMissedCardIds(db, roundId)).toEqual([{ id: dog }]);
  });

  it('возвращает null для неизвестного раунда', async () => {
    const { db } = await setup();
    expect(await getRoundResult(db, 'нет')).toBeNull();
  });
});

describe('очки и рекорды', () => {
  // Полдень по UTC: в любом часовом поясе эти моменты попадают в разные местные дни.
  const noon = (day: number) => Date.UTC(2026, 0, day, 12);

  it('без раундов всё по нулям', async () => {
    const { db } = await setup();
    expect(await getScoreStats(db, noon(1))).toEqual({
      today: 0,
      bestDay: 0,
      bestRound: 0,
      bestRoundDeck: null,
    });
  });

  it('считает очки за сегодня, рекорд дня и лучший раунд', async () => {
    const { db, deckId, cat } = await setup();
    await saveRound(db, deckId, 0, [answer(cat, 'correct', 40)], noon(1));
    await saveRound(db, deckId, 0, [answer(cat, 'correct', 35)], noon(1) + 60_000);
    await saveRound(db, deckId, 0, [answer(cat, 'correct', 50)], noon(5));
    await saveRound(db, deckId, 0, [answer(cat, 'correct', 12)], noon(9));

    expect(await getScoreStats(db, noon(9) + 1000)).toEqual({
      today: 12,
      bestDay: 75,
      bestRound: 50,
      bestRoundDeck: 'English',
    });
  });

  it('очки раундов удалённой стопки остаются, но имя стопки не показывается', async () => {
    const { db, deckId, cat } = await setup();
    await saveRound(db, deckId, 0, [answer(cat, 'correct', 30)], noon(1));
    await deleteDeck(db, deckId);

    expect(await getScoreStats(db, noon(1) + 1000)).toMatchObject({
      today: 30,
      bestRound: 30,
      bestRoundDeck: null,
    });
  });

  it('находит прежний рекорд, не считая более поздние раунды', async () => {
    const { db, deckId, cat } = await setup();
    await saveRound(db, deckId, 0, [answer(cat, 'correct', 40)], noon(1));
    await saveRound(db, deckId, 0, [answer(cat, 'correct', 60)], noon(2));

    expect(await getBestRoundBefore(db, noon(1))).toBe(0);
    expect(await getBestRoundBefore(db, noon(2))).toBe(40);
  });
});

describe('настройки', () => {
  it('по умолчанию таймер 30 секунд, 10 карточек и русский язык', async () => {
    const { db } = await setup();
    expect(await getSettings(db)).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toEqual({ timerSeconds: 30, roundSize: 10, defaultLanguage: 'ru-RU' });
  });

  it('сохраняет и перезаписывает значения', async () => {
    const { db } = await setup();
    await setSetting(db, 'timerSeconds', 15);
    await setSetting(db, 'timerSeconds', 0);
    await setSetting(db, 'roundSize', 20);
    await setSetting(db, 'defaultLanguage', 'en-US');
    expect(await getSettings(db)).toEqual({ timerSeconds: 0, roundSize: 20, defaultLanguage: 'en-US' });
  });

  it('отклоняет недопустимое значение и игнорирует испорченное в базе', async () => {
    const { raw, db } = await setup();
    await expect(setSetting(db, 'roundSize', 7)).rejects.toThrow(/Недопустимое/);
    await expect(setSetting(db, 'defaultLanguage', 'de-DE')).rejects.toThrow(/Недопустимое/);
    raw.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('defaultLanguage', 'fr-FR', 1)").run();
    raw.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('timerSeconds', 'abc', 1)").run();
    expect(await getSettings(db)).toEqual(DEFAULT_SETTINGS);
  });
});

describe('смешанный раунд', () => {
  it('берёт карточки всех стопок, кроме удалённых, с названием стопки', async () => {
    const { db, deckId, cat } = await setup();
    const bio = await createDeck(db, { name: 'Биология', frontLang: 'ru-RU', backLang: 'ru-RU' });
    await createCard(db, bio, { front: 'Спора', back: 'клетка' });
    const gone = await createDeck(db, { name: 'Старая', frontLang: 'ru-RU', backLang: 'ru-RU' });
    await createCard(db, gone, { front: 'x', back: 'y' });
    await deleteDeck(db, gone);
    await deleteCard(db, cat);

    const cards = await listAllCards(db);
    expect(cards.map((c) => [c.front, c.deck_name]).sort()).toEqual([
      ['dog', 'English'],
      ['fox', 'English'],
      ['Спора', 'Биология'],
    ]);
    expect(cards.every((c) => c.deck_id === deckId || c.deck_id === bio)).toBe(true);
  });

  it('сохраняется без стопки, меняет прогресс карточек и попадает в рекорды как «Все стопки»', async () => {
    const { db, cat } = await setup();
    const bio = await createDeck(db, { name: 'Биология', frontLang: 'ru-RU', backLang: 'ru-RU' });
    const spora = await createCard(db, bio, { front: 'Спора', back: 'клетка' });

    const roundId = await saveRound(db, null, 1000, [answer(cat, 'correct', 15), answer(spora, 'wrong')], 2000);

    const result = await getRoundResult(db, roundId);
    expect(result?.round).toMatchObject({ deck_id: null, score: 15, correct: 1, wrong: 1 });
    expect(result?.answers.map((a) => a.front)).toEqual(['cat', 'Спора']);
    expect(await getCard(db, cat)).toMatchObject({ level: 1, last_shown_at: 2000 });
    expect(await getCard(db, spora)).toMatchObject({ level: 0, wrong_count: 1 });
    expect(await getScoreStats(db, 2000)).toMatchObject({ bestRound: 15, bestRoundDeck: 'Все стопки' });
  });
});
