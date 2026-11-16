import { parseCatalogText, type CatalogSet } from '@/catalog/catalog';

import type { Db } from './db';

export interface CatalogEntry {
  set: CatalogSet;
  importedAt: number;
}

/** Загруженные наборы по порядку загрузки. Испорченную запись (например, от будущей версии формата) пропускаем. */
export async function loadCatalog(db: Db): Promise<CatalogEntry[]> {
  const rows = await db.getAllAsync<{ source: string; imported_at: number }>(
    `SELECT source, imported_at FROM catalog_sets ORDER BY imported_at`,
    [],
  );
  return rows.flatMap((row) => {
    try {
      return [{ set: parseCatalogText(row.source), importedAt: row.imported_at }];
    } catch {
      return [];
    }
  });
}

export async function loadCatalogSet(db: Db, id: string): Promise<CatalogSet | undefined> {
  return (await loadCatalog(db)).find((entry) => entry.set.id === id)?.set;
}

/**
 * Проверяет текст файла и сохраняет набор. Набор с тем же id заменяется —
 * так обновляют исправленный файл. Возвращает набор и признак замены.
 */
export async function saveImportedSet(
  db: Db,
  source: string,
  now = Date.now(),
): Promise<{ set: CatalogSet; replaced: boolean }> {
  const set = parseCatalogText(source);
  const existing = await db.getFirstAsync<{ id: string }>(`SELECT id FROM catalog_sets WHERE id = ?`, [set.id]);
  await db.runAsync(
    `INSERT INTO catalog_sets (id, source, imported_at) VALUES (?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET source = excluded.source, imported_at = excluded.imported_at`,
    [set.id, source, now],
  );
  return { set, replaced: existing !== null };
}

/** Убирает загруженный набор из списка. Стопки и карточки из него остаются. */
export async function deleteImportedSet(db: Db, id: string): Promise<void> {
  await db.runAsync(`DELETE FROM catalog_sets WHERE id = ?`, [id]);
}
