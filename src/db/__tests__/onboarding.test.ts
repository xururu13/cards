import { createDeck, deleteDeck } from '../decks';
import { loadOnboarding, saveOnboarding } from '../onboarding';
import { openMigratedDb } from '../test-db';

jest.mock('../ids', () => ({ newId: () => 'test-deck' }));

const deck = { name: 'Английский', frontLang: 'en-US', backLang: 'ru-RU' };

it('начинает обучение на чистой установке и возобновляет его у первой стопки', async () => {
  const { db } = await openMigratedDb();
  expect(await loadOnboarding(db)).toBe('welcome');
  const id = await createDeck(db, deck);
  await saveOnboarding(db, `deck:${id}`);
  expect(await loadOnboarding(db)).toBe(`deck:${id}`);
  await deleteDeck(db, id);
  expect(await loadOnboarding(db)).toBe('welcome');
});

it('не показывает обучение снова после завершения или пропуска', async () => {
  const { db } = await openMigratedDb();
  expect(await loadOnboarding(db)).toBe('welcome');
  await saveOnboarding(db, 'done');
  expect(await loadOnboarding(db)).toBe('done');
});

it('не включает обучение при обновлении установки с существующими данными', async () => {
  const { db } = await openMigratedDb();
  const id = await createDeck(db, deck);
  expect(await loadOnboarding(db)).toBe('done');
  await deleteDeck(db, id);
  expect(await loadOnboarding(db)).toBe('done');
});
