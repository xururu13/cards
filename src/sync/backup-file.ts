import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { Db } from '@/db/db';

import { exportSnapshot, mergeSnapshot, parseSnapshot, type MergeStats } from './snapshot';

function fileName(now: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `kartochki-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

/** Сохраняет копию в файл и открывает системное окно «Поделиться»: Файлы, Диск, мессенджер. */
export async function shareBackupFile(db: Db): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('На этом устройстве нельзя поделиться файлом.');
  }
  const snapshot = await exportSnapshot(db);
  const file = new File(Paths.cache, fileName(new Date(snapshot.exportedAt)));
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(snapshot));
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Сохранить резервную копию',
  });
}

/** Выбор файла копии и слияние с данными на телефоне. null — пользователь передумал. */
export async function restoreBackupFile(db: Db): Promise<MergeStats | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });
  if (picked.canceled) return null;
  const json = await new File(picked.assets[0].uri).text();
  return mergeSnapshot(db, parseSnapshot(json));
}
