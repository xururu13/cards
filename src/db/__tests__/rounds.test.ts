import { createCard, deleteCard, getCard } from '../cards';
import { createDeck } from '../decks';
import { getRoundResult, listMissedCardIds, saveRound } from '../rounds';
import { openMigratedDb } from '../test-db';

jest.mock('../ids', () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
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
  it('сохраняет раунд с итогами и ответами в порядке показа', async () => {
    const { db, deckId, cat, dog, fox } = await setup();
    const roundId = await saveRound(
      db,
      deckId,
      1000,
      [
        { cardId: dog, result: 'correct', timeMs: 3200.4 },
        { cardId: cat, result: 'hint', timeMs: 1500 },
        { cardId: fox, result: 'timeout', timeMs: 30000 },
      ],
      5000,
    );

    const result = await getRoundResult(db, roundId);
    expect(result?.round).toMatchObject({
      deck_id: deckId,
      started_at: 1000,
      finished_at: 5000,
      correct: 1,
      wrong: 0,
      hints: 2,
      score: 0,
    });
    expect(result?.answers).toEqual([
      { card_id: dog, front: 'dog', back: 'собака', result: 'correct' },
      { card_id: cat, front: 'cat', back: 'кот', result: 'hint' },
      { card_id: fox, front: 'fox', back: 'лиса', result: 'timeout' },
    ]);
  });

  it('отмечает время последнего показа только у карточек раунда', async () => {
    const { db, deckId, cat, dog } = await setup();
    await saveRound(db, deckId, 1000, [{ cardId: cat, result: 'wrong', timeMs: 100 }], 5000);

    expect(await getCard(db, cat)).toMatchObject({ last_shown_at: 5000, updated_at: 5000 });
    expect(await getCard(db, dog)).toMatchObject({ last_shown_at: null, updated_at: 20 });
  });

  it('не оставляет половину раунда, если ответ не сохранился', async () => {
    const { raw, db, deckId, cat } = await setup();
    await expect(
      saveRound(db, deckId, 1000, [
        { cardId: cat, result: 'correct', timeMs: 100 },
        { cardId: 'нет-такой-карточки', result: 'wrong', timeMs: 100 },
      ]),
    ).rejects.toThrow();

    expect(raw.prepare('SELECT COUNT(*) AS n FROM rounds').get()).toEqual({ n: 0 });
    expect(raw.prepare('SELECT COUNT(*) AS n FROM answers').get()).toEqual({ n: 0 });
  });

  it('для повтора отдаёт все неверные карточки, кроме удалённых', async () => {
    const { db, deckId, cat, dog, fox } = await setup();
    const roundId = await saveRound(db, deckId, 1000, [
      { cardId: cat, result: 'correct', timeMs: 100 },
      { cardId: dog, result: 'wrong', timeMs: 100 },
      { cardId: fox, result: 'hint', timeMs: 100 },
    ]);
    await deleteCard(db, fox);

    expect(await listMissedCardIds(db, roundId)).toEqual([{ id: dog }]);
  });

  it('возвращает null для неизвестного раунда', async () => {
    const { db } = await setup();
    expect(await getRoundResult(db, 'нет')).toBeNull();
  });
});
