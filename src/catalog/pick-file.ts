import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

/** Самый большой файл набора, который читаем: ~2 МБ — это десятки тысяч карточек. */
const MAX_BYTES = 2 * 1024 * 1024;

/** Выбор файла набора (YAML или JSON) на телефоне. null — пользователь передумал. */
export async function pickCatalogFile(): Promise<string | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    // У .yaml на Android часто нет своего типа — разрешаем любой файл и проверяем содержимое.
    type: ['application/yaml', 'application/x-yaml', 'text/yaml', 'text/plain', 'application/json', '*/*'],
    copyToCacheDirectory: true,
  });
  if (picked.canceled) return null;
  const asset = picked.assets[0];
  if (asset.size !== undefined && asset.size > MAX_BYTES) {
    throw new Error('Файл слишком большой для набора карточек.');
  }
  return new File(asset.uri).text();
}
