import { createCard, deleteCard, getCard, listCards, updateCard } from '@/db/cards';
import { createDeck, getDeck, listDecks } from '@/db/decks';
import { saveRound } from '@/db/rounds';
import { getSettings, setSetting } from '@/db/settings';
import { getScoreStats } from '@/db/stats';
import { openMigratedDb } from '@/db/test-db';

import { exportSnapshot, mergeSnapshot, parseSnapshot } from '../snapshot';

jest.mock('@/db/ids', () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
});

/** Два устройства с общими данными: второе получило копию первого. */
async function twoDevices() {
  const phone = await openMigratedDb();
  const deckId = await createDeck(phone.db, { name: 'English', frontLang: 'en-US', backLang: 'ru-RU' }, 100);
  const cat = await createCard(phone.db, deckId, { front: 'cat', back: 'кот' }, 100);
  const dog = await createCard(phone.db, deckId, { front: 'dog', back: 'собака' }, 100);
  await saveRound(
    phone.db,
    deckId,
    150,
    [{ cardId: cat, result: 'correct', timeMs: 1000, points: 15, repeat: false }],
    200,
  );
  await setSetting(phone.db, 'timerSeconds', 45, 200);

  const tablet = await openMigratedDb();
  await mergeSnapshot(tablet.db, await exportSnapshot(phone.db));
  return { phone, tablet, deckId, cat, dog };
}

const roundTrip = async (from: Awaited<ReturnType<typeof openMigratedDb>>) =>
  parseSnapshot(JSON.stringify(await exportSnapshot(from.db)));

describe('снимок', () => {
  it('передаёт пропущенные карточки между устройствами', async () => {
    const { phone, tablet, deckId, dog } = await twoDevices();
    expect((await exportSnapshot(phone.db)).version).toBe(2);
    const roundId = await saveRound(phone.db, deckId, 300, [
      { cardId: dog, result: 'skipped', timeMs: 1000, points: 0, repeat: false },
    ], 500);
    const snapshot = await roundTrip(phone);
    expect(snapshot.version).toBe(3);
    await mergeSnapshot(tablet.db, snapshot);
    expect((await exportSnapshot(tablet.db)).answers.find(a => a.round_id === roundId)?.result).toBe('skipped');
  });

  it('переносит все данные на чистое устройство', async () => {
    const { phone, tablet } = await twoDevices();
    expect(await exportSnapshot(tablet.db, 1)).toEqual(await exportSnapshot(phone.db, 1));
    expect(await getSettings(tablet.db)).toEqual({
      timerSeconds: 45,
      roundSize: 10,
      defaultLanguage: 'ru-RU',
    });
    expect((await getScoreStats(tablet.db, 300)).bestRound).toBe(15);
  });

  it('повторное слияние ничего не меняет', async () => {
    const { phone, tablet } = await twoDevices();
    expect(await mergeSnapshot(tablet.db, await roundTrip(phone))).toEqual({ changed: 0 });
  });

  it('при конфликте побеждает более поздняя правка, в обе стороны', async () => {
    const { phone, tablet, cat, dog } = await twoDevices();
    await updateCard(phone.db, cat, { front: 'cat', back: 'кошка' }, 300);
    await updateCard(tablet.db, cat, { front: 'cat', back: 'котик' }, 400);
    await updateCard(phone.db, dog, { front: 'dog', back: 'пёс' }, 500);

    await mergeSnapshot(phone.db, await roundTrip(tablet));
    await mergeSnapshot(tablet.db, await roundTrip(phone));

    for (const device of [phone, tablet]) {
      expect((await getCard(device.db, cat))?.back).toBe('котик');
      expect((await getCard(device.db, dog))?.back).toBe('пёс');
    }
  });

  it('удаление доходит до другого устройства и не воскрешается старой копией', async () => {
    const { phone, tablet, deckId, cat } = await twoDevices();
    const oldCopy = await roundTrip(phone);
    await deleteCard(tablet.db, cat, 300);

    await mergeSnapshot(phone.db, await roundTrip(tablet));
    expect(await getCard(phone.db, cat)).toBeNull();

    await mergeSnapshot(phone.db, oldCopy);
    expect((await listCards(phone.db, deckId)).map((c) => c.front)).toEqual(['dog']);
  });

  it('новые записи с обоих устройств объединяются', async () => {
    const { phone, tablet, deckId } = await twoDevices();
    await createCard(phone.db, deckId, { front: 'fox', back: 'лиса' }, 300);
    await createDeck(tablet.db, { name: 'Биология', frontLang: 'ru-RU', backLang: 'ru-RU' }, 300);

    await mergeSnapshot(phone.db, await roundTrip(tablet));
    expect((await listDecks(phone.db)).map((d) => d.name)).toEqual(['English', 'Биология']);
    expect(await getDeck(phone.db, deckId)).toMatchObject({ card_count: 3 });
  });

  it('прогресс карточки после раунда переносится вместе с ответами', async () => {
    const { phone, tablet, deckId, dog } = await twoDevices();
    await saveRound(
      tablet.db,
      deckId,
      300,
      [{ cardId: dog, result: 'correct', timeMs: 1000, points: 12, repeat: false }],
      400,
    );
    await mergeSnapshot(phone.db, await roundTrip(tablet));

    expect(await getCard(phone.db, dog)).toMatchObject({ level: 1, correct_count: 1, last_shown_at: 400 });
    expect((await getScoreStats(phone.db, 500)).bestRound).toBe(15);
    expect((await exportSnapshot(phone.db)).answers).toHaveLength(2);
  });

  it('смешанный раунд (без стопки) переносится на другое устройство', async () => {
    const { phone, tablet, dog } = await twoDevices();
    await saveRound(tablet.db, null, 300, [{ cardId: dog, result: 'correct', timeMs: 900, points: 20, repeat: false }], 400);
    await mergeSnapshot(phone.db, await roundTrip(tablet));

    expect(await getScoreStats(phone.db, 500)).toMatchObject({ bestRound: 20, bestRoundDeck: 'Все стопки' });
  });

  it('служебные значения устройства в снимок не попадают', async () => {
    const { phone } = await twoDevices();
    phone.raw.prepare("INSERT INTO meta (key, value) VALUES ('lastSyncAt', '1')").run();
    expect(Object.keys(await exportSnapshot(phone.db))).not.toContain('meta');
  });
});

