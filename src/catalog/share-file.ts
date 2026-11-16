import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { catalogSetToYaml, type CatalogSet } from './catalog';

/** Имя файла из названия набора: без знаков, запрещённых в именах файлов. */
export function catalogFileName(set: CatalogSet): string {
  const base = set.title.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  return `${base || 'набор'}.yaml`;
}

/** Сохраняет набор в YAML и открывает системное окно «Поделиться»: мессенджер, Диск, почта. */
export async function shareCatalogSet(set: CatalogSet): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('На этом устройстве нельзя поделиться файлом.');
  }
  const file = new File(Paths.cache, catalogFileName(set));
  if (file.exists) file.delete();
  file.create();
  file.write(catalogSetToYaml(set));
  await Sharing.shareAsync(file.uri, {
    // text/plain понимают все приложения; расширение .yaml сохраняется в имени файла.
    mimeType: 'text/plain',
    dialogTitle: `Поделиться: ${set.title}`,
  });
}
