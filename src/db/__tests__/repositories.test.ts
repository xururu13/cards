import { cardStatus, createCard, deleteCard, getCard, listCards, updateCard } from '../cards';
import { createDeck, deleteDeck, getDeck, listDecks, setDeckLanguage, updateDeck } from '../decks';
import { openMigratedDb } from '../test-db';

jest.mock('../ids', () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
});

const deckInput = { name: ' Английский ', frontLang: 'en-US', backLang: 'ru-RU' };

describe('стопки', () => {
  it('создаёт стопку, обрезая пробелы, и возвращает её в списке', async () => {
    const { db } = await openMigratedDb();
    const id = await createDeck(db, deckInput, 100);

    const decks = await listDecks(db);
    expect(decks).toHaveLength(1);
    expect(decks[0]).toMatchObject({
      id,
      name: 'Английский',
      front_lang: 'en-US',
      back_lang: 'ru-RU',
      card_count: 0,
      hard_count: 0,
      known_count: 0,
      created_at: 100,
      updated_at: 100,
    });
  });

  it('не принимает пустое название', async () => {
    const { db } = await openMigratedDb();
    await expect(createDeck(db, { ...deckInput, name: '   ' })).rejects.toThrow(/название/);
    expect(await listDecks(db)).toEqual([]);
  });

  it('переименовывает стопку и меняет язык одной стороны', async () => {
    const { db } = await openMigratedDb();
    const id = await createDeck(db, deckInput, 100);

    await updateDeck(db, id, { name: 'English', frontLang: 'en-US', backLang: 'ru-RU' }, 200);
    await setDeckLanguage(db, id, 'back', 'de-DE', 300);

    expect(await getDeck(db, id)).toMatchObject({
      name: 'English',
      front_lang: 'en-US',
      back_lang: 'de-DE',
      created_at: 100,
      updated_at: 300,
    });
  });

  it('считает карточки: всего, сложные и выученные', async () => {
    const { raw, db } = await openMigratedDb();
    const id = await createDeck(db, deckInput);
    const a = await createCard(db, id, { front: 'a', back: 'а' });
    const b = await createCard(db, id, { front: 'b', back: 'б' });
    await createCard(db, id, { front: 'c', back: 'в' });
    const removed = await createCard(db, id, { front: 'd', back: 'г' });
    raw.prepare('UPDATE cards SET wrong_count = 2 WHERE id = ?').run(a);
    raw.prepare('UPDATE cards SET level = 4, correct_count = 4 WHERE id = ?').run(b);
    await deleteCard(db, removed);

    expect(await getDeck(db, id)).toMatchObject({ card_count: 3, hard_count: 1, known_count: 1 });
  });

  it('удаление прячет стопку и карточки, но оставляет строки для синхронизации', async () => {
    const { raw, db } = await openMigratedDb();
    const id = await createDeck(db, deckInput, 100);
    const other = await createDeck(db, { ...deckInput, name: 'Биология' }, 100);
    const cardId = await createCard(db, id, { front: 'cat', back: 'кот' }, 100);
    const otherCard = await createCard(db, other, { front: 'Митоз', back: 'Деление' }, 100);

    await deleteDeck(db, id, 500);

    expect((await listDecks(db)).map((d) => d.id)).toEqual([other]);
    expect(await getDeck(db, id)).toBeNull();
    expect(await getCard(db, cardId)).toBeNull();
    expect(await getCard(db, otherCard)).not.toBeNull();
    expect(raw.prepare('SELECT deleted_at, updated_at FROM decks WHERE id = ?').get(id)).toEqual({
      deleted_at: 500,
      updated_at: 500,
    });
    expect(raw.prepare('SELECT deleted_at, updated_at FROM cards WHERE id = ?').get(cardId)).toEqual(
      { deleted_at: 500, updated_at: 500 },
    );
  });
});

describe('карточки', () => {
  it('создаёт карточку на уровне 0 и отдаёт новые первыми', async () => {
    const { db } = await openMigratedDb();
    const deckId = await createDeck(db, deckInput);
    const first = await createCard(db, deckId, { front: ' cat ', back: ' кот ' }, 100);
    const second = await createCard(db, deckId, { front: 'dog', back: 'собака' }, 200);

    const cards = await listCards(db, deckId);
    expect(cards.map((c) => c.id)).toEqual([second, first]);
    expect(cards[1]).toMatchObject({
      front: 'cat',
      back: 'кот',
      level: 0,
      correct_count: 0,
      wrong_count: 0,
      last_shown_at: null,
    });
  });

  it('не принимает пустую сторону', async () => {
    const { db } = await openMigratedDb();
    const deckId = await createDeck(db, deckInput);
    await expect(createCard(db, deckId, { front: ' ', back: 'кот' })).rejects.toThrow(/слов/);
    await expect(createCard(db, deckId, { front: 'cat', back: '' })).rejects.toThrow(/оборот/);
    expect(await listCards(db, deckId)).toEqual([]);
  });

  it('правка текста сохраняет прогресс', async () => {
    const { raw, db } = await openMigratedDb();
    const deckId = await createDeck(db, deckInput);
    const id = await createCard(db, deckId, { front: 'cat', back: 'кот' }, 100);
    raw.prepare('UPDATE cards SET level = 3, correct_count = 3 WHERE id = ?').run(id);

    await updateCard(db, id, { front: 'cat', back: 'кошка' }, 200);

    expect(await getCard(db, id)).toMatchObject({
      back: 'кошка',
      level: 3,
      correct_count: 3,
      created_at: 100,
      updated_at: 200,
    });
  });

  it('удалённая карточка не возвращается и не редактируется', async () => {
    const { raw, db } = await openMigratedDb();
    const deckId = await createDeck(db, deckInput);
    const id = await createCard(db, deckId, { front: 'cat', back: 'кот' }, 100);

    await deleteCard(db, id, 300);
    await updateCard(db, id, { front: 'cat', back: 'изменено' }, 400);

    expect(await listCards(db, deckId)).toEqual([]);
    expect(raw.prepare('SELECT back, deleted_at FROM cards WHERE id = ?').get(id)).toEqual({
      back: 'кот',
      deleted_at: 300,
    });
  });

  it('определяет статус карточки', () => {
    expect(cardStatus({ level: 0, correct_count: 0, wrong_count: 0 })).toBe('new');
    expect(cardStatus({ level: 0, correct_count: 1, wrong_count: 1 })).toBe('hard');
    expect(cardStatus({ level: 2, correct_count: 2, wrong_count: 0 })).toBe('learning');
    expect(cardStatus({ level: 4, correct_count: 5, wrong_count: 1 })).toBe('known');
  });
});
