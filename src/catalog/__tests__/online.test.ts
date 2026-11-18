import { createHash } from 'node:crypto';
import { TextDecoder } from 'node:util';
import { fetch } from 'expo/fetch';

import { downloadOnlineSet, loadOnlineCatalog } from '../online';

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digest: async (_algorithm: string, bytes: Uint8Array) => {
    const { createHash } = process.getBuiltinModule('node:crypto');
    return Uint8Array.from(createHash('sha256').update(bytes).digest()).buffer;
  },
}));

const origin = 'https://xururu13.github.io/cards-catalog/';
const yaml = 'id: algebra-7\ntitle: Алгебра';
const bytes = Buffer.from(yaml);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const entry = { id: 'algebra-7', title: 'Алгебра', sectionCount: 1, cardCount: 3, sha256 };

function reply(body: Uint8Array, responseUrl?: string) {
  jest.mocked(fetch).mockImplementationOnce(async (url) => {
    const read = jest.fn()
      .mockResolvedValueOnce({ done: false, value: body })
      .mockResolvedValueOnce({ done: true });
    return {
      ok: true,
      url: responseUrl ?? url,
      body: { getReader: () => ({ read, releaseLock: jest.fn() }) },
    } as unknown as Awaited<ReturnType<typeof fetch>>;
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  if (!globalThis.TextDecoder) {
    Object.defineProperty(globalThis, 'TextDecoder', { value: TextDecoder, configurable: true });
  }
});

it('loads the manifest and downloads exactly the version it describes', async () => {
  reply(Buffer.from(JSON.stringify({ version: 1, sets: [entry] })));
  reply(bytes);
  const controller = new AbortController();
  const [available] = await loadOnlineCatalog(controller);
  expect(available).toMatchObject(entry);
  await expect(downloadOnlineSet(available, controller)).resolves.toBe(yaml);
  expect(jest.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([
    origin + 'catalog.json',
    origin + `sets/${entry.id}-${sha256}.yaml`,
  ]);
});

it('refuses an invalid ID and a response from another URL', async () => {
  const controller = new AbortController();
  await expect(downloadOnlineSet({ ...entry, id: '../other' }, controller)).rejects.toThrow(/адрес/);
  expect(fetch).not.toHaveBeenCalled();
  reply(bytes, 'https://example.com/other.yaml');
  await expect(downloadOnlineSet(entry, controller)).rejects.toThrow(/недоступен/);
});

it('rejects corrupted assets and stops oversized downloads', async () => {
  reply(Buffer.from('different data'));
  await expect(downloadOnlineSet(entry, new AbortController())).rejects.toThrow(/не совпадает/);

  const controller = new AbortController();
  reply(new Uint8Array(256 * 1024 + 1));
  await expect(loadOnlineCatalog(controller)).rejects.toThrow(/размер/);
  expect(controller.signal.aborted).toBe(true);
});
