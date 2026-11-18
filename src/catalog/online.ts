import { CryptoDigestAlgorithm, digest } from 'expo-crypto';
import { fetch } from 'expo/fetch';

import { MAX_CATALOG_SET_BYTES } from './limits';

const BASE_URL = 'https://xururu13.github.io/cards-catalog/';
const MAX_INDEX_BYTES = 256 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;
const SET_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA256 = /^[a-f0-9]{64}$/;

export interface OnlineCatalogEntry {
  id: string;
  title: string;
  source?: string;
  sectionCount: number;
  cardCount: number;
  sha256: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

function parseIndex(text: string): OnlineCatalogEntry[] {
  const invalid = () => new Error('Не удалось прочитать список наборов.');
  let index: unknown;
  try {
    index = JSON.parse(text);
  } catch {
    throw invalid();
  }
  if (!isRecord(index) || index.version !== 1 || !Array.isArray(index.sets)) throw invalid();
  const ids = new Set<string>();
  return index.sets.map((entry: unknown) => {
    if (!isRecord(entry)) throw invalid();
    const { id, title, source, sectionCount, cardCount, sha256 } = entry;
    if (
      typeof id !== 'string' || id.length > 80 || !SET_ID.test(id) || ids.has(id) ||
      typeof title !== 'string' || !title.trim() || title.length > 200 ||
      (source !== undefined && (typeof source !== 'string' || source.length > 500)) ||
      !isCount(sectionCount) || !isCount(cardCount) || cardCount < sectionCount ||
      typeof sha256 !== 'string' || !SHA256.test(sha256)
    ) {
      throw invalid();
    }
    ids.add(id);
    return { id, title, source, sectionCount, cardCount, sha256 };
  });
}

async function download(
  path: string,
  maxBytes: number,
  controller: AbortController,
): Promise<Uint8Array<ArrayBuffer>> {
  const url = BASE_URL + path;
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const networkError = () => new Error('Не удалось скачать файл. Проверь подключение и попробуй снова.');
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'error',
      credentials: 'omit',
    }).catch(() => {
      throw networkError();
    });
    if (!response.ok || response.url !== url || !response.body) {
      controller.abort();
      throw new Error('Файл недоступен. Обнови список наборов и попробуй снова.');
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read().catch(() => {
          throw networkError();
        });
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) {
          controller.abort();
          throw new Error('Файл каталога превышает допустимый размер.');
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  } finally {
    clearTimeout(timeout);
  }
}

export async function loadOnlineCatalog(controller: AbortController): Promise<OnlineCatalogEntry[]> {
  const bytes = await download('catalog.json', MAX_INDEX_BYTES, controller);
  return parseIndex(new TextDecoder().decode(bytes));
}

export async function downloadOnlineSet(
  entry: OnlineCatalogEntry,
  controller: AbortController,
): Promise<string> {
  const { id, sha256 } = entry;
  if (!SET_ID.test(id) || !SHA256.test(sha256)) throw new Error('Неверный адрес файла набора.');
  const bytes = await download(`sets/${id}-${sha256}.yaml`, MAX_CATALOG_SET_BYTES, controller);
  const hash = new Uint8Array(await digest(CryptoDigestAlgorithm.SHA256, bytes));
  const actual = Array.from(hash, (byte) => byte.toString(16).padStart(2, '0')).join('');
  if (actual !== sha256) throw new Error('Файл не совпадает с версией каталога. Обнови список.');
  return new TextDecoder().decode(bytes);
}
