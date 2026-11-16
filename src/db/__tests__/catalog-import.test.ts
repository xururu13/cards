import { parseCatalogSet } from '@/catalog/catalog';

import { catalogCardId, importCatalog, loadedSections } from '../catalog-import';
import { deleteCard, listCards, updateCard } from '../cards';
import { getDeck, listDecks } from '../decks';
import { openMigratedDb } from '../test-db';

jest.mock('../ids', () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
});

const set = parseCatalogSet({
  format: 'kartochki-catalog',
  version: 1,
  id: 'test-set',
  title: 'Тест. 7 класс',
  source: 'тест',
  frontLang: 'ru-RU',
  backLang: 'ru-RU',
  chapters: [
    {
      title: 'Глава 1. Первая',
      sections: [
        { number: 1, title: 'Один', cards: [{ front: 'Спора', back: 'клетка' }, { front: 'Семя', back: 'орган' }] },
        { number: 2, title: 'Два', cards: [{ front: 'Плод', back: 'из завязи' }] },
      ],
    },
    { title: 'Глава 2. Вторая', sections: [{ number: 3, title: 'Три', cards: [{ front: 'Гифа', back: 'нить' }] }] },
  ],
});

describe('загрузка готового набора', () => {
  it('создаёт новую стопку с карточками выбранных параграфов в порядке учебника', async () => {
    const { db } = await openMigratedDb();
    const result = await importCatalog(db, set, [1, 3], { newDeckName: 'Биология' }, 1000);

    expect(result).toEqual({ deckId: 'id-1', added: 3, skipped: 0 });
    expect(await getDeck(db, 'id-1')).toMatchObject({ name: 'Биология', front_lang: 'ru-RU', card_count: 3 });
    const cards = await listCards(db, 'id-1');
    expect(cards.map((c) => c.front)).toEqual(['Спора', 'Семя', 'Гифа']);
    expect(cards[0]).toMatchObject({ id: 'id-1:test-set:спора', level: 0, updated_at: 1000 });
  });

  it('повторная загрузка не создаёт дубли и не трогает прогресс и правки', async () => {
    const { raw, db } = await openMigratedDb();
    const { deckId } = await importCatalog(db, set, [1], { newDeckName: 'Био' }, 1000);
    const spora = catalogCardId(deckId, set.id, 'Спора');
    await updateCard(db, spora, { front: 'Спора', back: 'моё объяснение' }, 2000);
    raw.prepare('UPDATE cards SET level = 3 WHERE id = ?').run(spora);
    await deleteCard(db, catalogCardId(deckId, set.id, 'Семя'), 2000);

    const again = await importCatalog(db, set, [1, 2], { deckId }, 3000);

    expect(again).toEqual({ deckId, added: 1, skipped: 2 });
    const cards = await listCards(db, deckId);
    expect(cards.map((c) => c.front).sort()).toEqual(['Плод', 'Спора']);
    expect(cards.find((c) => c.id === spora)).toMatchObject({ back: 'моё объяснение', level: 3 });
    expect(await listDecks(db)).toHaveLength(1);
  });

  it('в другую стопку те же термины попадают отдельными карточками', async () => {
    const { db } = await openMigratedDb();
    const a = await importCatalog(db, set, [1], { newDeckName: 'А' });
    const b = await importCatalog(db, set, [1], { newDeckName: 'Б' });
    expect(b.added).toBe(2);
    expect((await listCards(db, a.deckId)).length).toBe(2);
  });

  it('без выбранных параграфов ничего не создаёт', async () => {
    const { db } = await openMigratedDb();
    await expect(importCatalog(db, set, [], { newDeckName: 'Пусто' })).rejects.toThrow(/параграф/);
    expect(await listDecks(db)).toEqual([]);
  });

  it('показывает, какие параграфы уже загружены в стопку целиком', async () => {
    const { db } = await openMigratedDb();
    const { deckId } = await importCatalog(db, set, [1, 2], { newDeckName: 'Био' });
    expect(await loadedSections(db, set, deckId)).toEqual([1, 2]);
  });
});
