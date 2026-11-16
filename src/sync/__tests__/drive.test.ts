import { createCard, getCard, updateCard } from '@/db/cards';
import { createDeck, listDecks } from '@/db/decks';
import { getMeta } from '@/db/meta';
import { openMigratedDb } from '@/db/test-db';

import { DriveError, SYNC_FILE, syncWithDrive, type GetToken } from '../drive';

jest.mock('@/db/ids', () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
});

/** Поддельный Google Drive: одна скрытая папка приложения в памяти. */
function fakeDrive() {
  const files = new Map<string, { name: string; content: string }>();
  const calls: string[] = [];
  let nextId = 1;
  let rejectToken: string | null = null;

  const parseMultipart = (body: string) => {
    const parts = body.split(/--kartochki-\d+/).filter((p) => p.includes('\r\n\r\n'));
    const [metadata, content] = parts.map((p) => p.split('\r\n\r\n')[1].replace(/\r\n$/, ''));
    return { metadata: JSON.parse(metadata), content };
  };

  const fetchImpl = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? 'GET';
    const auth = (init.headers as Record<string, string>).Authorization;
    calls.push(`${method} ${url.pathname}`);
    const json = (status: number, data: unknown) =>
      new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

    if (auth === `Bearer ${rejectToken}`) return json(401, {});
    if (method === 'GET' && url.pathname === '/drive/v3/files') {
      expect(url.searchParams.get('spaces')).toBe('appDataFolder');
      const found = [...files].filter(([, f]) => f.name === SYNC_FILE).map(([id]) => ({ id }));
      return json(200, { files: found });
    }
    const id = url.pathname.split('/').at(-1)!;
    if (method === 'GET') return new Response(files.get(id)!.content, { status: 200 });
    const { metadata, content } = parseMultipart(String(init.body));
    if (method === 'POST') {
      expect(metadata.parents).toEqual(['appDataFolder']);
      files.set(String(nextId), { name: metadata.name, content });
      return json(200, { id: String(nextId++) });
    }
    files.set(id, { ...files.get(id)!, content });
    return json(200, { id });
  }) as typeof fetch;

  return {
    files,
    calls,
    fetchImpl,
    rejectNextToken: (token: string) => (rejectToken = token),
  };
}

const token: GetToken = async (refresh) => (refresh ? 'fresh' : 'cached');

describe('syncWithDrive', () => {
  it('первая синхронизация создаёт файл в скрытой папке приложения', async () => {
    const drive = fakeDrive();
    const { db } = await openMigratedDb();
    await createDeck(db, { name: 'English', frontLang: 'en-US', backLang: 'ru-RU' });

    const result = await syncWithDrive(db, token, drive.fetchImpl, () => 1000);

    expect(result).toEqual({ changed: 0, created: true, syncedAt: 1000 });
    expect(drive.calls).toEqual(['GET /drive/v3/files', 'POST /upload/drive/v3/files']);
    expect(JSON.parse(drive.files.get('1')!.content).decks[0].name).toBe('English');
    expect(await getMeta(db, 'lastSyncAt')).toBe('1000');
  });

  it('два устройства обмениваются правками через Диск', async () => {
    const drive = fakeDrive();
    const phone = await openMigratedDb();
    const tablet = await openMigratedDb();
    const deckId = await createDeck(phone.db, { name: 'English', frontLang: 'en-US', backLang: 'ru-RU' }, 100);
    const cat = await createCard(phone.db, deckId, { front: 'cat', back: 'кот' }, 100);
    await syncWithDrive(phone.db, token, drive.fetchImpl);

    const pulled = await syncWithDrive(tablet.db, token, drive.fetchImpl);
    expect(pulled.created).toBe(false);
    expect(pulled.changed).toBeGreaterThan(0);
    expect((await listDecks(tablet.db)).map((d) => d.name)).toEqual(['English']);

    await updateCard(tablet.db, cat, { front: 'cat', back: 'кошка' }, 200);
    await syncWithDrive(tablet.db, token, drive.fetchImpl);
    await syncWithDrive(phone.db, token, drive.fetchImpl);

    expect((await getCard(phone.db, cat))?.back).toBe('кошка');
    expect(drive.files.size).toBe(1);
    expect(drive.calls.filter((c) => c.startsWith('PATCH'))).toHaveLength(3);
  });

  it('при отклонённом токене берёт новый и повторяет запрос', async () => {
    const drive = fakeDrive();
    const { db } = await openMigratedDb();
    drive.rejectNextToken('cached');
    const tokens: boolean[] = [];

    await syncWithDrive(
      db,
      async (refresh) => {
        tokens.push(refresh);
        return refresh ? 'fresh' : 'cached';
      },
      drive.fetchImpl,
    );
    expect(tokens.slice(0, 2)).toEqual([false, true]);
  });

  it('сообщает понятную ошибку, если Drive API не включён', async () => {
    const { db } = await openMigratedDb();
    const forbidden = (async () => new Response('{}', { status: 403 })) as typeof fetch;

    const sync = syncWithDrive(db, token, forbidden);
    await expect(sync).rejects.toBeInstanceOf(DriveError);
    await expect(syncWithDrive(db, token, forbidden)).rejects.toThrow(/Drive API/);
    expect(await getMeta(db, 'lastSyncAt')).toBeNull();
  });
});
