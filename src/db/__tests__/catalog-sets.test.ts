import { deleteImportedSet, loadCatalog, loadCatalogSet, saveImportedSet } from '../catalog-sets';
import { openMigratedDb } from '../test-db';

const algebra = (term = 'Тождество') => `
id: algebra-7
title: Алгебра. 7 класс
chapters:
  - title: Глава 1
    sections:
      - number: 1
        title: Тождества
        cards:
          ${term}: Равенство, верное при любых значениях переменных.
`;

describe('загруженные наборы', () => {
  it('без загрузок список пуст — в приложение ничего не встроено', async () => {
    const { db } = await openMigratedDb();
    expect(await loadCatalog(db)).toEqual([]);
  });

  it('сохраняет набор из файла и показывает его в списке', async () => {
    const { db } = await openMigratedDb();
    const { set, replaced } = await saveImportedSet(db, algebra(), 100);

    expect(replaced).toBe(false);
    expect(set.title).toBe('Алгебра. 7 класс');
    expect((await loadCatalog(db)).map((e) => [e.set.id, e.importedAt])).toEqual([['algebra-7', 100]]);
    expect((await loadCatalogSet(db, 'algebra-7'))?.chapters[0].sections[0].cards[0].front).toBe('Тождество');
  });

  it('файл с тем же id заменяет прежнюю версию', async () => {
    const { db } = await openMigratedDb();
    await saveImportedSet(db, algebra(), 100);
    const again = await saveImportedSet(db, algebra('Равенство'), 200);

    expect(again.replaced).toBe(true);
    const imported = await loadCatalog(db);
    expect(imported).toHaveLength(1);
    expect(imported[0].set.chapters[0].sections[0].cards[0].front).toBe('Равенство');
  });

  it('ошибочный файл не сохраняется', async () => {
    const { db } = await openMigratedDb();
    await expect(saveImportedSet(db, 'title: X\nchapters: []')).rejects.toThrow(/нет глав/);
    expect(await loadCatalog(db)).toEqual([]);
  });

  it('удаление убирает набор из списка', async () => {
    const { db } = await openMigratedDb();
    await saveImportedSet(db, algebra());
    await deleteImportedSet(db, 'algebra-7');
    expect(await loadCatalog(db)).toEqual([]);
    expect(await loadCatalogSet(db, 'algebra-7')).toBeUndefined();
  });
});
