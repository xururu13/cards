import type { Db } from '@/db/db';
import { setMeta } from '@/db/meta';

import { exportSnapshot, mergeSnapshot, parseSnapshot, type MergeStats } from './snapshot';

/** Имя файла в скрытой папке приложения на Google Drive. Пользователь его не видит. */
export const SYNC_FILE = 'kartochki-sync.json';
/** Доступ только к собственной скрытой папке приложения, без остальных файлов на Диске. */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

export class DriveError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Выдаёт токен доступа; `refresh` — прежний токен отклонён, нужен новый. */
export type GetToken = (refresh: boolean) => Promise<string>;

type Fetch = typeof fetch;

async function request(fetchImpl: Fetch, getToken: GetToken, url: string, init: RequestInit = {}) {
  for (const refresh of [false, true]) {
    const token = await getToken(refresh);
    const response = await fetchImpl(url, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    });
    if (response.status === 401 && !refresh) continue;
    if (!response.ok) {
      throw new DriveError(
        response.status === 403
          ? 'Google Drive не дал доступ. Проверь, что Drive API включён в проекте Google Cloud.'
          : `Google Drive ответил ошибкой ${response.status}.`,
        response.status,
      );
    }
    return response;
  }
  throw new DriveError('Google не принял вход. Выйди и войди снова.', 401);
}

function multipart(metadata: object, content: string) {
  const boundary = `kartochki-${Date.now()}`;
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${content}\r\n` +
    `--${boundary}--`;
  return { body, headers: { 'Content-Type': `multipart/related; boundary=${boundary}` } };
}

export interface SyncResult extends MergeStats {
  /** Файл на Диске создан впервые. */
  created: boolean;
  syncedAt: number;
}

/**
 * Синхронизация: скачать копию с Диска, влить в базу, выгрузить объединённое обратно.
 * Если два устройства синхронизируются в одну и ту же секунду, правки одного из них
 * доедут при следующей синхронизации — ничего не теряется, потому что слияние идёт по записям.
 */
export async function syncWithDrive(
  db: Db,
  getToken: GetToken,
  fetchImpl: Fetch = fetch,
  now: () => number = Date.now,
): Promise<SyncResult> {
  const query = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name = '${SYNC_FILE}' and trashed = false`,
    fields: 'files(id, modifiedTime)',
    orderBy: 'modifiedTime desc',
  });
  const listed = await request(fetchImpl, getToken, `${API}?${query}`);
  const { files } = (await listed.json()) as { files: { id: string }[] };
  const fileId = files[0]?.id;

  let stats: MergeStats = { changed: 0 };
  if (fileId) {
    const downloaded = await request(fetchImpl, getToken, `${API}/${fileId}?alt=media`);
    stats = await mergeSnapshot(db, parseSnapshot(await downloaded.text()));
  }

  const syncedAt = now();
  const content = JSON.stringify(await exportSnapshot(db, syncedAt));
  const upload = fileId
    ? multipart({}, content)
    : multipart({ name: SYNC_FILE, parents: ['appDataFolder'] }, content);
  await request(
    fetchImpl,
    getToken,
    fileId ? `${UPLOAD}/${fileId}?uploadType=multipart` : `${UPLOAD}?uploadType=multipart`,
    { method: fileId ? 'PATCH' : 'POST', ...upload },
  );

  await setMeta(db, 'lastSyncAt', String(syncedAt));
  return { ...stats, created: !fileId, syncedAt };
}