describe('parseSnapshot', () => {
  it('отклоняет не JSON, чужой файл и копию из будущей версии', () => {
    expect(() => parseSnapshot('не json')).toThrow(/не JSON/);
    expect(() => parseSnapshot('{"format":"other"}')).toThrow(/не резервная копия/);
    expect(() => parseSnapshot('{"format":"kartochki-backup","version":99}')).toThrow(/новее|новой/);
  });

  it('называет испорченную запись и поле', async () => {
    const { phone } = await twoDevices();
    const snapshot = await exportSnapshot(phone.db);
    const broken = { ...snapshot, cards: [snapshot.cards[0], { ...snapshot.cards[1], level: '3' }] };
    expect(() => parseSnapshot(JSON.stringify(broken))).toThrow('cards, запись 2, поле level');
    expect(() => parseSnapshot(JSON.stringify({ ...snapshot, rounds: undefined }))).toThrow(
      /нет раздела rounds/,
    );
  });

  it('не оставляет половину данных, если запись ссылается на несуществующую стопку', async () => {
    const { phone } = await twoDevices();
    const snapshot = await exportSnapshot(phone.db);
    const target = await openMigratedDb();
    const orphan = { ...snapshot.cards[0], id: 'orphan', deck_id: 'нет-стопки' };

    await expect(
      mergeSnapshot(target.db, { ...snapshot, cards: [...snapshot.cards, orphan] }),
    ).rejects.toThrow();
    expect(await listDecks(target.db)).toEqual([]);
  });
});

it.each([0, 4] as const)('оценка %s сохраняется в базе и переносится на другое устройство', async (grade) => {
  const { phone, tablet, deckId, dog } = await twoDevices();
  await saveRound(phone.db, deckId, 300, [{ cardId: dog, result: grade === 0 ? 'wrong' : 'correct', grade, points: grade === 0 ? 0 : 12, timeMs: 6000, repeat: false }], 400);
  const copy = await roundTrip(phone);
  expect(copy.answers.at(-1)?.grade).toBe(grade);
  await mergeSnapshot(tablet.db, copy);
  expect((await exportSnapshot(tablet.db)).answers.at(-1)?.grade).toBe(grade);
});
it('резервная копия версии 1 получает пустые оценки', async () => {
  const { phone } = await twoDevices();
  const copy = await exportSnapshot(phone.db);
  const old = { ...copy, version: 1, answers: copy.answers.map(({ grade, ...rest }) => rest) };
  expect(parseSnapshot(JSON.stringify(old)).answers[0].grade).toBeNull();
});
